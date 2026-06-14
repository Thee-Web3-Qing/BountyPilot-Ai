import { logger } from "./logger.js";

const NOVUS_BASE_URL = process.env.NOVUS_BASE_URL || "https://novus-api.pendo.io/mcp";
const NOVUS_API_KEY = process.env.NOVUS_API_KEY || "";

export function hasNovusKey(): boolean {
  return !!NOVUS_API_KEY;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

let requestId = 0;

async function novusRpc(method: string, params?: unknown): Promise<unknown> {
  const id = ++requestId;
  const req: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
  const resp = await fetch(NOVUS_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(NOVUS_API_KEY ? { "Authorization": `Bearer ${NOVUS_API_KEY}` } : {}),
    },
    body: JSON.stringify(req),
  });
  const data = (await resp.json()) as JsonRpcResponse & { message?: string; statusCode?: number };
  // Novus returns errors in different shapes — handle both JSON-RPC and REST-style errors
  if (data.error || data.statusCode && data.statusCode >= 400) {
    const msg = data.error?.message || data.message || `HTTP ${data.statusCode}`;
    const code = data.error?.code || data.statusCode || "unknown";
    throw new Error(`Novus MCP error ${code}: ${msg}`);
  }
  return data.result;
}

// ── Initialize MCP connection ─────────────────────────────────
export async function initializeNovus(): Promise<{ protocolVersion: string; serverInfo: { name: string; version: string } } | null> {
  try {
    const result = await novusRpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "bountypilot", version: "1.0.0" },
    }) as { protocolVersion: string; serverInfo: { name: string; version: string } };
    return result;
  } catch (e: any) {
    logger.warn({ err: e.message }, "Novus MCP initialize failed");
    return null;
  }
}

// ── List available tools ──────────────────────────────────────
export async function listNovusTools(): Promise<Array<{ name: string; description: string }>> {
  try {
    const result = await novusRpc("tools/list", {}) as { tools: Array<{ name: string; description: string }> };
    return result.tools || [];
  } catch (e: any) {
    logger.warn({ err: e.message }, "Novus MCP tools/list failed");
    return [];
  }
}

// ── Call a Novus tool ─────────────────────────────────────────
export async function callNovusTool(name: string, args: Record<string, unknown>): Promise<string> {
  const result = await novusRpc("tools/call", { name, arguments: args }) as {
    content: Array<{ type: string; text: string }>;
  };
  const text = result.content?.find((c) => c.type === "text")?.text || "";
  return text;
}

// ── Simple LLM wrapper via Novus generate_text tool ───────────
export async function callNovusLLM(
  systemPrompt: string,
  userPrompt: string,
  { maxTokens = 400, timeout = 30000 }: { maxTokens?: number; timeout?: number } = {}
): Promise<string> {
  try {
    const text = await callNovusTool("generate_text", {
      system: systemPrompt,
      prompt: userPrompt,
      max_tokens: maxTokens,
    });
    return text;
  } catch (e: any) {
    logger.warn({ err: e.message }, "Novus generate_text failed, falling back");
    throw e;
  }
}

// ── Analytics: Dashboard insights for creators ──────────────────

export async function analyzeDashboardInsights(data: {
  totalBounties: number;
  totalEarnings: number;
  activeBounties: number;
  wonBounties: number;
  lostBounties: number;
  winRate: number;
  pipelineValue: number;
  averageScore: number | null;
  statusBreakdown: { status: string; count: number }[];
}): Promise<string | null> {
  if (!hasNovusKey()) return null;
  try {
    const prompt = `You are a senior Web3 creator strategist analyzing a creator's bounty pipeline.

Here is the creator's current data:
- Total bounties tracked: ${data.totalBounties}
- Total earnings: $${data.totalEarnings}
- Active bounties: ${data.activeBounties}
- Won: ${data.wonBounties} | Lost: ${data.lostBounties} | Win rate: ${data.winRate}%
- Pipeline value: $${data.pipelineValue}
- Average opportunity score: ${data.averageScore?.toFixed(1) ?? "N/A"}
- Status breakdown: ${data.statusBreakdown.map(s => `${s.status}: ${s.count}`).join(", ")}

Give 3-4 concise, actionable insights. Be specific and motivational. Focus on:
1. What they should prioritize next (based on pipeline + scores)
2. Win rate analysis — what's working, what to improve
3. If they have low activity, suggest how to find better bounties
4. One concrete next step they should take today

Return plain text with bullet points. Keep it under 250 words. No markdown headers.`;

    return await callNovusLLM(
      "You are a concise, direct Web3 creator coach. Give actionable advice based on numbers. No fluff.",
      prompt,
      { maxTokens: 500 }
    );
  } catch (e: any) {
    logger.warn({ err: e.message }, "Novus dashboard insights failed");
    return null;
  }
}

// ── Analytics: Admin product insights ─────────────────────────

export async function analyzeAdminInsights(data: {
  users: { total: number; last24h: number; last7d: number; last30d: number; activeLast7d: number };
  bounties: { total: number; claimed: number; won: number; lost: number; winRate: number; last7d: number };
  earnings: { total: number; last7d: number };
  hoursSaved: { total: number; last7d: number };
  platformBreakdown: { platform: string; count: number; totalReward: number }[];
  topEarners: { username: string; amount: number }[];
}): Promise<string | null> {
  if (!hasNovusKey()) return null;
  try {
    const prompt = `You are a growth strategist for a Web3 creator tool called BountyPilot. Analyze the product metrics and give growth + marketing advice.

Current metrics:
Users:
- Total: ${data.users.total}
- New last 7d: ${data.users.last7d} | 30d: ${data.users.last30d}
- Active (claimed bounty in 7d): ${data.users.activeLast7d}

Bounties:
- Total: ${data.bounties.total} | Claimed: ${data.bounties.claimed} | Won: ${data.bounties.won} | Lost: ${data.bounties.lost}
- Win rate: ${data.bounties.winRate}% | New last 7d: ${data.bounties.last7d}

Earnings:
- Total: $${data.earnings.total} | Last 7d: $${data.earnings.last7d}

Hours saved:
- Total: ${data.hoursSaved.total} | Last 7d: ${data.hoursSaved.last7d}

Top platforms: ${data.platformBreakdown.slice(0, 5).map(p => `${p.platform} (${p.count} bounties, $${p.totalReward})`).join(", ")}

Top earners: ${data.topEarners.slice(0, 5).map(e => `@${e.username} ($${e.amount})`).join(", ")}

Give 5 concise strategic recommendations covering:
1. User acquisition — where to focus efforts based on growth trends
2. Retention — what's working or failing based on active users
3. Marketing channels — where to double down based on platform data
4. Product improvements — what features would drive more value
5. Revenue/growth — how to increase earnings and platform adoption

Be direct and data-driven. No generic advice. Keep it under 350 words. Plain text bullet points.`;

    return await callNovusLLM(
      "You are a sharp product growth strategist. Give data-backed, specific recommendations. No generic fluff.",
      prompt,
      { maxTokens: 700 }
    );
  } catch (e: any) {
    logger.warn({ err: e.message }, "Novus admin insights failed");
    return null;
  }
}
