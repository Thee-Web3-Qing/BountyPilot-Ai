import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, userCheckinsTable, userStarTransactionsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

export const checkinRouter = Router();

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isPaidPlan(user: any): boolean {
  return user?.plan === "active" || user?.plan === "lifetime" || user?.plan === "beta";
}

function hasCheckinToday(checkins: any[]): boolean {
  const today = startOfDayUTC(new Date());
  return checkins.some((c) => {
    const d = new Date(c.checkinDate);
    return d.getUTCFullYear() === today.getUTCFullYear() &&
      d.getUTCMonth() === today.getUTCMonth() &&
      d.getUTCDate() === today.getUTCDate();
  });
}

function getCurrentStreak(checkins: any[]): number {
  if (checkins.length === 0) return 0;
  const today = startOfDayUTC(new Date());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const mostRecent = startOfDayUTC(new Date(checkins[0].checkinDate));
  const isStreakActive = mostRecent.getTime() >= yesterday.getTime();
  if (!isStreakActive) return 0;

  let streak = 1;
  for (let i = 1; i < checkins.length; i++) {
    const prev = startOfDayUTC(new Date(checkins[i - 1].checkinDate));
    const curr = startOfDayUTC(new Date(checkins[i].checkinDate));
    const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
}

function getConsecutiveDays(checkins: any[]): number {
  if (checkins.length === 0) return 0;
  const today = startOfDayUTC(new Date());
  const mostRecent = startOfDayUTC(new Date(checkins[0].checkinDate));
  if (mostRecent.getTime() < today.getTime() - 24 * 60 * 60 * 1000) return 0;

  let streak = 1;
  for (let i = 1; i < checkins.length; i++) {
    const prev = startOfDayUTC(new Date(checkins[i - 1].checkinDate));
    const curr = startOfDayUTC(new Date(checkins[i].checkinDate));
    const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
}

// GET /checkin/status — today's check-in status and streak
checkinRouter.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const checkins = await db
      .select()
      .from(userCheckinsTable)
      .where(eq(userCheckinsTable.userId, userId))
      .orderBy(desc(userCheckinsTable.checkinDate));

    const [userRow] = await db
      .select({ plan: usersTable.plan, points: usersTable.points })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const streak = getCurrentStreak(checkins);
    const checkedInToday = hasCheckinToday(checkins);
    const isPaid = isPaidPlan(userRow);

    let multiplier = 1;
    let bonusDaysLeft = 0;
    if (isPaid) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthCheckins = checkins.filter((c) => new Date(c.checkinDate) >= monthStart);
      const bonusDaysUsed = monthCheckins.filter((c) => c.multiplier >= 2).length;
      bonusDaysLeft = Math.max(0, 7 - bonusDaysUsed);
      if (bonusDaysLeft > 0) multiplier = 2;
    }

    const starsEarned = checkedInToday ? (checkins[0]?.starsEarned ?? 1) : multiplier;

    res.json({
      checkedInToday,
      streak,
      starsEarned,
      multiplier,
      bonusDaysLeft,
      isPaid,
      totalStars: userRow?.points ?? 0,
    });
  } catch (err) {
    logger.error(err, "Error fetching checkin status");
    res.status(500).json({ error: "Failed to fetch checkin status" });
  }
});

// POST /checkin — perform daily check-in
checkinRouter.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const checkins = await db
      .select()
      .from(userCheckinsTable)
      .where(eq(userCheckinsTable.userId, userId))
      .orderBy(desc(userCheckinsTable.checkinDate));

    const alreadyCheckedIn = hasCheckinToday(checkins);
    if (alreadyCheckedIn) {
      res.status(400).json({ error: "Already checked in today", checkedInToday: true });
      return;
    }

    const [userRow] = await db
      .select({ plan: usersTable.plan, points: usersTable.points })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const streak = getConsecutiveDays(checkins);
    const isPaid = isPaidPlan(userRow);

    let multiplier = 1;
    if (isPaid) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthCheckins = checkins.filter((c) => new Date(c.checkinDate) >= monthStart);
      const bonusDaysUsed = monthCheckins.filter((c) => c.multiplier >= 2).length;
      if (bonusDaysUsed < 7) multiplier = 2;
    }

    const starsEarned = Math.round(multiplier * (1 + streak * 0.1));

    await db.insert(userCheckinsTable).values({
      userId,
      checkinDate: new Date(),
      starsEarned,
      streakDay: streak + 1,
      multiplier,
    });

    await db.insert(userStarTransactionsTable).values({
      userId,
      amount: starsEarned,
      reason: "checkin",
      description: `Daily check-in (streak ${streak + 1}x, multiplier ${multiplier}x)`,
    });

    await db
      .update(usersTable)
      .set({ points: sql`${usersTable.points} + ${starsEarned}` })
      .where(eq(usersTable.id, userId));

    const newTotal = (userRow?.points ?? 0) + starsEarned;

    res.json({
      ok: true,
      starsEarned,
      newTotal,
      streak: streak + 1,
      multiplier,
    });
  } catch (err) {
    logger.error(err, "Error during checkin");
    res.status(500).json({ error: "Failed to check in" });
  }
});

// GET /checkin/history — checkin history
checkinRouter.get("/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const checkins = await db
      .select()
      .from(userCheckinsTable)
      .where(eq(userCheckinsTable.userId, userId))
      .orderBy(desc(userCheckinsTable.checkinDate));

    res.json({
      history: checkins.map((c) => ({
        date: c.checkinDate,
        starsEarned: c.starsEarned,
        streakDay: c.streakDay,
        multiplier: c.multiplier,
      })),
    });
  } catch (err) {
    logger.error(err, "Error fetching checkin history");
    res.status(500).json({ error: "Failed to fetch checkin history" });
  }
});

// GET /checkin/stars — star balance and transaction history
checkinRouter.get("/stars", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const [userRow] = await db
      .select({ points: usersTable.points })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const transactions = await db
      .select()
      .from(userStarTransactionsTable)
      .where(eq(userStarTransactionsTable.userId, userId))
      .orderBy(desc(userStarTransactionsTable.createdAt));

    res.json({
      balance: userRow?.points ?? 0,
      transactions: transactions.slice(0, 50),
    });
  } catch (err) {
    logger.error(err, "Error fetching stars");
    res.status(500).json({ error: "Failed to fetch stars" });
  }
});

// POST /checkin/stars/redeem — redeem stars for subscription credit
checkinRouter.post("/stars/redeem", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { stars } = req.body;
    if (!stars || stars < 100) {
      res.status(400).json({ error: "Minimum 100 stars required to redeem" });
      return;
    }

    const [userRow] = await db
      .select({ points: usersTable.points })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const currentPoints = userRow?.points ?? 0;
    if (currentPoints < stars) {
      res.status(400).json({ error: "Not enough stars", balance: currentPoints });
      return;
    }

    // Deduct stars
    await db
      .update(usersTable)
      .set({ points: sql`${usersTable.points} - ${stars}` })
      .where(eq(usersTable.id, userId));

    // Record transaction
    const dollars = stars >= 100 ? 10 : stars * 0.1;
    await db.insert(userStarTransactionsTable).values({
      userId,
      amount: -stars,
      reason: "redeemed",
      description: `Redeemed ${stars} stars for $${dollars} subscription credit`,
    });

    res.json({
      ok: true,
      starsRedeemed: stars,
      dollars,
      newBalance: currentPoints - stars,
    });
  } catch (err) {
    logger.error(err, "Error redeeming stars");
    res.status(500).json({ error: "Failed to redeem stars" });
  }
});
