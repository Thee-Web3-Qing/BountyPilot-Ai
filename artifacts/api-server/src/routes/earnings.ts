import { Router } from "express";
import { db } from "@workspace/db";
import { earningsTable } from "@workspace/db";
import { CreateEarningBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

export const earningsRouter = Router();

// GET /earnings
earningsRouter.get("/", async (_req, res) => {
  try {
    const earnings = await db.select().from(earningsTable);
    res.json(earnings);
  } catch (err) {
    logger.error(err, "Error listing earnings");
    res.status(500).json({ error: "Failed to list earnings" });
  }
});

// POST /earnings
earningsRouter.post("/", async (req, res) => {
  try {
    const parsed = CreateEarningBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error });
    }
    const { bountyId, platform, amount, currency, receivedAt, notes } = parsed.data;

    const [earning] = await db
      .insert(earningsTable)
      .values({
        bountyId: bountyId ?? null,
        platform: platform ?? null,
        amount,
        currency: currency ?? "USDC",
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
        notes: notes ?? null,
      })
      .returning();

    res.status(201).json(earning);
  } catch (err) {
    logger.error(err, "Error creating earning");
    res.status(500).json({ error: "Failed to create earning" });
  }
});
