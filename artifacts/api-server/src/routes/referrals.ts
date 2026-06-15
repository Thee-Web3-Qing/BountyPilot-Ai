import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, referralsTable } from "@workspace/db";
import { eq, desc, count, sql, gte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

export const referralsRouter = Router();

// Thresholds
const MIN_PAID_REFERRALS = 3;          // qualify for $50 crypto prize track (paid refs)
const FREE_LEADERBOARD_MIN = 10;       // minimum total referrals to appear on access track
const FREE_LEADERBOARD_TOP = 10;       // top N get 2 months free
const CRYPTO_PRIZE_TOP = 2;            // top N split the $50 pool

function qualifiesForCryptoPrize(paidReferrals: number) {
  return paidReferrals >= MIN_PAID_REFERRALS;
}

// GET /referrals/my — user's referral stats + referred user details
referralsRouter.get("/my", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const [user] = await db
      .select({ referralCode: usersTable.referralCode, username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    // Join with users table to get referred user's username
    const referralRows = await db
      .select({
        id: referralsTable.id,
        referredUserId: referralsTable.referredUserId,
        referredUserPlan: referralsTable.referredUserPlan,
        qualifies: referralsTable.qualifies,
        rewardGranted: referralsTable.rewardGranted,
        createdAt: referralsTable.createdAt,
        referredUsername: usersTable.username,
      })
      .from(referralsTable)
      .innerJoin(usersTable, eq(usersTable.id, referralsTable.referredUserId))
      .where(eq(referralsTable.referrerId, userId))
      .orderBy(desc(referralsTable.createdAt));

    const total = referralRows.length;
    const paidReferrals = referralRows.filter(r =>
      r.referredUserPlan === "active" || r.referredUserPlan === "lifetime"
    ).length;
    const hasPremiumReferral = paidReferrals > 0;

    const baseUrl = process.env.APP_URL || "https://bountypilot.xyz";
    const referralLink = `${baseUrl}/signup?ref=${user.username}`;

    res.json({
      referralCode: user.referralCode,
      referralLink,
      totalReferrals: total,
      paidReferrals,
      qualifiesCrypto: qualifiesForCryptoPrize(paidReferrals),
      qualifiesAccess: total >= FREE_LEADERBOARD_MIN,
      minRequired: MIN_PAID_REFERRALS,
      freeLeaderboardMin: FREE_LEADERBOARD_MIN,
      hasPremiumReferral,
      referrals: referralRows.map(r => ({
        id: r.id,
        referredUserId: r.referredUserId,
        referredUsername: r.referredUsername,
        referredUserPlan: r.referredUserPlan,
        isPaid: r.referredUserPlan === "active" || r.referredUserPlan === "lifetime",
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    logger.error(err, "Get referrals error");
    res.status(500).json({ error: "Failed to get referrals" });
  }
});

// GET /referrals/leaderboard — two separate leaderboards
referralsRouter.get("/leaderboard", async (_req, res) => {
  try {
    const rows = await db
      .select({
        referrerId: referralsTable.referrerId,
        username: usersTable.username,
        points: usersTable.points,
        total: count(referralsTable.id),
        premiumCount: sql<number>`COUNT(*) FILTER (WHERE ${referralsTable.referredUserPlan} IN ('active','lifetime'))`.mapWith(Number),
      })
      .from(referralsTable)
      .innerJoin(usersTable, eq(usersTable.id, referralsTable.referrerId))
      .groupBy(referralsTable.referrerId, usersTable.username, usersTable.points)
      .orderBy(desc(count(referralsTable.id)))
      .limit(100);

    // Crypto / paid track — rank by paid referrals, all shown (top 2 win)
    const paidSorted = [...rows]
      .map(r => ({
        username: r.username,
        totalReferrals: Number(r.total),
        paidReferrals: Number(r.premiumCount),
        points: r.points ?? 0,
      }))
      .sort((a, b) => b.paidReferrals - a.paidReferrals || b.totalReferrals - a.totalReferrals)
      .map((r, i) => ({
        rank: i + 1,
        ...r,
        isWinner: i < CRYPTO_PRIZE_TOP,
        qualifies: r.paidReferrals >= MIN_PAID_REFERRALS,
      }));

    // Access track — rank by total referrals, only those with >= FREE_LEADERBOARD_MIN, top FREE_LEADERBOARD_TOP
    const freeSorted = [...rows]
      .filter(r => Number(r.total) >= FREE_LEADERBOARD_MIN)
      .map(r => ({
        username: r.username,
        totalReferrals: Number(r.total),
        paidReferrals: Number(r.premiumCount),
        points: r.points ?? 0,
      }))
      .sort((a, b) => b.totalReferrals - a.totalReferrals || b.paidReferrals - a.paidReferrals)
      .slice(0, FREE_LEADERBOARD_TOP)
      .map((r, i) => ({
        rank: i + 1,
        ...r,
        isWinner: true, // all top 10 who hit threshold win
        qualifies: true,
      }));

    res.json({
      paidLeaderboard: paidSorted,
      freeLeaderboard: freeSorted,
      minRequired: MIN_PAID_REFERRALS,
      freeLeaderboardMin: FREE_LEADERBOARD_MIN,
      freeLeaderboardTop: FREE_LEADERBOARD_TOP,
      cryptoPrizeTop: CRYPTO_PRIZE_TOP,
    });
  } catch (err) {
    logger.error(err, "Leaderboard error");
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

// POST /referrals/record — called after signup/google auth with a ref code
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

// PATCH /referrals/:referredUserId/plan — update plan on referred user
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
