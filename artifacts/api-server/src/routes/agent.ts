import { Router } from "express";
import { db } from "@workspace/db";
import { bountiesTable } from "@workspace/db";
import { eq, gte, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { hasKey } from "../lib/qwen.js";
import { runBountyAgentPipeline, type AgentStreamEvent } from "../lib/agent.js";

export const agentRouter = Router();

agentRouter.use(requireAuth);

// GET /agent/status — pipeline stats + recent bounty activity feed
agentRouter.get("/status", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const oneDayAgo = new Date(Date.now() - 86_400_000);

    const [totalRow] = await db
      .select({ v: sql<number>`count(*)::int` })
      .from(bountiesTable);

    const [highMatchRow] = await db
      .select({ v: sql<number>`count(*)::int` })
      .from(bountiesTable)
      .where(gte(bountiesTable.opportunityScore, 7));

    const [recentRow] = await db
      .select({ v: sql<number>`count(*)::int` })
      .from(bountiesTable)
      .where(gte(bountiesTable.createdAt, oneDayAgo));

    const [userHighMatchRow] = await db
      .select({ v: sql<number>`count(*)::int` })
      .from(bountiesTable)
      .where(sql`${bountiesTable.userId} = ${userId} AND ${bountiesTable.opportunityScore} >= 7`);

    const recentActivity = await db
      .select({
        id: bountiesTable.id,
        title: bountiesTable.title,
        platform: bountiesTable.platform,
        opportunityScore: bountiesTable.opportunityScore,
        scoreExplanation: bountiesTable.scoreExplanation,
        status: bountiesTable.status,
        createdAt: bountiesTable.createdAt,
        rewardAmount: bountiesTable.rewardAmount,
        rewardCurrency: bountiesTable.rewardCurrency,
      })
      .from(bountiesTable)
      .where(eq(bountiesTable.userId, userId))
      .orderBy(desc(bountiesTable.createdAt))
      .limit(12);

    const total = totalRow?.v ?? 0;
    const highMatch = highMatchRow?.v ?? 0;
    const recent = recentRow?.v ?? 0;
    const userHighMatch = userHighMatchRow?.v ?? 0;
    const aiProvider = hasKey() ? "qwen" : "rule-based";

    res.json({
      aiProvider,
      stats: {
        totalIndexed: total,
        highMatch,
        userHighMatch,
        recentCrawled: recent,
      },
      pipeline: [
        {
          step: "discover",
          label: "Discover",
          description: "Agent scans Web3 platforms for new bounty opportunities",
          count: total,
        },
        {
          step: "score",
          label: "Score with Qwen",
          description: "Qwen AI evaluates each bounty using tool-calling: reward, deadline, format fit, creator fit",
          count: total,
        },
        {
          step: "match",
          label: "Match",
          description: "High-scoring opportunities (7+/10) surfaced as strong picks",
          count: highMatch,
        },
        {
          step: "checkpoint",
          label: "Human Checkpoint",
          description: "Creator reviews AI reasoning before committing — human-in-the-loop confirmation",
          count: userHighMatch,
        },
      ],
      recentActivity,
    });
  } catch (err) {
    logger.error(err, "Error fetching agent status");
    res.status(500).json({ error: "Failed to fetch agent status" });
  }
});

// POST /agent/run — SSE stream of every tool-call as it fires
agentRouter.post("/run", async (req: AuthRequest, res) => {
  const { url } = req.body as { url?: string };
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    res.status(400).json({ error: "A valid bounty URL is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: AgentStreamEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
      (res as unknown as { flush: () => void }).flush();
    }
  };

  try {
    await runBountyAgentPipeline(url, undefined, send);
  } catch (err) {
    logger.error({ err }, "SSE agent pipeline error");
    send({ type: "error", message: (err as Error).message ?? "Pipeline failed" });
  }

  res.end();
});
