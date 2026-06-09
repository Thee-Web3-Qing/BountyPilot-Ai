export interface ScrapedBounty {
  title: string;
  description: string;
  rewardAmount: string | null;
  rewardCurrency: string | null;
  deadline: string | null;
  projectName: string;
  contentFormat: string;
  submissionRequirements: string;
  deliverables: string;
  submissionLink: string;
  eligibilityRules: string;
  importantNotes: string;
}

function extractReward(text: string): { amount: string | null; currency: string | null } {
  const patterns = [
    /\$\s*([\d,]+(?:\.\d+)?)\s*(USDC|USDT|USD)?/i,
    /([\d,]+(?:\.\d+)?)\s*(USDC|USDT|SOL|ETH|OP|ARB|MATIC|BTC)/i,
    /(?:reward|prize|bounty|total)[:\s]+([\d,]+(?:\.\d+)?)\s*(USDC|USDT|SOL|ETH|OP|USD)?/i,
    /([\d,]+(?:\.\d+)?)\s*\$\s*(USDC|USDT)?/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      return {
        amount: m[1].replace(/,/g, ""),
        currency: (m[2] || "USDC").toUpperCase(),
      };
    }
  }
  return { amount: null, currency: null };
}

function extractDeadline(text: string): string | null {
  const patterns = [
    /(?:deadline|due|closes?|ends?|submit by)[:\s]+([A-Za-z]+ \d{1,2},?\s*\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      try {
        const d = new Date(m[1]);
        if (!isNaN(d.getTime()) && d.getTime() > Date.now() - 86400000 * 365) {
          return d.toISOString().split("T")[0];
        }
      } catch {}
    }
  }
  return null;
}

function extractContentFormat(text: string): string {
  const lower = text.toLowerCase();
  const formats: string[] = [];
  if (lower.includes("video") || lower.includes("youtube")) formats.push("Video");
  if (lower.includes("twitter") || lower.includes("thread") || lower.includes("tweet")) formats.push("Twitter Thread");
  if (lower.includes("blog") || lower.includes("article") || lower.includes("long-form") || lower.includes("mirror") || lower.includes("medium")) formats.push("Article");
  if (lower.includes("infographic")) formats.push("Infographic");
  if (lower.includes("podcast")) formats.push("Podcast");
  if (lower.includes("newsletter")) formats.push("Newsletter");
  if (formats.length === 0) return "Article / Thread";
  return [...new Set(formats)].join(" + ");
}

function getMeta(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, "i"),
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function getTitle(html: string): string {
  const og = getMeta(html, "og:title");
  if (og && !og.toLowerCase().includes("| superteam") && !og.toLowerCase().includes("listing |")) return og;
  const tw = getMeta(html, "twitter:title");
  if (tw && !tw.toLowerCase().includes("| superteam")) return tw;
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const t = m?.[1]?.trim() || "";
  // Strip trailing site name patterns like " | Superteam Earn" or " - GibWork"
  return t.replace(/\s*[|\-–]\s*[A-Za-z\s]+$/, "").trim();
}

function getDescription(html: string): string {
  const og = getMeta(html, "og:description");
  if (og) return og;
  const tw = getMeta(html, "twitter:description");
  if (tw) return tw;
  return getMeta(html, "description");
}

function detectPlatform(url: string): string {
  if (url.includes("earn.superteam")) return "Superteam Earn";
  if (url.includes("gibwork")) return "GibWork";
  if (url.includes("firstdollar")) return "First Dollar";
  if (url.includes("dorahacks")) return "DoraHacks";
  if (url.includes("gitcoin")) return "Gitcoin";
  if (url.includes("questbook")) return "Questbook";
  if (url.includes("layer3")) return "Layer3";
  if (url.includes("dework")) return "Dework";
  return "Unknown Platform";
}

// Extract Next.js __NEXT_DATA__ JSON embedded in SSR pages
function extractNextData(html: string): Record<string, unknown> | null {
  try {
    const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([^<]+)<\/script>/i);
    if (m?.[1]) return JSON.parse(m[1]);
  } catch {}
  return null;
}

// Deep search an object for a value by key
function deepFind(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  for (const key of keys) {
    if (key in (obj as Record<string, unknown>)) {
      const val = (obj as Record<string, unknown>)[key];
      if (val && typeof val === "string" && val.length > 0) return val;
      if (typeof val === "number") return String(val);
    }
  }
  for (const val of Object.values(obj as Record<string, unknown>)) {
    const found = deepFind(val, keys);
    if (found) return found;
  }
  return null;
}

