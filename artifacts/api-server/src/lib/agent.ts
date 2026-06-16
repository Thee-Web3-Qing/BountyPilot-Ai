/**
 * BountyPilot Agentic Pipeline
 *
 * Multi-step Qwen tool-calling loop that orchestrates the full creator
 * intelligence workflow: score → decide → research brief → production plan → application draft.
 *
 * Qwen acts as the orchestrator — it decides whether a bounty is worth
 * a full research brief based on its own score evaluation, then generates
 * all downstream assets. The decision logic is Qwen's, not hardcoded.
 */

import { runQwenAgentLoop, analyzeBounty, generateResearchBrief, generateProductionPlan, generateApplicationDraft, hasKey } from "./qwen.js";
import { scrapeBounty, type ScrapedBounty } from "./scraper.js";
import { logger } from "./logger.js";
import type { QwenMessage } from "./qwen.js";

// ── URL validation ─────────────────────────────────────────────

function validateBountyUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, reason: `"${raw.slice(0, 60)}" is not a valid URL. Paste a full bounty listing link (https://…).` };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: "URL must start with https://. Paste the full bounty listing link." };
  }
  if (!u.hostname.includes(".")) {
    return { ok: false, reason: "URL hostname looks invalid. Paste the full bounty listing link." };
  }
  const blocklist = ["twitter.com", "x.com", "instagram.com", "facebook.com", "tiktok.com", "youtube.com"];
  if (blocklist.some((b) => u.hostname.includes(b))) {
    return { ok: false, reason: `${u.hostname} is a social platform, not a bounty board. Paste the listing URL directly (e.g. from Superteam Earn, Devpost, or Dework).` };
  }
  return { ok: true, url: u.href };
}

// ── Post-scrape bounty page detection ─────────────────────────

function looksLikeBountyPage(scraped: ScrapedBounty): { ok: true } | { ok: false; reason: string } {
  const title = (scraped.title ?? "").toLowerCase();
  const desc  = (scraped.description ?? "").toLowerCase();

  // Reject obviously generic / error pages
  const genericTitles = ["home", "404", "not found", "page not found", "error", "access denied", "forbidden", "just a moment", "attention required", "cloudflare"];
  if (genericTitles.some((g) => title.includes(g)) || title.length < 5) {
    return { ok: false, reason: `That page doesn't look like a bounty listing (title: "${scraped.title?.slice(0, 60)}"). Paste a direct listing URL.` };
  }

  // Description must be substantive
  if (desc.length < 80) {
    return { ok: false, reason: "That page has too little content to analyse. Make sure you're linking to the individual bounty listing, not a homepage or profile." };
  }

  // At least one bounty signal: reward, deadline, or relevant keyword
  const bountyKeywords = ["reward", "prize", "bounty", "earn", "submit", "deadline", "winner", "apply", "grant", "hackathon", "challenge", "task", "deliverable", "bounties", "usdc", "sol", "eth", "$"];
  const hasSignal = scraped.rewardAmount != null || scraped.deadline != null || bountyKeywords.some((k) => desc.includes(k) || title.includes(k));
  if (!hasSignal) {
    return { ok: false, reason: "This page doesn't appear to be a bounty or challenge listing. Paste the direct listing URL from Superteam Earn, Devpost, Dework, or similar." };
  }

  return { ok: true };
}

// ── Stream event types ────────────────────────────────────────

export type AgentStreamEvent =
  | { type: "scraping"; url: string }
  | { type: "scraped"; title: string; platform: string }
  | { type: "no_key" }
  | { type: "tool_call"; step: number; tool: string; label: string }
  | { type: "tool_result"; step: number; tool: string; durationMs: number; preview: string; score?: number }
  | { type: "confirm"; score: number; message: string }
  | { type: "done"; opportunityScore: number; scoreExplanation: string; briefGenerated: boolean; planGenerated: boolean; draftGenerated: boolean; applicationDraft?: string; agentDecision: string; durationMs: number; title: string; platform: string }
  | { type: "error"; message: string }

// ── Result types ──────────────────────────────────────────────

