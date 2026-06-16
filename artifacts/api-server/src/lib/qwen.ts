import type { ScrapedBounty } from "./scraper.js";

const QWEN_BASE_URL = process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const QWEN_API_URL = `${QWEN_BASE_URL.replace(/\/+$/, "")}/chat/completions`;

const BRIEF_MODEL = process.env.QWEN_BRIEF_MODEL || "qwen-turbo";
const FAST_MODEL = process.env.QWEN_MODEL || "qwen-turbo";

export function hasKey(): boolean {
  return !!(process.env.QWEN_API_KEY && process.env.QWEN_API_KEY.trim().length > 0);
}

// ── Types ─────────────────────────────────────────────────────

interface QwenTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface QwenToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface QwenMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: QwenToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ScoreCriterion {
  label: string;
  score: number; // 1-10
  note: string;
}

export interface BountyAnalysis {
  scoreExplanation: string;
  opportunityScore: number;
  scoreBreakdown?: ScoreCriterion[];
}

export interface ResearchBriefContent {
  summary: string;
  contentAngles: string;
  keyPoints: string;
  targetAudience: string;
  competitorAnalysis: string;
  fullContent?: string;
}

export interface ProductionPlanContent {
  scriptOutline: string;
  shotList: string;
  captionDraft: string;
  submissionChecklist: string;
  estimatedHours: number;
}

// ── Core: plain text completion ────────────────────────────────

export async function callQwen(
  systemPrompt: string,
  userPrompt: string,
  { model = FAST_MODEL, maxTokens = 400, timeout = 30000 }: { model?: string; maxTokens?: number; timeout?: number } = {}
): Promise<string> {
  const resp = await fetch(QWEN_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.QWEN_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!resp.ok) throw new Error(`Qwen API error ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as { choices: { message: { content: string } }[]; code?: string; message?: string };
  if (data.code) throw new Error(`Qwen API error [${data.code}]: ${data.message ?? "Unknown error"}`);
  return data.choices[0]?.message?.content || "";
}

// ── Core: native function/tool calling ────────────────────────
// Uses the OpenAI-compatible tools parameter — no regex JSON parsing.

export async function callQwenWithTool<T>(
  messages: QwenMessage[],
  tool: QwenTool,
  { model = FAST_MODEL, maxTokens = 500, timeout = 30000 }: { model?: string; maxTokens?: number; timeout?: number } = {}
): Promise<T | null> {
  const resp = await fetch(QWEN_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.QWEN_API_KEY}` },
    body: JSON.stringify({
      model,
      messages,
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!resp.ok) throw new Error(`Qwen tool-call error ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as {
    choices: Array<{ message: { tool_calls?: QwenToolCall[]; content?: string } }>;
    code?: string; message?: string;
  };
  if (data.code) throw new Error(`Qwen API error [${data.code}]: ${data.message ?? "Unknown error"}`);
  const toolCall = data.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall) return null;
  return JSON.parse(toolCall.function.arguments) as T;
}

// ── Core: multi-turn agent loop ────────────────────────────────
// Runs a Qwen tool-calling loop until the model stops calling tools or max iterations.

export interface AgentLoopResult {
  messages: QwenMessage[];
  toolCallLog: Array<{ tool: string; args: unknown; result: unknown }>;
  finalContent: string | null;
}

export async function runQwenAgentLoop(
  initialMessages: QwenMessage[],
  tools: QwenTool[],
  toolExecutor: (name: string, args: unknown) => Promise<unknown>,
  { model = FAST_MODEL, maxTokens = 600, timeout = 45000, maxIterations = 6 }: {
    model?: string; maxTokens?: number; timeout?: number; maxIterations?: number
  } = {}
): Promise<AgentLoopResult> {
  const messages: QwenMessage[] = [...initialMessages];
  const toolCallLog: AgentLoopResult["toolCallLog"] = [];

  for (let i = 0; i < maxIterations; i++) {
    const resp = await fetch(QWEN_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.QWEN_API_KEY}` },
      body: JSON.stringify({ model, messages, tools, max_tokens: maxTokens, temperature: 0.4 }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!resp.ok) throw new Error(`Qwen agent loop error ${resp.status}: ${await resp.text()}`);

    const data = (await resp.json()) as {
      choices: Array<{ message: { role: string; content: string | null; tool_calls?: QwenToolCall[] }; finish_reason: string }>;
      code?: string; message?: string;
    };
    if (data.code) throw new Error(`Qwen API error [${data.code}]: ${data.message ?? "Unknown error"}`);
    const choice = data.choices[0];
    const msg = choice.message;

    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { messages, toolCallLog, finalContent: msg.content };
    }

    for (const tc of msg.tool_calls) {
      const args = JSON.parse(tc.function.arguments);
      const result = await toolExecutor(tc.function.name, args);
      toolCallLog.push({ tool: tc.function.name, args, result });
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: typeof result === "string" ? result : JSON.stringify(result),
      });
    }
  }

  return { messages, toolCallLog, finalContent: null };
}

