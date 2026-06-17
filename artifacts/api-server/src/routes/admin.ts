import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, bountiesTable, earningsTable, bountyReportsTable } from "@workspace/db";
import { dextopusDepositsTable } from "@workspace/db";
import { referralsTable, affiliateCommissionsTable } from "@workspace/db";
import { eq, count, desc, gte, sql, isNotNull, and, ilike, or, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { trialEndsAt } from "../lib/access.js";
import { analyzeAdminInsights } from "../lib/novus.js";
import { awardPointsAndBadges } from "../lib/gamification.js";
import { siteUpdatesTable, userNotificationsTable } from "@workspace/db";

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

adminRouter.get("/stats", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const allUsers = await db.select({ id: usersTable.id, plan: usersTable.plan }).from(usersTable);

    // Use deposits to distinguish monthly vs yearly for deposit-based subscribers
    const completedDeposits = await db
      .select({ userId: dextopusDepositsTable.userId, tier: dextopusDepositsTable.tier })
      .from(dextopusDepositsTable)
      .where(eq(dextopusDepositsTable.status, "COMPLETED"))
      .orderBy(desc(dextopusDepositsTable.updatedAt));

    // Latest completed deposit tier per active user
    const latestTierByUser = new Map<number, string>();
    for (const d of completedDeposits) {
      if (d.userId !== null && !latestTierByUser.has(d.userId)) {
        latestTierByUser.set(d.userId, d.tier ?? "");
      }
    }

    const activeUsers  = allUsers.filter(u => u.plan === "active");
    const lifetimeUsers = allUsers.filter(u => u.plan === "lifetime");

    // Users with a deposit record get their tier from there; rest counted as monthly (manually activated)
    let monthlyCount = 0;
    let yearlyCount = 0;
    for (const u of activeUsers) {
      const tier = latestTierByUser.get(u.id);
      if (tier === "yearly") yearlyCount++;
      else monthlyCount++; // monthly deposit OR manually activated by admin
    }

    const stats = {
      beta:     allUsers.filter(u => u.plan === "beta").length,
      pending:  allUsers.filter(u => u.plan === "pending").length,
      trial:    allUsers.filter(u => u.plan === "trial").length,
      expired:  allUsers.filter(u => u.plan === "expired").length,
      monthly:  monthlyCount,
      yearly:   yearlyCount,
      lifetime: lifetimeUsers.length,
      paid:     activeUsers.length + lifetimeUsers.length,
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
    const { plan } = req.body;
    const validPlans = ["pending", "trial", "beta", "expired", "active", "lifetime", "yearly", "monthly"];
    if (!validPlans.includes(plan)) {
      res.status(400).json({ error: "Invalid plan" });
      return;
    }

    // Map tier labels to DB plan values + set expiry
    let dbPlan = plan;
    let extraFields: Record<string, unknown> = {};
    if (plan === "yearly") {
      dbPlan = "active";
      const ends = new Date();
      ends.setDate(ends.getDate() + 365);
      extraFields = { subscriptionEndsAt: ends, trialEndsAt: null };
    } else if (plan === "monthly") {
      dbPlan = "active";
      const ends = new Date();
      ends.setDate(ends.getDate() + 31);
      extraFields = { subscriptionEndsAt: ends, trialEndsAt: null };
    } else if (plan === "trial") {
      extraFields = { trialEndsAt: trialEndsAt(14) };
    } else if (plan === "lifetime") {
      extraFields = { subscriptionEndsAt: null, trialEndsAt: null };
    }

    const [user] = await db
      .update(usersTable)
      .set({ plan: dbPlan, ...extraFields })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email, plan: usersTable.plan });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true, user });
    return;
  } catch (err) {
    logger.error(err, "Admin set-plan error");
    res.status(500).json({ error: "Failed to set plan" });
  }
});

