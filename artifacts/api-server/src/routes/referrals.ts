import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, referralsTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

export const referralsRouter = Router();

// Qualification thresholds
const MIN_REFERRALS = 5;

function qualifiesForReward(totalReferrals: number, hasPremiumReferral: boolean) {
  return totalReferrals >= MIN_REFERRALS || hasPremiumReferral;
}

// GET /referrals/my — user's referral stats + code
referralsRouter.get("/my", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const [user] = await db
      .select({ referralCode: usersTable.referralCode, username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const referralRows = await db
      .select({
        id: referralsTable.id,
        referredUserId: referralsTable.referredUserId,
        referredUserPlan: referralsTable.referredUserPlan,
        qualifies: referralsTable.qualifies,
        rewardGranted: referralsTable.rewardGranted,
        createdAt: referralsTable.createdAt,
      })
      .from(referralsTable)
      .where(eq(referralsTable.referrerId, userId))
      .orderBy(desc(referralsTable.createdAt));

    const total = referralRows.length;
    const hasPremiumReferral = referralRows.some(r =>
      r.referredUserPlan === "active" || r.referredUserPlan === "lifetime"
    );
    const qualified = qualifiesForReward(total, hasPremiumReferral);

    const baseUrl = process.env.APP_URL || "https://bountypilot.xyz";
    const referralLink = `${baseUrl}/signup?ref=${user.referralCode}`;

    res.json({
      referralCode: user.referralCode,
      referralLink,
      totalReferrals: total,
      qualifies: qualified,
      minRequired: MIN_REFERRALS,
      hasPremiumReferral,
      referrals: referralRows,
    });
  } catch (err) {
    logger.error(err, "Get referrals error");
    res.status(500).json({ error: "Failed to get referrals" });
  }
});

// GET /referrals/leaderboard — top referrers
referralsRouter.get("/leaderboard", async (_req, res) => {
  try {
    const rows = await db
      .select({
        referrerId: referralsTable.referrerId,
        username: usersTable.username,
        total: count(referralsTable.id),
        premiumCount: sql<number>`COUNT(*) FILTER (WHERE ${referralsTable.referredUserPlan} IN ('active','lifetime'))`.mapWith(Number),
      })
      .from(referralsTable)
      .innerJoin(usersTable, eq(usersTable.id, referralsTable.referrerId))
      .groupBy(referralsTable.referrerId, usersTable.username)
      .orderBy(desc(count(referralsTable.id)))
      .limit(20);

    const leaderboard = rows.map((r, i) => ({
      rank: i + 1,
      username: r.username,
      totalReferrals: Number(r.total),
      hasPremiumReferral: Number(r.premiumCount) > 0,
      qualifies: qualifiesForReward(Number(r.total), Number(r.premiumCount) > 0),
    }));

    res.json({ leaderboard, minRequired: MIN_REFERRALS });
  } catch (err) {
    logger.error(err, "Leaderboard error");
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

// POST /referrals/record — internal: called after signup/google auth with a ref code
referralsRouter.post("/record", async (req, res) => {
  try {
    const { referralCode, newUserId } = req.body;
    if (!referralCode || !newUserId) {
      res.status(400).json({ error: "Missing referralCode or newUserId" });
      return;
    }

    const [referrer] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.referralCode, referralCode));

    if (!referrer || referrer.id === newUserId) {
      res.json({ recorded: false });
      return;
    }

    // Check not already recorded
    const existing = await db
      .select({ id: referralsTable.id })
      .from(referralsTable)
      .where(eq(referralsTable.referredUserId, newUserId));
    if (existing.length > 0) {
      res.json({ recorded: false, reason: "already recorded" });
      return;
    }

    await db.insert(referralsTable).values({
      referrerId: referrer.id,
      referredUserId: newUserId,
    });

    // Mark referred_by on new user
    await db.update(usersTable)
      .set({ referredBy: referrer.id })
      .where(eq(usersTable.id, newUserId));

    logger.info({ referrerId: referrer.id, newUserId }, "Referral recorded");
    res.json({ recorded: true, referrerId: referrer.id });
  } catch (err) {
    logger.error(err, "Record referral error");
    res.status(500).json({ error: "Failed to record referral" });
  }
});

// PATCH /referrals/:referredUserId/plan — update plan on referred user (called when plan changes)
referralsRouter.patch("/:referredUserId/plan", async (req, res) => {
  try {
    const { plan } = req.body;
    const referredUserId = parseInt(req.params.referredUserId);

    await db.update(referralsTable)
      .set({ referredUserPlan: plan, qualifies: plan === "active" || plan === "lifetime" })
      .where(eq(referralsTable.referredUserId, referredUserId));

    res.json({ updated: true });
  } catch (err) {
    logger.error(err, "Update referral plan error");
    res.status(500).json({ error: "Failed to update" });
  }
});
