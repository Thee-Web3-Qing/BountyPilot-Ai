import { Router } from "express";
import { db } from "@workspace/db";
import {
  bountiesTable,
  bountyReportsTable,
  researchBriefsTable,
  productionPlansTable,
  userProfilesTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { CreateBountyBody, UpdateBountyBody } from "@workspace/api-zod";
import { logger } from "../lib/logger.js";
import { scrapeBounty } from "../lib/scraper.js";
import { analyzeBounty, generateResearchBrief, generateProductionPlan, generateApplicationDraft } from "../lib/qwen.js";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { getUserPlanStatus, countUserBounties } from "../lib/access.js";

export const bountiesRouter = Router();

bountiesRouter.use(requireAuth);

// GET /bounties
bountiesRouter.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { status, platform, active } = req.query as { status?: string; platform?: string; active?: string };
    const all = await db
      .select()
      .from(bountiesTable)
      .where(eq(bountiesTable.userId, userId))
      .orderBy(desc(bountiesTable.createdAt));
    let filtered = all;
    if (status) filtered = filtered.filter((b) => b.status === status);
    if (platform) filtered = filtered.filter((b) => b.platform === platform);
    if (active === "true") {
      const nowDate = new Date().toISOString().slice(0, 10);
      const completedStatuses = new Set(["submitted", "won", "lost"]);
      filtered = filtered.filter((b) => {
        // Always include completed bounties so users can track outcomes
        if (completedStatuses.has(b.status)) return true;
        if (!b.deadline) return true;
        const deadlineDate = b.deadline.slice(0, 10);
        return deadlineDate >= nowDate;
      });
    }
    res.json(filtered);
    return;
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
      res.status(400).json({ error: "Invalid input", details: parsed.error });
      return;
    }
    const { url } = parsed.data;

    // Enforce free tier 3-bounty pipeline limit
    const { isFree } = await getUserPlanStatus(userId);
    if (isFree) {
      const bountyCount = await countUserBounties(userId);
      if (bountyCount >= 3) {
        res.status(403).json({ error: "free_limit", message: "Free plan is limited to 3 bounties. Upgrade to add more." });
        return;
      }
    }

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
        scoreBreakdown: analysis.scoreBreakdown ? JSON.stringify(analysis.scoreBreakdown) : null,
        confidenceScore: scraped.confidenceScore,
        opportunityType: scraped.opportunityType,
        techStack: scraped.techStack,
        programmingLanguages: scraped.programmingLanguages,
        teamSize: scraped.teamSize,
        trackCategory: scraped.trackCategory,
        difficulty: scraped.difficulty,
        skillsRequired: scraped.skillsRequired,
        estimatedHours: scraped.estimatedHours,
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
    const id = parseInt(req.params.id as string);
    const [bounty] = await db
      .select()
      .from(bountiesTable)
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)));
    if (!bounty) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(bounty);
    return;
  } catch (err) {
    logger.error(err, "Error getting bounty");
    res.status(500).json({ error: "Failed to get bounty" });
  }
});

// PATCH /bounties/:id
bountiesRouter.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id as string);
    const parsed = UpdateBountyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.rewardAmount !== undefined) updates.rewardAmount = parsed.data.rewardAmount;
    if (parsed.data.deadline !== undefined) updates.deadline = parsed.data.deadline;
    if (parsed.data.hoursSaved !== undefined) updates.hoursSaved = parsed.data.hoursSaved;

    const [bounty] = await db
      .update(bountiesTable)
      .set(updates)
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)))
      .returning();
    if (!bounty) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(bounty);
    return;
  } catch (err) {
    logger.error(err, "Error updating bounty");
    res.status(500).json({ error: "Failed to update bounty" });
  }
});

// DELETE /bounties/:id
bountiesRouter.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id as string);
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
    const id = parseInt(req.params.id as string);
    const [bounty] = await db
      .update(bountiesTable)
      .set({ status: "approved" })
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)))
      .returning();
    if (!bounty) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const scrapedForGen = {
      title: bounty.title || "",
      description: bounty.submissionRequirements || "",
      rewardAmount: bounty.rewardAmount,
      rewardCurrency: bounty.rewardCurrency,
      prizeRank: bounty.prizeRank,
      prizeBreakdown: bounty.prizeBreakdown ? JSON.parse(bounty.prizeBreakdown) as import("../lib/scraper.js").PrizeBreakdown[] : null,
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
    const id = parseInt(req.params.id as string);
    const [bounty] = await db
      .update(bountiesTable)
      .set({ status: "rejected" })
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)))
      .returning();
    if (!bounty) {
      res.status(404).json({ error: "Not found" });
      return;
    }
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
    const id = parseInt(req.params.id as string);

    const [existing] = await db
      .select()
      .from(bountiesTable)
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

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
    if (scraped.techStack) updates.techStack = scraped.techStack;
    if (scraped.programmingLanguages) updates.programmingLanguages = scraped.programmingLanguages;
    if (scraped.teamSize) updates.teamSize = scraped.teamSize;
    if (scraped.trackCategory) updates.trackCategory = scraped.trackCategory;
    if (scraped.difficulty) updates.difficulty = scraped.difficulty;
    if (scraped.skillsRequired) updates.skillsRequired = scraped.skillsRequired;
    if (scraped.estimatedHours) updates.estimatedHours = scraped.estimatedHours;

    // Re-score with fresher data
    const analysis = await analyzeBounty(scraped);
    updates.opportunityScore = analysis.opportunityScore;
    updates.scoreExplanation = analysis.scoreExplanation;
    updates.scoreBreakdown = analysis.scoreBreakdown ? JSON.stringify(analysis.scoreBreakdown) : null;

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

