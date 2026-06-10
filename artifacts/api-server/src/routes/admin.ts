import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, bountiesTable, earningsTable } from "@workspace/db";
import { eq, count, desc, gte, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { trialEndsAt } from "../lib/access.js";

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
    const allUsers = await db.select({ plan: usersTable.plan }).from(usersTable);
    const stats = {
      beta: allUsers.filter(u => u.plan === "beta").length,
      pending: allUsers.filter(u => u.plan === "pending").length,
      trial: allUsers.filter(u => u.plan === "trial").length,
      expired: allUsers.filter(u => u.plan === "expired").length,
      total: allUsers.length,
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
    const userId = parseInt(req.params.userId);
    const ends = trialEndsAt(14);
    const [user] = await db
      .update(usersTable)
      .set({ plan: "trial", trialEndsAt: ends, approvedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email, plan: usersTable.plan, trialEndsAt: usersTable.trialEndsAt });
    if (!user) return res.status(404).json({ error: "User not found" });
    logger.info({ userId, trialEndsAt: ends }, "User approved for 14-day trial");
    res.json({ success: true, user });
  } catch (err) {
    logger.error(err, "Admin approve error");
    res.status(500).json({ error: "Failed to approve user" });
  }
});

adminRouter.post("/beta/:userId", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const [betaCount] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.plan, "beta"));
    if (Number(betaCount?.value ?? 0) >= 30) {
      return res.status(400).json({ error: "Beta is full (30 creators max)" });
    }
    const [user] = await db
      .update(usersTable)
      .set({ plan: "beta", trialEndsAt: null, approvedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email, plan: usersTable.plan });
    if (!user) return res.status(404).json({ error: "User not found" });
    logger.info({ userId }, "User promoted to beta");
    res.json({ success: true, user });
  } catch (err) {
    logger.error(err, "Admin beta error");
    res.status(500).json({ error: "Failed to promote to beta" });
  }
});

adminRouter.post("/revoke/:userId", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const [user] = await db
      .update(usersTable)
      .set({ plan: "expired" })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email, plan: usersTable.plan });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, user });
  } catch (err) {
    logger.error(err, "Admin revoke error");
    res.status(500).json({ error: "Failed to revoke access" });
  }
});

adminRouter.post("/set-plan/:userId", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { plan } = req.body as { plan: string };
    if (!["beta", "trial", "expired"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }
    if (plan === "beta") {
      const [betaCount] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.plan, "beta"));
      if (Number(betaCount?.value ?? 0) >= 30) {
        return res.status(400).json({ error: "Beta is full (30 creators max)" });
      }
    }
    const updates: Record<string, any> = { plan };
    if (plan === "trial") { updates.trialEndsAt = trialEndsAt(14); updates.approvedAt = new Date(); }
    if (plan === "beta") { updates.trialEndsAt = null; updates.approvedAt = new Date(); }
    if (plan === "pending" || plan === "expired") { updates.trialEndsAt = null; }
    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email, plan: usersTable.plan });
    if (!user) return res.status(404).json({ error: "User not found" });
    logger.info({ userId, plan }, "Admin set user plan");
    res.json({ success: true, user });
  } catch (err) {
    logger.error(err, "Admin set-plan error");
    res.status(500).json({ error: "Failed to update plan" });
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
