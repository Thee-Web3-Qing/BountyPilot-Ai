import { db } from "@workspace/db";
import { usersTable, userBadgesTable, earningsTable } from "@workspace/db";
import { eq, sum, count, and } from "drizzle-orm";
import { logger } from "./logger.js";

export interface BadgeDefinition {
  key: string;
  label: string;
  description: string;
  emoji: string;
}

export const BADGES: BadgeDefinition[] = [
  { key: "first_win",            label: "First Win",        description: "Logged your first bounty earning",    emoji: "🏆" },
  { key: "ten_bounties",         label: "10 Bounties",      description: "Won 10 bounties",                     emoji: "⚡" },
  { key: "fifty_bounties",       label: "50 Bounties",      description: "Won 50 bounties",                     emoji: "🔥" },
  { key: "five_hundred_earned",  label: "$500 Earned",      description: "Cumulative earnings reached $500",    emoji: "💰" },
  { key: "one_thousand_earned",  label: "$1K Earned",       description: "Cumulative earnings reached $1,000",  emoji: "💎" },
  { key: "five_thousand_earned", label: "$5K Earned",       description: "Cumulative earnings reached $5,000",  emoji: "🚀" },
];

export const BADGE_MAP = Object.fromEntries(BADGES.map((b) => [b.key, b]));

export async function awardPointsAndBadges(userId: number): Promise<void> {
  try {
    const rows = await db
      .select({ totalAmount: sum(earningsTable.amount), bountyCount: count(earningsTable.id) })
      .from(earningsTable)
      .where(eq(earningsTable.userId, userId));

    const totalAmount = Math.round(Number(rows[0]?.totalAmount ?? 0));
    const bountyCount = Number(rows[0]?.bountyCount ?? 0);

    await db
      .update(usersTable)
      .set({ points: totalAmount })
      .where(eq(usersTable.id, userId));

    const existingBadgeRows = await db
      .select({ badge: userBadgesTable.badge })
      .from(userBadgesTable)
      .where(eq(userBadgesTable.userId, userId));

    const earned = new Set(existingBadgeRows.map((r) => r.badge));

    const toAward: string[] = [];

    if (bountyCount >= 1  && !earned.has("first_win"))            toAward.push("first_win");
    if (bountyCount >= 10 && !earned.has("ten_bounties"))         toAward.push("ten_bounties");
    if (bountyCount >= 50 && !earned.has("fifty_bounties"))       toAward.push("fifty_bounties");
    if (totalAmount >= 500  && !earned.has("five_hundred_earned")) toAward.push("five_hundred_earned");
    if (totalAmount >= 1000 && !earned.has("one_thousand_earned")) toAward.push("one_thousand_earned");
    if (totalAmount >= 5000 && !earned.has("five_thousand_earned"))toAward.push("five_thousand_earned");

    if (toAward.length > 0) {
      await db.insert(userBadgesTable).values(toAward.map((badge) => ({ userId, badge })));
      logger.info({ userId, toAward }, "Badges awarded");
    }
  } catch (err) {
    logger.error(err, "Error in awardPointsAndBadges");
  }
}
