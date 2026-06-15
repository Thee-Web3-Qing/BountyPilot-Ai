import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, bountiesTable, earningsTable, bountyReportsTable } from "@workspace/db";
import { dextopusDepositsTable } from "@workspace/db";
import { eq, count, desc, gte, sql, isNotNull, and, ilike, or } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { trialEndsAt } from "../lib/access.js";
import { analyzeAdminInsights } from "../lib/novus.js";
import { awardPointsAndBadges } from "../lib/gamification.js";

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export const adminRouter = Router();

// One-time bootstrap: sets first admin + upgrades all existing users to beta.
// Safe to call multiple times — does nothing if an admin already exists.
adminRouter.post("/bootstrap", async (_req, res) => {
  try {
    const admins = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.isAdmin, true));

    if (admins.length > 0) {
      res.status(200).json({ ok: false, message: "Already bootstrapped — admin exists." });
      return;
    }

    // Set the owner account as admin + beta
    await db
      .update(usersTable)
      .set({ isAdmin: true, plan: "beta" })
      .where(eq(usersTable.username, "QingTheCreator_"));

    // Upgrade all other existing users to beta (original testers)
    await db
      .update(usersTable)
      .set({ plan: "beta" })
      .where(eq(usersTable.isAdmin, false));

    logger.info("Admin bootstrap complete");
    res.json({ ok: true, message: "Bootstrap complete. QingTheCreator_ is now admin. All existing users set to beta." });
  } catch (err) {
    logger.error(err, "Bootstrap error");
    res.status(500).json({ error: "Bootstrap failed" });
  }
});

async function requireAdmin(req: AuthRequest, res: any, next: any) {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, req.user.userId));
  if (!user?.isAdmin) { res.status(403).json({ error: "Admin access required" }); return; }
  next();
}

adminRouter.get("/stats", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const allUsers = await db.select({ id: usersTable.id, plan: usersTable.plan }).from(usersTable);
    // Count paid tiers from completed deposits (most recent per user)
    const completedDeposits = await db
      .select({ userId: dextopusDepositsTable.userId, tier: dextopusDepositsTable.tier })
      .from(dextopusDepositsTable)
      .where(eq(dextopusDepositsTable.status, "COMPLETED"))
      .orderBy(desc(dextopusDepositsTable.updatedAt));
    // Keep only the most-recent completed deposit per user
    const latestTierByUser = new Map<number, string>();
    for (const d of completedDeposits) {
      if (d.userId !== null && !latestTierByUser.has(d.userId)) latestTierByUser.set(d.userId, d.tier ?? "");
    }
    const activePlanUserIds = new Set(allUsers.filter(u => u.plan === "active").map((u: any) => u.id));

    const stats = {
      beta:     allUsers.filter(u => u.plan === "beta").length,
      pending:  allUsers.filter(u => u.plan === "pending").length,
      trial:    allUsers.filter(u => u.plan === "trial").length,
      expired:  allUsers.filter(u => u.plan === "expired").length,
      monthly:  [...latestTierByUser.entries()].filter(([uid, t]) => t === "monthly" && activePlanUserIds.has(uid)).length,
      yearly:   [...latestTierByUser.entries()].filter(([uid, t]) => t === "yearly"  && activePlanUserIds.has(uid)).length,
      lifetime: allUsers.filter(u => u.plan === "lifetime").length,
      paid:     allUsers.filter(u => u.plan === "active" || u.plan === "lifetime").length,
      total:    allUsers.length,
    };
    res.json(stats);
  } catch (err) {
    logger.error(err, "Admin stats error");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

adminRouter.get("/users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        username: usersTable.username,
        plan: usersTable.plan,
        trialEndsAt: usersTable.trialEndsAt,
        approvedAt: usersTable.approvedAt,
        isAdmin: usersTable.isAdmin,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));
    res.json(users);
  } catch (err) {
    logger.error(err, "Admin users error");
    res.status(500).json({ error: "Failed to get users" });
  }
});

