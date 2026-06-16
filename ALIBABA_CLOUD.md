# Alibaba Cloud Integration Proof

## Service Used

**Qwen API (Alibaba Cloud DashScope)** — the backbone of BountyPilot's AI agent pipeline.

## Evidence

All AI inference in BountyPilot routes through `artifacts/api-server/src/lib/qwen.ts`, which calls:

```
https://dashscope.aliyuncs.com/compatible-mode/v1
```

This is Alibaba Cloud's DashScope inference endpoint, exposed as an OpenAI-compatible API.

## What It Powers

| Feature | Qwen API Call |
|---|---|
| Opportunity scoring | `analyzeBounty()` — structured JSON via tool-calling |
| Research brief generation | `generateResearchBrief()` — 14-section creator intelligence report |
| Production plan generation | `generateProductionPlan()` — timeline, script, and distribution strategy |
| Application draft generation | `generateApplicationDraft()` — personalised cover letter |
| Multi-turn agent loop | `runQwenAgentLoop()` — Qwen decides which tools to invoke and when |
| MCP tool execution | `/api/mcp` — exposes all agent tools over MCP 2024-11-05 JSON-RPC 2.0 |

## Key File

[`artifacts/api-server/src/lib/qwen.ts`](artifacts/api-server/src/lib/qwen.ts)

```typescript
// Line ~10 — Alibaba Cloud DashScope endpoint
const BASE_URL = process.env["QWEN_BASE_URL"] ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
const MODEL    = process.env["QWEN_MODEL"]    ?? "qwen-plus";
```

## Model

- Default: `qwen-plus` (Qwen Cloud)
- Configurable via `QWEN_MODEL` environment variable
- API key configured via `QWEN_API_KEY` (Alibaba Cloud DashScope API key)

## Track

**Track 4: Autopilot Agent** — BountyPilot automates the full Web3 bounty discovery-to-application workflow end-to-end, using Qwen as the orchestration brain with native tool-calling.
