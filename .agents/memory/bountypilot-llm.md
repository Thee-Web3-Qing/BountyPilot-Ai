---
name: BountyPilot LLM config
description: LLM provider system — env vars, mock fallback, settings endpoint.
---

## Env vars
- `QWEN_API_KEY` — enables Qwen AI (get from dashscope.aliyuncs.com)
- `QWEN_MODEL` — default: `qwen-plus-2025-07-28`
- `QWEN_BASE_URL` — default: `https://dashscope.aliyuncs.com/compatible-mode/v1`

## Behavior
- When `QWEN_API_KEY` is set: real AI extraction, scoring, research briefs, production plans
- When not set: rule-based scoring + template-based generation (still functional, just not AI-powered)
- `GET /api/settings/status` (requires auth) returns current provider, model, status, and whether API key is configured
- Frontend Settings page reads this endpoint and shows a warning if in mock mode

**Why:** Users without an API key still get a fully functional app with smart template fallback. The UI warns them clearly in Settings how to upgrade to AI mode.
