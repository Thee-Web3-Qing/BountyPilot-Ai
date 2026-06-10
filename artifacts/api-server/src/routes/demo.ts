import { Router } from "express";
import { db } from "@workspace/db";
import {
  bountiesTable, researchBriefsTable, productionPlansTable,
  submissionsTable, earningsTable,
} from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

export const demoRouter = Router();

// POST /demo/load — seed demo bounties for the current user
demoRouter.post("/load", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const now = new Date();
    const days = (n: number) => new Date(now.getTime() + n * 86400000).toISOString().split("T")[0];

    const demoBounties = [
      {
        userId, url: "https://earn.superteam.fun/listing/compose-a-twitterx-post-or-thread-promoting-jagpool-world-cup",
        title: "Compose a Twitter/X Post or Thread Promoting JagPool World Cup", platform: "Superteam Earn",
        projectName: "JagPool", rewardAmount: "500", rewardCurrency: "USDC",
        deadline: days(14), contentFormat: "Twitter Thread",
        submissionRequirements: "Create a Twitter/X post or thread promoting JagPool World Cup event",
        deliverables: "Twitter/X post or thread",
        submissionLink: "https://earn.superteam.fun/listing/compose-a-twitterx-post-or-thread-promoting-jagpool-world-cup",
        eligibilityRules: "Open worldwide", importantNotes: "Focus on engagement and reach",
        opportunityScore: 7, confidenceScore: 85,
        scoreExplanation: "Score 7/10: Moderate reward ($500 USDC), clear requirements, 14 days deadline.",
        status: "approved",
      },
      {
        userId, url: "https://earn.superteam.fun/listing/create-content-about-amulets-and-earn-rewards",
        title: "Create Content About Amulets & Earn Rewards", platform: "Superteam Earn",
        projectName: "Amulets", rewardAmount: "2000", rewardCurrency: "USDC",
        deadline: days(7), contentFormat: "Video + Article",
        submissionRequirements: "Create content about Amulets platform and earn rewards",
        deliverables: "Video + article",
        submissionLink: "https://earn.superteam.fun/listing/create-content-about-amulets-and-earn-rewards",
        eligibilityRules: "Open to all creators", importantNotes: "High reward, competitive",
        opportunityScore: 9, confidenceScore: 92,
        scoreExplanation: "Score 9/10: Top-tier reward ($2000 USDC), clear brief, tight deadline.",
        status: "scripting",
      },
      {
        userId, url: "https://app.firstdollar.money/bounties/d1b98f7a-b9de-43f5-9095-089016f4835b",
        title: "X Thread / Video Explainer & Experience Bounty", platform: "First Dollar",
        projectName: "First Dollar", rewardAmount: "", rewardCurrency: "USDC",
        deadline: days(21), contentFormat: "X Thread / Video",
        submissionRequirements: "Create an X thread or video explaining and sharing experience with First Dollar",
        deliverables: "X thread or video",
        submissionLink: "https://app.firstdollar.money/bounties/d1b98f7a-b9de-43f5-9095-089016f4835b",
        eligibilityRules: "Open to all", importantNotes: "Check listing for reward details",
        opportunityScore: 6, confidenceScore: 78,
        scoreExplanation: "Score 6/10: Clear requirements, open format, reward not specified.",
        status: "discovered",
      },
      {
        userId, url: "https://earn.superteam.fun/listing/explain-clapmi-in-your-niche",
        title: "Explain ClapMi in Your Niche", platform: "Superteam Earn",
        projectName: "ClapMi", rewardAmount: "5000", rewardCurrency: "USDC",
        deadline: days(10), contentFormat: "YouTube Video",
        submissionRequirements: "Explain ClapMi platform in your content niche",
        deliverables: "YouTube video",
        submissionLink: "https://earn.superteam.fun/listing/explain-clapmi-in-your-niche",
        eligibilityRules: "Open to all", importantNotes: "High reward, niche-specific content",
        opportunityScore: 8, confidenceScore: 88,
        scoreExplanation: "Score 8/10: High reward ($5000 USDC), clear requirements, 10 days to submit.",
        status: "researching",
      },
      {
        userId, url: "https://app.firstdollar.money/bounties/5d83f1f9-79ab-471c-ac0e-50956c21d6ef",
        title: "CodeXero v2 is now live on Base - VIDEO CAMPAIGN", platform: "First Dollar",
        projectName: "CodeXero", rewardAmount: "2000", rewardCurrency: "USDC",
        deadline: days(-30), contentFormat: "Video Campaign",
        submissionRequirements: "Create video content promoting CodeXero v2 on Base",
        deliverables: "Video campaign",
        submissionLink: "https://app.firstdollar.money/bounties/5d83f1f9-79ab-471c-ac0e-50956c21d6ef", eligibilityRules: "Open worldwide",
        importantNotes: "Video campaign for CodeXero launch",
        opportunityScore: 7, confidenceScore: 85,
        scoreExplanation: "Score 7/10: Good reward ($2000), clear campaign brief.",
        status: "won",
      },
    ];

    const inserted = await db.insert(bountiesTable).values(demoBounties).returning();

    // Add research brief + production plan for the approved one
    const approved = inserted.find((b) => b.status === "approved");
    if (approved) {
      await db.insert(researchBriefsTable).values({
        bountyId: approved.id,
        summary: "JagPool is a World Cup-themed pool on Solana. This bounty asks creators to promote the event via a Twitter/X post or thread, focusing on engagement and reach.",
        contentAngles: "1. The 'World Cup meets blockchain' angle\n2. How to participate in JagPool during the tournament\n3. Comparison with other Solana pools\n4. Real-time engagement strategy",
        keyPoints: "- JagPool runs on Solana\n- World Cup themed events\n- Creator rewards based on engagement\n- Focus on Twitter/X reach",
        targetAudience: "Solana community, World Cup fans, crypto-curious users",
        competitorAnalysis: "Most existing content is about the event itself. Opportunity: narrative-driven content about participation and rewards.",
      });
      await db.insert(productionPlansTable).values({
        bountyId: approved.id,
        scriptOutline: "HOOK: Open with World Cup + blockchain connection\nSECTION 1: What is JagPool and how it works\nSECTION 2: How to participate in the World Cup event\nSECTION 3: Engagement tips and strategy\nOUTRO: CTA + link",
        shotList: "1. Talking head intro\n2. Screen: JagPool interface\n3. Screen: Participation steps\n4. Graphic overlay: engagement tips\n5. Outro card",
        captionDraft: "World Cup meets blockchain — here's how to participate in JagPool on Solana. #WorldCup #Solana #JagPool",
        submissionChecklist: `[ ] Twitter/X post or thread published (public)\n[ ] Engaging content with clear CTA\n[ ] Submission form completed before ${days(14)}\n[ ] Thread is 10+ tweets if chosen`,
        estimatedHours: 4,
      });
    }

    // Add submission + earnings for won bounty
    const won = inserted.find((b) => b.status === "won");
    if (won) {
      await db.insert(submissionsTable).values({
        userId, bountyId: won.id,
        submittedAt: new Date(now.getTime() - 35 * 86400000),
        submissionUrl: "https://mirror.xyz/creator/codexero-campaign",
        result: "won", rewardReceived: 2000,
        notes: "Won first place! USDC received to wallet.",
      });
      await db.insert(earningsTable).values({
        userId, bountyId: won.id, platform: "First Dollar",
        amount: 2000, currency: "USDC",
        receivedAt: new Date(now.getTime() - 32 * 86400000),
        notes: "First place prize for CodeXero video campaign",
      });
    }

    logger.info({ userId, count: inserted.length }, "Demo data loaded");
    res.json({ loaded: inserted.length, message: "Demo data loaded successfully" });
  } catch (err) {
    logger.error(err, "Demo load error");
    res.status(500).json({ error: "Failed to load demo data" });
  }
});
