/**
 * BountyPilot Agentic Pipeline
 *
 * Multi-step Qwen tool-calling loop that orchestrates the full creator
 * intelligence workflow: score → decide → research brief → production plan.
 *
 * Qwen acts as the orchestrator — it decides whether a bounty is worth
 * a full research brief based on its own score evaluation, then generates
 * all downstream assets. The decision logic is Qwen's, not hardcoded.
 */

import { runQwenAgentLoop, analyzeBounty, generateResearchBrief, generateProductionPlan, hasKey } from "./qwen.js";
import { scrapeBounty, type ScrapedBounty } from "./scraper.js";
import { logger } from "./logger.js";
import type { QwenMessage } from "./qwen.js";

// ── Result types ──────────────────────────────────────────────

export interface AgentPipelineResult {
  scraped: ScrapedBounty;
  opportunityScore: number;
  scoreExplanation: string;
  briefGenerated: boolean;
  planGenerated: boolean;
  researchBrief?: {
    summary: string;
    contentAngles: string;
    keyPoints: string;
    targetAudience: string;
    competitorAnalysis: string;
    fullContent?: string;
  };
  productionPlan?: {
    scriptOutline: string;
    shotList: string;
    captionDraft: string;
    submissionChecklist: string;
    estimatedHours: number;
  };
  agentDecision: string;
  toolCallLog: Array<{ tool: string; args: unknown; result: unknown }>;
  durationMs: number;
}

// ── Agent tools schema ────────────────────────────────────────