export interface AgentPipelineResult {
  scraped: ScrapedBounty;
  opportunityScore: number;
  scoreExplanation: string;
  briefGenerated: boolean;
  planGenerated: boolean;
  draftGenerated: boolean;
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
  applicationDraft?: string;
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
      name: "draft_application",
      description: "Write a ready-to-submit application cover letter personalised to the creator's profile. Call this after the production plan.",
      parameters: {
        type: "object",
        properties: {
          tone_notes: {
            type: "string",
            description: "Any specific tone or angle notes for the application",
          },
        },
        required: ["tone_notes"],
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
  profile?: Record<string, unknown>,
  emit?: (event: AgentStreamEvent) => void
): Promise<AgentPipelineResult> {
  const start = Date.now();

  // 0. Validate URL if a string was provided
  if (typeof urlOrScraped === "string") {
    const validation = validateBountyUrl(urlOrScraped);
    if (!validation.ok) {
      emit?.({ type: "error", message: validation.reason });
      throw new Error(validation.reason);
    }
    urlOrScraped = validation.url;
  }

  // 1. Scrape bounty if URL provided
  let scraped: ScrapedBounty;
  if (typeof urlOrScraped === "string") {
    emit?.({ type: "scraping", url: urlOrScraped });
    scraped = await scrapeBounty(urlOrScraped);
  } else {
    scraped = urlOrScraped;
  }
  emit?.({ type: "scraped", title: scraped.title ?? "Untitled", platform: scraped.platform ?? "Unknown" });

  // 1b. Verify the scraped page actually looks like a bounty listing
  const pageCheck = looksLikeBountyPage(scraped);
  if (!pageCheck.ok) {
    emit?.({ type: "error", message: pageCheck.reason });
    throw new Error(pageCheck.reason);
  }

  // Collect results as the agent calls tools
  let opportunityScore = 5;
  let scoreExplanation = "";
  let briefGenerated = false;
  let planGenerated = false;
  let draftGenerated = false;
  let researchBrief: AgentPipelineResult["researchBrief"];
  let productionPlan: AgentPipelineResult["productionPlan"];
  let applicationDraft: string | undefined;
  let agentDecision = "";
  let stepCount = 0;

  // 2. If no API key, fall back to direct sequential calls
  if (!hasKey()) {
    emit?.({ type: "no_key" });

    emit?.({ type: "tool_call", step: ++stepCount, tool: "score_bounty", label: "Scoring Opportunity (rule-based)" });
    const t1 = Date.now();
    const analysis = await analyzeBounty(scraped);
    opportunityScore = analysis.opportunityScore;
    scoreExplanation = analysis.scoreExplanation;
    emit?.({ type: "tool_result", step: stepCount, tool: "score_bounty", durationMs: Date.now() - t1, preview: `Score: ${opportunityScore}/10 — ${scoreExplanation.slice(0, 100)}`, score: opportunityScore });

    if (opportunityScore >= 5) {
      emit?.({ type: "tool_call", step: ++stepCount, tool: "generate_research_brief", label: "Generating Research Brief" });
      const t2 = Date.now();
      const brief = await generateResearchBrief(scraped);
      researchBrief = brief;
      briefGenerated = true;
      emit?.({ type: "tool_result", step: stepCount, tool: "generate_research_brief", durationMs: Date.now() - t2, preview: brief.summary?.slice(0, 100) ?? "Brief generated" });

      emit?.({ type: "tool_call", step: ++stepCount, tool: "generate_production_plan", label: "Building Production Plan" });
      const t3 = Date.now();
      const plan = await generateProductionPlan(scraped);
      productionPlan = plan;
      planGenerated = true;
      emit?.({ type: "tool_result", step: stepCount, tool: "generate_production_plan", durationMs: Date.now() - t3, preview: `~${plan.estimatedHours}h estimated · ${scraped.contentFormat} format` });

      emit?.({ type: "tool_call", step: ++stepCount, tool: "draft_application", label: "Drafting Application" });
      const t4 = Date.now();
      const draft = await generateApplicationDraft(scraped, profile as Parameters<typeof generateApplicationDraft>[1]);
      applicationDraft = draft.fullDraft;
      draftGenerated = true;
      emit?.({ type: "tool_result", step: stepCount, tool: "draft_application", durationMs: Date.now() - t4, preview: draft.opening?.slice(0, 120) ?? "Application draft ready" });
    }

    const result: AgentPipelineResult = {
      scraped, opportunityScore, scoreExplanation, briefGenerated, planGenerated, draftGenerated,
      researchBrief, productionPlan, applicationDraft,
      agentDecision: opportunityScore >= 5 ? "Pursued — score meets threshold" : "Skipped brief — low score",
      toolCallLog: [], durationMs: Date.now() - start,
    };
    emit?.({ type: "done", opportunityScore, scoreExplanation, briefGenerated, planGenerated, draftGenerated, applicationDraft, agentDecision: result.agentDecision, durationMs: result.durationMs, title: scraped.title ?? "Untitled", platform: scraped.platform ?? "Unknown" });
    return result;
  }

  // 3. Run the Qwen agent loop
  const systemPrompt: QwenMessage = {
    role: "system",
    content: `You are the BountyPilot AI agent. Your job is to evaluate a Web3 bounty opportunity and build a complete creator intelligence package.

Follow this sequence using the available tools:
1. Call score_bounty to evaluate the opportunity
2. If the bounty looks worthwhile (score 5+), call generate_research_brief
3. After the research brief, call generate_production_plan
4. After the production plan, call draft_application to write a ready-to-submit cover letter
5. Always finish by calling finalize_pipeline with your recommendation

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

  const TOOL_LABELS: Record<string, string> = {
    score_bounty: "Scoring Opportunity",
    generate_research_brief: "Generating Research Brief",
    generate_production_plan: "Building Production Plan",
    draft_application: "Drafting Application",
    finalize_pipeline: "Finalizing Recommendation",
  };

  const toolExecutor = async (name: string, args: unknown): Promise<unknown> => {
    logger.info({ tool: name, args }, "Agent executing tool");
    const t = Date.now();
    emit?.({ type: "tool_call", step: ++stepCount, tool: name, label: TOOL_LABELS[name] ?? name });

    switch (name) {
      case "score_bounty": {
        const analysis = await analyzeBounty(scraped);
        opportunityScore = analysis.opportunityScore;
        scoreExplanation = analysis.scoreExplanation;
        emit?.({ type: "tool_result", step: stepCount, tool: name, durationMs: Date.now() - t, preview: `Score: ${opportunityScore}/10 — ${scoreExplanation.slice(0, 100)}`, score: opportunityScore });
        return { opportunityScore, scoreExplanation, decision: opportunityScore >= 5 ? "proceed_to_brief" : "skip_brief" };
      }

      case "generate_research_brief": {
        const brief = await generateResearchBrief(scraped);
        researchBrief = brief;
        briefGenerated = true;
        emit?.({ type: "tool_result", step: stepCount, tool: name, durationMs: Date.now() - t, preview: brief.summary?.slice(0, 120) ?? "Research brief generated" });
        return { generated: true, summary: brief.summary?.slice(0, 200), sectionsCompleted: 14 };
      }

      case "generate_production_plan": {
        const plan = await generateProductionPlan(scraped);
        productionPlan = plan;
        planGenerated = true;
        emit?.({ type: "tool_result", step: stepCount, tool: name, durationMs: Date.now() - t, preview: `~${plan.estimatedHours}h estimated · ${scraped.contentFormat ?? "content"} format` });
        return { generated: true, estimatedHours: plan.estimatedHours, format: scraped.contentFormat };
      }

      case "draft_application": {
        const draft = await generateApplicationDraft(scraped, profile as Parameters<typeof generateApplicationDraft>[1]);
        applicationDraft = draft.fullDraft;
        draftGenerated = true;
        emit?.({ type: "tool_result", step: stepCount, tool: name, durationMs: Date.now() - t, preview: draft.opening?.slice(0, 120) ?? "Application draft ready" });
        return { generated: true, opening: draft.opening };
      }

      case "finalize_pipeline": {
        agentDecision = (args as { recommendation: string }).recommendation || "Pipeline complete";
        emit?.({ type: "tool_result", step: stepCount, tool: name, durationMs: Date.now() - t, preview: agentDecision.slice(0, 120) });
        return { status: "complete", briefGenerated, planGenerated, draftGenerated };
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
      { maxTokens: 500, timeout: 90000, maxIterations: 10 }
    );

    if (!agentDecision && loopResult.finalContent) {
      agentDecision = loopResult.finalContent.slice(0, 300);
    }

    logger.info(
      { score: opportunityScore, briefGenerated, planGenerated, draftGenerated, tools: loopResult.toolCallLog.length },
      "BountyPilot agent pipeline complete"
    );

    const durationMs = Date.now() - start;
    emit?.({ type: "done", opportunityScore, scoreExplanation, briefGenerated, planGenerated, draftGenerated, applicationDraft, agentDecision, durationMs, title: scraped.title ?? "Untitled", platform: scraped.platform ?? "Unknown" });

    return {
      scraped, opportunityScore, scoreExplanation, briefGenerated, planGenerated, draftGenerated,
      researchBrief, productionPlan, applicationDraft, agentDecision,
      toolCallLog: loopResult.toolCallLog,
      durationMs,
    };
  } catch (err) {
    logger.error({ err }, "Agent pipeline error — falling back to direct calls");

    const analysis = await analyzeBounty(scraped);
    return {
      scraped,
      opportunityScore: analysis.opportunityScore,
      scoreExplanation: analysis.scoreExplanation,
      briefGenerated: false,
      planGenerated: false,
      draftGenerated: false,
      agentDecision: "Fallback mode — agent loop encountered an error",
      toolCallLog: [],
      durationMs: Date.now() - start,
    };
  }
}
