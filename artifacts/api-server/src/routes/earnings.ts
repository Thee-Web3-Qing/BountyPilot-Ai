import { Router } from "express";
import { db } from "@workspace/db";
import { earningsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateEarningBody } from "@workspace/api-zod";
import { logger } from "../lib/logger.js";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { awardPointsAndBadges } from "../lib/gamification.js";

export const earningsRouter = Router();
earningsRouter.use(requireAuth);

// GET /earnings
earningsRouter.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const earnings = await db.select().from(earningsTable).where(eq(earningsTable.userId, userId));
    res.json(earnings);
  } catch (err) {
    logger.error(err, "Error listing earnings");
    res.status(500).json({ error: "Failed to list earnings" });
  }
});

// POST /earnings
earningsRouter.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const parsed = CreateEarningBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error });
      return;
    }
    const { bountyId, platform, amount, currency, receivedAt, notes } = parsed.data;

    const [earning] = await db
      .insert(earningsTable)
      .values({
        userId,
        bountyId: bountyId ?? null,
        platform: platform ?? null,
        amount,
        currency: currency ?? "USDC",
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
        notes: notes ?? null,
      })
      .returning();

    await awardPointsAndBadges(userId);

    res.status(201).json(earning);
  } catch (err) {
    logger.error(err, "Error creating earning");
    res.status(500).json({ error: "Failed to create earning" });
  }
});
