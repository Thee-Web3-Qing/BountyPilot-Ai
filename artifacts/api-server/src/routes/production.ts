import { Router } from "express";
import { db } from "@workspace/db";
import { productionPlansTable, bountiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { generateProductionPlan } from "../lib/qwen.js";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { requireActivePlan } from "../lib/access.js";

export const productionRouter = Router();

productionRouter.get("/", async (_req, res) => {
  try {
    res.json(await db.select().from(productionPlansTable));
  } catch (err) {
    logger.error(err, "Error listing production plans");
    res.status(500).json({ error: "Failed to list production plans" });
  }
});

productionRouter.get("/bounty/:bountyId", async (req, res) => {
  try {
    const [plan] = await db.select().from(productionPlansTable).where(eq(productionPlansTable.bountyId, parseInt(req.params.bountyId)));
    if (!plan) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(plan);
  } catch (err) {
    logger.error(err, "Error getting production plan by bounty");
    res.status(500).json({ error: "Failed to get production plan" });
  }
});

// POST /production-plans/bounty/:bountyId/generate — (re)generate with AI
productionRouter.post("/bounty/:bountyId/generate", requireAuth, requireActivePlan, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const bountyId = parseInt(req.params.bountyId as string);

    const [bounty] = await db.select().from(bountiesTable).where(and(eq(bountiesTable.id, bountyId), eq(bountiesTable.userId, userId)));
    if (!bounty) {
      res.status(404).json({ error: "Bounty not found" });
      return;
    }

    const scraped = {
      title: bounty.title || "",
      description: bounty.submissionRequirements || "",
      rewardAmount: bounty.rewardAmount,
      rewardCurrency: bounty.rewardCurrency,
      deadline: bounty.deadline,
      projectName: bounty.projectName || bounty.platform || "",
      contentFormat: bounty.contentFormat || "Article / Thread",
      submissionRequirements: bounty.submissionRequirements || "",
      deliverables: bounty.deliverables || "",
      submissionLink: bounty.submissionLink || bounty.url,
      eligibilityRules: bounty.eligibilityRules || "",
      importantNotes: bounty.importantNotes || "",
      platform: bounty.platform || "",
      rawText: "",
    };

    logger.info({ bountyId }, "Regenerating production plan with AI");
    const plan = await generateProductionPlan(scraped);

    const existing = await db.select().from(productionPlansTable).where(eq(productionPlansTable.bountyId, bountyId));
    let result;
    if (existing.length > 0) {
      [result] = await db.update(productionPlansTable).set(plan).where(eq(productionPlansTable.bountyId, bountyId)).returning();
    } else {
      [result] = await db.insert(productionPlansTable).values({ bountyId, ...plan }).returning();
    }

    res.json(result);
  } catch (err) {
    logger.error(err, "Error generating production plan");
    res.status(500).json({ error: "Failed to generate production plan" });
  }
});
