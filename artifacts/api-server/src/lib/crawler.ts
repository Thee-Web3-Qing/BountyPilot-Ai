import { db } from "@workspace/db";
import { bountiesTable } from "@workspace/db";
import { eq, isNull, and, like, isNotNull } from "drizzle-orm";
import { scrapeBounty, stripHtml } from "./scraper.js";
import { analyzeBounty } from "./qwen.js";
import { logger } from "./logger.js";
import { fetchWithBrowser } from "./browser.js";

export interface CrawlPlatformResult {
  platform: string;
  attempted: number;
  added: number;
  skipped: number;
  error?: string;
  durationMs: number;
}

export interface CrawlerStatus {
  isRunning: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResults: CrawlPlatformResult[];
  totalAddedLastRun: number;
  totalCrawledBounties: number;
}

const status: CrawlerStatus = {
  isRunning: false,
  lastRunAt: null,
  nextRunAt: null,
  lastResults: [],
  totalAddedLastRun: 0,
  totalCrawledBounties: 0,
};

export function getCrawlerStatus(): CrawlerStatus {
  return { ...status };
}

// ─────────────────────────────────────────────────────────────
// PLATFORM CONFIGS
// ─────────────────────────────────────────────────────────────

interface PlatformBountyHint {
  url: string;
  title?: string;
  rewardAmount?: string;
  rewardCurrency?: string;
  deadline?: string;
  projectName?: string;
  description?: string;
}

interface PlatformConfig {
  name: string;
  listingUrl: string;
  fetchLinks: (html: string, baseUrl: string) => PlatformBountyHint[];
  maxBounties?: number;
}

