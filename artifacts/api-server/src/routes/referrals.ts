import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, referralsTable, campaignEnrollmentsTable } from "@workspace/db";
import { eq, desc, count, sql, and, or, isNull } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

export const referralsRouter = Router();

// ── Campaign config ───────────────────────────────────────────
const CAMPAIGN_SLUGS = ["crypto-50", "free-access", "yearly-challenge", "lifetime-challenge"];

// Thresholds
const MIN_PAID_REFERRALS = 3;
const FREE_LEADERBOARD_MIN = 10;
const FREE_LEADERBOARD_TOP = 10;
const CRYPTO_PRIZE_TOP = 2;

const YEARLY_CHALLENGE = {
  prizePool: 200,
  minQualify: 3,
  milestone1: { qualified: 5, unlockPercent: 50, unlockAmount: 100 },
  milestone2: { qualified: 10, unlockPercent: 100, unlockAmount: 200 },
  rewards50: { first: 50, second: 25, restShare: 25 },
  rewards100: { first: 100, second: 50, thirdToTenth: 20 },
};

const LIFETIME_CHALLENGE = {
  prizePool: 500,
  minQualify: 3,
  milestone1: { qualified: 5, unlockPercent: 50, unlockAmount: 250 },
  milestone2: { qualified: 10, unlockPercent: 100, unlockAmount: 500 },
  rewards50: { first: 125, second: 75, restShare: 50 },
  rewards100: { first: 250, second: 150, thirdToTenth: 50 },
};

// ── Optional auth helper ──────────────────────────────────────
function tryGetUserId(req: AuthRequest): number | null {
  try {
    return req.user?.userId ?? null;
  } catch {
    return null;
  }
}

// ── GET /referrals/my — user's referral stats ─────────────────
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
        tier: referralsTable.tier,
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

    // Per-campaign counts (isolated)
    const cryptoRefs = referralRows.filter(r =>
      r.referredUserPlan === "active" &&
      (r.tier === "monthly" || r.tier === null)
    ).length;
    const yearlyRefs = referralRows.filter(r => r.tier === "yearly").length;
    const lifetimeRefs = referralRows.filter(r =>
      r.tier === "lifetime" || r.referredUserPlan === "lifetime"
    ).length;
    const freeRefs = referralRows.filter(r =>
      r.referredUserPlan !== "active" && r.referredUserPlan !== "lifetime"
    ).length;

    const baseUrl = process.env.APP_URL || "https://bountypilot.xyz";
    const referralLink = `${baseUrl}/signup?ref=${encodeURIComponent(user.username)}`;

    res.json({
      referralCode: user.username,
      referralLink,
      totalReferrals: total,
      paidReferrals: cryptoRefs,
      yearlyReferrals: yearlyRefs,
      lifetimeReferrals: lifetimeRefs,
      freeReferrals: freeRefs,
      qualifiesCrypto: cryptoRefs >= MIN_PAID_REFERRALS,
      qualifiesAccess: freeRefs >= FREE_LEADERBOARD_MIN,
      minRequired: MIN_PAID_REFERRALS,
      freeLeaderboardMin: FREE_LEADERBOARD_MIN,
      hasPremiumReferral: cryptoRefs > 0 || yearlyRefs > 0 || lifetimeRefs > 0,
      referrals: referralRows.map(r => ({
        id: r.id,
        referredUserId: r.referredUserId,
        referredUsername: r.referredUsername,
        referredUserPlan: r.referredUserPlan,
        tier: r.tier,
        isPaid: r.referredUserPlan === "active" || r.referredUserPlan === "lifetime",
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    logger.error(err, "Get referrals error");
    res.status(500).json({ error: "Failed to get referrals" });
  }
});

// ── GET /referrals/campaigns — list campaigns with enrollment ─
referralsRouter.get("/campaigns", async (req: AuthRequest, res) => {
  try {
    const userId = tryGetUserId(req);

    let enrollments: string[] = [];
    if (userId) {
      const enrolled = await db
        .select({ campaignSlug: campaignEnrollmentsTable.campaignSlug })
        .from(campaignEnrollmentsTable)
        .where(eq(campaignEnrollmentsTable.userId, userId));
      enrollments = enrolled.map(e => e.campaignSlug);
    }

    const enrolledCounts = await db
      .select({
        campaignSlug: campaignEnrollmentsTable.campaignSlug,
        cnt: count(campaignEnrollmentsTable.id),
      })
      .from(campaignEnrollmentsTable)
      .groupBy(campaignEnrollmentsTable.campaignSlug);

    const countMap: Record<string, number> = {};
    for (const e of enrolledCounts) countMap[e.campaignSlug] = Number(e.cnt);

    res.json({
      campaigns: CAMPAIGN_SLUGS.map(slug => ({
        slug,
        enrolledCount: countMap[slug] ?? 0,
        isEnrolled: enrollments.includes(slug),
      })),
    });
  } catch (err) {
    logger.error(err, "Get campaigns error");
    res.status(500).json({ error: "Failed to get campaigns" });
  }
});

// ── POST /referrals/campaigns/:slug/join ─────────────────────
referralsRouter.post("/campaigns/:slug/join", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const slug = req.params.slug as string;

    if (!CAMPAIGN_SLUGS.includes(slug)) {
      res.status(400).json({ error: "Invalid campaign slug" });
      return;
    }

    await db.insert(campaignEnrollmentsTable)
      .values({ userId, campaignSlug: slug })
      .onConflictDoNothing();

    logger.info({ userId, slug }, "User joined campaign");
    res.json({ joined: true, campaignSlug: slug });
  } catch (err) {
    logger.error(err, "Join campaign error");
    res.status(500).json({ error: "Failed to join campaign" });
  }
});

