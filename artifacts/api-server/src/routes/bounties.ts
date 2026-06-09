import { Router } from "express";
import { db } from "@workspace/db";
import {
  bountiesTable,
  researchBriefsTable,
  productionPlansTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateBountyBody,
  UpdateBountyBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger.js";
import { scrapeBounty } from "../lib/scraper.js";
import { analyzeBounty, generateResearchBrief, generateProductionPlan } from "../lib/qwen.js";

export const bountiesRouter = Router();

// GET /bounties
bountiesRouter.get("/", async (req, res) => {
  try {
    const { status, platform } = req.query as { status?: string; platform?: string };
    const all = await db.select().from(bountiesTable).orderBy(desc(bountiesTable.createdAt));
    let filtered = all;
    if (status) filtered = filtered.filter((b) => b.status === status);
    if (platform) filtered = filtered.filter((b) => b.platform === platform);
    res.json(filtered);
  } catch (err) {
    logger.error(err, "Error listing bounties");
    res.status(500).json({ error: "Failed to list bounties" });
  }
});

// POST /bounties — real scrape + AI analysis
bountiesRouter.post("/", async (req, res) => {
  try {
    const parsed = CreateBountyBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error });
    }
    const { url } = parsed.data;

    logger.info({ url }, "Scraping bounty URL");
    const scraped = await scrapeBounty(url);
    logger.info({ title: scraped.title, platform: scraped.platform }, "Scraped bounty");

    const analysis = await analyzeBounty(scraped);
    logger.info({ score: analysis.opportunityScore }, "Analysed bounty");

    const [bounty] = await db
      .insert(bountiesTable)
      .values({
        url,
        title: scraped.title,
        platform: scraped.platform,
        projectName: scraped.projectName,
        rewardAmount: scraped.rewardAmount,
        rewardCurrency: scraped.rewardCurrency,
        deadline: scraped.deadline,
        contentFormat: scraped.contentFormat,
        submissionRequirements: scraped.submissionRequirements,
        deliverables: scraped.deliverables,
        submissionLink: scraped.submissionLink,
        eligibilityRules: scraped.eligibilityRules,
        importantNotes: scraped.importantNotes,
        opportunityScore: analysis.opportunityScore,
        scoreExplanation: analysis.scoreExplanation,
        status: "discovered",
      })
      .returning();

    res.status(201).json(bounty);
  } catch (err) {
    logger.error(err, "Error creating bounty");
    res.status(500).json({ error: "Failed to create bounty" });
  }
});

// GET /bounties/:id
bountiesRouter.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [bounty] = await db.select().from(bountiesTable).where(eq(bountiesTable.id, id));
    if (!bounty) return res.status(404).json({ error: "Not found" });
    res.json(bounty);
  } catch (err) {
    logger.error(err, "Error getting bounty");
    res.status(500).json({ error: "Failed to get bounty" });
  }
});

// PATCH /bounties/:id
bountiesRouter.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = UpdateBountyBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const updates: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.rewardAmount !== undefined) updates.rewardAmount = parsed.data.rewardAmount;
    if (parsed.data.deadline !== undefined) updates.deadline = parsed.data.deadline;

    const [bounty] = await db
      .update(bountiesTable)
      .set(updates)
      .where(eq(bountiesTable.id, id))
      .returning();
    if (!bounty) return res.status(404).json({ error: "Not found" });
    res.json(bounty);
  } catch (err) {
    logger.error(err, "Error updating bounty");
    res.status(500).json({ error: "Failed to update bounty" });
  }
});

// DELETE /bounties/:id
bountiesRouter.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(bountiesTable).where(eq(bountiesTable.id, id));
    res.status(204).send();
  } catch (err) {
    logger.error(err, "Error deleting bounty");
    res.status(500).json({ error: "Failed to delete bounty" });
  }
});

// POST /bounties/:id/approve — AI generates research brief + production plan
bountiesRouter.post("/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [bounty] = await db
      .update(bountiesTable)
      .set({ status: "approved" })
      .where(eq(bountiesTable.id, id))
      .returning();
    if (!bounty) return res.status(404).json({ error: "Not found" });

    const scrapedForGen = {
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

    const existingBrief = await db
      .select()
      .from(researchBriefsTable)
      .where(eq(researchBriefsTable.bountyId, id));

    if (existingBrief.length === 0) {
      logger.info({ bountyId: id }, "Generating research brief");
      const brief = await generateResearchBrief(scrapedForGen);
      await db.insert(researchBriefsTable).values({
        bountyId: id,
        summary: brief.summary,
        contentAngles: brief.contentAngles,
        keyPoints: brief.keyPoints,
        targetAudience: brief.targetAudience,
        competitorAnalysis: brief.competitorAnalysis,
      });
    }

    const existingPlan = await db
      .select()
      .from(productionPlansTable)
      .where(eq(productionPlansTable.bountyId, id));

    if (existingPlan.length === 0) {
      logger.info({ bountyId: id }, "Generating production plan");
      const plan = await generateProductionPlan(scrapedForGen);
      await db.insert(productionPlansTable).values({
        bountyId: id,
        scriptOutline: plan.scriptOutline,
        shotList: plan.shotList,
        captionDraft: plan.captionDraft,
        submissionChecklist: plan.submissionChecklist,
        estimatedHours: plan.estimatedHours,
      });
    }

    res.json(bounty);
  } catch (err) {
    logger.error(err, "Error approving bounty");
    res.status(500).json({ error: "Failed to approve bounty" });
  }
});

// POST /bounties/:id/reject
bountiesRouter.post("/:id/reject", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [bounty] = await db
      .update(bountiesTable)
      .set({ status: "rejected" })
      .where(eq(bountiesTable.id, id))
      .returning();
    if (!bounty) return res.status(404).json({ error: "Not found" });
    res.json(bounty);
  } catch (err) {
    logger.error(err, "Error rejecting bounty");
    res.status(500).json({ error: "Failed to reject bounty" });
  }
});

// POST /bounties/:id/save-later
bountiesRouter.post("/:id/save-later", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [bounty] = await db
      .update(bountiesTable)
      .set({ status: "saved_for_later" })
      .where(eq(bountiesTable.id, id))
      .returning();
    if (!bounty) return res.status(404).json({ error: "Not found" });
    res.json(bounty);
  } catch (err) {
    logger.error(err, "Error saving bounty for later");
    res.status(500).json({ error: "Failed to save bounty" });
  }
});
