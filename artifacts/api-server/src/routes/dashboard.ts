import { Router } from "express";
import { db } from "@workspace/db";
import { bountiesTable, earningsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "../lib/logger";

export const dashboardRouter = Router();

// GET /dashboard/summary
dashboardRouter.get("/summary", async (_req, res) => {
  try {
    const [bounties, earnings] = await Promise.all([
      db.select().from(bountiesTable),
      db.select().from(earningsTable),
    ]);

    const totalBounties = bounties.length;
    const totalEarnings = earnings.reduce((sum, e) => sum + (e.amount ?? 0), 0);
    const activeBounties = bounties.filter((b) =>
      ["approved", "researching", "scripting", "recording", "editing"].includes(b.status)
    ).length;
    const wonBounties = bounties.filter((b) => b.status === "won").length;
    const pipelineValue = bounties
      .filter((b) => ["approved", "researching", "scripting", "recording", "editing"].includes(b.status))
      .reduce((sum, b) => sum + parseFloat(b.rewardAmount ?? "0"), 0);

    const scores = bounties.filter((b) => b.opportunityScore != null).map((b) => b.opportunityScore!);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    const statusMap: Record<string, number> = {};
    for (const b of bounties) {
      statusMap[b.status] = (statusMap[b.status] ?? 0) + 1;
    }
    const statusBreakdown = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    res.json({
      totalBounties,
      totalEarnings,
      activeBounties,
      wonBounties,
      pipelineValue,
      averageScore,
      statusBreakdown,
    });
  } catch (err) {
    logger.error(err, "Error getting dashboard summary");
    res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

// GET /dashboard/recent
dashboardRouter.get("/recent", async (_req, res) => {
  try {
    const bounties = await db
      .select()
      .from(bountiesTable)
      .orderBy(desc(bountiesTable.createdAt))
      .limit(5);
    res.json(bounties);
  } catch (err) {
    logger.error(err, "Error getting recent bounties");
    res.status(500).json({ error: "Failed to get recent bounties" });
  }
});

// GET /dashboard/platform-breakdown
dashboardRouter.get("/platform-breakdown", async (_req, res) => {
  try {
    const bounties = await db.select().from(bountiesTable);
    const platformMap: Record<string, { count: number; totalReward: number }> = {};

    for (const b of bounties) {
      const platform = b.platform ?? "Unknown";
      if (!platformMap[platform]) platformMap[platform] = { count: 0, totalReward: 0 };
      platformMap[platform].count++;
      platformMap[platform].totalReward += parseFloat(b.rewardAmount ?? "0");
    }

    const result = Object.entries(platformMap).map(([platform, data]) => ({
      platform,
      count: data.count,
      totalReward: data.totalReward,
    }));

    res.json(result);
  } catch (err) {
    logger.error(err, "Error getting platform breakdown");
    res.status(500).json({ error: "Failed to get platform breakdown" });
  }
});
