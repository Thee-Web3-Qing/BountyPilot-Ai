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

function classifyFormat(scraped: ScrapedBounty): "hackathon" | "dev" | "video" | "podcast" | "thread" | "article" | "design" | "other" {
  const f = (scraped.contentFormat || "").toLowerCase();
  const t = (scraped.opportunityType || "").toLowerCase();
  if (t === "hackathon" || t.includes("hackathon")) return "hackathon";
  if (t === "bug bounty" || t.includes("bug bounty") || t.includes("security")) return "dev";
  if (f.includes("video") || f.includes("youtube") || f.includes("tiktok") || f.includes("reel")) return "video";
  if (f.includes("podcast") || f.includes("audio") || f.includes("space")) return "podcast";
  if (f.includes("thread") || f.includes("tweet") || f.includes("twitter")) return "thread";
  if (f.includes("article") || f.includes("blog") || f.includes("mirror") || f.includes("writ") || f.includes("newsletter")) return "article";
  if (f.includes("design") || f.includes("ui") || f.includes("ux") || f.includes("figma") || f.includes("art") || f.includes("graphic")) return "design";
  if (f.includes("code") || f.includes("develop") || f.includes("smart contract") || f.includes("github")) return "dev";
  return "other";
}

function templateProductionPlan(scraped: ScrapedBounty): ProductionPlanContent {
  const subject = getSubject(scraped);
  const kind = classifyFormat(scraped);

  if (kind === "hackathon" || kind === "dev") {
    return {
      scriptOutline: `PHASE 1 — Planning\n- Define scope and core features\n- Choose tech stack and architecture\n- Set up repository and project structure\n\nPHASE 2 — Development\n- Implement core functionality\n- Integrate required APIs/SDKs\n- Handle edge cases and errors\n\nPHASE 3 — Testing & Polish\n- End-to-end testing\n- Fix bugs and UX issues\n- Write README and docs\n\nPHASE 4 — Submission\n- Record demo video\n- Deploy to public URL\n- Submit before ${scraped.deadline || "deadline"}`,
      shotList: `Architecture overview:\n- Frontend: [framework]\n- Backend: [runtime]\n- DB: [database]\n- Key integrations: ${scraped.deliverables || "see requirements"}\n\nKey components to build:\n1. Core feature implementation\n2. API integration layer\n3. Authentication / user flow\n4. UI / dashboard\n5. Demo-ready polish`,
      captionDraft: `Built ${subject} for the ${scraped.platform || "hackathon"} — here's what I shipped, the tech stack, and how it works. #Hackathon #Web3 #Build`,
      submissionChecklist: `[ ] Working demo deployed to public URL\n[ ] Source code pushed to public GitHub repo\n[ ] Demo video recorded (< 3 min)\n[ ] README with setup instructions\n[ ] All required deliverables: ${scraped.deliverables || "see listing"}\n[ ] Submitted before deadline: ${scraped.deadline || "check listing"}\n[ ] Submission form completed: ${scraped.submissionLink || "check listing"}`,
      estimatedHours: 20,
    };
  }

  if (kind === "podcast") {
    return {
      scriptOutline: `INTRO (0-60s): Welcome + episode teaser — what listeners will learn\nSEGMENT 1 (1-5 min): What is ${subject} and why does it matter?\nSEGMENT 2 (5-12 min): Deep dive — mechanics, use cases, unique angles\nSEGMENT 3 (12-18 min): Who's building it, who's using it, what's next\nOUTRO (18-20 min): Key takeaways + CTA — links, submission URL`,
      shotList: `Episode structure:\n1. Cold open (hook quote or stat)\n2. Host intro + context\n3. Main interview / monologue breakdown\n4. Lightning round / rapid insights\n5. Resources + links shoutout\n6. Sign-off`,
      captionDraft: `New episode: breaking down ${subject} — everything you need to know as a Web3 builder or creator. Listen now 🎙️ #Web3 #Podcast #${(scraped.platform || "").replace(/\s/g, "")}`,
      submissionChecklist: `[ ] Audio exported as MP3/WAV, clean quality\n[ ] Episode published publicly (not private)\n[ ] Show notes / transcript provided\n[ ] All deliverables: ${scraped.deliverables || "see listing"}\n[ ] Submitted before deadline: ${scraped.deadline || "check listing"}\n[ ] Submission link completed: ${scraped.submissionLink || "check listing"}`,
      estimatedHours: 6,
    };
  }

  if (kind === "thread") {
    return {
      scriptOutline: `Tweet 1 (Hook): Bold claim or surprising stat about ${subject}\nTweet 2: What it is — plain English, no jargon\nTweet 3: Why it was built / problem it solves\nTweet 4: How it works (simplified)\nTweet 5: Real use case or example\nTweet 6: Key numbers / traction / stats\nTweet 7: Who's behind it and why it matters\nTweet 8: Comparison / differentiation\nTweet 9: What to watch for next\nTweet 10: CTA + submission link`,
      shotList: `Tweet-by-tweet structure:\n1. Hook (must stop the scroll)\n2-3: Context (2 tweets max)\n4-5: Core mechanics (short + visual-friendly)\n6-7: Evidence (data, traction, quotes)\n8-9: Opinion / angle (makes it shareable)\n10: CTA`,
      captionDraft: `🧵 Everything you need to know about ${subject} — thread below`,
      submissionChecklist: `[ ] Thread posted publicly on Twitter/X\n[ ] Minimum tweet count met\n[ ] All deliverables covered: ${scraped.deliverables || "see listing"}\n[ ] Submitted before deadline: ${scraped.deadline || "check listing"}\n[ ] Submission form completed: ${scraped.submissionLink || "check listing"}`,
      estimatedHours: 3,
    };
  }

  if (kind === "article") {
    return {
      scriptOutline: `HEADLINE: Compelling, SEO-aware title about ${subject}\n\nINTRO (200 words): Hook with a stat or story, then orient the reader\n\nSECTION 1 (300 words): What is ${subject} and why now?\nSECTION 2 (400 words): How it works — go deeper than surface level\nSECTION 3 (300 words): Who's using it and real-world outcomes\nSECTION 4 (200 words): What's next / future implications\n\nCONCLUSION (100 words): Key takeaways + CTA`,
      shotList: `Section-by-section structure:\n1. Intro hook (stat, story, or provocative question)\n2. Background / context (brief)\n3. Core mechanics / product breakdown\n4. Evidence — data, case studies, quotes\n5. Forward-looking analysis\n6. Conclusion with CTA and submission link`,
      captionDraft: `Just published: ${subject} explained — everything Web3 builders and creators need to know. Full article linked 👇 #Web3 #${(scraped.platform || "").replace(/\s/g, "")}`,
      submissionChecklist: `[ ] Article published publicly (not draft)\n[ ] Word count meets requirements\n[ ] All deliverables: ${scraped.deliverables || "see listing"}\n[ ] Submitted before deadline: ${scraped.deadline || "check listing"}\n[ ] Submission link completed: ${scraped.submissionLink || "check listing"}\n[ ] Original work — no plagiarism`,
      estimatedHours: 5,
    };
  }

  if (kind === "design") {
    return {
      scriptOutline: `BRIEF:\n- Project: ${subject}\n- Deliverables: ${scraped.deliverables || "see listing"}\n- Style direction: Clean, Web3-native, brand-aligned\n\nPHASE 1 — Concepting: Moodboard, style references, initial sketches\nPHASE 2 — Design: Hi-fi execution in Figma/tool of choice\nPHASE 3 — Revisions: Refinement based on self-review vs requirements\nPHASE 4 — Export: Final assets in required formats`,
      shotList: `Asset checklist:\n1. Primary deliverable (logo / UI / artwork)\n2. Required formats (PNG, SVG, etc.)\n3. Size variants if needed\n4. Source file (Figma link or editable file)\n5. Usage guide / notes if required`,
      captionDraft: `Designed for ${subject} — here's the creative direction, process, and final result. #Web3Design #${(scraped.platform || "").replace(/\s/g, "")}`,
      submissionChecklist: `[ ] All design assets exported in required formats\n[ ] Source file provided\n[ ] Deliverables met: ${scraped.deliverables || "see listing"}\n[ ] Submitted before deadline: ${scraped.deadline || "check listing"}\n[ ] Submission form completed: ${scraped.submissionLink || "check listing"}`,
      estimatedHours: 8,
    };
  }

  // Default: video
  return {
    scriptOutline: `HOOK (0-30s): Open with a surprising stat or bold claim about ${subject}\nSECTION 1 (30-90s): What is it and why does it exist?\nSECTION 2 (90-180s): How does it work — live demo if possible\nSECTION 3 (180-240s): Why should the viewer care?\nOUTRO (240-300s): CTA — link in bio, subscribe, submit before ${scraped.deadline || "deadline"}`,
    shotList: `1. Talking head intro — clean background, good lighting\n2. Screen recording — product/protocol walkthrough\n3. Graphic overlay — key stats and comparisons\n4. B-roll — community, ecosystem, relevant visuals\n5. Outro card — social links + submission URL`,
    captionDraft: `Breaking down ${subject} — here's everything creators and builders need to know. Full video 👆 #Web3 #${(scraped.platform || "").replace(/\s/g, "")} #Crypto`,
    submissionChecklist: [
      `[ ] Content published publicly (not draft/private)`,
      `[ ] Video is minimum required length`,
      `[ ] All required deliverables included: ${scraped.deliverables}`,
      scraped.deadline ? `[ ] Submitted before deadline: ${scraped.deadline}` : `[ ] Submitted before the listed deadline`,
      `[ ] Submission form/link completed: ${scraped.submissionLink}`,
      `[ ] All original work — no AI-generated filler text`,
    ].join("\n"),
    estimatedHours: 10,
  };
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

  const kind = classifyFormat(scraped);
  const kindInstructions: Record<string, string> = {
    hackathon: "This is a HACKATHON. Fill scriptOutline with a phased build plan (Planning → Development → Testing → Submission). Fill shotList with architecture notes and key components. Fill captionDraft with a submission pitch. Fill submissionChecklist with hackathon-specific items (repo, demo video, README, deployed URL).",
    dev: "This is a DEVELOPMENT/CODE bounty. Fill scriptOutline with an implementation plan. Fill shotList with technical architecture notes. Fill captionDraft with a submission pitch. Fill submissionChecklist with code-specific items.",
    podcast: "This is a PODCAST bounty. Fill scriptOutline with a timed episode outline. Fill shotList with episode structure and segment breakdown. Fill captionDraft with an episode promo caption. Fill submissionChecklist with audio-specific requirements.",
    thread: "This is a TWITTER/THREAD bounty. Fill scriptOutline with a tweet-by-tweet thread outline. Fill shotList with the tweet structure (hook, core, evidence, CTA). Fill captionDraft with a promo tweet. Fill submissionChecklist with thread-specific requirements.",
    article: "This is an ARTICLE/WRITING bounty. Fill scriptOutline with a detailed article outline with section headings and word counts. Fill shotList with section-by-section structure. Fill captionDraft with a social promo caption. Fill submissionChecklist with writing-specific requirements.",
    design: "This is a DESIGN bounty. Fill scriptOutline with a design brief and phased approach. Fill shotList with a list of assets and deliverables to produce. Fill captionDraft with a portfolio/submission note. Fill submissionChecklist with design export requirements.",
    other: "This is a VIDEO/CONTENT bounty. Fill scriptOutline with a timed script. Fill shotList with a shot-by-shot production list. Fill captionDraft with a social caption. Fill submissionChecklist with video submission requirements.",
    video: "This is a VIDEO bounty. Fill scriptOutline with a timed script with hooks and sections. Fill shotList with a shot-by-shot list. Fill captionDraft with a social caption. Fill submissionChecklist with video submission requirements.",
  };
  const typeInstruction = kindInstructions[kind] || kindInstructions.other;

  try {
    const result = await callQwenWithTool<ProductionPlanContent>(
      [
        {
          role: "system",
          content: `You are BountyPilot, helping creators plan and produce winning crypto bounty submissions. Call submit_production_plan with a complete, actionable plan. ${typeInstruction}`,
        },
        {
          role: "user",
          content: `Generate a production plan for this bounty:
- Title: ${scraped.title}
- Platform: ${scraped.platform}
- Project: ${scraped.projectName}
- Opportunity Type: ${scraped.opportunityType || "Bounty"}
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

// ── Manual bounty extraction from raw text ──────────────────────────────────

export interface ExtractedBounty {
  title: string;
  projectName: string;
  rewardAmount: string;
  rewardCurrency: string;
  prizeBreakdown: string;
  deadline: string;
  contentFormat: string;
  submissionRequirements: string;
  deliverables: string;
  trackCategory: string;
  skillsRequired: string;
  tags: string;
  opportunityScore: number;
  scoreExplanation: string;
}

export async function extractBountyFromText(rawText: string, sourceUrl?: string): Promise<ExtractedBounty> {
  const extractTool: QwenTool = {
    type: "function",
    function: {
      name: "submit_extracted_bounty",
      description: "Submit the structured bounty data extracted from the raw announcement text",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short, clear bounty title (e.g. '$DEGX Content Contest — $500 USDC')" },
          projectName: { type: "string", description: "Name of the project or company running the bounty" },
          rewardAmount: { type: "string", description: "Total reward pool as a number string, e.g. '500'" },
          rewardCurrency: { type: "string", description: "Currency ticker: USDC, SOL, ETH, etc." },
          prizeBreakdown: { type: "string", description: "Prize breakdown for each rank, e.g. '1st: $200, 2nd: $100, 3rd: $75'" },
          deadline: { type: "string", description: "Deadline in YYYY-MM-DD format. Leave empty string if unknown." },
          contentFormat: { type: "string", description: "Comma-separated list of accepted content formats, e.g. 'Memes, Threads, Videos, Graphics'" },
          submissionRequirements: { type: "string", description: "Step-by-step rules/requirements for participants" },
          deliverables: { type: "string", description: "What the participant must actually produce or submit" },
          trackCategory: { type: "string", description: "Category: Content, Design, Development, Research, Marketing, Community, Other" },
          skillsRequired: { type: "string", description: "Comma-separated skills needed, e.g. 'Content Creation, Social Media'" },
          tags: { type: "string", description: "Comma-separated relevant tags, e.g. 'x-contest,content,crypto,meme'" },
          opportunityScore: { type: "integer", description: "Score 1–100 reflecting opportunity quality for Web3 content creators", minimum: 1, maximum: 100 },
          scoreExplanation: { type: "string", description: "2-sentence explanation of the score: why it is or isn't a great opportunity" },
        },
        required: ["title", "projectName", "rewardAmount", "rewardCurrency", "prizeBreakdown", "deadline", "contentFormat", "submissionRequirements", "deliverables", "trackCategory", "skillsRequired", "tags", "opportunityScore", "scoreExplanation"],
      },
    },
  };

  const result = await callQwenWithTool<ExtractedBounty>(
    [
      {
        role: "system",
        content: `You are BountyPilot's extraction AI. Given a raw bounty announcement (tweet, post, or message), extract all structured data about the bounty. Be precise with numbers and dates. If a field is not mentioned, use an empty string. For the deadline, convert any relative or fuzzy dates to YYYY-MM-DD using today's date (${new Date().toISOString().slice(0, 10)}) as reference.`,
      },
      {
        role: "user",
        content: `Extract bounty data from this announcement:\n\n${rawText}${sourceUrl ? `\n\nSource URL: ${sourceUrl}` : ""}`,
      },
    ],
    extractTool,
    { maxTokens: 800, timeout: 45000 }
  );

  if (!result) throw new Error("Qwen extraction returned no result");
  return result;
}
