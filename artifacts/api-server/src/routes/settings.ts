import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { getCrawlerStatus } from "../lib/cron.js";
import { hasNovusKey, initializeNovus } from "../lib/novus.js";

export const settingsRouter = Router();

settingsRouter.get("/status", requireAuth, async (_req: AuthRequest, res) => {
  const hasQwen = !!(process.env.QWEN_API_KEY && process.env.QWEN_API_KEY.trim().length > 0);
  const hasNovus = hasNovusKey();
  const provider = process.env.LLM_PROVIDER || (hasNovus ? "novus" : hasQwen ? "qwen" : "mock");
  const model = process.env.QWEN_MODEL || "qwen-plus-2025-07-28";
  const baseUrl = process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";

  let novusStatus = null;
  if (hasNovus) {
    try {
      const init = await initializeNovus();
      novusStatus = init ? { connected: true, serverInfo: init.serverInfo } : { connected: false };
    } catch {
      novusStatus = { connected: false };
    }
  }

  res.json({
    provider,
    model: hasNovus ? "novus" : hasQwen ? model : "mock-llm",
    baseUrl: hasNovus ? process.env.NOVUS_BASE_URL : hasQwen ? baseUrl : null,
    apiKeyConfigured: hasNovus || hasQwen,
    status: hasNovus ? "novus_active" : hasQwen ? "active" : "mock_mode",
    message: hasNovus
      ? "Connected to Novus AI"
      : hasQwen
        ? `Connected to Qwen (${model})`
        : "Running in mock mode — add NOVUS_API_KEY or QWEN_API_KEY to enable AI generation",
    environment: process.env.NODE_ENV || "development",
    supportedProviders: ["mock", "qwen", "novus"],
    novus: novusStatus,
    crawler: getCrawlerStatus(),
  });
});