// ── GET /referrals/campaigns/:slug/leaderboard ───────────────
referralsRouter.get("/campaigns/:slug/leaderboard", async (req: AuthRequest, res) => {
  try {
    const slug = req.params.slug as string;
    const userId = tryGetUserId(req);

    if (!CAMPAIGN_SLUGS.includes(slug)) {
      res.status(400).json({ error: "Invalid campaign slug" });
      return;
    }

    // Build isolated leaderboard per campaign
    if (slug === "crypto-50") {
      // Monthly paid referrals: active plan + tier is null or "monthly"
      const rows = await db
        .select({
          referrerId: referralsTable.referrerId,
          username: usersTable.username,
          cnt: count(referralsTable.id),
        })
        .from(referralsTable)
        .innerJoin(usersTable, eq(usersTable.id, referralsTable.referrerId))
        .where(and(
          eq(referralsTable.referredUserPlan, "active"),
          or(isNull(referralsTable.tier), eq(referralsTable.tier, "monthly"))
        ))
        .groupBy(referralsTable.referrerId, usersTable.username)
        .orderBy(desc(count(referralsTable.id)))
        .limit(50);

      const leaderboard = rows.map((r, i) => ({
        rank: i + 1,
        username: r.username,
        count: Number(r.cnt),
        isYou: r.referrerId === userId,
        isWinner: i < CRYPTO_PRIZE_TOP,
        qualifies: Number(r.cnt) >= MIN_PAID_REFERRALS,
      }));

      res.json({
        slug,
        leaderboard,
        config: {
          prizePool: 50,
          topWinners: CRYPTO_PRIZE_TOP,
          prizePerWinner: 25,
          minQualify: MIN_PAID_REFERRALS,
          label: "monthly referrals",
        },
      });

    } else if (slug === "free-access") {
      // All referrals — matches the "2 months free" track on the referral page
      const rows = await db
        .select({
          referrerId: referralsTable.referrerId,
          username: usersTable.username,
          cnt: count(referralsTable.id),
        })
        .from(referralsTable)
        .innerJoin(usersTable, eq(usersTable.id, referralsTable.referrerId))
        .groupBy(referralsTable.referrerId, usersTable.username)
        .orderBy(desc(count(referralsTable.id)))
        .limit(100);

      const qualified = rows.filter(r => Number(r.cnt) >= FREE_LEADERBOARD_MIN);
      const leaderboard = qualified
        .slice(0, FREE_LEADERBOARD_TOP)
        .map((r, i) => ({
          rank: i + 1,
          username: r.username,
          count: Number(r.cnt),
          isYou: r.referrerId === userId,
          isWinner: true,
          qualifies: true,
        }));

      // Also include current user if not in top 10
      const myRow = rows.find(r => r.referrerId === userId);
      const myRank = myRow ? rows.indexOf(myRow) + 1 : null;

      res.json({
        slug,
        leaderboard,
        myRank,
        myCount: myRow ? Number(myRow.cnt) : 0,
        config: {
          minQualify: FREE_LEADERBOARD_MIN,
          topWinners: FREE_LEADERBOARD_TOP,
          prize: "2 months free access",
          label: "free referrals",
        },
      });

    } else if (slug === "yearly-challenge") {
      const rows = await db
        .select({
          referrerId: referralsTable.referrerId,
          username: usersTable.username,
          cnt: count(referralsTable.id),
        })
        .from(referralsTable)
        .innerJoin(usersTable, eq(usersTable.id, referralsTable.referrerId))
        .where(eq(referralsTable.tier, "yearly"))
        .groupBy(referralsTable.referrerId, usersTable.username)
        .orderBy(desc(count(referralsTable.id)))
        .limit(50);

      const leaderboard = rows.map((r, i) => ({
        rank: i + 1,
        username: r.username,
        count: Number(r.cnt),
        isYou: r.referrerId === userId,
        qualifies: Number(r.cnt) >= YEARLY_CHALLENGE.minQualify,
        isWinner: i < 10,
      }));

      const qualified = leaderboard.filter(e => e.qualifies);
      const unlockPercent = qualified.length >= YEARLY_CHALLENGE.milestone2.qualified ? 100
        : qualified.length >= YEARLY_CHALLENGE.milestone1.qualified ? 50 : 0;
      const unlockedAmount = unlockPercent === 100 ? YEARLY_CHALLENGE.milestone2.unlockAmount
        : unlockPercent === 50 ? YEARLY_CHALLENGE.milestone1.unlockAmount : 0;

      res.json({
        slug,
        leaderboard: leaderboard.slice(0, 10),
        qualifiedCount: qualified.length,
        unlockPercent,
        unlockedAmount,
        config: YEARLY_CHALLENGE,
      });

    } else if (slug === "lifetime-challenge") {
      const rows = await db
        .select({
          referrerId: referralsTable.referrerId,
          username: usersTable.username,
          cnt: count(referralsTable.id),
        })
        .from(referralsTable)
        .innerJoin(usersTable, eq(usersTable.id, referralsTable.referrerId))
        .where(or(
          eq(referralsTable.tier, "lifetime"),
          eq(referralsTable.referredUserPlan, "lifetime")
        ))
        .groupBy(referralsTable.referrerId, usersTable.username)
        .orderBy(desc(count(referralsTable.id)))
        .limit(50);

      const leaderboard = rows.map((r, i) => ({
        rank: i + 1,
        username: r.username,
        count: Number(r.cnt),
        isYou: r.referrerId === userId,
        qualifies: Number(r.cnt) >= LIFETIME_CHALLENGE.minQualify,
        isWinner: i < 10,
      }));

      const qualified = leaderboard.filter(e => e.qualifies);
      const unlockPercent = qualified.length >= LIFETIME_CHALLENGE.milestone2.qualified ? 100
        : qualified.length >= LIFETIME_CHALLENGE.milestone1.qualified ? 50 : 0;
      const unlockedAmount = unlockPercent === 100 ? LIFETIME_CHALLENGE.milestone2.unlockAmount
        : unlockPercent === 50 ? LIFETIME_CHALLENGE.milestone1.unlockAmount : 0;

      res.json({
        slug,
        leaderboard: leaderboard.slice(0, 10),
        qualifiedCount: qualified.length,
        unlockPercent,
        unlockedAmount,
        config: LIFETIME_CHALLENGE,
      });
    }
  } catch (err) {
    logger.error(err, "Campaign leaderboard error");
    res.status(500).json({ error: "Failed to get campaign leaderboard" });
  }
});