adminRouter.get("/report", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const userCols = await db.select({ id: usersTable.id, createdAt: usersTable.createdAt, updatedAt: usersTable.updatedAt }).from(usersTable);
    const bounties = await db.select({ id: bountiesTable.id, createdAt: bountiesTable.createdAt, status: bountiesTable.status }).from(bountiesTable);
    const earnings = await db.select({ id: earningsTable.id, amount: earningsTable.amount, createdAt: earningsTable.createdAt }).from(earningsTable);
    const reports = await db.select({ id: bountyReportsTable.id, createdAt: bountyReportsTable.createdAt }).from(bountyReportsTable);

    const now = Date.now();
    const h24 = now - 24 * 60 * 60 * 1000;
    const h48 = now - 48 * 60 * 60 * 1000;
    const d7  = now - 7 * 24 * 60 * 60 * 1000;
    const d30 = now - 30 * 24 * 60 * 60 * 1000;

    const aggUsers24 = userCols.filter((u) => u.createdAt && new Date(u.createdAt).getTime() > h24).length;
    const aggUsers48 = userCols.filter((u) => u.createdAt && new Date(u.createdAt).getTime() > h48).length;
    const aggUsers7  = userCols.filter((u) => u.createdAt && new Date(u.createdAt).getTime() > d7).length;
    const aggUsers30 = userCols.filter((u) => u.createdAt && new Date(u.createdAt).getTime() > d30).length;

    // DAU: users with updatedAt in last 24h (meaning they were active)
    const dau = userCols.filter((u) => u.updatedAt && new Date(u.updatedAt).getTime() > h24).length;
    const active7d = userCols.filter((u) => u.updatedAt && new Date(u.updatedAt).getTime() > d7).length;

    const wonBounties = bounties.filter((b) => b.status === "won");
    const totalBounties = bounties.length;
    const wonCount = wonBounties.length;
    const winRate = totalBounties > 0 ? Math.round((wonCount / totalBounties) * 100) : 0;

    const b24 = bounties.filter((b) => b.createdAt && new Date(b.createdAt).getTime() > h24).length;
    const b48 = bounties.filter((b) => b.createdAt && new Date(b.createdAt).getTime() > h48).length;
    const b7  = bounties.filter((b) => b.createdAt && new Date(b.createdAt).getTime() > d7).length;
    const b30 = bounties.filter((b) => b.createdAt && new Date(b.createdAt).getTime() > d30).length;

    const totalEarned = earnings.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const e24 = earnings.filter((e) => e.createdAt && new Date(e.createdAt).getTime() > h24).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const e48 = earnings.filter((e) => e.createdAt && new Date(e.createdAt).getTime() > h48).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const e7  = earnings.filter((e) => e.createdAt && new Date(e.createdAt).getTime() > d7).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const e30 = earnings.filter((e) => e.createdAt && new Date(e.createdAt).getTime() > d30).reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const totalHoursSaved = reports.length * 2;
    const hs24 = reports.filter((r) => r.createdAt && new Date(r.createdAt).getTime() > h24).length * 2;
    const hs48 = reports.filter((r) => r.createdAt && new Date(r.createdAt).getTime() > h48).length * 2;
    const hs7  = reports.filter((r) => r.createdAt && new Date(r.createdAt).getTime() > d7).length * 2;
    const hs30 = reports.filter((r) => r.createdAt && new Date(r.createdAt).getTime() > d30).length * 2;

    const platformMap = new Map<string, { count: number; totalReward: number }>();
    for (const r of reports) {
      const p = "Unknown";
      const entry = platformMap.get(p) ?? { count: 0, totalReward: 0 };
      entry.count += 1;
      entry.totalReward += 0;
      platformMap.set(p, entry);
    }
    const platformBreakdown = Array.from(platformMap.entries()).map(([platform, v]) => ({ platform, count: v.count, totalReward: v.totalReward })).sort((a, b) => b.count - a.count);

    const earningsMap = new Map<string, number>();
    for (const e of earnings) {
      const amt = Number(e.amount) || 0;
      if (amt <= 0) continue;
      const key = `user_${e.id}`;
      earningsMap.set(key, (earningsMap.get(key) || 0) + amt);
    }
    const topEarners = [];
    // Top earners need user data, so we'll fetch separately
    const userIds = [...new Set(earnings.map((e) => e.id))];
    const earners = userIds.map((uid) => ({
      username: "User",
      amount: earningsMap.get(`user_${uid}`) || 0,
    }));

    res.json({
      generatedAt: new Date().toISOString(),
      users: {
        total: userCols.length,
        last24h: aggUsers24,
        last48h: aggUsers48,
        last7d: aggUsers7,
        last30d: aggUsers30,
        activeLast7d: active7d,
        dau, // daily active users
      },
      bounties: {
        total: totalBounties,
        claimed: bounties.filter((b) => b.status === "claimed").length,
        won: wonCount,
        lost: bounties.filter((b) => b.status === "lost").length,
        winRate,
        last24h: b24,
        last48h: b48,
        last7d: b7,
        last30d: b30,
      },
      earnings: {
        total: totalEarned,
        last24h: e24,
        last48h: e48,
        last7d: e7,
        last30d: e30,
      },
      hoursSaved: {
        total: totalHoursSaved,
        last24h: hs24,
        last48h: hs48,
        last7d: hs7,
        last30d: hs30,
      },
      platformBreakdown,
      topEarners: earners.sort((a, b) => b.amount - a.amount).slice(0, 10),
    });
  } catch (err) {
    logger.error(err, "Admin report error");
    res.status(500).json({ error: "Failed to generate report" });
  }
});

