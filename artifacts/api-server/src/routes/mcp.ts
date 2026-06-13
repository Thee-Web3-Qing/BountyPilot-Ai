/**
 * BountyPilot MCP Server
 *
 * Implements the Model Context Protocol (MCP) over HTTP (JSON-RPC 2.0).
 * Exposes BountyPilot's AI capabilities as standard MCP tools so any
 * MCP-compatible client (Claude Desktop, Cursor, custom agents) can
 * discover and call them.
 *
 * Endpoints:
 *   GET  /api/mcp          — server manifest / capabilities overview
 *   POST /api/mcp          — JSON-RPC 2.0 handler (initialize / tools/list / tools/call)
 */

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { bountiesTable, researchBriefsTable, productionPlansTable } from "@workspace/db";
import { desc, isNull, gte, eq } from "drizzle-orm";
import { scrapeBounty } from "../lib/scraper.js";
import { analyzeBounty } from "../lib/qwen.js";
import { runBountyAgentPipeline } from "../lib/agent.js";
import { logger } from "../lib/logger.js";

export const mcpRouter = Router();

const MCP_PROTOCOL_VERSION = "2024-11-05";

const SERVER_INFO = {
  name: "BountyPilot MCP",
  version: "1.0.0",
  description:
    "AI-powered Web3 bounty intelligence for content creators. Discovers, scores, and generates research briefs and production plans for crypto content bounties.",
};

const CAPABILITIES = {
  tools: {},
};

// ── Tool definitions (MCP inputSchema format) ─────────────────