// ── Rule-based scoring (fallback) ─────────────────────────────

function ruleBasedScore(rewardAmount: string | null, deadline: string | null): number {
  let score = 5;
  if (rewardAmount) {
    const num = parseFloat(rewardAmount.replace(/[^0-9.]/g, ""));
    if (num >= 5000) score += 2;
    else if (num >= 1500) score += 1.5;
    else if (num >= 500) score += 0.5;
    else if (num < 100) score -= 1;
  }
  if (deadline) {
    const daysLeft = (new Date(deadline).getTime() - Date.now()) / 86400000;
    if (daysLeft < 0) score -= 3;
    else if (daysLeft < 3) score -= 1;
    else if (daysLeft > 14) score += 1;
    else if (daysLeft > 7) score += 0.5;
  }
  return Math.max(1, Math.min(10, Math.round(score)));
}

function templateExplanation(score: number, scraped: ScrapedBounty): string {
  const hasReward = scraped.rewardAmount && Number(scraped.rewardAmount) > 0;
  const rewardPart = hasReward
    ? `${scraped.rewardAmount} ${scraped.rewardCurrency || "USDC"} reward`
    : "reward listed on platform";
  const deadlineNote = scraped.deadline
    ? (() => {
        const d = Math.round((new Date(scraped.deadline).getTime() - Date.now()) / 86400000);
        return d < 0 ? "deadline passed" : d === 0 ? "deadline today" : `${d} days to deadline`;
      })()
    : "open deadline";
  const verdict =
    score >= 7 ? "Strong pick — solid reward and clear deliverables."
    : score >= 5 ? "Worth pursuing if the format fits your strengths."
    : "Lower priority — limited reward or tight timeline.";
  return `Score ${score}/10: ${rewardPart}. ${deadlineNote}. Format: ${scraped.contentFormat || "open"}. ${verdict}`;
}

function getSubject(scraped: ScrapedBounty): string {
  return scraped.projectName && scraped.projectName !== scraped.platform
    ? scraped.projectName
    : scraped.title;
}

// ── Template fallbacks ────────────────────────────────────────

function templateResearchBrief(scraped: ScrapedBounty): ResearchBriefContent {
  const subject = getSubject(scraped);
  return {
    summary: scraped.description || `This bounty (hosted on ${scraped.platform}) asks creators to produce ${scraped.contentFormat} content about ${subject}. Focus on clear, accurate, and engaging delivery.`,
    contentAngles: `1. Beginner explainer — break down complex concepts for a non-technical audience\n2. Comparison angle — how does ${subject} differ from competitors?\n3. Use-case story — real people, real outcomes\n4. "Why it matters" narrative — connect to broader Web3 trends`,
    keyPoints: `- Understand ${subject}'s core value proposition\n- Research recent news and product updates\n- Identify common misconceptions to address\n- Gather supporting data points and statistics`,
    targetAudience: `Crypto-curious users, developers considering ${subject}, and general Web3 content consumers.`,
    competitorAnalysis: `Search Twitter, YouTube, and Mirror for existing coverage of ${subject}. Differentiate by going deeper, using demos, or targeting a specific sub-audience.`,
  };
}

