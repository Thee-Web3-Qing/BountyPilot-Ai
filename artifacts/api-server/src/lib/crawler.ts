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
  type?: string;
  prizeRank?: string;
  prizeBreakdown?: string;
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
  /\/bug-bounty\/[^"'\s>?#]+/gi,
  /\/earn\/[^"'\s>?#]+/gi,
  /\/task\/[^"'\s>?#]+/gi,
  /\/quest\/[^"'\s>?#]+/gi,
  /\/mission\/[^"'\s>?#]+/gi,
  /\/opportunity\/[^"'\s>?#]+/gi,
  /\/campaign\/[^"'\s>?#]+/gi,
  /\/challenge\/[^"'\s>?#]+/gi,
  /\/program\/[^"'\s>?#]+/gi,
  /\/job\/[^"'\s>?#]+/gi,
  /\/jobs\/[^"'\s>?#]+/gi,
  /\/contest\/[^"'\s>?#]+/gi,
  /\/competition\/[^"'\s>?#]+/gi,
  /\/hackathon\/[^"'\s>?#]+/gi,
  /\/grants\/[^"'\s>?#]+/gi,
  /\/position\/[^"'\s>?#]+/gi,
  /\/role\/[^"'\s>?#]+/gi,
  /\/work\/[^"'\s>?#]+/gi,
  /\/bounties\/[a-z0-9-]{8,}/gi,
];

const BAD_SLUGS = /(^|\/)(old-bounty|test-.*|demo-.*|sample-.*|placeholder-.*|undefined|fake-.*|bounty-.*)$/i;
const GOOD_SLUG_MIN = 4; // meaningful slugs are at least 4 chars

const NAV_PAGES = new Set([
  "about","privacy","terms","faq","help","login","signup","contact","blog",
  "careers","jobs","team","partners","press","sitemap","404","500","search",
  "explore","dashboard","profile","settings","notifications","wallet","account",
  "home","index","page","list","all","new","create","edit","delete","admin",
  "api","assets","static","js","css","images","fonts","uploads","downloads",
  "data","logs","tmp","temp","vendor","node_modules","dist","build","src",
  "test","tests","spec","specs","mock","mocks","fixtures","coverage","ci",
  "docs","documentation","guides","tutorials","examples","samples","templates",
  "layouts","components","modules","plugins","extensions","themes","styles",
  "scripts","icons","media","files","attachments","resources","public","private",
  "shared","common","utils","helpers","tools","tasks","workers","services",
  "handlers","controllers","models","views","routes","endpoints","gateways",
  "proxies","middleware","filters","interceptors","validators","serializers",
  "parsers","formatters","renderers","engines","generators","builders",
  "compilers","transpilers","minifiers","bundlers","packagers","deployers",
  "publishers","distributors","releasers","installers","updaters","upgraders",
  "migrators","importers","exporters","converters","transformers","adaptors",
  "wrappers","facades","decorators","enhancers","optimizers","analyzers",
  "profilers","debuggers","monitors","trackers","tracers","auditors","inspectors",
  "checkers","testers","reviewers","evaluators","assessors","scorers","rankers",
  "classifiers","taggers","labelers","categorizers","organizers","sorters",
  "groupers","clusterers","aggregators","collectors","gatherers","harvesters",
  "crawlers","spiders","bots","agents","clients","servers","hosts","nodes",
  "peers","hubs","caches","stores","repositories","databases","indexes",
  "registries","catalogs","directories","tables","grids","maps","charts","graphs",
  "diagrams","flowcharts","wireframes","prototypes","sketches","drafts",
  "outlines","summaries","abstracts","excerpts","snippets","clips","fragments",
  "segments","sections","parts","pieces","chunks","blocks","units","items",
  "elements","entities","objects","subjects","topics","themes","issues",
  "problems","questions","answers","solutions","fixes","patches","releases",
  "versions","commits","branches","tags","labels","milestones","changelog",
  "roadmap","backlog","sprint","epic","story","ticket","pull-request","merge",
  "compare","fork","clone","branch","tag","commit","release","deploy","build",
  "pipeline","action","workflow","job","step","stage","env","environment",
  "config","configuration","setting","preference","option","flag","feature",
  "toggle","switch","mode","theme","locale","language","region","timezone",
  "currency","unit","format","type","kind","category","class","group","set",
  "collection","array","list","map","dictionary","record","tuple","pair",
  "triple","range","interval","span","duration","period","frequency","rate",
  "ratio","percentage","proportion","fraction","decimal","integer","number",
  "count","amount","quantity","total","sum","average","mean","median","mode",
  "minimum","maximum","min","max","limit","threshold","boundary","cap","floor",
  "ceiling","quota","allowance","budget","allocation","share","portion","slice",
  "division","partition","split","merge","join","combine","aggregate","rollup",
  "progress","completion","status","state","condition","phase","level","tier",
  "grade","rank","rating","score","points","stars","badges","achievements",
  "accomplishments","certifications","credentials","qualifications","skills",
  "abilities","competencies","expertise","proficiency","mastery","experience",
  "background","history","log","audit","trail","record","archive","backup",
  "snapshot","checkpoint","save","restore","revert","undo","redo","reset",
  "refresh","reload","sync","synchronize","mirror","replicate","copy",
  "duplicate","clone","instance","spawn","create","init","setup","configure",
  "install","uninstall","remove","purge","clean","clear","empty","wipe",
  "erase","destroy","terminate","kill","stop","halt","pause","suspend",
  "resume","continue","start","launch","run","execute","perform","do",
  "make","generate","produce","output","render","draw","paint","compose",
  "write","modify","update","change","transform","convert","translate",
  "adapt","adjust","tune","calibrate","align","fit","match","pair","contrast",
  "diff","delta","patch","fix","repair","mend","heal","recover","buffer",
  "queue","stack","heap","pool","bucket","bin","container","package","bundle",
  "crate","module","library","framework","sdk","toolkit","platform","runtime",
  "vm","pod","service","function","lambda","daemon","cron","scheduler",
  "orchestrator","coordinator","manager","controller","supervisor","watcher",
  "observer","listener","handler","processor","consumer","producer","publisher",
  "subscriber","broker","router","gateway","proxy","relay","tunnel","vpn",
  "firewall","shield","guard","gate","door","lock","key","token","ticket",
  "pass","permit","license","authorization","permission","access","grant",
  "deny","reject","block","ban","allow","whitelist","blacklist","graylist",
  "safelist","blocklist","allowlist","denylist",
]);

const VALID_BOUNTY_SEGMENTS = new Set(["information", "scope", "resources", "submit", "apply", "details"]);

function isValidSlug(url: string): boolean {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    const lastSegment = segments.pop() || "";
    if (BAD_SLUGS.test(lastSegment)) return false;
    if (lastSegment.length < GOOD_SLUG_MIN) return false;
    if (NAV_PAGES.has(lastSegment.toLowerCase())) {
      // Allow known valid bounty sub-paths (e.g. /bug-bounty/ethena/information/)
      if (!VALID_BOUNTY_SEGMENTS.has(lastSegment.toLowerCase())) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function verifyUrl(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BountyPilot/1.0)" },
    });
    return { ok: resp.status >= 200 && resp.status < 400, status: resp.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

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
      if (!seen.has(clean) && clean.length > domain.length + 8 && isValidSlug(clean)) {
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

    // Fetch detailed data for each bounty to get prize breakdown
    const hints: PlatformBountyHint[] = await Promise.all(
      (items as Array<Record<string, unknown>>)
        .filter((b) => b.status === "OPEN")
        .slice(0, 10)
        .map(async (b) => {
          const slug = b.slug as string | undefined;
          const sponsor = b.sponsor as Record<string, unknown> | undefined;
          const listingType = b.type as string | undefined;
          const hint: PlatformBountyHint = {
            url: `https://earn.superteam.fun/listing/${slug}`,
            title: b.title as string | undefined,
            rewardAmount: b.rewardAmount != null ? String(b.rewardAmount) : undefined,
            rewardCurrency: (b.token as string | undefined) || "USDC",
            deadline: b.deadline as string | undefined,
            projectName: (sponsor?.name as string | undefined) || (b.sponsorName as string | undefined),
            type: listingType === "project" ? "Job" : undefined,
          };

          // Fetch detailed listing for prize breakdown
          if (slug) {
            try {
              const detail = await fetch(`https://earn.superteam.fun/api/listings/${slug}`, {
                headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; BountyPilot/1.0)" },
                signal: AbortSignal.timeout(8000),
              });
              if (detail.ok) {
                const dData = await detail.json() as Record<string, unknown>;
                const prizes = dData.prizes as Array<Record<string, unknown>> | undefined;
                if (prizes && prizes.length > 0) {
                  const breakdown = prizes.map((p) => ({
                    rank: (p.rank as string) || (p.label as string) || "",
                    amount: String(p.amount ?? p.reward ?? p.value ?? ""),
                    currency: hint.rewardCurrency || "USDC",
                    count: (p.count as number) ?? undefined,
                  })).filter((p) => p.amount && p.rank);
                  if (breakdown.length > 0) {
                    hint.prizeBreakdown = JSON.stringify(breakdown);
                  }
                }
                // Also look for prizeDistribution field
                const pd = dData.prizeDistribution as Array<Record<string, unknown>> | undefined;
                if (pd && pd.length > 0 && !hint.prizeBreakdown) {
                  const breakdown = pd.map((p) => ({
                    rank: (p.rank as string) || (p.label as string) || (p.position as string) || "",
                    amount: String(p.amount ?? p.reward ?? p.value ?? ""),
                    currency: hint.rewardCurrency || "USDC",
                    count: (p.count as number) ?? undefined,
                  })).filter((p) => p.amount && p.rank);
                  if (breakdown.length > 0) {
                    hint.prizeBreakdown = JSON.stringify(breakdown);
                  }
                }
              }
            } catch {}
          }

          return hint;
        })
    );
    return hints;
  } catch (e) {
    logger.warn({ err: e }, "Superteam API fetch failed");
    return [];
  }
}

// ─── First Dollar — public JSON API ─────────────────────────
async function fetchFirstDollar(): Promise<PlatformBountyHint[]> {
  try {
    const resp = await fetch("https://app.firstdollar.money/api/bounties?limit=12", {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; BountyPilot/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as { success?: boolean; data?: Array<Record<string, unknown>> };
    const items = (data.data || []).filter((b) => b.status === "published").slice(0, 8);

    // Enrich with individual bounty data for reward/deadline
    const hints: PlatformBountyHint[] = await Promise.all(
      items.map(async (b) => {
        let rewardAmount: string | undefined;
        let rewardCurrency: string | undefined;
        let deadline: string | undefined;
        let projectName: string | undefined;

        let prizeRank: string | undefined;
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
            // Extract prize distribution — prizeDistribution is a JSON string
            try {
              const pdRaw = d.prizeDistribution as string | undefined;
              if (pdRaw) {
                const pd = JSON.parse(pdRaw) as { prizes?: Array<{ rank: string; amount: number }> };
                if (pd.prizes && pd.prizes.length > 0) {
                  const count = pd.prizes.length;
                  prizeRank = count >= 10 ? "1st-10th+" : count >= 3 ? `1st-${count}th` : "1st-3rd";
                }
              }
            } catch {}
          }
        } catch {}

        const company = b.company as Record<string, unknown> | undefined;
        const companyUsername = (company?.username as string | undefined) || (company?.name as string | undefined)?.toLowerCase().replace(/\s+/g, "-");
        const slug = b.slug as string | undefined;
        const url = companyUsername && slug
          ? `https://app.firstdollar.money/company/${companyUsername}/bounty/${slug}`
          : `https://app.firstdollar.money/bounties/${b.id}`;
        return {
          url,
          title: b.title as string | undefined,
          projectName,
          rewardAmount,
          rewardCurrency,
          deadline,
          prizeRank,
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
  // Gitcoin's grants API is no longer publicly available; rely on generic HTML scraper
  return [];
}

// ─── Devpost — public hackathons API ────────────────────────
async function fetchDevpost(): Promise<PlatformBountyHint[]> {
  try {
    const url = `https://devpost.com/api/hackathons?status=open&per_page=40&page=1`;
    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; BountyPilot/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as { hackathons?: Array<Record<string, unknown>>; meta?: { total_count: number } };
    const hackathons = data.hackathons || [];
    return hackathons.slice(0, 10).map((h) => {
      const title = (h.title as string) || "";
      const rawReward = (h.prize_amount as string) || (h.total_prize_value as string) || undefined;
      const tags = Array.isArray(h.themes) ? (h.themes as Array<Record<string, unknown>>).map((t) => t.name as string).filter(Boolean) : [];
      return {
        url: (h.url as string) || "",
        title,
        deadline: (h.submission_period_ends_at as string) || (h.deadline as string) || undefined,
        rewardAmount: rawReward ? stripHtml(rawReward) : undefined,
        rewardCurrency: "USD",
        projectName: (h.organization_name as string) || (h.displayed_location as Record<string, unknown>)?.location as string || "Devpost",
        description: tags.join(", ") || undefined,
        type: "Hackathon",
      };
    });
  } catch (e: any) {
    logger.warn({ err: e.message }, "Devpost API fetch failed");
    return [];
  }
}

// ─── Galxe — GraphQL campaigns API ─────────────────────────
async function fetchGalxe(): Promise<PlatformBountyHint[]> {
  try {
    const query = `query {
      campaigns(input: { forAdmin: false, status: Active, first: 8 }) {
        list {
          id
          name
          description
          space { name }
          endTime
        }
      }
    }`;
    const resp = await fetch("https://graphigo.prd.galaxy.eco/query", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "BountyPilot/1.0" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as { data?: { campaigns?: { list?: Array<Record<string, unknown>> } }; errors?: Array<unknown> };
    if (data.errors) {
      logger.warn({ errors: data.errors }, "Galxe GraphQL errors");
      return [];
    }
    const list = data?.data?.campaigns?.list || [];
    return list.slice(0, 8).map((c) => {
      const space = c.space as Record<string, unknown> | undefined;
      const endTime = c.endTime ? new Date(Number(c.endTime) * 1000).toISOString().split("T")[0] : undefined;
      return {
        url: `https://galxe.com/campaign/${c.id}`,
        title: c.name as string | undefined,
        projectName: space?.name as string | undefined,
        description: c.description as string | undefined,
        deadline: endTime,
      };
    });
  } catch (e) {
    logger.warn({ err: e }, "Galxe GraphQL fetch failed");
    return [];
  }
}

// ─── Zealy (formerly Crew3) — public quests API ─────────────
async function fetchZealy(): Promise<PlatformBountyHint[]> {
  try {
    // Zealy public subdomain API — returns active content quests
    const communities = ["superteam", "solana", "aptos", "sui", "base", "arbitrum"];
    const hints: PlatformBountyHint[] = [];

    for (const subdomain of communities.slice(0, 4)) {
      try {
        const resp = await fetch(`https://api.zealy.io/communities/${subdomain}/quests?status=published&limit=4`, {
          headers: { "User-Agent": "BountyPilot/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) continue;
        const data = await resp.json() as { data?: Array<Record<string, unknown>>; items?: Array<Record<string, unknown>> };
        const quests = data.data || data.items || [];
        for (const q of (quests as Array<Record<string, unknown>>).slice(0, 3)) {
          const title = q.name as string | undefined;
          if (!title) continue;
          hints.push({
            url: `https://zealy.io/cw/${subdomain}/questboard/${q.id}`,
            title,
            projectName: subdomain.charAt(0).toUpperCase() + subdomain.slice(1),
            description: q.description as string | undefined,
          });
        }
      } catch {}
    }
    return hints.slice(0, 8);
  } catch (e) {
    logger.warn({ err: e }, "Zealy fetch failed");
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
  {
    name: "Galxe",
    listingUrl: "https://galxe.com/quests",
    fetchLinks: (html, base) => {
      const hints = genericLinkExtractor(html, base);
      return hints.filter((h) => h.url.includes("/quest/") || h.url.includes("/campaign/")).slice(0, 8);
    },
    maxBounties: 8,
  },
  {
    name: "Zealy",
    listingUrl: "https://zealy.io/explore",
    fetchLinks: genericLinkExtractor,
    maxBounties: 6,
  },
  // ─── Jobs, Grants, Contests, Hackathons ─────────────────────
  {
    name: "Web3 Careers",
    listingUrl: "https://web3.careers",
    fetchLinks: (html, base) => {
      const hints = genericLinkExtractor(html, base);
      return hints.filter((h) => h.url.includes("/job/")).slice(0, 6);
    },
    maxBounties: 6,
  },
  {
    name: "Crypto Jobs",
    listingUrl: "https://crypto.jobs",
    fetchLinks: (html, base) => {
      const hints = genericLinkExtractor(html, base);
      return hints.filter((h) => h.url.includes("/c/") || h.url.includes("/job/")).slice(0, 6);
    },
    maxBounties: 6,
  },
  {
    name: "Devpost",
    listingUrl: "https://devpost.com/hackathons",
    fetchLinks: (html, base) => {
      const hints = genericLinkExtractor(html, base);
      return hints.filter((h) => h.url.includes("/hackathon/")).slice(0, 6);
    },
    maxBounties: 6,
  },
  {
    name: "Gitcoin Grants",
    listingUrl: "https://explorer.gitcoin.co",
    fetchLinks: (html, base) => {
      const hints = genericLinkExtractor(html, base);
      return hints.filter((h) => h.url.includes("/round/")).slice(0, 5);
    },
    maxBounties: 5,
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
  // Verify URL is live before storing
  const verify = await verifyUrl(hint.url);
  if (!verify.ok) {
    logger.warn({ url: hint.url, status: verify.status }, "Skipping dead bounty URL");
    return false;
  }

  try {
    const scraped = await scrapeBounty(hint.url, hint.type);

    // Merge API hint data over scraped data — API is authoritative for reward/deadline/prizeRank
    const merged = {
      ...scraped,
      rewardAmount: hint.rewardAmount || scraped.rewardAmount,
      rewardCurrency: hint.rewardCurrency || scraped.rewardCurrency,
      prizeRank: hint.prizeRank || scraped.prizeRank,
      prizeBreakdown: hint.prizeBreakdown || scraped.prizeBreakdown,
      deadline: hint.deadline || scraped.deadline,
    };

    const analysis = await analyzeBounty(merged as import("./scraper.js").ScrapedBounty);

    const mergedBreakdown = merged.prizeBreakdown
      ? (Array.isArray(merged.prizeBreakdown)
          ? JSON.stringify(merged.prizeBreakdown)
          : merged.prizeBreakdown)
      : null;

    await db.insert(bountiesTable).values({
      url: hint.url,
      title: hint.title || scraped.title,
      platform: scraped.platform || platform,
      projectName: hint.projectName || scraped.projectName,
      rewardAmount: merged.rewardAmount,
      rewardCurrency: merged.rewardCurrency,
      prizeRank: scraped.prizeRank,
      prizeBreakdown: mergedBreakdown,
      deadline: merged.deadline,
      contentFormat: scraped.contentFormat,
      submissionRequirements: scraped.submissionRequirements,
      deliverables: scraped.deliverables,
      submissionLink: scraped.submissionLink,
      eligibilityRules: scraped.eligibilityRules,
      importantNotes: scraped.importantNotes,
      opportunityScore: analysis.opportunityScore,
      scoreExplanation: analysis.scoreExplanation,
      scoreBreakdown: analysis.scoreBreakdown ? JSON.stringify(analysis.scoreBreakdown) : null,
      confidenceScore: scraped.confidenceScore,
      opportunityType: scraped.opportunityType,
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

    const galxeHints = await fetchGalxe();
    const galxeResult = await crawlPlatform(
      PLATFORMS.find((p) => p.name === "Galxe")!,
      existingUrls,
      () => Promise.resolve(galxeHints)
    );
    results.push(galxeResult);
    await sleep(2000);

    const zealyHints = await fetchZealy();
    const zealyResult = await crawlPlatform(
      PLATFORMS.find((p) => p.name === "Zealy")!,
      existingUrls,
      () => Promise.resolve(zealyHints)
    );
    results.push(zealyResult);
    await sleep(2000);

    const devpostHints = await fetchDevpost();
    const devpostResult = await crawlPlatform(
      PLATFORMS.find((p) => p.name === "Devpost")!,
      existingUrls,
      () => Promise.resolve(devpostHints)
    );
    results.push(devpostResult);
    await sleep(2000);

    // Generic HTML scrapers for remaining platforms
    const remainingPlatforms = PLATFORMS.filter(
      (p) => !["Superteam Earn", "First Dollar", "Gitcoin", "Galxe", "Zealy", "Devpost"].includes(p.name)
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
