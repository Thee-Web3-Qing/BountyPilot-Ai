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
  const data = (await resp.json()) as JsonRpcResponse;
  if (data.error) {
    throw new Error(`Novus MCP error ${data.error.code}: ${data.error.message}`);
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
  // Try the generate_text tool if available
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