function templateProductionPlan(scraped: ScrapedBounty): ProductionPlanContent {
  const subject = getSubject(scraped);
  const hasVideo = scraped.contentFormat.toLowerCase().includes("video");
  const hasThread = scraped.contentFormat.toLowerCase().includes("thread") || scraped.contentFormat.toLowerCase().includes("twitter");
  const hasArticle = scraped.contentFormat.toLowerCase().includes("article") || scraped.contentFormat.toLowerCase().includes("blog");

  const scriptOutline = hasVideo
    ? `HOOK (0-30s): Open with a surprising stat or bold claim about ${subject}\nSECTION 1 (30-90s): What is it and why does it exist?\nSECTION 2 (90-180s): How does it work — live demo if possible\nSECTION 3 (180-240s): Why should the viewer care?\nOUTRO (240-300s): CTA — link in bio, subscribe, submit before ${scraped.deadline || "deadline"}`
    : `HOOK: Lead with a surprising angle about ${subject}\nSECTION 1: Context and background\nSECTION 2: Core mechanics or value proposition\nSECTION 3: Real implications and use cases\nCLOSING: Call to action`;

  const shotList = hasVideo
    ? `1. Talking head intro — clean background, good lighting\n2. Screen recording — product/protocol walkthrough\n3. Graphic overlay — key stats and comparisons\n4. B-roll — community, ecosystem, relevant visuals\n5. Outro card — social links + submission URL`
    : hasThread
    ? `Tweet 1: Hook with bold statement\nTweets 2-5: Core explanation broken into digestible chunks\nTweets 6-8: Supporting evidence and examples\nTweet 9: Implications / what this means for you\nTweet 10: CTA + link to submission`
    : `Section 1: Intro + hook (200 words)\nSection 2: Background context (300 words)\nSection 3: Deep dive (400 words)\nSection 4: Practical takeaways (200 words)\nConclusion + CTA (100 words)`;

  const captionDraft = `Breaking down ${subject} for you — here's everything creators and builders need to know. ${hasThread ? "Thread 🧵" : hasVideo ? "Full video 👆" : "Full article linked."} #Web3 #${(scraped.platform || "").replace(/\s/g, "")} #Crypto`;

  const checklist = [
    `[ ] Content published publicly (not draft/private)`,
    scraped.contentFormat.toLowerCase().includes("video") ? `[ ] Video is minimum required length` : null,
    `[ ] All required deliverables included: ${scraped.deliverables}`,
    scraped.deadline ? `[ ] Submitted before deadline: ${scraped.deadline}` : `[ ] Submitted before the listed deadline`,
    `[ ] Submission form/link completed: ${scraped.submissionLink}`,
    `[ ] All original work — no AI-generated filler text`,
  ]
    .filter(Boolean)
    .join("\n");

  const hours = hasVideo ? 10 : hasArticle && hasThread ? 6 : hasThread ? 3 : 5;

  return { scriptOutline, shotList, captionDraft, submissionChecklist: checklist, estimatedHours: hours };
}

// ── Public API ─────────────────────────────────────────────────

export interface UserProfile {
  contentFormats?: string | null;
  mainPlatforms?: string | null;
  niche?: string | null;
  skillLevel?: string | null;
  preferredBountyTypes?: string | null;
  minimumReward?: number | null;
  creatorStrengths?: string | null;
}