// ── GET /referrals/leaderboard — legacy two-track leaderboard ─
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

    const paidSorted = [...rows]
      .map(r => ({
        username: r.username,
        totalReferrals: Number(r.total),
        paidReferrals: Number(r.premiumCount),
        points: r.points ?? 0,
      }))
      .filter(r => r.paidReferrals > 0)
      .sort((a, b) => b.paidReferrals - a.paidReferrals || b.totalReferrals - a.totalReferrals)
      .map((r, i) => ({
        rank: i + 1,
        ...r,
        isWinner: i < CRYPTO_PRIZE_TOP,
        qualifies: r.paidReferrals >= MIN_PAID_REFERRALS,
      }));

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
        isWinner: true,
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

// ── POST /referrals/record ────────────────────────────────────
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

// ── PATCH /referrals/:referredUserId/plan ─────────────────────
referralsRouter.patch("/:referredUserId/plan", async (req, res) => {
  try {
    const { plan, tier } = req.body;
    const referredUserId = parseInt(req.params.referredUserId);

    await db.update(referralsTable)
      .set({
        referredUserPlan: plan,
        tier: tier ?? undefined,
        qualifies: plan === "active" || plan === "lifetime",
      })
      .where(eq(referralsTable.referredUserId, referredUserId));

    res.json({ updated: true });
  } catch (err) {
    logger.error(err, "Update referral plan error");
    res.status(500).json({ error: "Failed to update" });
  }
});