// POST /bounties/:id/report
bountiesRouter.post("/:id/report", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id as string);
    const { reason, note } = req.body as { reason?: string; note?: string };
    const validReasons = ["broken_link", "wrong_info", "spam", "expired", "other"];
    if (!reason || !validReasons.includes(reason)) {
      res.status(400).json({ error: "Invalid reason. Use: broken_link, wrong_info, spam, expired, other" });
      return;
    }
    const [bounty] = await db
      .select()
      .from(bountiesTable)
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)));
    if (!bounty) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // Check if user already reported this bounty
    const existing = await db
      .select()
      .from(bountyReportsTable)
      .where(and(eq(bountyReportsTable.bountyId, id), eq(bountyReportsTable.userId, userId)));
    if (existing.length > 0) {
      res.status(409).json({ error: "You already reported this bounty" });
      return;
    }
    const [report] = await db
      .insert(bountyReportsTable)
      .values({ bountyId: id, userId, reason, note: note || null })
      .returning();
    logger.info({ bountyId: id, userId, reason }, "Bounty reported");
    res.status(201).json(report);
    return;
  } catch (err) {
    logger.error(err, "Error reporting bounty");
    res.status(500).json({ error: "Failed to report bounty" });
  }
});

// POST /bounties/:id/save-later
bountiesRouter.post("/:id/save-later", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id as string);
    const [bounty] = await db
      .update(bountiesTable)
      .set({ status: "saved_for_later" })
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)))
      .returning();
    if (!bounty) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(bounty);
  } catch (err) {
    logger.error(err, "Error saving bounty for later");
    res.status(500).json({ error: "Failed to save bounty" });
  }
});

// POST /bounties/:id/rescore — re-score with user's current profile using Qwen AI
bountiesRouter.post("/:id/rescore", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id as string);
    const [bounty] = await db
      .select()
      .from(bountiesTable)
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)));
    if (!bounty) { res.status(404).json({ error: "Not found" }); return; }

    const [userProfile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));

    const scraped = {
      title: bounty.title ?? "",
      platform: bounty.platform ?? "",
      projectName: bounty.projectName ?? "",
      rewardAmount: bounty.rewardAmount ?? null,
      rewardCurrency: bounty.rewardCurrency ?? null,
      deadline: bounty.deadline ?? null,
      contentFormat: bounty.contentFormat ?? "",
      submissionRequirements: bounty.submissionRequirements ?? "",
      deliverables: bounty.deliverables ?? "",
      description: bounty.submissionRequirements ?? "",
      submissionLink: bounty.submissionLink ?? "",
      eligibilityRules: bounty.eligibilityRules ?? "",
      importantNotes: bounty.importantNotes ?? "",
      confidenceScore: bounty.confidenceScore ?? 70,
      prizeBreakdown: null,
      prizeRank: null,
    };

    const analysis = await analyzeBounty(scraped, userProfile ?? undefined);
    const [updated] = await db
      .update(bountiesTable)
      .set({
        opportunityScore: analysis.opportunityScore,
        scoreExplanation: analysis.scoreExplanation,
        scoreBreakdown: analysis.scoreBreakdown ? JSON.stringify(analysis.scoreBreakdown) : null,
      })
      .where(eq(bountiesTable.id, id))
      .returning();

    res.json({ ...updated, personalized: !!userProfile });
  } catch (err) {
    logger.error(err, "Error rescoring bounty");
    res.status(500).json({ error: "Failed to rescore bounty" });
  }
});

// POST /bounties/:id/draft-application — generate AI application draft using Qwen
bountiesRouter.post("/:id/draft-application", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id as string);
    const [bounty] = await db
      .select()
      .from(bountiesTable)
      .where(and(eq(bountiesTable.id, id), eq(bountiesTable.userId, userId)));
    if (!bounty) { res.status(404).json({ error: "Not found" }); return; }

    const [userProfile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
    const draft = await generateApplicationDraft(
      {
        title: bounty.title,
        platform: bounty.platform,
        projectName: bounty.projectName,
        rewardAmount: bounty.rewardAmount,
        rewardCurrency: bounty.rewardCurrency,
        contentFormat: bounty.contentFormat,
        submissionRequirements: bounty.submissionRequirements,
        deliverables: bounty.deliverables,
        description: null,
      },
      userProfile ?? undefined
    );
    res.json(draft);
  } catch (err) {
    logger.error(err, "Error drafting application");
    res.status(500).json({ error: "Failed to draft application" });
  }
});
