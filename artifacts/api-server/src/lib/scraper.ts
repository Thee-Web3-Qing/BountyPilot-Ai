export interface PrizeBreakdown {
  rank: string;
  amount: string;
  currency: string;
  count?: number;
}

export interface ScrapedBounty {
  title: string;
  description: string;
  rewardAmount: string | null;
  rewardCurrency: string | null;
  prizeRank: string | null;
  prizeBreakdown?: PrizeBreakdown[] | null;
  deadline: string | null;
  projectName: string;
  contentFormat: string;
  submissionRequirements: string;
  deliverables: string;
  submissionLink: string;
  eligibilityRules: string;
  importantNotes: string;
  platform: string | null;
  confidenceScore?: number;
  opportunityType?: string;
}

function extractReward(text: string): { amount: string | null; currency: string | null } {
  const patterns = [
    // Range format first: 1-3, 1-10, 1 — 5
    /(\d+)\s*[\u2013\u2014-]\s*(\d+)(?:\s*(USDC|USDT|USD|SOL|ETH))?/i,
    /\$\s*([\d,]+(?:\.\d+)?)\s*(USDC|USDT|USD)?/i,
    /([\d,]+(?:\.\d+)?)\s*(USDC|USDT|SOL|ETH|OP|ARB|MATIC|BTC)/i,
    /(?:reward|prize|bounty|total)[:\s]+([\d,]+(?:\.\d+)?)\s*(USDC|USDT|SOL|ETH|OP|USD)?/i,
    /([\d,]+(?:\.\d+)?)\s*\$\s*(USDC|USDT)?/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      // Range format: capture groups 1 and 2 are min-max, optional 3 is currency
      if (pat.source.startsWith("(\\d+)")) {
        const min = m[1].replace(/,/g, "");
        const max = m[2].replace(/,/g, "");
        return {
          amount: `${min}-${max}`,
          currency: (m[3] || "USDC").toUpperCase(),
        };
      }
      return {
        amount: m[1].replace(/,/g, ""),
        currency: (m[2] || "USDC").toUpperCase(),
      };
    }
  }
  return { amount: null, currency: null };
}