adminRouter.post("/approve/:userId", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId as string);
    const ends = trialEndsAt(14);
    const [user] = await db
      .update(usersTable)
      .set({ plan: "trial", trialEndsAt: ends, approvedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email, plan: usersTable.plan, trialEndsAt: usersTable.trialEndsAt });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    logger.info({ userId, trialEndsAt: ends }, "User approved for 14-day trial");
    res.json({ success: true, user });
    return;
  } catch (err) {
    logger.error(err, "Admin approve error");
    res.status(500).json({ error: "Failed to approve user" });
  }
});

adminRouter.post("/beta/:userId", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId as string);
    const [betaCount] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.plan, "beta"));
    if (Number(betaCount?.value ?? 0) >= 30) {
      res.status(400).json({ error: "Beta is full (30 creators max)" });
      return;
    }
    const [user] = await db
      .update(usersTable)
      .set({ plan: "beta", trialEndsAt: null, approvedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email, plan: usersTable.plan });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    logger.info({ userId }, "User promoted to beta");
    res.json({ success: true, user });
    return;
  } catch (err) {
    logger.error(err, "Admin beta error");
    res.status(500).json({ error: "Failed to promote to beta" });
  }
});

adminRouter.post("/revoke/:userId", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId as string);
    const [user] = await db
      .update(usersTable)
      .set({ plan: "expired" })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email, plan: usersTable.plan });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true, user });
    return;
  } catch (err) {
    logger.error(err, "Admin revoke error");
    res.status(500).json({ error: "Failed to revoke access" });
  }
});

adminRouter.post("/set-plan/:userId", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId as string);
    const { plan } = req.body as { plan: string };
    const validPlans = ["beta", "trial", "expired", "monthly", "yearly", "lifetime"];
    if (!validPlans.includes(plan)) {
      res.status(400).json({ error: "Invalid plan" });
      return;
    }
    if (plan === "beta") {
      const [betaCount] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.plan, "beta"));
      if (Number(betaCount?.value ?? 0) >= 30) {
        res.status(400).json({ error: "Beta is full (30 creators max)" });
        return;
      }
    }
    const now = new Date();
    const updates: Record<string, any> = {};
    if (plan === "trial") {
      updates.plan = "trial"; updates.trialEndsAt = trialEndsAt(14); updates.approvedAt = now;
    } else if (plan === "beta") {
      updates.plan = "beta"; updates.trialEndsAt = null; updates.approvedAt = now;
    } else if (plan === "monthly") {
      const ends = new Date(now); ends.setDate(ends.getDate() + 31);
      updates.plan = "active"; updates.subscriptionEndsAt = ends; updates.trialEndsAt = null; updates.approvedAt = now;
    } else if (plan === "yearly") {
      const ends = new Date(now); ends.setDate(ends.getDate() + 365);
      updates.plan = "active"; updates.subscriptionEndsAt = ends; updates.trialEndsAt = null; updates.approvedAt = now;
    } else if (plan === "lifetime") {
      updates.plan = "lifetime"; updates.subscriptionEndsAt = null; updates.trialEndsAt = null; updates.approvedAt = now;
    } else {
      updates.plan = "expired"; updates.trialEndsAt = null;
    }
    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email, plan: usersTable.plan, subscriptionEndsAt: usersTable.subscriptionEndsAt });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    logger.info({ userId, plan }, "Admin set user plan");
    res.json({ success: true, user });
    return;
  } catch (err) {
    logger.error(err, "Admin set-plan error");
    res.status(500).json({ error: "Failed to update plan" });
  }
});

