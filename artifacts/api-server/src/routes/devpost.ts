import { Router } from "express";
import { db } from "@workspace/db";
import { bountiesTable } from "@workspace/db";
import { isNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAuth, type AuthRequest } from "../lib/auth.js";

const router = Router();

router.use(requireAuth);

const BEGINNER_KEYWORDS = [
  "beginner", "beginner-friendly", "beginner friendly", "no-code", "no code",
  "low-code", "low code", "vibe", "vibecode", "vibe coding", "agentic", "no code required",
  "drag and drop", "visual builder", "no programming", "citizen developer",
];

function isBeginnerFriendly(title: string, tags: string[]): boolean {
  const text = `${title} ${tags.join(" ")}`.toLowerCase();
  return BEGINNER_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

function stripHtml(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, "").trim() || null;
}

async function fetchDevpostHackathons(page = 1): Promise<Array<{
  url: string;
  title: string;
  deadline: string | null;
  reward: string | null;
  currency: string;
  location: string | null;
  tags: string[];
  isBeginnerFriendly: boolean;
}>> {
  try {
    const url = `https://devpost.com/api/hackathons?status=open&per_page=40&page=${page}`;
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
    return hackathons.map((h) => {
      const title = (h.title as string) || "";
      const tags = Array.isArray(h.themes) ? (h.themes as Array<Record<string, unknown>>).map((t) => t.name as string).filter(Boolean) : [];
      const rawReward = (h.prize_amount as string) || (h.total_prize_value as string) || null;
      return {
        url: (h.url as string) || "",
        title,
        deadline: (h.submission_period_ends_at as string) || (h.deadline as string) || null,
        reward: stripHtml(rawReward),
        currency: "USD",
        location: (h.location as string) || ((h.displayed_location as Record<string, unknown>)?.location as string) || null,
        tags,
        isBeginnerFriendly: isBeginnerFriendly(title, tags),
      };
    });
  } catch (e: any) {
    logger.warn({ err: e.message }, "Devpost API fetch failed");
    return [];
  }
}

async function fetchAllOpenHackathons(): Promise<Array<{
  url: string;
  title: string;
  deadline: string | null;
  reward: string | null;
  currency: string;
  location: string | null;
  tags: string[];
  isBeginnerFriendly: boolean;
}>> {
  const page1 = await fetchDevpostHackathons(1);
  if (page1.length === 0) return [];

  const page2 = await fetchDevpostHackathons(2);
  const page3 = await fetchDevpostHackathons(3);

  const all = [...page1, ...page2, ...page3];

  // Deduplicate by URL
  const byUrl = new Map<string, typeof all[0]>();
  for (const h of all) {
    if (!h.url) continue;
    byUrl.set(h.url, h);
  }

  return Array.from(byUrl.values());
}

router.post("/crawl", async (req: AuthRequest, res) => {
  try {
    const hackathons = await fetchAllOpenHackathons();
    const existing = await db.select({ url: bountiesTable.url }).from(bountiesTable);
    const existingUrls = new Set(existing.map((r) => r.url));

    let added = 0;
    let skipped = 0;

    for (const h of hackathons) {
      if (!h.url || existingUrls.has(h.url)) {
        skipped++;
        continue;
      }
      const dl = h.deadline ? new Date(h.deadline).toISOString().split("T")[0] : null;
      const tags = h.tags.join(", ");
      await db.insert(bountiesTable).values({
        url: h.url,
        title: h.title,
        platform: "Devpost",
        projectName: h.tags[0] || "Devpost",
        rewardAmount: h.reward,
        rewardCurrency: h.currency,
        deadline: dl,
        contentFormat: "Hackathon",
        deliverables: "Hackathon submission",
        opportunityType: "Hackathon",
        status: "discovered",
        tags: h.isBeginnerFriendly ? `beginner-friendly, ${tags}` : tags,
      });
      added++;
    }

    res.json({ added, skipped, total: hackathons.length, beginnerFriendly: hackathons.filter((h) => h.isBeginnerFriendly).length });
    return;
  } catch (e: any) {
    res.status(500).json({ error: e.message });
    return;
  }
});

export default router;