// Score a bounty using native Qwen function calling (no regex fallback).
export async function analyzeBounty(scraped: ScrapedBounty, profile?: UserProfile): Promise<BountyAnalysis> {
  const baseScore = ruleBasedScore(scraped.rewardAmount, scraped.deadline);

  if (!hasKey()) {
    return { opportunityScore: baseScore, scoreExplanation: templateExplanation(baseScore, scraped) };
  }

  const profileContext = profile ? `
Creator profile (personalise the score for THIS creator):
- Platforms: ${profile.mainPlatforms || "not specified"}
- Content formats: ${profile.contentFormats || "not specified"}
- Niche: ${profile.niche || "not specified"}
- Skill level: ${profile.skillLevel || "not specified"}
- Preferred bounty types: ${profile.preferredBountyTypes || "not specified"}
- Minimum reward: $${profile.minimumReward || 0}
- Strengths: ${profile.creatorStrengths || "not specified"}` : "";

  const scoringTool: QwenTool = {
    type: "function",
    function: {
      name: "submit_bounty_score",
      description: "Submit the evaluated opportunity score, breakdown, and personalised explanation for this bounty",
      parameters: {
        type: "object",
        properties: {
          opportunityScore: {
            type: "integer",
            description: "Score from 1 (very poor) to 10 (excellent) reflecting creator opportunity",
            minimum: 1,
            maximum: 10,
          },
          scoreExplanation: {
            type: "string",
            description: "2–3 sentence explanation personalised to this creator: reward, timeline, format fit, key reasons",
          },
          scoreBreakdown: {
            type: "array",
            description: "Breakdown of the 5 scoring criteria, each rated 1-10 with a short note",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "Criterion name: Reward, Deadline, Requirements, Format Fit, or Creator Fit" },
                score: { type: "integer", minimum: 1, maximum: 10, description: "Individual score for this criterion" },
                note: { type: "string", description: "One-sentence note explaining this score" },
              },
              required: ["label", "score", "note"],
            },
          },
        },
        required: ["opportunityScore", "scoreExplanation", "scoreBreakdown"],
      },
    },
  };

  try {
    const result = await callQwenWithTool<BountyAnalysis>(
      [
        {
          role: "system",
          content: `You are BountyPilot, an AI assistant helping Web3 content creators evaluate bounty opportunities.
Score from 1-10 based on: reward size, deadline feasibility, requirement clarity, format match, and creator fit.

You MUST return scoreBreakdown as an array of exactly 5 criteria:
1. Reward — how generous the reward is relative to the work required
2. Deadline — how feasible the timeline is
3. Requirements — how clear and reasonable the requirements are
4. Format Fit — how well the content format matches typical creator workflows
5. Creator Fit — how well this bounty matches the specific creator's profile

Call submit_bounty_score with your evaluation.`,
        },
        {
          role: "user",
          content: `Evaluate this bounty:
- Platform: ${scraped.platform}
- Project: ${scraped.projectName}
- Title: ${scraped.title}
- Reward: ${scraped.rewardAmount || "unknown"} ${scraped.rewardCurrency || ""}
- Deadline: ${scraped.deadline || "not specified"}
- Format: ${scraped.contentFormat}
- Requirements: ${scraped.submissionRequirements?.slice(0, 300)}
- Description: ${scraped.description?.slice(0, 400)}
${profileContext}`,
        },
      ],
      scoringTool,
      { maxTokens: 350 }
    );

    if (result) {
      return {
        opportunityScore: Math.max(1, Math.min(10, parseInt(String(result.opportunityScore)) || baseScore)),
        scoreExplanation: result.scoreExplanation || templateExplanation(baseScore, scraped),
        scoreBreakdown: result.scoreBreakdown,
      };
    }
  } catch {
    // Fall through to template
  }

  return { opportunityScore: baseScore, scoreExplanation: templateExplanation(baseScore, scraped) };
}

