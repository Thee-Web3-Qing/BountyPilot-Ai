import { Router } from "express";
import { db } from "@workspace/db";
import {
  bountiesTable,
  researchBriefsTable,
  productionPlansTable,
  userProfilesTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { CreateBountyBody, UpdateBountyBody } from "@workspace/api-zod";
import { logger } from "../lib/logger.js";
import { scrapeBounty } from "../lib/scraper.js";
import { analyzeBounty, generateResearchBrief, generateProductionPlan } from "../lib/qwen.js";
import { requireAuth, type AuthRequest } from "../lib/auth.js";

export const bountiesRouter = Router();

bountiesRouter.use(requireAuth);

// GET /bounties
bountiesRouter.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { status, platform } = req.query as { status?: string; platform?: string };
    const all = await db
      .select()
      .from(bountiesTable)
      .where(eq(bountiesTable.userId, userId))
      .orderBy(desc(bountiesTable.createdAt));
    let filtered = all;
    if (status) filtered = filtered.filter((b) => b.status === status);
    if (platform) filtered = filtered.filter((b) => b.platform === platform);
    res.json(filtered);
  } catch (err) {
    logger.error(err, "Error listing bounties");
    res.status(500).json({ error: "Failed to list bounties" });
  }
});

// POST /bounties
bountiesRouter.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const parsed = CreateBountyBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error });
    }
    const { url } = parsed.data;

    logger.info({ url, userId }, "Scraping bounty URL");
    const scraped = await scrapeBounty(url);
    logger.info({ title: scraped.title, platform: scraped.platform }, "Scraped bounty");

    const [userProfile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
    const analysis = await analyzeBounty(scraped, userProfile ?? undefined);
    logger.info({ score: analysis.opportunityScore }, "Analysed bounty");

    const [bounty] = await db
      .insert(bountiesTable)
      .values({
        userId,
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
        confidenceScore: scraped.confidenceScore,
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
bountiesRouter.get("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const [bounty] = await db
      .select()
      .from(bountiesTable)
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)));
    if (!bounty) return res.status(404).json({ error: "Not found" });
    res.json(bounty);
  } catch (err) {
    logger.error(err, "Error getting bounty");
    res.status(500).json({ error: "Failed to get bounty" });
  }
});

// PATCH /bounties/:id
bountiesRouter.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const parsed = UpdateBountyBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const updates: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.rewardAmount !== undefined) updates.rewardAmount = parsed.data.rewardAmount;
    if (parsed.data.deadline !== undefined) updates.deadline = parsed.data.deadline;

    const [bounty] = await db
      .update(bountiesTable)
      .set(updates)
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)))
      .returning();
    if (!bounty) return res.status(404).json({ error: "Not found" });
    res.json(bounty);
  } catch (err) {
    logger.error(err, "Error updating bounty");
    res.status(500).json({ error: "Failed to update bounty" });
  }
});

// DELETE /bounties/:id
bountiesRouter.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    await db.delete(bountiesTable).where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)));
    res.status(204).send();
  } catch (err) {
    logger.error(err, "Error deleting bounty");
    res.status(500).json({ error: "Failed to delete bounty" });
  }
});

// POST /bounties/:id/approve
bountiesRouter.post("/:id/approve", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const [bounty] = await db
      .update(bountiesTable)
      .set({ status: "approved" })
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)))
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

    const existingBrief = await db.select().from(researchBriefsTable).where(eq(researchBriefsTable.bountyId, id));
    if (existingBrief.length === 0) {
      logger.info({ bountyId: id }, "Generating research brief");
      const brief = await generateResearchBrief(scrapedForGen);
      await db.insert(researchBriefsTable).values({ bountyId: id, ...brief });
    }

    const existingPlan = await db.select().from(productionPlansTable).where(eq(productionPlansTable.bountyId, id));
    if (existingPlan.length === 0) {
      logger.info({ bountyId: id }, "Generating production plan");
      const plan = await generateProductionPlan(scrapedForGen);
      await db.insert(productionPlansTable).values({ bountyId: id, ...plan });
    }

    res.json(bounty);
  } catch (err) {
    logger.error(err, "Error approving bounty");
    res.status(500).json({ error: "Failed to approve bounty" });
  }
});

// POST /bounties/:id/reject
bountiesRouter.post("/:id/reject", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const [bounty] = await db
      .update(bountiesTable)
      .set({ status: "rejected" })
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)))
      .returning();
    if (!bounty) return res.status(404).json({ error: "Not found" });
    res.json(bounty);
  } catch (err) {
    logger.error(err, "Error rejecting bounty");
    res.status(500).json({ error: "Failed to reject bounty" });
  }
});

// POST /bounties/:id/rescrape — re-fetch the URL and update extracted fields
bountiesRouter.post("/:id/rescrape", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    const [existing] = await db
      .select()
      .from(bountiesTable)
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)));
    if (!existing) return res.status(404).json({ error: "Not found" });

    const prevConfidence = existing.confidenceScore ?? 0;
    logger.info({ bountyId: id, url: existing.url }, "Rescraping bounty");
    const scraped = await scrapeBounty(existing.url);

    const updates: Record<string, unknown> = {
      confidenceScore: scraped.confidenceScore,
    };
    // Merge: only fill in fields that were missing or improve them
    if (scraped.title && scraped.title.length > (existing.title?.length ?? 0)) updates.title = scraped.title;
    if (scraped.deadline && !existing.deadline) updates.deadline = scraped.deadline;
    if (scraped.rewardAmount && !existing.rewardAmount) updates.rewardAmount = scraped.rewardAmount;
    if (scraped.submissionRequirements) updates.submissionRequirements = scraped.submissionRequirements;
    if (scraped.deliverables) updates.deliverables = scraped.deliverables;
    if (scraped.eligibilityRules) updates.eligibilityRules = scraped.eligibilityRules;
    if (scraped.importantNotes) updates.importantNotes = scraped.importantNotes;

    // Re-score with fresher data
    const analysis = await analyzeBounty(scraped);
    updates.opportunityScore = analysis.opportunityScore;
    updates.scoreExplanation = analysis.scoreExplanation;

    const [bounty] = await db
      .update(bountiesTable)
      .set(updates)
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)))
      .returning();

    logger.info({ bountyId: id, prevConfidence, newConfidence: scraped.confidenceScore }, "Rescrape complete");
    res.json({ bounty, prevConfidence, newConfidence: scraped.confidenceScore });
  } catch (err) {
    logger.error(err, "Error rescraping bounty");
    res.status(500).json({ error: "Failed to rescrape bounty" });
  }
});

// POST /bounties/:id/save-later
bountiesRouter.post("/:id/save-later", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const [bounty] = await db
      .update(bountiesTable)
      .set({ status: "saved_for_later" })
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)))
      .returning();
    if (!bounty) return res.status(404).json({ error: "Not found" });
    res.json(bounty);
  } catch (err) {
    logger.error(err, "Error saving bounty for later");
    res.status(500).json({ error: "Failed to save bounty" });
  }
});
