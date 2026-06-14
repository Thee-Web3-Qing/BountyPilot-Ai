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

function isBeginnerFriendly(title: string, description: string, tags: string[]): boolean {
  const text = `${title} ${description} ${tags.join(" ")}`.toLowerCase();
  return BEGINNER_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

async function fetchDevpostHackathons(search?: string): Promise<Array<{
  url: string;
  title: string;
  description: string;
  deadline: string | null;
  reward: string | null;
  currency: string;
  location: string | null;
  tags: string[];
  isBeginnerFriendly: boolean;
}>> {
  try {
    const url = search
      ? `https://devpost.com/api/hackathons?search=${encodeURIComponent(search)}`
      : "https://devpost.com/api/hackathons";
    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; BountyPilot/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as { hackathons?: Array<Record<string, unknown>> };
    const hackathons = data.hackathons || [];
    return hackathons.map((h) => {
      const title = (h.title as string) || "";
      const description = (h.tagline as string) || (h.description as string) || "";
      const tags = Array.isArray(h.themes) ? (h.themes as Array<Record<string, unknown>>).map((t) => t.name as string).filter(Boolean) : [];
      return {
        url: (h.url as string) || "",
        title,
        description,
        deadline: (h.submission_period_ends_at as string) || (h.deadline as string) || null,
        reward: (h.prize_amount as string) || (h.total_prize_value as string) || null,
        currency: "USD",
        location: (h.location as string) || ((h.displayed_location as Record<string, unknown>)?.location as string) || null,
        tags,
        isBeginnerFriendly: isBeginnerFriendly(title, description, tags),
      };
    });
  } catch (e: any) {
    logger.warn({ err: e.message }, "Devpost API fetch failed");
    return [];
  }
}

router.post("/crawl", async (req: AuthRequest, res) => {
  try {
    // Fetch all hackathons + beginner-friendly searches
    const [allHackathons, beginnerHackathons, vibeHackathons] = await Promise.all([
      fetchDevpostHackathons(),
      fetchDevpostHackathons("beginner"),
      fetchDevpostHackathons("vibe"),
    ]);

    // Merge and deduplicate by URL
    type HackathonResult = Awaited<ReturnType<typeof fetchDevpostHackathons>>[number];
    const byUrl = new Map<string, HackathonResult>();
    for (const h of allHackathons) byUrl.set(h.url, { ...h, isBeginnerFriendly: h.isBeginnerFriendly });
    for (const h of beginnerHackathons) {
      const existing = byUrl.get(h.url);
      if (existing) existing.isBeginnerFriendly = true;
      else byUrl.set(h.url, { ...h, isBeginnerFriendly: true });
    }
    for (const h of vibeHackathons) {
      const existing = byUrl.get(h.url);
      if (existing) existing.isBeginnerFriendly = true;
      else byUrl.set(h.url, { ...h, isBeginnerFriendly: true });
    }

    const hackathons = Array.from(byUrl.values());
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
        submissionRequirements: h.description,
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