function extractPrizeRank(text: string): string | null {
  // Look for "1st to 10th", "1st - 10th", "1st-10th", "top 10", etc.
  const rangePatterns = [
    /\b(1st|first)\s*(?:to|[-–—])\s*(\d+)(?:st|nd|rd|th)?\b/i,
    /\b(1st|first)\s*[-–—]\s*(\d+)(?:st|nd|rd|th)?\s*(?:place|prize|winner)/i,
    /\btop\s*(\d+)\s*(?:winners?|prizes?|places?|positions?)/i,
    /\b(\d+)\s*(?:winners?|prizes?|places?|positions?)\s*(?:total|available|up for grabs)/i,
    /\b(\d+)\s*(?:winners?|prizes?)\s*\(/i,
    /\b(\d+)\s*(?:winners?|prizes?)\s*(?:will be|to be)\s*(?:selected|chosen|picked)/i,
    /\breward\s*pool\b/i,
    /\bprize\s*pool\b/i,
  ];
  for (const pat of rangePatterns) {
    const m = text.match(pat);
    if (m) {
      if (pat.source.includes("to|")) {
        // "1st to 10th" -> "1st-10th"
        const end = m[2];
        const endSuffix = end === "1" ? "st" : end === "2" ? "nd" : end === "3" ? "rd" : "th";
        return `1st-${end}${endSuffix}`;
      }
      if (pat.source.includes("top")) {
        return `Top ${m[1]}`;
      }
      return `${m[1]} winners`;
    }
  }

  // Look for individual prize ranks
  const rankPatterns = [
    /\b(1st|first)\b.*prize/i,
    /\b(2nd|second)\b.*prize/i,
    /\b(3rd|third)\b.*prize/i,
    /\b(4th|fourth)\b.*prize/i,
    /\b(5th|fifth)\b.*prize/i,
    /\b(1st|first)\b.*place/i,
    /\b(2nd|second)\b.*place/i,
    /\b(3rd|third)\b.*place/i,
    /\b(4th|fourth)\b.*place/i,
    /\b(5th|fifth)\b.*place/i,
    /\b(1st|first)\b.*winner/i,
    /\b(2nd|second)\b.*winner/i,
    /\b(3rd|third)\b.*winner/i,
    /\b(1st|2nd|3rd|4th|5th)\b/i,
    /\bposition\s*(\d+)\b/i,
    /\btop\s*(\d+)\b/i,
    /\b(\d+)(st|nd|rd|th)\b.*prize/i,
    /\b(\d+)(st|nd|rd|th)\b.*place/i,
  ];
  for (const pat of rankPatterns) {
    const m = text.match(pat);
    if (m) {
      const rank = m[1] || m[0];
      return rank.toLowerCase();
    }
  }
  return null;
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

// Strip HTML tags and decode common entities to plain text
export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
  if (url.includes("immunefi")) return "Immunefi";
  if (url.includes("wizzhq")) return "WIZZ";
  if (url.includes("galxe")) return "Galxe";
  if (url.includes("zealy")) return "Zealy";
  if (url.includes("whop")) return "Whop";
  if (url.includes("cre8core")) return "Cre8core";
  if (url.includes("hashly")) return "Hashly";
  if (url.includes("klout")) return "Klout";
  if (url.includes("arena.social")) return "Arena Social";
  if (url.includes("duelduck")) return "Duel Duck";
  if (url.includes("wpl") || url.includes("wp1")) return "WPL Earn";
  if (url.includes("rova")) return "Rova";
  if (url.includes("mindo")) return "MindoAI";
  if (url.includes("scribble")) return "Scribble";
  if (url.includes("elevenlabs")) return "ElevenLabs Creative";
  if (url.includes("scouts")) return "Scouts";
  if (url.includes("anthum")) return "Anthum AI";
  if (url.includes("devpost")) return "Devpost";
  if (url.includes("dework")) return "Dework";
  if (url.includes("job")) return "Job Board";
  if (url.includes("contest")) return "Contest";
  if (url.includes("competition")) return "Competition";
  if (url.includes("hackathon")) return "Hackathon";
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
async function trySuperteamAPI(url: string): Promise<Partial<ScrapedBounty> | null> {
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
  url: string,
  type?: string,
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
    apiData = await trySuperteamAPI(url);
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
  const prizeRank = apiData?.prizeRank || extractPrizeRank(searchText) || null;

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

  const cleanDescription = stripHtml(rawDescription);
  const submissionRequirements = cleanDescription
    ? `${cleanDescription.slice(0, 600)}`
    : `Original content required for this ${platform} bounty. Check the listing page for full requirements.`;

  const notesArr: string[] = [];
  if (deadline) notesArr.push(`Deadline: ${deadline}`);
  notesArr.push("Submit via the original listing page.");
  if (rewardAmount) notesArr.push(`Reward: ${rewardAmount} ${rewardCurrency}`);

  // Calculate confidence score based on how many key fields were successfully extracted
  let confidence = 40;
  if (apiData) confidence += 25;
  if (rewardAmount) confidence += 10;
  if (deadline) confidence += 10;
  if (contentFormat && contentFormat !== "Article / Thread") confidence += 5;
  if (title && title.length > 15 && !title.startsWith("Content Bounty on")) confidence += 5;
  if (html.length > 5000) confidence += 5;
  const confidenceScore = Math.min(99, confidence);

  // Extract prize breakdown from the page text
  let prizeBreakdown: PrizeBreakdown[] | null = null;
  try {
    const breakdowns = parsePrizeBreakdown(searchText);
    if (breakdowns.length > 0) prizeBreakdown = breakdowns;
  } catch {}

  return {
    title,
    description,
    rewardAmount,
    rewardCurrency,
    prizeRank,
    prizeBreakdown,
    deadline,
    projectName,
    contentFormat,
    submissionRequirements,
    deliverables: contentFormat,
    submissionLink: url,
    eligibilityRules: "Open to all creators — check platform listing for specific eligibility.",
    importantNotes: notesArr.join(". "),
    platform,
    opportunityType: type || detectOpportunityType(url, searchText),
    rawText: searchText.slice(0, 4000),
    confidenceScore,
  };
}

/**
 * Parse detailed prize breakdown from text like:
 * "1,500 USDG 1st", "1,000 USDG 2nd", "500 USDG 3rd", "250 USDG x8 (Bonus)"
 * Also handles: "1st Prize: $1,500", "1st Place: 1,500 USDC", "1st - 1,500"
 */
function parsePrizeBreakdown(text: string): PrizeBreakdown[] {
  const results: PrizeBreakdown[] = [];
  const lines = text.split(/\n|\r|\s{2,}/g);
  const rankSuffix = /(1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th|13th|14th|15th|16th|17th|18th|19th|20th|first|second|third|fourth|fifth|bonus|runner[- ]up|consolation|special|winner|pool)/i;
  const amountPattern = /([\d,]+(?:\.\d+)?)\s*(USD[CG]?|USDT|SOL|ETH|USDC|USDG|USDe|DAI|BUSD|G[BT]|EUR|GBP|JPY|XRP|BCH)?/i;
  const countPattern = /\bx(\d+)|\b(\d+)\s*(?:x|times|entries)\b|\((\d+)\s*(?:prizes|winners|bonus|extra)\)/i;

  for (const line of lines) {
    if (line.length < 10) continue;
    const rankMatch = line.match(rankSuffix);
    const amountMatch = line.match(amountPattern);
    if (rankMatch && amountMatch) {
      let rank = rankMatch[1];
      const amount = amountMatch[1].replace(/,/g, "");
      const currency = (amountMatch[2] || "USDC").toUpperCase();
      // Count of winners (e.g., "x8" or "(8 bonus)")
      const countMatch = line.match(countPattern);
      const count = countMatch ? Number(countMatch[1] || countMatch[2] || countMatch[3]) : undefined;
      // Normalize rank
      rank = rank.toLowerCase();
      if (rank === "first") rank = "1st";
      if (rank === "second") rank = "2nd";
      if (rank === "third") rank = "3rd";
      if (rank === "fourth") rank = "4th";
      if (rank === "fifth") rank = "5th";
      if (rank === "bonus") rank = "Bonus";
      if (rank === "pool") rank = "Pool";
      if (rank === "winner") rank = "Winner";
      results.push({ rank, amount, currency, count });
    }
  }

  return results;
}

function detectOpportunityType(url: string, text: string): string {
  const u = url.toLowerCase();
  const t = text.toLowerCase();
  if (u.includes("/job/") || u.includes("/jobs/") || u.includes("/careers/") || t.includes("full-time") || t.includes("part-time") || t.includes("hire")) return "Job";
  if (u.includes("/contest/") || u.includes("/competition/") || t.includes("contest") || t.includes("competition") || t.includes("winners")) return "Contest";
  if (u.includes("/hackathon/") || t.includes("hackathon")) return "Hackathon";
  if (u.includes("/grant/") || u.includes("/grants/") || t.includes("grant")) return "Grant";
  if (u.includes("/task/") || u.includes("/mission/") || t.includes("task") || t.includes("mission")) return "Task";
  if (u.includes("/campaign/") || u.includes("/quest/") || t.includes("campaign") || t.includes("quest")) return "Campaign";
  if (u.includes("/bug-bounty/") || u.includes("/bug/") || t.includes("bug bounty") || t.includes("security")) return "Bug Bounty";
  if (u.includes("/bounty/") || u.includes("/bounties/") || t.includes("bounty")) return "Bounty";
  return "Bounty";
}
