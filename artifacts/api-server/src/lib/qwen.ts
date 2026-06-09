import type { ScrapedBounty } from "./scraper.js";

const QWEN_BASE_URL = process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const QWEN_API_URL = `${QWEN_BASE_URL.replace(/\/+$/, "")}/chat/completions`;
const MODEL = process.env.QWEN_MODEL || "qwen-plus-2025-07-28";

function hasKey(): boolean {
  return !!(process.env.QWEN_API_KEY && process.env.QWEN_API_KEY.trim().length > 0);
}

async function callQwen(systemPrompt: string, userPrompt: string): Promise<string> {
  const resp = await fetch(QWEN_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.QWEN_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Qwen API error ${resp.status}: ${err}`);
  }
  const data = (await resp.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content || "";
}

export interface BountyAnalysis {
  scoreExplanation: string;
  opportunityScore: number;
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

function templateResearchBrief(scraped: ScrapedBounty): ResearchBriefContent {
  return {
    summary: scraped.description || `This ${scraped.platform} bounty from ${scraped.projectName} asks creators to produce ${scraped.contentFormat} content. Focus on clear, accurate, and engaging delivery.`,
    contentAngles: `1. Beginner explainer — break down complex concepts for a non-technical audience\n2. Comparison angle — how does ${scraped.projectName} differ from competitors?\n3. Use-case story — real people, real outcomes\n4. "Why it matters" narrative — connect to broader Web3 trends`,
    keyPoints: `- Understand ${scraped.projectName}'s core value proposition\n- Research recent news and product updates\n- Identify common misconceptions to address\n- Gather supporting data points and statistics`,
    targetAudience: `Crypto-curious users, existing ${scraped.platform} community members, developers considering the ecosystem, and general Web3 content consumers.`,
    competitorAnalysis: `Search Twitter, YouTube, and Mirror for existing coverage of ${scraped.projectName}. Differentiate by going deeper, using demos, or targeting a specific sub-audience.`,
  };
}

function templateProductionPlan(scraped: ScrapedBounty): ProductionPlanContent {
  const hasVideo = scraped.contentFormat.toLowerCase().includes("video");
  const hasThread = scraped.contentFormat.toLowerCase().includes("thread") || scraped.contentFormat.toLowerCase().includes("twitter");
  const hasArticle = scraped.contentFormat.toLowerCase().includes("article") || scraped.contentFormat.toLowerCase().includes("blog");

  const scriptOutline = hasVideo
    ? `HOOK (0-30s): Open with a surprising stat or bold claim about ${scraped.projectName}\nSECTION 1 (30-90s): What is it and why does it exist?\nSECTION 2 (90-180s): How does it work — live demo if possible\nSECTION 3 (180-240s): Why should the viewer care?\nOUTRO (240-300s): CTA — link in bio, subscribe, submit before ${scraped.deadline || "deadline"}`
    : `HOOK: Lead with a surprising angle about ${scraped.projectName}\nSECTION 1: Context and background\nSECTION 2: Core mechanics or value proposition\nSECTION 3: Real implications and use cases\nCLOSING: Call to action`;

  const shotList = hasVideo
    ? `1. Talking head intro — clean background, good lighting\n2. Screen recording — product/protocol walkthrough\n3. Graphic overlay — key stats and comparisons\n4. B-roll — community, ecosystem, relevant visuals\n5. Outro card — social links + submission URL`
    : hasThread
    ? `Tweet 1: Hook with bold statement\nTweets 2-5: Core explanation broken into digestible chunks\nTweets 6-8: Supporting evidence and examples\nTweet 9: Implications / what this means for you\nTweet 10: CTA + link to submission`
    : `Section 1: Intro + hook (200 words)\nSection 2: Background context (300 words)\nSection 3: Deep dive (400 words)\nSection 4: Practical takeaways (200 words)\nConclusion + CTA (100 words)`;

  const captionDraft = `Breaking down ${scraped.projectName} for you — here's everything creators and builders need to know. ${hasThread ? "Thread 🧵" : hasVideo ? "Full video 👆" : "Full article linked."} #Web3 #${scraped.platform.replace(/\s/g, "")} #Crypto`;

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

  return {
    scriptOutline,
    shotList,
    captionDraft,
    submissionChecklist: checklist,
    estimatedHours: hours,
  };
}

export interface UserProfile {
  contentFormats?: string | null;
  mainPlatforms?: string | null;
  niche?: string | null;
  skillLevel?: string | null;
  preferredBountyTypes?: string | null;
  minimumReward?: number | null;
  creatorStrengths?: string | null;
}

