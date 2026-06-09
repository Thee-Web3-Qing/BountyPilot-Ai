import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth.js";

export const settingsRouter = Router();

settingsRouter.get("/status", requireAuth, (_req: AuthRequest, res) => {
  const hasQwen = !!(process.env.QWEN_API_KEY && process.env.QWEN_API_KEY.trim().length > 0);
  const provider = process.env.LLM_PROVIDER || (hasQwen ? "qwen" : "mock");
  const model = process.env.QWEN_MODEL || "qwen-plus-2025-07-28";
  const baseUrl = process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";

  res.json({
    provider,
    model: hasQwen ? model : "mock-llm",
    baseUrl: hasQwen ? baseUrl : null,
    apiKeyConfigured: hasQwen,
    status: hasQwen ? "active" : "mock_mode",
    message: hasQwen
      ? `Connected to Qwen (${model})`
      : "Running in mock mode — add QWEN_API_KEY to enable AI generation",
    environment: process.env.NODE_ENV || "development",
    supportedProviders: ["mock", "qwen"],
  });
});
