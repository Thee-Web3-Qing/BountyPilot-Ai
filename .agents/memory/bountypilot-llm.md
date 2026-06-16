---
name: BountyPilot LLM config
description: LLM provider system — env vars, mock fallback, settings endpoint.
---

## Env vars
- `QWEN_API_KEY` — Token Plan Team Edition key (format: `sk-sp-...`)
- `QWEN_MODEL` — currently `qwen3.6-flash` (Token Plan endpoint uses different model IDs — NOT qwen-turbo/qwen-plus)
- `QWEN_BASE_URL` — `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`

## Token Plan endpoint model IDs (as of Jun 2026)
Available: `qwen3.6-flash`, `qwen3.6-plus`, `qwen3.7-max`, `qwen3.7-plus`, `deepseek-v3.2`, `deepseek-v4-flash`, `deepseek-v4-pro`, `glm-5`, `glm-5.1`, `kimi-k2.5`, `kimi-k2.6`, `MiniMax-M2.5`
NOT available: `qwen-turbo`, `qwen-plus`, `qwen-max` (these are regular DashScope model IDs, rejected with model_not_found)

## Behavior
- When `QWEN_API_KEY` is set: real AI extraction, scoring, research briefs, production plans
- When not set or key invalid: rule-based scoring + template-based fallback
- `GET /api/settings/status` (requires auth) returns current provider, model, status

**Why:** The Token Plan Team Edition (ap-southeast-1) uses a completely different endpoint and model name space from regular DashScope. The key format is `sk-sp-...` vs regular `sk-...`. The base URL must match the subscription region.