export async function analyzeBounty(scraped: ScrapedBounty, profile?: UserProfile): Promise<BountyAnalysis> {
  const baseScore = ruleBasedScore(scraped.rewardAmount, scraped.deadline);

  if (!hasKey()) {
    return {
      opportunityScore: baseScore,
      scoreExplanation: templateExplanation(baseScore, scraped),
    };
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

  try {
    const text = await callQwen(
      `You are BountyPilot, an AI assistant helping content creators evaluate crypto bounty opportunities. 
Be concise, direct, and creator-focused. Score from 1-10 based on: reward size, deadline feasibility, requirement clarity, format match, and creator-specific opportunity.`,
      `Evaluate this bounty opportunity and respond with JSON only:
{
  "opportunityScore": <1-10 integer>,
  "scoreExplanation": "<2-3 sentence explanation personalised to this creator, mentioning reward, timeline, format fit, and key reasons>"
}

Bounty details:
- Platform: ${scraped.platform}
- Project: ${scraped.projectName}
- Title: ${scraped.title}
- Reward: ${scraped.rewardAmount || "unknown"} ${scraped.rewardCurrency || ""}
- Deadline: ${scraped.deadline || "not specified"}
- Format: ${scraped.contentFormat}
- Requirements: ${scraped.submissionRequirements?.slice(0, 300)}
- Description: ${scraped.description?.slice(0, 400)}
${profileContext}`
    );

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        opportunityScore: Math.max(1, Math.min(10, parseInt(parsed.opportunityScore) || baseScore)),
        scoreExplanation: parsed.scoreExplanation || templateExplanation(baseScore, scraped),
      };
    }
  } catch (e) {
    // Fall through to template
  }

  return {
    opportunityScore: baseScore,
    scoreExplanation: templateExplanation(baseScore, scraped),
  };
}

export async function generateResearchBrief(scraped: ScrapedBounty): Promise<ResearchBriefContent> {
  if (!hasKey()) {
    return templateResearchBrief(scraped);
  }

  try {
    const fullContent = await callQwen(
      `You are a senior Web3 researcher and content strategist. You write comprehensive, deeply researched creator briefs that give content creators everything they need to produce winning content without any additional research. Be specific, insightful, and actionable. Use clear markdown headings.`,
      `Conduct comprehensive research on ${scraped.projectName || scraped.title} and produce a complete content creator brief.

Bounty context:
- Platform: ${scraped.platform}
- Title: ${scraped.title}
- Format: ${scraped.contentFormat}
- Reward: ${scraped.rewardAmount || "TBD"} ${scraped.rewardCurrency || ""}
- Requirements: ${scraped.submissionRequirements?.slice(0, 500) || "See listing"}
- Description: ${scraped.description?.slice(0, 600) || ""}

Write the full brief using these exact sections:

## 1. Executive Summary
- What is the project?
- What problem does it solve?
- Why should people care?

## 2. Beginner-Friendly Explanation
Explain the project as if speaking to someone completely new to Web3.

## 3. Detailed Product Breakdown
- How does the product work?
- What are its major features?
- What makes it unique?

## 4. Team and Background
Founders, team, investors, funding rounds.

## 5. Market Positioning
Competitors, advantages, disadvantages, market opportunity.

## 6. Community and Growth
X/Twitter following, community size, engagement quality, recent growth indicators.

## 7. Latest Updates
Partnerships, product launches, announcements, major milestones.

## 8. Important Statistics
User numbers, volume, revenue, TVL, downloads, transactions, any relevant metrics.

## 9. Strong Content Angles
Generate at least 20 content ideas across: beginner angles, contrarian angles, educational angles, storytelling angles, viral angles.

## 10. Hooks
Generate at least 20 video hooks and 20 thread hooks.

## 11. Visual Ideas
B-roll ideas, motion graphics ideas, visual metaphors, screen recording opportunities, comic ideas.

## 12. Frequently Misunderstood Concepts
List common misconceptions and explain them.

## 13. Key Talking Points
Generate the 20 most important points a creator should mention.

## 14. Sources
Website, documentation, X account, GitHub, blog, and any official resources.

Write in a professional report style. Use bullet points and sub-headings throughout. Be specific to ${scraped.projectName || scraped.title} — do not give generic answers.`
    );

    const fallback = templateResearchBrief(scraped);
    return {
      summary: fallback.summary,
      contentAngles: fallback.contentAngles,
      keyPoints: fallback.keyPoints,
      targetAudience: fallback.targetAudience,
      competitorAnalysis: fallback.competitorAnalysis,
      fullContent,
    };
  } catch (e) {
    // Fall through to template
  }

  return templateResearchBrief(scraped);
}

export async function generateProductionPlan(scraped: ScrapedBounty): Promise<ProductionPlanContent> {
  if (!hasKey()) {
    return templateProductionPlan(scraped);
  }

  try {
    const text = await callQwen(
      `You are BountyPilot, helping content creators plan and produce winning crypto bounty submissions.`,
      `Generate a production plan for this bounty as JSON only:
{
  "scriptOutline": "<detailed outline with timing/sections>",
  "shotList": "<specific shot list or content structure>",
  "captionDraft": "<ready-to-use caption/hook for social promotion>",
  "submissionChecklist": "<checklist items with [ ] markers>",
  "estimatedHours": <integer hours to complete>
}

Bounty:
- Title: ${scraped.title}
- Platform: ${scraped.platform}
- Project: ${scraped.projectName}
- Format: ${scraped.contentFormat}
- Deliverables: ${scraped.deliverables}
- Deadline: ${scraped.deadline || "check listing"}
- Submission link: ${scraped.submissionLink}
- Requirements: ${scraped.submissionRequirements?.slice(0, 300)}`
    );

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const fallback = templateProductionPlan(scraped);
      return {
        scriptOutline: parsed.scriptOutline || fallback.scriptOutline,
        shotList: parsed.shotList || fallback.shotList,
        captionDraft: parsed.captionDraft || fallback.captionDraft,
        submissionChecklist: parsed.submissionChecklist || fallback.submissionChecklist,
        estimatedHours: parseInt(parsed.estimatedHours) || fallback.estimatedHours,
      };
    }
  } catch (e) {
    // Fall through to template
  }

  return templateProductionPlan(scraped);
}