// Generate research brief (markdown — uses plain callQwen, not tool calling).
export async function generateResearchBrief(scraped: ScrapedBounty): Promise<ResearchBriefContent> {
  if (!hasKey()) return templateResearchBrief(scraped);

  try {
    const subject = getSubject(scraped);
    const fullContent = await callQwen(
      `You are a senior Web3 researcher and content strategist. Write comprehensive, specific creator briefs. Use clear markdown headings. Be concise but complete — every section should be actionable.`,
      `Write a content creator research brief about: **${subject}**

CRITICAL RULES — you MUST follow these:
1. The topic is "${subject}" — this is the PRODUCT/PROJECT/PROTOCOL that content should be about.
2. "${scraped.platform}" is ONLY the bounty platform (like a job board). NEVER write about ${scraped.platform} itself.
3. If the description only says "${subject} is the global trading engine for every asset, fully on-chain on Solana" — you MUST still expand deeply on ${subject}, not the platform.
4. Do NOT mention "Superteam", "Earn", "Bounty Platform", "Listing Site" or any platform name in the brief.
5. Write every section as if the reader wants to know about ${subject} the product, nothing else.

Bounty context:
- Product to research: ${subject}
- Bounty hosted on: ${scraped.platform} (IGNORE THIS — write about ${subject} only)
- Content format required: ${scraped.contentFormat}
- Reward: ${scraped.rewardAmount || "TBD"} ${scraped.rewardCurrency || ""}
- Requirements: ${scraped.submissionRequirements?.slice(0, 400) || "See listing"}
- Description: ${scraped.description?.slice(0, 500) || ""}

Cover all 14 sections concisely:

## 1. Executive Summary
## 2. Beginner-Friendly Explanation
## 3. Detailed Product Breakdown
## 4. Team and Background
## 5. Market Positioning
## 6. Community and Growth
## 7. Latest Updates
## 8. Important Statistics
## 9. Strong Content Angles (20 ideas: beginner, contrarian, educational, storytelling, viral)
## 10. Hooks (10 video hooks + 10 thread hooks)
## 11. Visual Ideas
## 12. Frequently Misunderstood Concepts
## 13. Key Talking Points (top 10)
## 14. Sources

Be specific to ${subject}. Use bullet points throughout. Do NOT write about ${scraped.platform}.`,
      { model: BRIEF_MODEL, maxTokens: 2000, timeout: 90000 }
    );

    const fallback = templateResearchBrief(scraped);
    return { ...fallback, fullContent };
  } catch {
    // Fall through to template
  }

  return templateResearchBrief(scraped);
}

// Generate production plan using native Qwen function calling (no regex fallback).
export async function generateProductionPlan(scraped: ScrapedBounty): Promise<ProductionPlanContent> {
  if (!hasKey()) return templateProductionPlan(scraped);

  const planTool: QwenTool = {
    type: "function",
    function: {
      name: "submit_production_plan",
      description: "Submit the complete production plan for this bounty",
      parameters: {
        type: "object",
        properties: {
          scriptOutline: {
            type: "string",
            description: "Detailed content outline with timing/sections appropriate for the format",
          },
          shotList: {
            type: "string",
            description: "Specific shot list (for video) or content structure (for threads/articles)",
          },
          captionDraft: {
            type: "string",
            description: "Ready-to-use caption/hook for social promotion of the submission",
          },
          submissionChecklist: {
            type: "string",
            description: "Checklist items with [ ] markers covering all submission requirements",
          },
          estimatedHours: {
            type: "integer",
            description: "Realistic hours to complete this bounty end-to-end",
            minimum: 1,
          },
        },
        required: ["scriptOutline", "shotList", "captionDraft", "submissionChecklist", "estimatedHours"],
      },
    },
  };

  try {
    const result = await callQwenWithTool<ProductionPlanContent>(
      [
        {
          role: "system",
          content: "You are BountyPilot, helping content creators plan and produce winning crypto bounty submissions. Call submit_production_plan with a complete, actionable plan tailored to the bounty format.",
        },
        {
          role: "user",
          content: `Generate a production plan for this bounty:
- Title: ${scraped.title}
- Platform: ${scraped.platform}
- Project: ${scraped.projectName}
- Format: ${scraped.contentFormat}
- Deliverables: ${scraped.deliverables}
- Deadline: ${scraped.deadline || "check listing"}
- Submission link: ${scraped.submissionLink}
- Requirements: ${scraped.submissionRequirements?.slice(0, 300)}`,
        },
      ],
      planTool,
      { maxTokens: 900 }
    );

    if (result) {
      const fallback = templateProductionPlan(scraped);
      return {
        scriptOutline: result.scriptOutline || fallback.scriptOutline,
        shotList: result.shotList || fallback.shotList,
        captionDraft: result.captionDraft || fallback.captionDraft,
        submissionChecklist: result.submissionChecklist || fallback.submissionChecklist,
        estimatedHours: parseInt(String(result.estimatedHours)) || fallback.estimatedHours,
      };
    }
  } catch {
    // Fall through to template
  }

  return templateProductionPlan(scraped);
}

// ── Application Drafter ────────────────────────────────────────

export interface ApplicationDraft {
  opening: string;
  creatorFit: string;
  approach: string;
  closing: string;
  fullDraft: string;
}