// ── Payments: list pending deposits with tx_hash submitted ─────────────────
adminRouter.get("/payments", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const deposits = await db
      .select({
        id: dextopusDepositsTable.id,
        depositId: dextopusDepositsTable.depositId,
        depositAddress: dextopusDepositsTable.depositAddress,
        tier: dextopusDepositsTable.tier,
        expectedAmount: dextopusDepositsTable.expectedAmount,
        txHash: dextopusDepositsTable.txHash,
        status: dextopusDepositsTable.status,
        createdAt: dextopusDepositsTable.createdAt,
        updatedAt: dextopusDepositsTable.updatedAt,
        userId: dextopusDepositsTable.userId,
        username: usersTable.username,
        email: usersTable.email,
        userPlan: usersTable.plan,
      })
      .from(dextopusDepositsTable)
      .innerJoin(usersTable, eq(usersTable.id, dextopusDepositsTable.userId))
      .where(isNotNull(dextopusDepositsTable.txHash))
      .orderBy(desc(dextopusDepositsTable.updatedAt));
    res.json(deposits);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Payments: manually verify a deposit and activate user plan ─────────────
adminRouter.post("/payments/:depositId/verify", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { depositId } = req.params;
    const [deposit] = await db
      .select()
      .from(dextopusDepositsTable)
      .where(eq(dextopusDepositsTable.id, parseInt(depositId)));
    if (!deposit) {
      res.status(404).json({ error: "Deposit not found" });
      return;
    }

    // Mark deposit as COMPLETED
    await db
      .update(dextopusDepositsTable)
      .set({ status: "COMPLETED" })
      .where(eq(dextopusDepositsTable.id, deposit.id));

    // Activate user plan based on tier
    const now = new Date();
    const planUpdates: Record<string, any> = { approvedAt: now };
    if (deposit.tier === "monthly") {
      const ends = new Date(now); ends.setDate(ends.getDate() + 31);
      planUpdates.plan = "active"; planUpdates.subscriptionEndsAt = ends; planUpdates.trialEndsAt = null;
    } else if (deposit.tier === "yearly") {
      const ends = new Date(now); ends.setDate(ends.getDate() + 365);
      planUpdates.plan = "active"; planUpdates.subscriptionEndsAt = ends; planUpdates.trialEndsAt = null;
    } else if (deposit.tier === "lifetime") {
      planUpdates.plan = "lifetime"; planUpdates.subscriptionEndsAt = null; planUpdates.trialEndsAt = null;
    }

    await db.update(usersTable).set(planUpdates).where(eq(usersTable.id, deposit.userId));
    logger.info({ depositId: deposit.id, userId: deposit.userId, tier: deposit.tier }, "Admin manually verified payment");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/report — product-level aggregate analytics for admin progress reports
adminRouter.get("/report", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const h24 = hoursAgo(24);
    const h48 = hoursAgo(48);
    const d7 = hoursAgo(24 * 7);
    const d30 = hoursAgo(24 * 30);

    const [allUsers, allBounties, allEarnings] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(bountiesTable),
      db.select().from(earningsTable),
    ]);

    // Time-bucketed counts
    const usersLast24h = allUsers.filter(u => new Date(u.createdAt) >= h24).length;
    const usersLast48h = allUsers.filter(u => new Date(u.createdAt) >= h48).length;
    const usersLast7d = allUsers.filter(u => new Date(u.createdAt) >= d7).length;
    const usersLast30d = allUsers.filter(u => new Date(u.createdAt) >= d30).length;

    const bountiesLast24h = allBounties.filter(b => new Date(b.createdAt) >= h24).length;
    const bountiesLast48h = allBounties.filter(b => new Date(b.createdAt) >= h48).length;
    const bountiesLast7d = allBounties.filter(b => new Date(b.createdAt) >= d7).length;
    const bountiesLast30d = allBounties.filter(b => new Date(b.createdAt) >= d30).length;

    const earningsLast24h = allEarnings.filter(e => new Date(e.createdAt) >= h24).reduce((s, e) => s + (e.amount ?? 0), 0);
    const earningsLast48h = allEarnings.filter(e => new Date(e.createdAt) >= h48).reduce((s, e) => s + (e.amount ?? 0), 0);
    const earningsLast7d = allEarnings.filter(e => new Date(e.createdAt) >= d7).reduce((s, e) => s + (e.amount ?? 0), 0);
    const earningsLast30d = allEarnings.filter(e => new Date(e.createdAt) >= d30).reduce((s, e) => s + (e.amount ?? 0), 0);

    const totalHoursSaved = allBounties.reduce((sum, b) => sum + (b.hoursSaved ?? 0), 0);
    const hoursSavedLast24h = allBounties
      .filter(b => b.hoursSaved && new Date(b.createdAt) >= h24)
      .reduce((sum, b) => sum + (b.hoursSaved ?? 0), 0);
    const hoursSavedLast48h = allBounties
      .filter(b => b.hoursSaved && new Date(b.createdAt) >= h48)
      .reduce((sum, b) => sum + (b.hoursSaved ?? 0), 0);
    const hoursSavedLast7d = allBounties
      .filter(b => b.hoursSaved && new Date(b.createdAt) >= d7)
      .reduce((sum, b) => sum + (b.hoursSaved ?? 0), 0);
    const hoursSavedLast30d = allBounties
      .filter(b => b.hoursSaved && new Date(b.createdAt) >= d30)
      .reduce((sum, b) => sum + (b.hoursSaved ?? 0), 0);

    // Totals
    const totalUsers = allUsers.length;
    const totalBounties = allBounties.length;
    const totalEarnings = allEarnings.reduce((s, e) => s + (e.amount ?? 0), 0);
    const totalClaimed = allBounties.filter(b => b.status !== "discovered").length;
    const totalWon = allBounties.filter(b => b.status === "won").length;
    const totalLost = allBounties.filter(b => b.status === "lost").length;
    const decided = totalWon + totalLost;
    const winRate = decided > 0 ? Math.round((totalWon / decided) * 100) : 0;

    // Top platforms
    const platformMap: Record<string, { count: number; reward: number }> = {};
    for (const b of allBounties) {
      const p = b.platform ?? "Unknown";
      if (!platformMap[p]) platformMap[p] = { count: 0, reward: 0 };
      platformMap[p].count++;
      platformMap[p].reward += parseFloat(b.rewardAmount ?? "0");
    }
    const platformBreakdown = Object.entries(platformMap)
      .map(([platform, d]) => ({ platform, count: d.count, totalReward: d.reward }))
      .sort((a, b) => b.count - a.count);

    // Top earners
    const userEarnings: Record<number, number> = {};
    for (const e of allEarnings) {
      if (e.userId) userEarnings[e.userId] = (userEarnings[e.userId] ?? 0) + (e.amount ?? 0);
    }
    const topEarners = Object.entries(userEarnings)
      .map(([userId, amount]) => {
        const u = allUsers.find(u => u.id === Number(userId));
        return { username: u?.username ?? "unknown", amount };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Active users (have claimed a bounty in last 7d)
    const activeUserIds = new Set(
      allBounties
        .filter(b => b.status !== "discovered" && new Date(b.createdAt) >= d7)
        .map(b => b.userId)
    ).size;

    res.json({
      generatedAt: now.toISOString(),
      users: {
        total: totalUsers,
        last24h: usersLast24h,
        last48h: usersLast48h,
        last7d: usersLast7d,
        last30d: usersLast30d,
        activeLast7d: activeUserIds,
      },
      bounties: {
        total: totalBounties,
        claimed: totalClaimed,
        won: totalWon,
        lost: totalLost,
        winRate,
        last24h: bountiesLast24h,
        last48h: bountiesLast48h,
        last7d: bountiesLast7d,
        last30d: bountiesLast30d,
      },
      earnings: {
        total: totalEarnings,
        last24h: earningsLast24h,
        last48h: earningsLast48h,
        last7d: earningsLast7d,
        last30d: earningsLast30d,
      },
      hoursSaved: {
        total: totalHoursSaved,
        last24h: hoursSavedLast24h,
        last48h: hoursSavedLast48h,
        last7d: hoursSavedLast7d,
        last30d: hoursSavedLast30d,
      },
      platformBreakdown,
      topEarners,
    });
  } catch (err) {
    logger.error(err, "Admin report error");
    res.status(500).json({ error: "Failed to get report" });
  }
});

