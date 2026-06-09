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
        userId, url: "https://earn.superteam.fun/listing/solana-defi-explainer",
        title: "Explain Solana DeFi to Beginners", platform: "Superteam Earn",
        projectName: "Solana Foundation", rewardAmount: "1500", rewardCurrency: "USDC",
        deadline: days(14), contentFormat: "YouTube Video + Twitter Thread",
        submissionRequirements: "Original video min 8 minutes, detailed thread min 10 tweets with visuals",
        deliverables: "YouTube video + Twitter thread",
        submissionLink: "https://earn.superteam.fun/listing/solana-defi-explainer",
        eligibilityRules: "Open worldwide", importantNotes: "Judged on clarity, engagement, accuracy",
        opportunityScore: 8, confidenceScore: 85,
        scoreExplanation: "Score 8/10: High reward ($1500 USDC), clear requirements, 14 days deadline, strong creator fit.",
        status: "approved",
      },
      {
        userId, url: "https://dorahacks.io/bounty/superchain-explainer",
        title: "Superchain Explained: Layer 2 for Creators", platform: "DoraHacks",
        projectName: "Optimism", rewardAmount: "2000", rewardCurrency: "OP",
        deadline: days(5), contentFormat: "Video Series",
        submissionRequirements: "Series of 3 short videos (3-5 min each), must include demos",
        deliverables: "3-part video series",
        submissionLink: "https://dorahacks.io/bounty/superchain-explainer/submit",
        eligibilityRules: "Must have YouTube channel with 500+ subscribers",
        importantNotes: "Prize split across 3 winners",
        opportunityScore: 9, confidenceScore: 92,
        scoreExplanation: "Score 9/10: Top-tier reward ($2000 OP), very clear requirements, tight deadline keeps competition low.",
        status: "scripting",
      },
      {
        userId, url: "https://gitcoin.co/grants/zk-for-everyone",
        title: "Zero Knowledge for Everyone", platform: "Gitcoin",
        projectName: "Ethereum Foundation", rewardAmount: "3000", rewardCurrency: "ETH",
        deadline: days(21), contentFormat: "Long-form Article + Infographic",
        submissionRequirements: "Technical accuracy required, peer reviewed, min 2000 words",
        deliverables: "Article + 2 infographics",
        submissionLink: "https://gitcoin.co/grants/zk-for-everyone/submit",
        eligibilityRules: "Technical background preferred", importantNotes: "Reviewed by EF team",
        opportunityScore: 9, confidenceScore: 90,
        scoreExplanation: "Score 9/10: Premium reward, prestigious sponsor, clear brief, 3 weeks is comfortable.",
        status: "discovered",
      },
      {
        userId, url: "https://earn.superteam.fun/listing/depin-content",
        title: "DePIN 101: Content Series", platform: "Superteam Earn",
        projectName: "Hivemapper", rewardAmount: "500", rewardCurrency: "USDC",
        deadline: days(10), contentFormat: "Twitter Thread",
        submissionRequirements: "Single thread, min 15 tweets, include real use cases",
        deliverables: "Twitter thread",
        submissionLink: "https://earn.superteam.fun/listing/depin-content",
        eligibilityRules: "Open to all", importantNotes: "Focus on real-world adoption",
        opportunityScore: 5, confidenceScore: 72,
        scoreExplanation: "Score 5/10: Modest reward, competitive category, but low barrier to entry.",
        status: "researching",
      },
      {
        userId, url: "https://gitcoin.co/grants/zk-won",
        title: "Layer 2 Scaling Explained", platform: "Gitcoin",
        projectName: "Arbitrum", rewardAmount: "1200", rewardCurrency: "ARB",
        deadline: days(-30), contentFormat: "Article + Thread",
        submissionRequirements: "Min 1500 words, published on Mirror",
        deliverables: "Article + thread",
        submissionLink: "https://gitcoin.co/submit", eligibilityRules: "Open worldwide",
        importantNotes: "Judged by Arbitrum team",
        opportunityScore: 7, confidenceScore: 88,
        scoreExplanation: "Score 7/10: Good reward, reasonable deadline, clear requirements.",
        status: "won",
      },
    ];

    const inserted = await db.insert(bountiesTable).values(demoBounties).returning();

    // Add research brief + production plan for the approved one
    const approved = inserted.find((b) => b.status === "approved");
    if (approved) {
      await db.insert(researchBriefsTable).values({
        bountyId: approved.id,
        summary: "Solana DeFi has exploded in 2024 with protocols like Jupiter, Raydium, and Drift leading volume. This bounty targets creators who can demystify on-chain finance for mainstream audiences.",
        contentAngles: "1. The 'DeFi in 5 minutes' explainer angle\n2. Comparison: Solana vs Ethereum DeFi UX\n3. Real user story: $100 to $10k using only Solana DeFi\n4. Risk-first narrative: what can go wrong",
        keyPoints: "- Solana processes 65k TPS\n- Jupiter aggregates $2B+ daily volume\n- Average tx fee is $0.00025\n- Key protocols: Jupiter, Raydium, Marginfi, Drift, Kamino",
        targetAudience: "Crypto-curious users aged 18-35, existing DeFi users wanting to explore Solana",
        competitorAnalysis: "Most existing content is too technical. Opportunity: narrative-driven content with actual demos and real numbers.",
      });
      await db.insert(productionPlansTable).values({
        bountyId: approved.id,
        scriptOutline: "INTRO (0-30s): Hook with DeFi fee stat\nACT 1 (30-120s): What is DeFi, why Solana\nACT 2 (120-240s): Live demo: Jupiter swap, Kamino yield\nACT 3 (240-360s): Risk management basics\nOUTRO: CTA + link",
        shotList: "1. Talking head intro\n2. Screen: Jupiter swap flow\n3. Screen: Kamino dashboard\n4. Graphic overlay: fee comparison table\n5. Outro card",
        captionDraft: "I spent 30 days only using Solana DeFi. Here is what actually happened. #Solana #DeFi #Crypto",
        submissionChecklist: `[ ] Video published on YouTube (public)\n[ ] Twitter thread live (10+ tweets)\n[ ] YouTube link in thread\n[ ] Submission form completed before ${days(14)}\n[ ] Video is 8+ minutes`,
        estimatedHours: 10,
      });
    }

    // Add submission + earnings for won bounty
    const won = inserted.find((b) => b.status === "won");
    if (won) {
      await db.insert(submissionsTable).values({
        userId, bountyId: won.id,
        submittedAt: new Date(now.getTime() - 35 * 86400000),
        submissionUrl: "https://mirror.xyz/creator/layer2-scaling",
        result: "won", rewardReceived: 1200,
        notes: "Won first place! ARB received to wallet.",
      });
      await db.insert(earningsTable).values({
        userId, bountyId: won.id, platform: "Gitcoin",
        amount: 1200, currency: "ARB",
        receivedAt: new Date(now.getTime() - 32 * 86400000),
        notes: "First place prize for Layer 2 article",
      });
    }

    logger.info({ userId, count: inserted.length }, "Demo data loaded");
    res.json({ loaded: inserted.length, message: "Demo data loaded successfully" });
  } catch (err) {
    logger.error(err, "Demo load error");
    res.status(500).json({ error: "Failed to load demo data" });
  }
});
