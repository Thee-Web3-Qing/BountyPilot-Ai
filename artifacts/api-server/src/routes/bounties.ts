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
import { logger } from "../lib/logger";

export const bountiesRouter = Router();

// Mock LLM function — swap out for Qwen API when key is available
function mockLLM(prompt: string): string {
  return `[AI Response for: ${prompt.slice(0, 60)}...]`;
}

function detectPlatform(url: string): string {
  if (url.includes("earn.superteam")) return "Superteam Earn";
  if (url.includes("gibwork")) return "GibWork";
  if (url.includes("firstdollar")) return "First Dollar";
  if (url.includes("dorahacks")) return "DoraHacks";
  if (url.includes("gitcoin")) return "Gitcoin";
  return "Unknown Platform";
}

function computeScore(rewardAmount: string | null, deadline: string | null): number {
  let score = 5;
  if (rewardAmount) {
    const num = parseFloat(rewardAmount.replace(/[^0-9.]/g, ""));
    if (num > 5000) score += 2;
    else if (num > 1000) score += 1;
  }
  if (deadline) {
    const d = new Date(deadline);
    const daysLeft = (d.getTime() - Date.now()) / 86400000;
    if (daysLeft < 3) score -= 1;
    else if (daysLeft > 14) score += 1;
  }
  return Math.max(1, Math.min(10, score));
}

// GET /bounties
bountiesRouter.get("/", async (req, res) => {
  try {
    const { status, platform } = req.query as { status?: string; platform?: string };
    let query = db.select().from(bountiesTable).orderBy(desc(bountiesTable.createdAt));
    const all = await query;
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
bountiesRouter.post("/", async (req, res) => {
  try {
    const parsed = CreateBountyBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error });
    }
    const { url } = parsed.data;
    const platform = detectPlatform(url);

    // Simulate extraction (mock LLM / scraping)
    const title = `Content Bounty on ${platform}`;
    const rewardAmount = "500";
    const rewardCurrency = "USDC";
    const deadline = new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0];
    const contentFormat = "Article / Twitter Thread";
    const submissionRequirements = "Original content, min 800 words, include relevant links";
    const deliverables = "1 long-form article + 5-tweet thread";
    const submissionLink = url;
    const eligibilityRules = "Open to all creators worldwide";
    const importantNotes = "Judged on clarity, accuracy, and reach";

    const score = computeScore(rewardAmount, deadline);
    const scoreExplanation = mockLLM(
      `Score ${score}/10: Moderate reward ($${rewardAmount} USDC), clear requirements, 10 days remaining. Good fit for experienced content creators.`
    );

    const [bounty] = await db
      .insert(bountiesTable)
      .values({
        url,
        title,
        platform,
        projectName: platform,
        rewardAmount,
        rewardCurrency,
        deadline,
        contentFormat,
        submissionRequirements,
        deliverables,
        submissionLink,
        eligibilityRules,
        importantNotes,
        opportunityScore: score,
        scoreExplanation: `Score ${score}/10: Moderate reward ($${rewardAmount} ${rewardCurrency}), clear requirements, 10 days remaining. Good fit for experienced content creators.`,
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

// POST /bounties/:id/approve
bountiesRouter.post("/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [bounty] = await db
      .update(bountiesTable)
      .set({ status: "approved" })
      .where(eq(bountiesTable.id, id))
      .returning();
    if (!bounty) return res.status(404).json({ error: "Not found" });

    // Auto-generate research brief and production plan
    const existingBrief = await db
      .select()
      .from(researchBriefsTable)
      .where(eq(researchBriefsTable.bountyId, id));

    if (existingBrief.length === 0) {
      await db.insert(researchBriefsTable).values({
        bountyId: id,
        summary: `Research brief for "${bounty.title}" on ${bounty.platform}. This bounty requires deep knowledge of the project ecosystem and target audience.`,
        contentAngles: `1. Deep-dive technical explainer\n2. Beginner's guide / onboarding narrative\n3. Comparison with competing protocols\n4. Use-case story with real user examples`,
        keyPoints: `- Understand the core protocol mechanics\n- Highlight unique value propositions\n- Address common misconceptions\n- Include recent milestones and roadmap`,
        targetAudience: `Web3 enthusiasts, crypto investors, developers entering the ecosystem, content consumers on Twitter and YouTube`,
        competitorAnalysis: `Similar content exists on Medium and Mirror. Differentiate through clarity, unique angles, and multimedia elements.`,
      });
    }

    const existingPlan = await db
      .select()
      .from(productionPlansTable)
      .where(eq(productionPlansTable.bountyId, id));

    if (existingPlan.length === 0) {
      await db.insert(productionPlansTable).values({
        bountyId: id,
        scriptOutline: `INTRO (0-30s): Hook with a surprising statistic\nSECTION 1 (30-90s): Problem statement\nSECTION 2 (90-180s): Solution overview\nSECTION 3 (180-240s): How it works\nOUTRO (240-300s): Call to action + submission link`,
        shotList: `1. Talking head intro\n2. Screen recording of protocol\n3. Graphic: key metrics\n4. B-roll: community/ecosystem\n5. Outro card with links`,
        captionDraft: `Exploring ${bounty.platform}'s latest content bounty — here's everything you need to know about ${bounty.projectName}. Thread below. #Web3 #Crypto #ContentBounty`,
        submissionChecklist: `[ ] Content published and accessible\n[ ] Minimum word/time requirement met\n[ ] All required links included\n[ ] Submitted before deadline (${bounty.deadline})\n[ ] Submission URL shared in form`,
        estimatedHours: 8,
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