// GET /admin/insights — AI-powered growth + marketing insights via Novus
// Feeds product-wide metrics to Novus for strategic recommendations.
adminRouter.get("/insights", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const h24 = hoursAgo(24);
    const h48 = hoursAgo(48);
    const d7 = hoursAgo(24 * 7);
    const d30 = hoursAgo(24 * 30);

    const [allUsers, allBounties, allEarnings] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(bountiesTable),
      db.select().from(earningsTable),
    ]);

    const usersLast24h = allUsers.filter(u => new Date(u.createdAt) >= h24).length;
    const usersLast7d = allUsers.filter(u => new Date(u.createdAt) >= d7).length;
    const usersLast30d = allUsers.filter(u => new Date(u.createdAt) >= d30).length;
    const activeUserIds = new Set(
      allBounties.filter(b => b.status !== "discovered" && new Date(b.createdAt) >= d7).map(b => b.userId)
    ).size;

    const bountiesLast7d = allBounties.filter(b => new Date(b.createdAt) >= d7).length;
    const totalWon = allBounties.filter(b => b.status === "won").length;
    const totalLost = allBounties.filter(b => b.status === "lost").length;
    const decided = totalWon + totalLost;
    const winRate = decided > 0 ? Math.round((totalWon / decided) * 100) : 0;
    const totalClaimed = allBounties.filter(b => b.status !== "discovered").length;

    const earningsLast7d = allEarnings.filter(e => new Date(e.createdAt) >= d7).reduce((s, e) => s + (e.amount ?? 0), 0);
    const totalEarnings = allEarnings.reduce((s, e) => s + (e.amount ?? 0), 0);

    const totalHoursSaved = allBounties.reduce((sum, b) => sum + (b.hoursSaved ?? 0), 0);
    const hoursSavedLast7d = allBounties
      .filter(b => b.hoursSaved && new Date(b.createdAt) >= d7)
      .reduce((sum, b) => sum + (b.hoursSaved ?? 0), 0);

    const platformMap: Record<string, { count: number; reward: number }> = {};
    for (const b of allBounties) {
      const p = b.platform ?? "Unknown";
      if (!platformMap[p]) platformMap[p] = { count: 0, reward: 0 };
      platformMap[p].count++;
      platformMap[p].reward += parseFloat(b.rewardAmount ?? "0");
    }
    const platformBreakdown = Object.entries(platformMap)
      .map(([platform, d]) => ({ platform, count: d.count, totalReward: d.reward }))
      .sort((a, b) => b.count - a.count);

    const userEarnings: Record<number, number> = {};
    for (const e of allEarnings) {
      if (e.userId) userEarnings[e.userId] = (userEarnings[e.userId] ?? 0) + (e.amount ?? 0);
    }
    const topEarners = Object.entries(userEarnings)
      .map(([userId, amount]) => {
        const u = allUsers.find(u => u.id === Number(userId));
        return { username: u?.username ?? "unknown", amount };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const insights = await analyzeAdminInsights({
      users: { total: allUsers.length, last24h: usersLast24h, last7d: usersLast7d, last30d: usersLast30d, activeLast7d: activeUserIds },
      bounties: { total: allBounties.length, claimed: totalClaimed, won: totalWon, lost: totalLost, winRate, last7d: bountiesLast7d },
      earnings: { total: totalEarnings, last7d: earningsLast7d },
      hoursSaved: { total: totalHoursSaved, last7d: hoursSavedLast7d },
      platformBreakdown,
      topEarners,
    });

    res.json({ insights, hasNovus: !!insights });
  } catch (err) {
    logger.error(err, "Admin insights error");
    res.status(500).json({ error: "Failed to get admin insights" });
  }
});

