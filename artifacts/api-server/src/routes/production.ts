import { Router } from "express";
import { db } from "@workspace/db";
import { productionPlansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export const productionRouter = Router();

// GET /production-plans
productionRouter.get("/", async (_req, res) => {
  try {
    const plans = await db.select().from(productionPlansTable);
    res.json(plans);
  } catch (err) {
    logger.error(err, "Error listing production plans");
    res.status(500).json({ error: "Failed to list production plans" });
  }
});

// GET /production-plans/bounty/:bountyId
productionRouter.get("/bounty/:bountyId", async (req, res) => {
  try {
    const bountyId = parseInt(req.params.bountyId);
    const [plan] = await db
      .select()
      .from(productionPlansTable)
      .where(eq(productionPlansTable.bountyId, bountyId));
    if (!plan) return res.status(404).json({ error: "Not found" });
    res.json(plan);
  } catch (err) {
    logger.error(err, "Error getting production plan by bounty");
    res.status(500).json({ error: "Failed to get production plan" });
  }
});
