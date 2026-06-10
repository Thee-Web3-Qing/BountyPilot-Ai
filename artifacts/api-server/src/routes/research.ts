import { Router } from "express";
import { db } from "@workspace/db";
import { researchBriefsTable, bountiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { generateResearchBrief } from "../lib/qwen.js";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { requireActivePlan } from "../lib/access.js";

export const researchRouter = Router();

researchRouter.get("/", async (_req, res) => {
  try {
    res.json(await db.select().from(researchBriefsTable));
  } catch (err) {
    logger.error(err, "Error listing research briefs");
    res.status(500).json({ error: "Failed to list research briefs" });
  }
});

researchRouter.get("/:id", async (req, res) => {
  try {
    const [brief] = await db.select().from(researchBriefsTable).where(eq(researchBriefsTable.id, parseInt(req.params.id)));
    if (!brief) return res.status(404).json({ error: "Not found" });
    res.json(brief);
  } catch (err) {
    logger.error(err, "Error getting research brief");
    res.status(500).json({ error: "Failed to get research brief" });
  }
});

researchRouter.get("/bounty/:bountyId", async (req, res) => {
  try {
    const [brief] = await db.select().from(researchBriefsTable).where(eq(researchBriefsTable.bountyId, parseInt(req.params.bountyId)));
    if (!brief) return res.status(404).json({ error: "Not found" });
    res.json(brief);
  } catch (err) {
    logger.error(err, "Error getting research brief by bounty");
    res.status(500).json({ error: "Failed to get research brief" });
  }
});

// POST /research-briefs/bounty/:bountyId/generate — (re)generate with AI
researchRouter.post("/bounty/:bountyId/generate", requireAuth, requireActivePlan, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const bountyId = parseInt(req.params.bountyId);

    const [bounty] = await db.select().from(bountiesTable).where(and(eq(bountiesTable.id, bountyId), eq(bountiesTable.userId, userId)));
    if (!bounty) return res.status(404).json({ error: "Bounty not found" });

    const scraped = {
      title: bounty.title || "",
      description: bounty.submissionRequirements || "",
      rewardAmount: bounty.rewardAmount,
      rewardCurrency: bounty.rewardCurrency,
      deadline: bounty.deadline,
      projectName: bounty.projectName || "",
      contentFormat: bounty.contentFormat || "Article / Thread",
      submissionRequirements: bounty.submissionRequirements || "",
      deliverables: bounty.deliverables || "",
      submissionLink: bounty.submissionLink || bounty.url,
      eligibilityRules: bounty.eligibilityRules || "",
      importantNotes: bounty.importantNotes || "",
      platform: bounty.platform || "",
      rawText: "",
    };

    logger.info({ bountyId }, "Regenerating research brief with AI");
    const brief = await generateResearchBrief(scraped);

    const existing = await db.select().from(researchBriefsTable).where(eq(researchBriefsTable.bountyId, bountyId));
    let result;
    if (existing.length > 0) {
      [result] = await db.update(researchBriefsTable).set(brief).where(eq(researchBriefsTable.bountyId, bountyId)).returning();
    } else {
      [result] = await db.insert(researchBriefsTable).values({ bountyId, ...brief }).returning();
    }

    res.json(result);
  } catch (err) {
    logger.error(err, "Error generating research brief");
    res.status(500).json({ error: "Failed to generate research brief" });
  }
});