// GET /admin/bounty-reports
adminRouter.get("/bounty-reports", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const reports = await db
      .select()
      .from(bountyReportsTable)
      .where(eq(bountyReportsTable.status, "open"))
      .orderBy(desc(bountyReportsTable.createdAt));
    // Fetch bounty details for each
    const allBounties = await db.select().from(bountiesTable);
    const allUsers = await db.select({ id: usersTable.id, username: usersTable.username }).from(usersTable);
    const enriched = reports.map(r => {
      const b = allBounties.find(b => b.id === r.bountyId);
      const u = allUsers.find(u => u.id === r.userId);
      return {
        ...r,
        bounty: b ? { id: b.id, title: b.title, url: b.url, platform: b.platform, rewardAmount: b.rewardAmount } : null,
        reportedBy: u?.username ?? "unknown",
      };
    });
    res.json(enriched);
  } catch (err) {
    logger.error(err, "Admin bounty-reports error");
    res.status(500).json({ error: "Failed to get reports" });
  }
});

// POST /admin/bounty-reports/:id/resolve
adminRouter.post("/bounty-reports/:id/resolve", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { resolution } = req.body as { resolution?: string };
    const [report] = await db
      .update(bountyReportsTable)
      .set({ status: "resolved", resolvedAt: new Date(), resolvedBy: req.user!.userId, resolution: resolution || "resolved" })
      .where(eq(bountyReportsTable.id, id))
      .returning();
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    logger.info({ reportId: id, resolution }, "Report resolved");
    res.json({ success: true, report });
    return;
  } catch (err) {
    logger.error(err, "Admin resolve report error");
    res.status(500).json({ error: "Failed to resolve" });
  }
});