// Link extraction patterns used by most platforms
const BOUNTY_PATH_PATTERNS = [
  /\/listing\/[^"'\s>?#]+/gi,
  /\/bounty\/[^"'\s>?#]+/gi,
  /\/earn\/[^"'\s>?#]+/gi,
  /\/task\/[^"'\s>?#]+/gi,
  /\/quest\/[^"'\s>?#]+/gi,
  /\/mission\/[^"'\s>?#]+/gi,
  /\/opportunity\/[^"'\s>?#]+/gi,
  /\/campaign\/[^"'\s>?#]+/gi,
  /\/challenge\/[^"'\s>?#]+/gi,
  /\/program\/[^"'\s>?#]+/gi,
  /\/bounties\/[a-z0-9-]{8,}/gi,
];

function genericLinkExtractor(html: string, baseUrl: string): PlatformBountyHint[] {
  const domain = new URL(baseUrl).origin;
  const seen = new Set<string>();
  const hints: PlatformBountyHint[] = [];

  for (const pattern of BOUNTY_PATH_PATTERNS) {
    const matches = html.matchAll(pattern);
    for (const m of matches) {
      const path = m[0];
      const full = path.startsWith("http") ? path : `${domain}${path}`;
      const clean = full.split("?")[0].replace(/\/$/, "");
      if (!seen.has(clean) && clean.length > domain.length + 8) {
        seen.add(clean);
        hints.push({ url: clean });
      }
    }
    pattern.lastIndex = 0;
  }
  return hints.slice(0, 10);
}

// ─── Superteam Earn — public JSON API ───────────────────────
async function fetchSuperteam(): Promise<PlatformBountyHint[]> {
  try {
    const resp = await fetch("https://earn.superteam.fun/api/listings?limit=10", {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; BountyPilot/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as Array<Record<string, unknown>>;
    const items = Array.isArray(data) ? data : (data as Record<string, unknown[]>).bounties || [];
    return (items as Array<Record<string, unknown>>)
      .filter((b) => b.type !== "hackathon" && b.status === "OPEN")
      .slice(0, 8)
      .map((b) => {
        const sponsor = b.sponsor as Record<string, unknown> | undefined;
        return {
          url: `https://earn.superteam.fun/listing/${b.slug}`,
          title: b.title as string | undefined,
          rewardAmount: b.rewardAmount != null ? String(b.rewardAmount) : undefined,
          rewardCurrency: (b.token as string | undefined) || "USDC",
          deadline: b.deadline as string | undefined,
          projectName: (sponsor?.name as string | undefined) || (b.sponsorName as string | undefined),
        };
      });
  } catch (e) {
    logger.warn({ err: e }, "Superteam API fetch failed");
    return [];
  }
}

// ─── First Dollar — public JSON API ─────────────────────────
async function fetchFirstDollar(): Promise<PlatformBountyHint[]> {
  try {
    const resp = await fetch("https://app.firstdollar.money/api/bounties?limit=12&status=open", {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; BountyPilot/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as { success?: boolean; data?: Array<Record<string, unknown>> };
    const items = (data.data || []).filter((b) => b.status !== "completed").slice(0, 8);

    // Enrich with individual bounty data for reward/deadline
    const hints: PlatformBountyHint[] = await Promise.all(
      items.map(async (b) => {
        let rewardAmount: string | undefined;
        let rewardCurrency: string | undefined;
        let deadline: string | undefined;
        let projectName: string | undefined;

        try {
          const detail = await fetch(`https://app.firstdollar.money/api/bounties/${b.id}`, {
            headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; BountyPilot/1.0)" },
            signal: AbortSignal.timeout(8000),
          });
          if (detail.ok) {
            const dData = await detail.json() as { data?: Record<string, unknown> };
            const d = dData.data || {};
            const prize = d.totalPrizePool ?? d.firstPlacePrize ?? d.prizePool;
            rewardAmount = prize != null ? String(prize) : undefined;
            rewardCurrency = (d.paymentTokenName as string | undefined) || (d.paymentToken as string | undefined) || "USDC";
            const dl = (d.submissionDeadline ?? d.applicationDeadline ?? d.deadline) as string | undefined;
            if (dl) {
              try { deadline = new Date(dl).toISOString().split("T")[0]; } catch {}
            }
            const co = d.company as Record<string, unknown> | undefined;
            projectName = (co?.name as string | undefined) || (d.companyName as string | undefined);
          }
        } catch {}

        return {
          url: `https://app.firstdollar.money/bounties/${b.id}`,
          title: b.title as string | undefined,
          projectName,
          rewardAmount,
          rewardCurrency,
          deadline,
        };
      })
    );
    return hints;
  } catch (e) {
    logger.warn({ err: e }, "First Dollar API fetch failed");
    return [];
  }
}

// ─── Gitcoin Grants — public rounds API ─────────────────────
async function fetchGitcoin(): Promise<PlatformBountyHint[]> {
  try {
    // Gitcoin pivoted to Grants Stack — fetch active rounds
    const resp = await fetch(
      "https://grants-stack-indexer-v2.gitcoin.co/api/v1/rounds?first=6&orderBy=createdAtBlock&orderDirection=desc&chainId=1",
      {
        headers: { Accept: "application/json", "User-Agent": "BountyPilot/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
      }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as { rounds?: Array<Record<string, unknown>> };
    return (data.rounds || []).slice(0, 5).map((r) => ({
      url: `https://explorer.gitcoin.co/#/round/${r.chainId}/${r.id}`,
      title: r.roundMetadata ? (r.roundMetadata as Record<string, unknown>).name as string : (r.id as string),
      projectName: "Gitcoin Grants",
      description: r.roundMetadata ? (r.roundMetadata as Record<string, unknown>).description as string : undefined,
    }));
  } catch (e) {
    logger.warn({ err: e }, "Gitcoin Grants API fetch failed");
    return [];
  }
}

// ─── Generic HTML fetcher with Next.js data extraction ──────
async function fetchGenericListing(config: PlatformConfig): Promise<PlatformBountyHint[]> {
  try {
    const resp = await fetch(config.listingUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BountyPilot/1.0)",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();

    // Try __NEXT_DATA__ JSON first
    const nextMatch = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([^<]+)<\/script>/i);
    if (nextMatch) {
      try {
        const nextData = JSON.parse(nextMatch[1]);
        const str = JSON.stringify(nextData);
        const slugMatches = str.match(/"slug":"([^"]+)"/g);
        if (slugMatches && slugMatches.length > 0) {
          const domain = new URL(config.listingUrl).origin;
          return slugMatches.slice(0, 8).map((s) => {
            const slug = s.replace(/"slug":"/, "").replace(/"$/, "");
            return { url: `${domain}/listing/${slug}` };
          });
        }
      } catch {}
    }

    const links = config.fetchLinks(html, config.listingUrl);
    if (links.length > 0) return links;

    // Fallback: try headless browser for SPAs that returned empty HTML
    logger.info({ platform: config.name }, "Falling back to headless browser");
    try {
      const renderedHtml = await fetchWithBrowser(config.listingUrl, 25000);
      return config.fetchLinks(renderedHtml, config.listingUrl);
    } catch (browserErr) {
      logger.warn({ platform: config.name, err: (browserErr as Error).message }, "Browser fallback failed");
      return [];
    }
  } catch (e) {
    logger.warn({ platform: config.name, err: (e as Error).message }, "Generic HTML fetch failed");
    // Still try browser
    try {
      const renderedHtml = await fetchWithBrowser(config.listingUrl, 25000);
      return config.fetchLinks(renderedHtml, config.listingUrl);
    } catch {
      return [];
    }
  }
}

// ─── Strip HTML from stored requirements/description fields ─
async function fixHtmlInRequirements(): Promise<void> {
  try {
    const rows = await db
      .select({
        id: bountiesTable.id,
        submissionRequirements: bountiesTable.submissionRequirements,
        eligibilityRules: bountiesTable.eligibilityRules,
        deliverables: bountiesTable.deliverables,
      })
      .from(bountiesTable)
      .where(isNull(bountiesTable.userId));

    let fixed = 0;
    for (const row of rows) {
      const hasHtml =
        /<[a-z][^>]*>/i.test(row.submissionRequirements || "") ||
        /<[a-z][^>]*>/i.test(row.eligibilityRules || "") ||
        /<[a-z][^>]*>/i.test(row.deliverables || "");
      if (!hasHtml) continue;

      await db
        .update(bountiesTable)
        .set({
          submissionRequirements: row.submissionRequirements
            ? stripHtml(row.submissionRequirements).slice(0, 600) : row.submissionRequirements,
          eligibilityRules: row.eligibilityRules
            ? stripHtml(row.eligibilityRules) : row.eligibilityRules,
          deliverables: row.deliverables
            ? stripHtml(row.deliverables) : row.deliverables,
        })
        .where(eq(bountiesTable.id, row.id));
      fixed++;
    }
    if (fixed > 0) logger.info({ fixed }, "Stripped HTML from requirements fields");
  } catch (err) {
    logger.warn({ err }, "fixHtmlInRequirements failed");
  }
}

// ─── Fix stale "unspecified reward" score explanations ──────
async function fixUnspecifiedBounties(): Promise<void> {
  try {
    const stale = await db
      .select()
      .from(bountiesTable)
      .where(
        and(
          isNull(bountiesTable.userId),
          isNotNull(bountiesTable.rewardAmount),
          like(bountiesTable.scoreExplanation, "%unspecified reward%")
        )
      );

    for (const bounty of stale) {
      const hasReward = bounty.rewardAmount && Number(bounty.rewardAmount) > 0;
      const reward = hasReward ? `${bounty.rewardAmount} ${bounty.rewardCurrency || "USDC"}` : null;
      const dl = bounty.deadline
        ? Math.round((new Date(bounty.deadline).getTime() - Date.now()) / 86400000)
        : null;
      const deadlineNote = dl !== null ? `${dl} days until deadline` : "no deadline specified";
      const score = bounty.opportunityScore ?? 5;
      const verdict =
        score >= 7 ? "Strong opportunity — clear deliverables and solid reward."
        : score >= 5 ? "Moderate opportunity — worth pursuing if format aligns with your strengths."
        : "Lower priority — limited reward or tight timeline.";
      const rewardPart = reward ? `${reward} reward` : "reward listed on platform";
      const newExplanation = `Score ${score}/10: ${rewardPart}. ${deadlineNote}. Format: ${bounty.contentFormat || "open"}. ${verdict}`;

      await db
        .update(bountiesTable)
        .set({ scoreExplanation: newExplanation })
        .where(eq(bountiesTable.id, bounty.id));
    }

    if (stale.length > 0) {
      logger.info({ fixed: stale.length }, "Fixed unspecified reward explanations (with reward)");
    }

    // Also fix entries where rewardAmount IS null — just clean up the text
    const nullRewardStale = await db
      .select({ id: bountiesTable.id, platform: bountiesTable.platform, contentFormat: bountiesTable.contentFormat, opportunityScore: bountiesTable.opportunityScore, deadline: bountiesTable.deadline })
      .from(bountiesTable)
      .where(
        and(
          isNull(bountiesTable.userId),
          isNull(bountiesTable.rewardAmount),
          like(bountiesTable.scoreExplanation, "%unspecified reward%")
        )
      );

    for (const bounty of nullRewardStale) {
      const score = bounty.opportunityScore ?? 5;
      const dl = bounty.deadline
        ? Math.round((new Date(bounty.deadline).getTime() - Date.now()) / 86400000)
        : null;
      const deadlineNote = dl !== null ? (dl < 0 ? "deadline passed" : `${dl} days to deadline`) : "open deadline";
      const verdict =
        score >= 7 ? "Strong pick — solid reward and clear deliverables."
        : score >= 5 ? "Worth pursuing if the format fits your strengths."
        : "Lower priority — limited reward or tight timeline.";
      const newExplanation = `Score ${score}/10: reward listed on platform. ${deadlineNote}. Format: ${bounty.contentFormat || "open"}. ${verdict}`;

      await db
        .update(bountiesTable)
        .set({ scoreExplanation: newExplanation })
        .where(eq(bountiesTable.id, bounty.id));
    }

    if (nullRewardStale.length > 0) {
      logger.info({ fixed: nullRewardStale.length }, "Fixed unspecified reward text (no reward data)");
    }

    // Also fix entries where rewardAmount = "0" — "$0 USDC" is worse than "reward listed on platform"
    const zeroRewardStale = await db
      .select({ id: bountiesTable.id, platform: bountiesTable.platform, contentFormat: bountiesTable.contentFormat, opportunityScore: bountiesTable.opportunityScore, deadline: bountiesTable.deadline })
      .from(bountiesTable)
      .where(
        and(
          isNull(bountiesTable.userId),
          eq(bountiesTable.rewardAmount, "0"),
        )
      );

    for (const bounty of zeroRewardStale) {
      const score = bounty.opportunityScore ?? 4;
      const dl = bounty.deadline
        ? Math.round((new Date(bounty.deadline).getTime() - Date.now()) / 86400000)
        : null;
      const deadlineNote = dl !== null ? (dl < 0 ? "deadline passed" : dl === 0 ? "deadline today" : `${dl} days to deadline`) : "open deadline";
      const verdict =
        score >= 7 ? "Strong pick — solid reward and clear deliverables."
        : score >= 5 ? "Worth pursuing if the format fits your strengths."
        : "Lower priority — limited reward or tight timeline.";
      const newExplanation = `Score ${score}/10: reward listed on platform. ${deadlineNote}. Format: ${bounty.contentFormat || "open"}. ${verdict}`;

      await db
        .update(bountiesTable)
        .set({ scoreExplanation: newExplanation })
        .where(eq(bountiesTable.id, bounty.id));
    }

    if (zeroRewardStale.length > 0) {
      logger.info({ fixed: zeroRewardStale.length }, "Fixed $0 reward entries");
    }
  } catch (err) {
    logger.warn({ err }, "fixUnspecifiedBounties failed");
  }
}

// ─────────────────────────────────────────────────────────────
// PLATFORM REGISTRY
// ─────────────────────────────────────────────────────────────

const PLATFORMS: PlatformConfig[] = [
  {
    name: "Superteam Earn",
    listingUrl: "https://earn.superteam.fun/bounties",
    fetchLinks: genericLinkExtractor,
    maxBounties: 8,
  },
  {
    name: "First Dollar",
    listingUrl: "https://app.firstdollar.money/bounties",
    fetchLinks: genericLinkExtractor,
    maxBounties: 6,
  },
  {
    name: "Hashly/GibWork",
    listingUrl: "https://hashly.space/bounty",
    fetchLinks: genericLinkExtractor,
    maxBounties: 5,
  },
  {
    name: "Cre8core",
    listingUrl: "https://cre8core.fun",
    fetchLinks: genericLinkExtractor,
    maxBounties: 5,
  },
  {
    name: "Klout",
    listingUrl: "https://klout.gg",
    fetchLinks: (html, base) => {
      const hints = genericLinkExtractor(html, base);
      if (hints.length === 0) return [{ url: "https://klout.gg" }];
      return hints;
    },
    maxBounties: 5,
  },
  {
    name: "Arena Social",
    listingUrl: "https://arena.social",
    fetchLinks: genericLinkExtractor,
    maxBounties: 5,
  },
  {
    name: "Duel Duck",
    listingUrl: "https://duelduck.com",
    fetchLinks: genericLinkExtractor,
    maxBounties: 5,
  },
  {
    name: "WPL Earn",
    listingUrl: "https://thewp1.xyz",
    fetchLinks: genericLinkExtractor,
    maxBounties: 5,
  },
  {
    name: "Rova",
    listingUrl: "https://rova.xyz",
    fetchLinks: genericLinkExtractor,
    maxBounties: 5,
  },
  {
    name: "MindoAI",
    listingUrl: "https://mindoshare.ai",
    fetchLinks: genericLinkExtractor,
    maxBounties: 5,
  },
  {
    name: "Scribble",
    listingUrl: "https://scribble.network",
    fetchLinks: genericLinkExtractor,
    maxBounties: 5,
  },
  {
    name: "ElevenLabs Creative",
    listingUrl: "https://elevenlabs.io/creators",
    fetchLinks: genericLinkExtractor,
    maxBounties: 5,
  },
  {
    name: "WizzHQ",
    listingUrl: "https://wizzhq.xyz",
    fetchLinks: genericLinkExtractor,
    maxBounties: 5,
  },
  {
    name: "Scouts",
    listingUrl: "https://scouts.yutori.com",
    fetchLinks: genericLinkExtractor,
    maxBounties: 5,
  },
  {
    name: "Anthum AI",
    listingUrl: "https://anthum.ai",
    fetchLinks: genericLinkExtractor,
    maxBounties: 5,
  },
  {
    name: "Layer3",
    listingUrl: "https://layer3.xyz/quests",
    fetchLinks: (html, base) => {
      const hints = genericLinkExtractor(html, base);
      return hints.filter((h) => h.url.includes("/quests/") || h.url.includes("/bounty/")).slice(0, 6);
    },
    maxBounties: 6,
  },
  {
    name: "Dework",
    listingUrl: "https://app.dework.xyz/bounties",
    fetchLinks: genericLinkExtractor,
    maxBounties: 5,
  },
  {
    name: "Whop",
    listingUrl: "https://whop.com/discover",
    fetchLinks: genericLinkExtractor,
    maxBounties: 5,
  },
  {
    name: "Immunefi",
    listingUrl: "https://immunefi.com/bug-bounty",
    fetchLinks: (html, base) => {
      const hints = genericLinkExtractor(html, base);
      return hints.filter((h) => h.url.includes("/bug-bounty/")).slice(0, 5);
    },
    maxBounties: 5,
  },
  {
    name: "Gitcoin",
    listingUrl: "https://explorer.gitcoin.co",
    fetchLinks: genericLinkExtractor,
    maxBounties: 6,
  },
];

// ─────────────────────────────────────────────────────────────
// CORE CRAWL LOGIC
// ─────────────────────────────────────────────────────────────

async function getExistingUrls(): Promise<Set<string>> {
  const rows = await db.select({ url: bountiesTable.url }).from(bountiesTable);
  return new Set(rows.map((r) => r.url));
}

async function storeBountyHint(hint: PlatformBountyHint, platform: string): Promise<boolean> {
  try {
    const scraped = await scrapeBounty(hint.url);

    // Merge API hint data over scraped data — API is authoritative for reward/deadline
    const merged = {
      ...scraped,
      rewardAmount: hint.rewardAmount || scraped.rewardAmount,
      rewardCurrency: hint.rewardCurrency || scraped.rewardCurrency,
      deadline: hint.deadline || scraped.deadline,
    };

    const analysis = await analyzeBounty(merged);

    await db.insert(bountiesTable).values({
      userId: null,
      url: hint.url,
      title: hint.title || scraped.title,
      platform: scraped.platform || platform,
      projectName: hint.projectName || scraped.projectName,
      rewardAmount: merged.rewardAmount,
      rewardCurrency: merged.rewardCurrency,
      deadline: merged.deadline,
      contentFormat: scraped.contentFormat,
      submissionRequirements: scraped.submissionRequirements,
      deliverables: scraped.deliverables,
      submissionLink: scraped.submissionLink,
      eligibilityRules: scraped.eligibilityRules,
      importantNotes: scraped.importantNotes,
      opportunityScore: analysis.opportunityScore,
      scoreExplanation: analysis.scoreExplanation,
      confidenceScore: scraped.confidenceScore,
      status: "discovered",
    });
    return true;
  } catch (e) {
    logger.warn({ url: hint.url, err: (e as Error).message }, "Failed to store bounty hint");
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function crawlPlatform(
  config: PlatformConfig,
  existingUrls: Set<string>,
  specialFetcher?: () => Promise<PlatformBountyHint[]>
): Promise<CrawlPlatformResult> {
  const start = Date.now();
  let added = 0;
  let skipped = 0;

  try {
    const hints = specialFetcher
      ? await specialFetcher()
      : await fetchGenericListing(config);

    const maxBounties = config.maxBounties || 5;
    const toProcess = hints.filter((h) => !existingUrls.has(h.url)).slice(0, maxBounties);
    skipped = hints.length - toProcess.length;

    for (const hint of toProcess) {
      const stored = await storeBountyHint(hint, config.name);
      if (stored) {
        added++;
        existingUrls.add(hint.url);
      }
      await sleep(1500); // Rate limit between individual bounty scrapes
    }

    logger.info({ platform: config.name, found: hints.length, added, skipped }, "Platform crawled");
    return { platform: config.name, attempted: toProcess.length, added, skipped, durationMs: Date.now() - start };
  } catch (e) {
    const err = (e as Error).message;
    logger.error({ platform: config.name, err }, "Platform crawl error");
    return { platform: config.name, attempted: 0, added: 0, skipped: 0, error: err, durationMs: Date.now() - start };
  }
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: CRAWL ALL PLATFORMS
// ─────────────────────────────────────────────────────────────

export async function crawlAll(): Promise<CrawlPlatformResult[]> {
  if (status.isRunning) {
    logger.info("Crawl already running, skipping");
    return [];
  }

  logger.info("Starting full platform crawl");
  status.isRunning = true;
  status.lastRunAt = new Date().toISOString();

  try {
    const existingUrls = await getExistingUrls();
    const results: CrawlPlatformResult[] = [];

    // Special fetchers for platforms with good APIs
    const superteamHints = await fetchSuperteam();
    const superteamResult = await crawlPlatform(
      PLATFORMS.find((p) => p.name === "Superteam Earn")!,
      existingUrls,
      () => Promise.resolve(superteamHints)
    );
    results.push(superteamResult);
    await sleep(2000);

    const firstDollarHints = await fetchFirstDollar();
    const firstDollarResult = await crawlPlatform(
      PLATFORMS.find((p) => p.name === "First Dollar")!,
      existingUrls,
      () => Promise.resolve(firstDollarHints)
    );
    results.push(firstDollarResult);
    await sleep(2000);

    const gitcoinHints = await fetchGitcoin();
    const gitcoinResult = await crawlPlatform(
      PLATFORMS.find((p) => p.name === "Gitcoin")!,
      existingUrls,
      () => Promise.resolve(gitcoinHints)
    );
    results.push(gitcoinResult);
    await sleep(2000);

    // Generic HTML scrapers for remaining platforms
    const remainingPlatforms = PLATFORMS.filter(
      (p) => p.name !== "Superteam Earn" && p.name !== "First Dollar" && p.name !== "Gitcoin"
    );

    for (const platform of remainingPlatforms) {
      const result = await crawlPlatform(platform, existingUrls);
      results.push(result);
      await sleep(2000); // 2s pause between platforms
    }

    const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
    const totalCrawled = await db
      .select({ url: bountiesTable.url })
      .from(bountiesTable)
      .where(isNull(bountiesTable.userId))
      .then((r) => r.length);

    status.lastResults = results;
    status.totalAddedLastRun = totalAdded;
    status.totalCrawledBounties = totalCrawled;

    // Clean HTML from stored text fields and fix stale score explanations
    await fixHtmlInRequirements();
    await fixUnspecifiedBounties();

    logger.info({ totalAdded, platforms: results.length }, "Crawl complete");
    return results;
  } finally {
    status.isRunning = false;
  }
}