// Superteam Earn has a public API for listing details
async function trySupeteamAPI(url: string): Promise<Partial<ScrapedBounty> | null> {
  try {
    const slug = url.split("/listing/")[1]?.split("?")[0]?.replace(/\/$/, "");
    if (!slug) return null;
    const apiUrl = `https://earn.superteam.fun/api/listings/${slug}`;
    const resp = await fetch(apiUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as Record<string, unknown>;

    const rewardAmount = deepFind(data, ["rewardAmount", "reward", "totalReward", "usdValue"]);
    const currency = deepFind(data, ["token", "currency", "rewardToken"]) || "USDC";
    const deadline = deepFind(data, ["deadline", "dueDate", "endDate"]);
    const title = deepFind(data, ["title", "name", "listingTitle"]);
    const description = deepFind(data, ["description", "eligibility", "requirements", "details"]);
    const projectName = deepFind(data, ["sponsorName", "sponsor", "orgName", "projectName"]);
    const type = deepFind(data, ["type", "listingType", "contentType"]);

    let parsedDeadline: string | null = null;
    if (deadline) {
      try {
        const d = new Date(deadline);
        if (!isNaN(d.getTime())) parsedDeadline = d.toISOString().split("T")[0];
      } catch {}
    }

    return {
      title: title || undefined,
      description: description || undefined,
      rewardAmount: rewardAmount || null,
      rewardCurrency: currency.toUpperCase(),
      deadline: parsedDeadline,
      projectName: projectName || undefined,
      contentFormat: type ? extractContentFormat(type) : undefined,
    } as Partial<ScrapedBounty>;
  } catch {
    return null;
  }
}

export async function scrapeBounty(
  url: string
): Promise<ScrapedBounty & { platform: string; rawText: string }> {
  const platform = detectPlatform(url);

  let html = "";
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BountyPilot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) html = await resp.text();
  } catch {}

  // Try platform-specific APIs first
  let apiData: Partial<ScrapedBounty> | null = null;
  if (platform === "Superteam Earn") {
    apiData = await trySupeteamAPI(url);
  }

  // Extract from __NEXT_DATA__ if present
  const nextData = extractNextData(html);
  const nextTitleRaw = nextData ? deepFind(nextData, ["title", "listing_title", "bountyTitle"]) : null;
  // Filter out short/generic Next.js UI labels (e.g. "Apply by undefined", "Sign In", etc.)
  const nextTitle =
    nextTitleRaw && nextTitleRaw.length > 15 && !/^(apply|sign|log|home|error|loading)/i.test(nextTitleRaw)
      ? nextTitleRaw
      : null;
  const nextReward = nextData ? deepFind(nextData, ["rewardAmount", "reward", "usdValue", "totalReward"]) : null;
  const nextCurrency = nextData ? deepFind(nextData, ["token", "rewardToken", "currency"]) : null;
  const nextDeadline = nextData ? deepFind(nextData, ["deadline", "dueDate", "endDate"]) : null;
  const nextDesc = nextData ? deepFind(nextData, ["description", "requirements", "eligibility"]) : null;
  const nextSponsor = nextData ? deepFind(nextData, ["sponsorName", "sponsor", "orgName"]) : null;
  const nextType = nextData ? deepFind(nextData, ["type", "listingType"]) : null;

  // Merge: API data > __NEXT_DATA__ > OG tags > fallback
  const rawTitle =
    apiData?.title ||
    nextTitle ||
    getTitle(html) ||
    `Content Bounty on ${platform}`;

  const rawDescription =
    apiData?.description ||
    nextDesc ||
    getDescription(html) ||
    "";

  const plainText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const searchText = `${rawTitle} ${rawDescription} ${plainText.slice(0, 5000)}`;

  const { amount: scrapedAmount, currency: scrapedCurrency } = extractReward(searchText);

  const rewardAmount =
    apiData?.rewardAmount ||
    (nextReward ? nextReward.replace(/[^0-9.]/g, "") : null) ||
    scrapedAmount;

  const rewardCurrency =
    apiData?.rewardCurrency ||
    (nextCurrency?.toUpperCase()) ||
    scrapedCurrency ||
    "USDC";

  let deadline = apiData?.deadline || null;
  if (!deadline && nextDeadline) {
    try {
      const d = new Date(nextDeadline);
      if (!isNaN(d.getTime())) deadline = d.toISOString().split("T")[0];
    } catch {}
  }
  if (!deadline) deadline = extractDeadline(searchText);

  const projectName =
    apiData?.projectName ||
    nextSponsor ||
    (() => {
      const ogSite = getMeta(html, "og:site_name");
      if (ogSite && ogSite.toLowerCase() !== platform.toLowerCase()) return ogSite;
      const hostMatch = url.match(/https?:\/\/(?:www\.)?([^./]+)\./);
      return hostMatch
        ? hostMatch[1].charAt(0).toUpperCase() + hostMatch[1].slice(1)
        : platform;
    })();

  const contentFormat =
    apiData?.contentFormat ||
    (nextType ? extractContentFormat(nextType) : extractContentFormat(searchText));

  const title = (rawTitle || `Content Bounty on ${platform}`).slice(0, 200);
  const description = rawDescription || `A content creation bounty on ${platform} by ${projectName}.`;

  const submissionRequirements = rawDescription
    ? `${rawDescription.slice(0, 400)}. Original content required.`
    : `Original content required for this ${platform} bounty. Check the listing page for full requirements.`;

  const notesArr: string[] = [];
  if (deadline) notesArr.push(`Deadline: ${deadline}`);
  notesArr.push("Submit via the original listing page.");
  if (rewardAmount) notesArr.push(`Reward: ${rewardAmount} ${rewardCurrency}`);

  return {
    title,
    description,
    rewardAmount,
    rewardCurrency,
    deadline,
    projectName,
    contentFormat,
    submissionRequirements,
    deliverables: contentFormat,
    submissionLink: url,
    eligibilityRules: "Open to all creators — check platform listing for specific eligibility.",
    importantNotes: notesArr.join(". "),
    platform,
    rawText: searchText.slice(0, 4000),
  };
}