// ── GET /referrals/challenges — legacy yearly + lifetime data ─
referralsRouter.get("/challenges", async (_req, res) => {
  try {
    const allReferrals = await db
      .select({
        referrerId: referralsTable.referrerId,
        username: usersTable.username,
        tier: referralsTable.tier,
        referredUserPlan: referralsTable.referredUserPlan,
      })
      .from(referralsTable)
      .innerJoin(usersTable, eq(usersTable.id, referralsTable.referrerId))
      .where(
        sql`${referralsTable.tier} IN ('yearly', 'lifetime') OR ${referralsTable.referredUserPlan} IN ('active', 'lifetime')`
      );

    const userMap = new Map<number, { username: string; yearly: number; lifetime: number }>();
    for (const r of allReferrals) {
      const u = userMap.get(r.referrerId) || { username: r.username, yearly: 0, lifetime: 0 };
      if (r.tier === "yearly") u.yearly++;
      if (r.tier === "lifetime" || r.referredUserPlan === "lifetime") u.lifetime++;
      userMap.set(r.referrerId, u);
    }

    const users = Array.from(userMap.entries()).map(([id, data]) => ({ id, ...data }));

    const yearlySorted = users
      .map(u => ({ username: u.username, count: u.yearly }))
      .sort((a, b) => b.count - a.count)
      .map((u, i) => ({
        rank: i + 1,
        username: u.username,
        count: u.count,
        qualifies: u.count >= YEARLY_CHALLENGE.minQualify,
      }));

    const yearlyQualified = yearlySorted.filter(u => u.qualifies);
    const yearlyUnlock = yearlyQualified.length >= YEARLY_CHALLENGE.milestone2.qualified ? 100
      : yearlyQualified.length >= YEARLY_CHALLENGE.milestone1.qualified ? 50 : 0;

    const lifetimeSorted = users
      .map(u => ({ username: u.username, count: u.lifetime }))
      .sort((a, b) => b.count - a.count)
      .map((u, i) => ({
        rank: i + 1,
        username: u.username,
        count: u.count,
        qualifies: u.count >= LIFETIME_CHALLENGE.minQualify,
      }));

    const lifetimeQualified = lifetimeSorted.filter(u => u.qualifies);
    const lifetimeUnlock = lifetimeQualified.length >= LIFETIME_CHALLENGE.milestone2.qualified ? 100
      : lifetimeQualified.length >= LIFETIME_CHALLENGE.milestone1.qualified ? 50 : 0;

    res.json({
      yearly: {
        config: YEARLY_CHALLENGE,
        leaderboard: yearlySorted.slice(0, 10),
        qualifiedCount: yearlyQualified.length,
        unlockedPercent: yearlyUnlock,
        unlockedAmount: yearlyUnlock === 100 ? YEARLY_CHALLENGE.milestone2.unlockAmount
          : yearlyUnlock === 50 ? YEARLY_CHALLENGE.milestone1.unlockAmount : 0,
      },
      lifetime: {
        config: LIFETIME_CHALLENGE,
        leaderboard: lifetimeSorted.slice(0, 10),
        qualifiedCount: lifetimeQualified.length,
        unlockedPercent: lifetimeUnlock,
        unlockedAmount: lifetimeUnlock === 100 ? LIFETIME_CHALLENGE.milestone2.unlockAmount
          : lifetimeUnlock === 50 ? LIFETIME_CHALLENGE.milestone1.unlockAmount : 0,
      },
    });
  } catch (err) {
    logger.error(err, "Challenge leaderboard error");
    res.status(500).json({ error: "Failed to get challenges" });
  }
});
