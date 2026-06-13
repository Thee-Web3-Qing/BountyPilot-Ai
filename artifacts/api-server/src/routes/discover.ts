import { Router } from "express";
import { db } from "@workspace/db";
import { bountiesTable } from "@workspace/db";
import { isNull, eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { crawlAll } from "../lib/crawler.js";
import { getCrawlerStatus } from "../lib/cron.js";

export const discoverRouter = Router();
discoverRouter.use(requireAuth);

// GET /discover — list all global (auto-fetched) bounties
discoverRouter.get("/", async (_req: AuthRequest, res) => {
  try {
    const bounties = await db
      .select()
      .from(bountiesTable)
      .where(isNull(bountiesTable.userId))
      .orderBy(desc(bountiesTable.createdAt));
    res.json(bounties);
  } catch (err) {
    logger.error(err, "Error listing discover bounties");
    res.status(500).json({ error: "Failed to list bounties" });
  }
});

// GET /discover/status — crawler status
discoverRouter.get("/status", (_req: AuthRequest, res) => {
  res.json(getCrawlerStatus());
});

// POST /discover/trigger — manually kick off a crawl
discoverRouter.post("/trigger", async (_req: AuthRequest, res) => {
  const status = getCrawlerStatus();
  if (status.isRunning) {
    res.status(409).json({ error: "Crawl already in progress" });
    return;
  }
  res.json({ message: "Crawl triggered — running in background" });
  // Non-blocking
  crawlAll().catch((err) => logger.error(err, "Manual crawl failed"));
});

// POST /discover/:id/claim — copy global bounty into current user's pipeline
discoverRouter.post("/:id/claim", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id as string);

    const [source] = await db
      .select()
      .from(bountiesTable)
      .where(and(eq(bountiesTable.id, id), isNull(bountiesTable.userId)));

    if (!source) {
      res.status(404).json({ error: "Bounty not found in discover pool" });
      return;
    }

    // Check user doesn't already have this URL
    const existing = await db
      .select({ id: bountiesTable.id })
      .from(bountiesTable)
      .where(and(eq(bountiesTable.url, source.url), eq(bountiesTable.userId, userId)));

    if (existing.length > 0) {
      res.status(409).json({ error: "Already in your pipeline", bountyId: existing[0].id });
      return;
    }

    const [claimed] = await db
      .insert(bountiesTable)
      .values({
        userId,
        url: source.url,
        title: source.title,
        platform: source.platform,
        projectName: source.projectName,
        rewardAmount: source.rewardAmount,
        rewardCurrency: source.rewardCurrency,
        deadline: source.deadline,
        contentFormat: source.contentFormat,
        submissionRequirements: source.submissionRequirements,
        deliverables: source.deliverables,
        submissionLink: source.submissionLink,
        eligibilityRules: source.eligibilityRules,
        importantNotes: source.importantNotes,
        opportunityScore: source.opportunityScore,
        scoreExplanation: source.scoreExplanation,
        confidenceScore: source.confidenceScore,
        status: "discovered",
      })
      .returning();

    logger.info({ userId, bountyId: claimed.id, sourceId: id }, "Bounty claimed");
    res.status(201).json(claimed);
  } catch (err) {
    logger.error(err, "Error claiming bounty");
    res.status(500).json({ error: "Failed to claim bounty" });
  }
});