const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "score_bounty",
      description: "Score the bounty opportunity on a 1-10 scale based on reward, deadline, and creator fit. Always call this first.",
      parameters: {
        type: "object",
        properties: {
          reasoning: {
            type: "string",
            description: "Brief reasoning for the score based on reward size, deadline, format, and opportunity quality",
          },
        },
        required: ["reasoning"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_research_brief",
      description: "Generate a comprehensive research brief for this bounty. Call this if the opportunity score is 5 or higher.",
      parameters: {
        type: "object",
        properties: {
          justification: {
            type: "string",
            description: "Why this bounty merits a full research brief",
          },
        },
        required: ["justification"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_production_plan",
      description: "Generate a production plan (script outline, shot list, caption, checklist, hours). Call this after the research brief.",
      parameters: {
        type: "object",
        properties: {
          format_notes: {
            type: "string",
            description: "Any specific notes about the content format that should inform the production plan",
          },
        },
        required: ["format_notes"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "finalize_pipeline",
      description: "Mark the pipeline as complete and provide a final creator recommendation.",
      parameters: {
        type: "object",
        properties: {
          recommendation: {
            type: "string",
            description: "Final actionable recommendation for the creator: whether to pursue, priority level, and key tips",
          },
        },
        required: ["recommendation"],
      },
    },
  },
];

// ── Main agent entry point ────────────────────────────────────

export async function runBountyAgentPipeline(
  urlOrScraped: string | ScrapedBounty,
  profile?: Record<string, unknown>
): Promise<AgentPipelineResult> {
  const start = Date.now();

  // 1. Scrape bounty if URL provided
  let scraped: ScrapedBounty;
  if (typeof urlOrScraped === "string") {
    scraped = await scrapeBounty(urlOrScraped);
  } else {
    scraped = urlOrScraped;
  }

  // Collect results as the agent calls tools
  let opportunityScore = 5;
  let scoreExplanation = "";
  let briefGenerated = false;
  let planGenerated = false;
  let researchBrief: AgentPipelineResult["researchBrief"];
  let productionPlan: AgentPipelineResult["productionPlan"];
  let agentDecision = "";

  // 2. If no API key, fall back to direct sequential calls
  if (!hasKey()) {
    const analysis = await analyzeBounty(scraped);
    opportunityScore = analysis.opportunityScore;
    scoreExplanation = analysis.scoreExplanation;

    if (opportunityScore >= 5) {
      const brief = await generateResearchBrief(scraped);
      researchBrief = brief;
      briefGenerated = true;

      const plan = await generateProductionPlan(scraped);
      productionPlan = plan;
      planGenerated = true;
    }

    return {
      scraped,
      opportunityScore,
      scoreExplanation,
      briefGenerated,
      planGenerated,
      researchBrief,
      productionPlan,
      agentDecision: opportunityScore >= 5 ? "Pursued — score meets threshold" : "Skipped brief — low score",
      toolCallLog: [],
      durationMs: Date.now() - start,
    };
  }

  // 3. Run the Qwen agent loop
  const systemPrompt: QwenMessage = {
    role: "system",
    content: `You are the BountyPilot AI agent. Your job is to evaluate a Web3 bounty opportunity and build a complete creator intelligence package.

Follow this sequence using the available tools:
1. Call score_bounty to evaluate the opportunity
2. If the bounty looks worthwhile (score 5+), call generate_research_brief
3. After the research brief, call generate_production_plan  
4. Always finish by calling finalize_pipeline with your recommendation

Make each tool call decision based on the bounty data. You are the orchestrator — use your judgment.`,
  };

  const userPrompt: QwenMessage = {
    role: "user",
    content: `Analyze this bounty and build a full creator intelligence package:

Platform: ${scraped.platform}
Project: ${scraped.projectName || scraped.title}
Title: ${scraped.title}
Reward: ${scraped.rewardAmount || "not listed"} ${scraped.rewardCurrency || ""}
Deadline: ${scraped.deadline || "open"}
Content Format: ${scraped.contentFormat}
Description: ${scraped.description?.slice(0, 400) || ""}
Requirements: ${scraped.submissionRequirements?.slice(0, 300) || ""}
Deliverables: ${scraped.deliverables || ""}
${profile ? `\nCreator profile:\n${JSON.stringify(profile, null, 2)}` : ""}

Work through the pipeline step by step using the available tools.`,
  };

  // Tool executor: maps agent tool calls to real functions
  const toolExecutor = async (name: string, args: unknown): Promise<unknown> => {
    logger.info({ tool: name, args }, "Agent executing tool");

    switch (name) {
      case "score_bounty": {
        const analysis = await analyzeBounty(scraped);
        opportunityScore = analysis.opportunityScore;
        scoreExplanation = analysis.scoreExplanation;
        return {
          opportunityScore,
          scoreExplanation,
          decision: opportunityScore >= 5 ? "proceed_to_brief" : "skip_brief",
        };
      }

      case "generate_research_brief": {
        const brief = await generateResearchBrief(scraped);
        researchBrief = brief;
        briefGenerated = true;
        return {
          generated: true,
          summary: brief.summary?.slice(0, 200),
          sectionsCompleted: 14,
        };
      }

      case "generate_production_plan": {
        const plan = await generateProductionPlan(scraped);
        productionPlan = plan;
        planGenerated = true;
        return {
          generated: true,
          estimatedHours: plan.estimatedHours,
          format: scraped.contentFormat,
        };
      }

      case "finalize_pipeline": {
        agentDecision = (args as { recommendation: string }).recommendation || "Pipeline complete";
        return { status: "complete", briefGenerated, planGenerated };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  };

  try {
    const loopResult = await runQwenAgentLoop(
      [systemPrompt, userPrompt],
      AGENT_TOOLS,
      toolExecutor,
      { maxTokens: 500, timeout: 60000, maxIterations: 8 }
    );

    if (!agentDecision && loopResult.finalContent) {
      agentDecision = loopResult.finalContent.slice(0, 300);
    }

    logger.info(
      { score: opportunityScore, briefGenerated, planGenerated, tools: loopResult.toolCallLog.length },
      "BountyPilot agent pipeline complete"
    );

    return {
      scraped,
      opportunityScore,
      scoreExplanation,
      briefGenerated,
      planGenerated,
      researchBrief,
      productionPlan,
      agentDecision,
      toolCallLog: loopResult.toolCallLog,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    logger.error({ err }, "Agent pipeline error — falling back to direct calls");

    // Hard fallback if the agent loop fails
    const analysis = await analyzeBounty(scraped);
    return {
      scraped,
      opportunityScore: analysis.opportunityScore,
      scoreExplanation: analysis.scoreExplanation,
      briefGenerated: false,
      planGenerated: false,
      agentDecision: "Fallback mode — agent loop encountered an error",
      toolCallLog: [],
      durationMs: Date.now() - start,
    };
  }
}