function templateApplicationDraft(
  bounty: { title: string | null; platform: string | null; contentFormat: string | null },
  profile?: UserProfile & { creatorName?: string | null; fullName?: string | null }
): ApplicationDraft {
  const name = profile?.creatorName || profile?.fullName || "I";
  const niche = profile?.niche ? ` in the ${profile.niche} space` : "";
  const format = bounty.contentFormat || "content";
  const project = bounty.title || "this project";

  const opening = `Hi! I'm ${name}, a Web3 content creator${niche} excited about the ${project} bounty.`;
  const creatorFit = `My experience creating ${format} content makes me a strong fit for this opportunity. I specialize in communicating complex Web3 concepts clearly to engaged audiences.`;
  const approach = `For this bounty I would create high-quality ${format} covering the core value proposition of the project, hitting every required deliverable, and submitting well ahead of the deadline.`;
  const closing = `I'm ready to deliver great work here — please reach out if you have any questions!`;
  const fullDraft = `${opening}\n\n${creatorFit}\n\n${approach}\n\n${closing}`;
  return { opening, creatorFit, approach, closing, fullDraft };
}

export async function generateApplicationDraft(
  bounty: {
    title: string | null;
    platform: string | null;
    projectName: string | null;
    rewardAmount: string | null;
    rewardCurrency: string | null;
    contentFormat: string | null;
    submissionRequirements: string | null;
    deliverables: string | null;
    description: string | null;
  },
  profile?: UserProfile & { creatorName?: string | null; fullName?: string | null; portfolioLinks?: string | null }
): Promise<ApplicationDraft> {
  if (!hasKey()) return templateApplicationDraft(bounty, profile);

  const profileContext = profile
    ? `\nCreator applying:\n- Name: ${profile.creatorName || profile.fullName || "not provided"}\n- Niche: ${profile.niche || "Web3 creator"}\n- Platforms: ${profile.mainPlatforms || "not specified"}\n- Content formats: ${profile.contentFormats || "not specified"}\n- Skill level: ${profile.skillLevel || "intermediate"}\n- Strengths: ${profile.creatorStrengths || "not specified"}\n- Portfolio: ${profile.portfolioLinks || "not specified"}`
    : "";

  const draftTool: QwenTool = {
    type: "function",
    function: {
      name: "submit_application_draft",
      description: "Submit a structured bounty application draft personalized to this creator",
      parameters: {
        type: "object",
        properties: {
          opening: { type: "string", description: "1-2 sentence opening: who you are and why you're interested in this specific bounty" },
          creatorFit: { type: "string", description: "2-3 sentences: why this creator is a strong fit — niche, format experience, relevant strengths" },
          approach: { type: "string", description: "2-3 sentences: specific approach to the deliverables — research plan, unique angle, timeline" },
          closing: { type: "string", description: "1-2 sentence confident closing with a CTA" },
          fullDraft: { type: "string", description: "Complete application text in natural flowing prose, ready to submit" },
        },
        required: ["opening", "creatorFit", "approach", "closing", "fullDraft"],
      },
    },
  };

  try {
    const result = await callQwenWithTool<ApplicationDraft>(
      [
        {
          role: "system",
          content:
            "You are BountyPilot, drafting tailored Web3 bounty applications for content creators. Write in first person, professionally but conversationally. Be specific to this bounty and this creator's profile. No filler. Call submit_application_draft.",
        },
        {
          role: "user",
          content: `Draft an application for this bounty:\n- Title: ${bounty.title}\n- Platform: ${bounty.platform}\n- Project: ${bounty.projectName}\n- Reward: ${bounty.rewardAmount || "listed"} ${bounty.rewardCurrency || ""}\n- Format: ${bounty.contentFormat}\n- Requirements: ${bounty.submissionRequirements?.slice(0, 400) || "see listing"}\n- Description: ${bounty.description?.slice(0, 300) || ""}${profileContext}`,
        },
      ],
      draftTool,
      { maxTokens: 700 }
    );
    if (result) return result;
  } catch {
    // Fall through to template
  }

  return templateApplicationDraft(bounty, profile);
}