adminRouter.get("/payments", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const deposits = await db
      .select()
      .from(dextopusDepositsTable)
      .orderBy(desc(dextopusDepositsTable.createdAt));
    const enriched = deposits.map((d) => ({
      ...d,
      userId: null,
      username: "",
      email: "",
      userPlan: "",
    }));
    res.json(enriched);
  } catch (err) {
    logger.error(err, "Admin payments error");
    res.status(500).json({ error: "Failed to get payments" });
  }
});

adminRouter.post("/verify-payment", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { depositId } = req.body;
    if (!depositId) { res.status(400).json({ error: "depositId required" }); return; }
    res.json({ success: true, message: "Mock verify" });
  } catch (err) {
    logger.error(err, "Admin verify-payment error");
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

adminRouter.get("/insights", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [allUsers, allBounties, allEarnings, allReports] = await Promise.all([
      db.select({ id: usersTable.id, createdAt: usersTable.createdAt, updatedAt: usersTable.updatedAt }).from(usersTable),
      db.select({ id: bountiesTable.id, status: bountiesTable.status, createdAt: bountiesTable.createdAt }).from(bountiesTable),
      db.select({ id: earningsTable.id, amount: earningsTable.amount, createdAt: earningsTable.createdAt, userId: earningsTable.userId }).from(earningsTable),
      db.select({ id: bountyReportsTable.id, createdAt: bountyReportsTable.createdAt }).from(bountyReportsTable),
    ]);
    const now = Date.now();
    const d7 = now - 7 * 24 * 60 * 60 * 1000;
    const d30 = now - 30 * 24 * 60 * 60 * 1000;
    const insightData = {
      users: {
        total: allUsers.length,
        last24h: allUsers.filter((u) => u.createdAt && new Date(u.createdAt).getTime() > now - 86400000).length,
        last7d: allUsers.filter((u) => u.createdAt && new Date(u.createdAt).getTime() > d7).length,
        last30d: allUsers.filter((u) => u.createdAt && new Date(u.createdAt).getTime() > d30).length,
        activeLast7d: allUsers.filter((u) => u.updatedAt && new Date(u.updatedAt).getTime() > d7).length,
      },
      bounties: {
        total: allBounties.length,
        claimed: allBounties.filter((b) => b.status === "claimed").length,
        won: allBounties.filter((b) => b.status === "won").length,
        lost: allBounties.filter((b) => b.status === "lost").length,
        winRate: allBounties.length > 0 ? Math.round((allBounties.filter((b) => b.status === "won").length / allBounties.length) * 100) : 0,
        last7d: allBounties.filter((b) => b.createdAt && new Date(b.createdAt).getTime() > d7).length,
      },
      earnings: {
        total: allEarnings.reduce((s, e) => s + (Number(e.amount) || 0), 0),
        last7d: allEarnings.filter((e) => e.createdAt && new Date(e.createdAt).getTime() > d7).reduce((s, e) => s + (Number(e.amount) || 0), 0),
      },
      hoursSaved: {
        total: allReports.length * 2,
        last7d: allReports.filter((r) => r.createdAt && new Date(r.createdAt).getTime() > d7).length * 2,
      },
      platformBreakdown: [] as { platform: string; count: number; totalReward: number }[],
      topEarners: [] as { username: string; amount: number }[],
    };
    const insights = await analyzeAdminInsights(insightData);
    res.json({ insights });
  } catch (err) {
    logger.error(err, "Admin insights error");
    res.status(500).json({ error: "Failed to get insights" });
  }
});

// GET /admin/updates — list all site updates (admin)
adminRouter.get("/updates", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const updates = await db
      .select()
      .from(siteUpdatesTable)
      .orderBy(desc(siteUpdatesTable.createdAt));
    res.json(updates);
  } catch (err) {
    logger.error(err, "Admin updates error");
    res.status(500).json({ error: "Failed to get updates" });
  }
});

