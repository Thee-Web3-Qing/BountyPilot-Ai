import { Router } from "express";
import { db } from "@workspace/db";
import { bountiesTable } from "@workspace/db";
import { isNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAuth, type AuthRequest } from "../lib/auth.js";

const router = Router();

router.use(requireAuth);

async function fetchDevpostHackathons(): Promise<Array<{
  url: string;
  title: string;
  description: string;
  deadline: string | null;
  reward: string | null;
  currency: string;
  location: string | null;
  tags: string[];
}>> {
  try {
    const resp = await fetch("https://devpost.com/api/hackathons", {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; BountyPilot/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as { hackathons?: Array<Record<string, unknown>> };
    const hackathons = data.hackathons || [];
    return hackathons.map((h) => ({
      url: (h.url as string) || "",
      title: (h.title as string) || "",
      description: (h.tagline as string) || (h.description as string) || "",
      deadline: (h.submission_period_ends_at as string) || (h.deadline as string) || null,
      reward: (h.prize_amount as string) || (h.total_prize_value as string) || null,
      currency: "USD",
      location: (h.location as string) || ((h.displayed_location as Record<string, unknown>)?.location as string) || null,
      tags: Array.isArray(h.themes) ? (h.themes as Array<Record<string, unknown>>).map((t) => t.name as string).filter(Boolean) : [],
    }));
  } catch (e: any) {
    logger.warn({ err: e.message }, "Devpost API fetch failed");
    return [];
  }
}

router.post("/crawl", async (req: AuthRequest, res) => {
  try {
    const hackathons = await fetchDevpostHackathons();
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
      });
      added++;
    }

    res.json({ added, skipped, total: hackathons.length });
    return;
  } catch (e: any) {
    res.status(500).json({ error: e.message });
    return;
  }
});

export default router;
