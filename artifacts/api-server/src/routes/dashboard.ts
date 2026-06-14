import { Router } from "express";
import { db } from "@workspace/db";
import { bountiesTable, earningsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { analyzeDashboardInsights } from "../lib/novus.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

// GET /dashboard/summary
dashboardRouter.get("/summary", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const [bounties, earnings] = await Promise.all([
      db.select().from(bountiesTable).where(eq(bountiesTable.userId, userId)),
      db.select().from(earningsTable).where(eq(earningsTable.userId, userId)),
    ]);

    const totalBounties = bounties.length;
    const totalEarnings = earnings.reduce((sum, e) => sum + (e.amount ?? 0), 0);
    const activeBounties = bounties.filter((b) =>
      ["approved", "researching", "scripting", "recording", "editing"].includes(b.status)
    ).length;
    const wonBounties = bounties.filter((b) => b.status === "won").length;
    const lostBounties = bounties.filter((b) => b.status === "lost").length;
    const decidedBounties = wonBounties + lostBounties;
    const winRate = decidedBounties > 0 ? Math.round((wonBounties / decidedBounties) * 100) : 0;
    const pipelineValue = bounties
      .filter((b) => ["approved", "researching", "scripting", "recording", "editing"].includes(b.status))
      .reduce((sum, b) => sum + parseFloat(b.rewardAmount ?? "0"), 0);
    const totalPipelineValue = bounties
      .filter((b) => !["discovered", "rejected", "lost"].includes(b.status))
      .reduce((sum, b) => sum + parseFloat(b.rewardAmount ?? "0"), 0);
    const totalHoursSaved = bounties.reduce((sum, b) => sum + (b.hoursSaved ?? 0), 0);
    const totalClaimed = bounties.filter((b) => b.status !== "discovered").length;

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
      lostBounties,
      winRate,
      pipelineValue,
      totalPipelineValue,
      totalHoursSaved,
      totalClaimed,
      averageScore,
      statusBreakdown,
    });
  } catch (err) {
    logger.error(err, "Error getting dashboard summary");
    res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

// GET /dashboard/insights — AI-powered analytics suggestions via Novus
// This runs dashboard summary through Novus to get actionable creator insights.
dashboardRouter.get("/insights", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const [bounties, earnings] = await Promise.all([
      db.select().from(bountiesTable).where(eq(bountiesTable.userId, userId)),
      db.select().from(earningsTable).where(eq(earningsTable.userId, userId)),
    ]);

    const totalEarnings = earnings.reduce((sum, e) => sum + (e.amount ?? 0), 0);
    const activeBounties = bounties.filter((b) =>
      ["approved", "researching", "scripting", "recording", "editing"].includes(b.status)
    ).length;
    const wonBounties = bounties.filter((b) => b.status === "won").length;
    const lostBounties = bounties.filter((b) => b.status === "lost").length;
    const decided = wonBounties + lostBounties;
    const winRate = decided > 0 ? Math.round((wonBounties / decided) * 100) : 0;
    const pipelineValue = bounties
      .filter((b) => ["approved", "researching", "scripting", "recording", "editing"].includes(b.status))
      .reduce((sum, b) => sum + parseFloat(b.rewardAmount ?? "0"), 0);
    const scores = bounties.filter((b) => b.opportunityScore != null).map((b) => b.opportunityScore!);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const statusMap: Record<string, number> = {};
    for (const b of bounties) { statusMap[b.status] = (statusMap[b.status] ?? 0) + 1; }
    const statusBreakdown = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    const insights = await analyzeDashboardInsights({
      totalBounties: bounties.length,
      totalEarnings,
      activeBounties,
      wonBounties,
      lostBounties,
      winRate,
      pipelineValue,
      averageScore,
      statusBreakdown,
    });

    res.json({ insights, hasNovus: !!insights });
  } catch (err) {
    logger.error(err, "Error getting dashboard insights");
    res.status(500).json({ error: "Failed to get dashboard insights" });
  }
});

// GET /dashboard/recent
dashboardRouter.get("/recent", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const bounties = await db
      .select()
      .from(bountiesTable)
      .where(eq(bountiesTable.userId, userId))
      .orderBy(desc(bountiesTable.createdAt))
      .limit(5);
    res.json(bounties);
  } catch (err) {
    logger.error(err, "Error getting recent bounties");
    res.status(500).json({ error: "Failed to get recent bounties" });
  }
});

// GET /dashboard/platform-breakdown
dashboardRouter.get("/platform-breakdown", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const bounties = await db.select().from(bountiesTable).where(eq(bountiesTable.userId, userId));
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