// POST /admin/updates — create a new site update
adminRouter.post("/updates", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { title, body, category = "update", pinned = false } = req.body;
    if (!title || !body) {
      res.status(400).json({ error: "Title and body are required" });
      return;
    }
    const [inserted] = await db
      .insert(siteUpdatesTable)
      .values({ title, body, category, pinned })
      .returning();

    // Auto-create notification records for all users
    const allUsers = await db.select({ id: usersTable.id }).from(usersTable);
    if (allUsers.length > 0) {
      await db.insert(userNotificationsTable).values(
        allUsers.map((u) => ({
          userId: u.id,
          updateId: inserted.id,
          read: false,
        }))
      );
    }

    res.json({ ok: true, update: inserted });
  } catch (err) {
    logger.error(err, "Admin create update error");
    res.status(500).json({ error: "Failed to create update" });
  }
});

// DELETE /admin/updates/:id — delete a site update
adminRouter.delete("/updates/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    await db.delete(userNotificationsTable).where(eq(userNotificationsTable.updateId, id));
    await db.delete(siteUpdatesTable).where(eq(siteUpdatesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "Admin delete update error");
    res.status(500).json({ error: "Failed to delete update" });
  }
});

// GET /admin/dau — daily active users for last 30 days
adminRouter.get("/dau", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await db.select({ updatedAt: usersTable.updatedAt }).from(usersTable);
    const now = new Date();
    const days: { date: string; dau: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const count = users.filter((u) => {
        const t = u.updatedAt ? new Date(u.updatedAt).getTime() : 0;
        return t >= day.getTime() && t < nextDay.getTime();
      }).length;
      days.push({ date: day.toISOString().split("T")[0], dau: count });
    }
    res.json({ days });
  } catch (err) {
    logger.error(err, "Admin DAU error");
    res.status(500).json({ error: "Failed to get DAU" });
  }
});

// ── POST /admin/backfill-commissions ──────────────────────────
// One-time idempotent backfill: creates affiliate_commissions rows for any
// referral that has already converted to a paid plan but has no commission row.
// Safe to run multiple times — ON CONFLICT DO NOTHING prevents duplicates.
adminRouter.post("/backfill-commissions", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const PAYING_PLANS = ["active", "yearly", "lifetime"];

    function resolveCommPlan(plan: string, tier: string | null | undefined): string {
      if (tier === "lifetime" || plan === "lifetime") return "lifetime";
      if (tier === "yearly" || plan === "yearly") return "yearly";
      return "monthly";
    }

    function resolveCommAmount(commPlan: string): number {
      if (commPlan === "lifetime") return 50;
      if (commPlan === "yearly") return 9;
      return 1;
    }

    function resolveCommStatus(commPlan: string): string {
      if (commPlan === "lifetime" || commPlan === "yearly") return "approved";
      return "pending";
    }

    // Find all converted referrals that are missing a commission row.
    const qualifying = await db
      .select({
        id: referralsTable.id,
        referrerId: referralsTable.referrerId,
        referredUserId: referralsTable.referredUserId,
        referredUserPlan: referralsTable.referredUserPlan,
        tier: referralsTable.tier,
      })
      .from(referralsTable)
      .where(inArray(referralsTable.referredUserPlan, PAYING_PLANS));

    if (qualifying.length === 0) {
      res.json({ inserted: 0, skipped: 0, message: "No qualifying referrals found." });
      return;
    }

    // Fetch existing commission referral IDs to report skipped count.
    const existingRows = await db
      .select({ referralId: affiliateCommissionsTable.referralId })
      .from(affiliateCommissionsTable)
      .where(inArray(affiliateCommissionsTable.referralId, qualifying.map((r) => r.id)));

    const existingReferralIds = new Set(existingRows.map((r) => r.referralId));

    const toInsert = qualifying.map((r) => {
      const commPlan = resolveCommPlan(r.referredUserPlan, r.tier);
      const commAmount = resolveCommAmount(commPlan);
      const commStatus = resolveCommStatus(commPlan);
      return {
        referrerId: r.referrerId,
        referredUserId: r.referredUserId,
        referralId: r.id,
        plan: commPlan,
        amount: commAmount.toFixed(2),
        status: commStatus,
      };
    });

    // Batch insert — ON CONFLICT DO NOTHING makes this idempotent.
    await db
      .insert(affiliateCommissionsTable)
      .values(toInsert)
      .onConflictDoNothing({ target: affiliateCommissionsTable.referralId });

    const inserted = toInsert.filter((r) => !existingReferralIds.has(r.referralId)).length;
    const skipped = existingReferralIds.size;

    logger.info({ total: qualifying.length, inserted, skipped }, "Commission backfill complete");
    res.json({
      inserted,
      skipped,
      total: qualifying.length,
      message: `Backfill complete. ${inserted} commission(s) created, ${skipped} already existed.`,
    });
  } catch (err) {
    logger.error(err, "Commission backfill error");
    res.status(500).json({ error: "Commission backfill failed" });
  }
});