// DELETE /admin/bounty-reports/:id
adminRouter.delete("/bounty-reports/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(bountyReportsTable).where(eq(bountyReportsTable.id, id));
    logger.info({ reportId: id }, "Report deleted");
    res.status(204).send();
    return;
  } catch (err) {
    logger.error(err, "Admin delete report error");
    res.status(500).json({ error: "Failed to delete" });
  }
});

// DELETE /admin/bounty-reports/:id/remove-bounty
adminRouter.delete("/bounty-reports/:id/remove-bounty", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [report] = await db.select().from(bountyReportsTable).where(eq(bountyReportsTable.id, id));
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    await db.delete(bountiesTable).where(eq(bountiesTable.id, report.bountyId));
    await db.delete(bountyReportsTable).where(eq(bountyReportsTable.bountyId, report.bountyId));
    logger.info({ bountyId: report.bountyId, reportId: id }, "Bounty removed via report");
    res.json({ success: true, bountyId: report.bountyId });
    return;
  } catch (err) {
    logger.error(err, "Admin remove bounty error");
    res.status(500).json({ error: "Failed to remove" });
  }
});

// POST /admin/backfill-gamification
// One-time (but idempotent) backfill: awards correct points + badges to every user
// who has at least one earning. Safe to call multiple times — awardPointsAndBadges()
// never inserts duplicate badges.
adminRouter.post("/backfill-gamification", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const usersWithEarnings = await db
      .selectDistinct({ userId: earningsTable.userId })
      .from(earningsTable);

    const userIds = usersWithEarnings
      .map((r) => r.userId)
      .filter((id): id is number => id !== null);

    logger.info({ count: userIds.length }, "Starting gamification backfill");

    const results: { userId: number; status: "ok" | "error" }[] = [];

    for (const userId of userIds) {
      try {
        await awardPointsAndBadges(userId);
        results.push({ userId, status: "ok" });
      } catch (err) {
        logger.error({ userId, err }, "Backfill failed for user");
        results.push({ userId, status: "error" });
      }
    }

    const succeeded = results.filter((r) => r.status === "ok").length;
    const failed = results.filter((r) => r.status === "error").length;

    logger.info({ succeeded, failed }, "Gamification backfill complete");
    res.json({ ok: true, processed: userIds.length, succeeded, failed, results });
  } catch (err) {
    logger.error(err, "Backfill gamification error");
    res.status(500).json({ error: "Backfill failed" });
  }
});