const MCP_TOOLS = [
  {
    name: "list_bounties",
    description:
      "List current Web3 bounty opportunities indexed by BountyPilot, sorted by AI opportunity score. Returns platform, title, reward, deadline, and score.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Maximum number of bounties to return (1–20). Default: 10.",
          default: 10,
          minimum: 1,
          maximum: 20,
        },
        platform: {
          type: "string",
          description: "Filter by platform name (e.g. 'Superteam Earn', 'Layer3'). Optional.",
        },
        min_score: {
          type: "integer",
          description: "Only return bounties with an AI opportunity score at or above this value (1–10). Default: 1.",
          default: 1,
          minimum: 1,
          maximum: 10,
        },
      },
    },
  },
  {
    name: "score_bounty",
    description:
      "Use Qwen AI to evaluate a Web3 bounty URL and return a 1–10 opportunity score with a personalised explanation for a content creator. Scrapes the listing and runs the AI scoring model.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Full URL of the bounty listing to score.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "run_pipeline",
    description:
      "Run the full BountyPilot agentic pipeline on a bounty URL: Qwen agent scores the bounty, decides if it merits a research brief, generates the brief (14 sections, 20 content angles, 10 hooks), and builds a production plan (script, shot list, caption, checklist). Returns the complete creator intelligence package.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Full URL of the bounty to analyse.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "get_bounty_brief",
    description:
      "Retrieve an existing AI-generated research brief for a bounty that has already been processed by BountyPilot.",
    inputSchema: {
      type: "object",
      properties: {
        bounty_id: {
          type: "integer",
          description: "BountyPilot internal bounty ID (from list_bounties).",
        },
      },
      required: ["bounty_id"],
    },
  },
  {
    name: "get_crawler_stats",
    description:
      "Return statistics about the BountyPilot autonomous crawler: total bounties indexed, platforms covered, and score distribution.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────

async function handleListBounties(args: {
  limit?: number;
  platform?: string;
  min_score?: number;
}): Promise<unknown> {
  const limit = Math.min(args.limit ?? 10, 20);
  const minScore = args.min_score ?? 1;

  let query = db
    .select({
      id: bountiesTable.id,
      title: bountiesTable.title,
      platform: bountiesTable.platform,
      projectName: bountiesTable.projectName,
      rewardAmount: bountiesTable.rewardAmount,
      rewardCurrency: bountiesTable.rewardCurrency,
      deadline: bountiesTable.deadline,
      contentFormat: bountiesTable.contentFormat,
      opportunityScore: bountiesTable.opportunityScore,
      scoreExplanation: bountiesTable.scoreExplanation,
      url: bountiesTable.url,
    })
    .from(bountiesTable)
    .where(isNull(bountiesTable.userId))
    .orderBy(desc(bountiesTable.opportunityScore))
    .limit(limit);

  const rows = await query;

  const filtered = rows
    .filter((r) => (r.opportunityScore ?? 0) >= minScore)
    .filter((r) => !args.platform || r.platform?.toLowerCase().includes(args.platform.toLowerCase()));

  return {
    count: filtered.length,
    bounties: filtered.map((r) => ({
      id: r.id,
      title: r.title,
      platform: r.platform,
      project: r.projectName,
      reward: r.rewardAmount ? `${r.rewardAmount} ${r.rewardCurrency || "USDC"}` : "See listing",
      deadline: r.deadline || "Open",
      format: r.contentFormat,
      opportunityScore: r.opportunityScore,
      scoreExplanation: r.scoreExplanation,
      url: r.url,
    })),
  };
}

async function handleScoreBounty(args: { url: string }): Promise<unknown> {
  const scraped = await scrapeBounty(args.url);
  const analysis = await analyzeBounty(scraped);
  return {
    url: args.url,
    title: scraped.title,
    platform: scraped.platform,
    project: scraped.projectName,
    reward: scraped.rewardAmount ? `${scraped.rewardAmount} ${scraped.rewardCurrency || ""}` : "Not listed",
    deadline: scraped.deadline || "Open",
    format: scraped.contentFormat,
    opportunityScore: analysis.opportunityScore,
    scoreExplanation: analysis.scoreExplanation,
  };
}

async function handleRunPipeline(args: { url: string }): Promise<unknown> {
  const result = await runBountyAgentPipeline(args.url);
  return {
    url: args.url,
    title: result.scraped.title,
    platform: ((result.scraped as unknown) as Record<string, unknown>).platform as string | undefined,
    opportunityScore: result.opportunityScore,
    scoreExplanation: result.scoreExplanation,
    agentDecision: result.agentDecision,
    briefGenerated: result.briefGenerated,
    planGenerated: result.planGenerated,
    researchBrief: result.researchBrief
      ? {
          summary: result.researchBrief.summary,
          contentAngles: result.researchBrief.contentAngles,
          keyPoints: result.researchBrief.keyPoints,
          targetAudience: result.researchBrief.targetAudience,
          fullContent: result.researchBrief.fullContent?.slice(0, 3000),
        }
      : null,
    productionPlan: result.productionPlan || null,
    agentSteps: result.toolCallLog.map((tc) => tc.tool),
    durationMs: result.durationMs,
  };
}

async function handleGetBountyBrief(args: { bounty_id: number }): Promise<unknown> {
  const [brief] = await db
    .select()
    .from(researchBriefsTable)
    .where(eq(researchBriefsTable.bountyId, args.bounty_id))
    .limit(1);

  if (!brief) return { error: "No research brief found for this bounty ID" };

  return {
    bountyId: args.bounty_id,
    summary: brief.summary,
    contentAngles: brief.contentAngles,
    keyPoints: brief.keyPoints,
    targetAudience: brief.targetAudience,
    competitorAnalysis: brief.competitorAnalysis,
    fullContent: brief.fullContent,
    generatedAt: brief.createdAt,
  };
}

async function handleGetCrawlerStats(): Promise<unknown> {
  const all = await db
    .select({
      platform: bountiesTable.platform,
      opportunityScore: bountiesTable.opportunityScore,
    })
    .from(bountiesTable)
    .where(isNull(bountiesTable.userId));

  const platforms = [...new Set(all.map((r) => r.platform).filter(Boolean))];
  const scores = all.map((r) => r.opportunityScore ?? 0);
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "0";
  const high = scores.filter((s) => s >= 7).length;
  const medium = scores.filter((s) => s >= 5 && s < 7).length;
  const low = scores.filter((s) => s < 5).length;

  return {
    totalBounties: all.length,
    platformsIndexed: platforms.length,
    platforms,
    scoreDistribution: { high, medium, low },
    averageScore: Number(avg),
  };
}

// ── JSON-RPC dispatcher ───────────────────────────────────────

async function dispatchToolCall(name: string, args: unknown): Promise<string> {
  switch (name) {
    case "list_bounties":
      return JSON.stringify(await handleListBounties(args as Parameters<typeof handleListBounties>[0]));
    case "score_bounty":
      return JSON.stringify(await handleScoreBounty(args as { url: string }));
    case "run_pipeline":
      return JSON.stringify(await handleRunPipeline(args as { url: string }));
    case "get_bounty_brief":
      return JSON.stringify(await handleGetBountyBrief(args as { bounty_id: number }));
    case "get_crawler_stats":
      return JSON.stringify(await handleGetCrawlerStats());
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── GET — server manifest ─────────────────────────────────────

mcpRouter.get("/", (_req: Request, res: Response) => {
  res.json({
    ...SERVER_INFO,
    protocol: "Model Context Protocol (MCP)",
    transport: "HTTP JSON-RPC 2.0",
    endpoint: "POST /api/mcp",
    protocolVersion: MCP_PROTOCOL_VERSION,
    tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
    usage: {
      initialize: { method: "initialize", params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "your-client", version: "1.0" } } },
      listTools: { method: "tools/list", params: {} },
      callTool: { method: "tools/call", params: { name: "list_bounties", arguments: { limit: 5 } } },
    },
  });
});

// ── POST — JSON-RPC 2.0 handler ───────────────────────────────

mcpRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const { jsonrpc, id, method, params } = req.body ?? {};

  if (jsonrpc !== "2.0") {
    res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid JSON-RPC version" } });
    return;
  }

  try {
    let result: unknown;

    switch (method) {
      case "initialize":
        result = {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: CAPABILITIES,
          serverInfo: SERVER_INFO,
        };
        break;

      case "tools/list":
        result = { tools: MCP_TOOLS };
        break;

      case "tools/call": {
        const { name, arguments: args } = (params ?? {}) as { name: string; arguments: unknown };
        if (!name) {
          res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } });
          return;
        }

        logger.info({ tool: name }, "MCP tool call");
        const text = await dispatchToolCall(name, args ?? {});
        result = { content: [{ type: "text", text }] };
        break;
      }

      case "notifications/initialized":
        res.status(200).json({ jsonrpc: "2.0", id });
        return;

      default:
        res.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
        return;
    }

    res.json({ jsonrpc: "2.0", id, result });
  } catch (err) {
    logger.error({ err, method }, "MCP handler error");
    res.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: (err as Error).message || "Internal error" },
    });
  }
});
