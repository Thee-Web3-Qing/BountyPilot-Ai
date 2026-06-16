import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, userBadgesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { BADGE_MAP } from "../lib/gamification.js";

export const gamificationRouter = Router();

// GET /gamification/me — current user's points + badges
gamificationRouter.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const [userRow] = await db
      .select({ points: usersTable.points })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const badgeRows = await db
      .select({ badge: userBadgesTable.badge, earnedAt: userBadgesTable.earnedAt })
      .from(userBadgesTable)
      .where(eq(userBadgesTable.userId, userId))
      .orderBy(desc(userBadgesTable.earnedAt));

    const badges = badgeRows.map((r) => {
      const def = BADGE_MAP[r.badge];
      return {
        key: r.badge,
        earnedAt: r.earnedAt,
        label: def?.label ?? r.badge,
        description: def?.description ?? "",
        emoji: def?.emoji ?? "🎖️",
      };
    });

    res.json({ points: userRow?.points ?? 0, badges });
  } catch (err) {
    logger.error(err, "Error fetching gamification data");
    res.status(500).json({ error: "Failed to fetch gamification data" });
  }
});
