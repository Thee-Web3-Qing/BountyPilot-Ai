# BountyPilot AI — Project Story

## Inspiration

The idea came from a personal challenge I started: going from $0 to $1000 through content bounties.

I initially built a Google Sheets system to manage research, scripts, submissions, and earnings. Very quickly, I realized the biggest problem wasn't organization. It was the amount of manual work required before creating a single piece of content.

Every bounty required me to find opportunities, read requirements, research projects, generate ideas, create scripts, track deadlines, and submit deliverables.

While documenting this process, I came across the Qwen Cloud Global AI Hackathon and decided to build the solution I wished I already had.

That solution became BountyPilot AI.

## What I Learned

### Qwen as an Orchestrator, Not Just a Completion Engine

My first instinct was to use Qwen the way most people use LLMs: send a prompt, parse the response, move on. That approach hit a ceiling fast — JSON extracted via regex is fragile, single-turn calls can't reason across steps, and there's no principled way to let the model make decisions.

The real unlock was **native function/tool calling**. When you hand Qwen a JSON Schema and tell it to call `submit_bounty_score`, the response is structured data with type guarantees — not a string you hope parses. This completely changed the reliability profile of the AI layer.

The scoring model uses a hybrid approach. The rule-based component gives a baseline score of 5, then adjusts based on reward size and deadline proximity:

- Reward adjustments: +2 if $5,000 or above, +1.5 if $1,500 or above, +0.5 if $500 or above, -1 if below $100
- Deadline adjustments: -3 if already passed, -1 if under 3 days remain, +1 if over 14 days remain, +0.5 if over 7 days remain

The score is clamped to a 1-10 range. Qwen then refines this with a personalized AI score that incorporates creator profile, format fit, and requirement clarity — dimensions the rule function can't see. The final score is the AI score clamped to 1-10, falling back to the rule-based baseline if the API is unavailable.

### The Model Context Protocol

I had never implemented an MCP server before this project. Reading the spec for the first time made the concept click: MCP is to AI tools what REST is to HTTP services — a standard handshake (initialize, then tools/list, then tools/call) that any compliant client can speak without knowing your implementation. Building BountyPilot as an MCP server means Claude Desktop, Cursor, or any future agent can call `run_pipeline` on a bounty URL and get back the full intelligence package. The capability becomes composable.

### Agentic Pipelines

The most important lesson was the difference between sequential AI calls and an agent loop. In a sequential setup you decide what to generate and call three functions. In an agent loop, the model decides — it calls `score_bounty`, reads the result, then chooses whether to call `generate_research_brief` based on its own judgment. The tool call log becomes auditable reasoning. This made the system feel genuinely intelligent rather than scripted.

## How I Built It

### Architecture Overview

The project is a full-stack SaaS in a pnpm monorepo with two main artifacts:

- **Frontend**: A React + Vite SPA at `bountypilot/` that handles JWT authentication, plan-gated routing, a sticky trial countdown banner, and an admin panel for managing user tiers.
- **Backend**: An Express API server at `api-server/` compiled by esbuild, with routes grouped by domain: auth, bounties, research briefs, production plans, submissions, earnings, discover, admin, and the new MCP endpoint.
- **Database**: PostgreSQL managed by Drizzle ORM, with tables for users, bounties, research briefs, production plans, submissions, earnings, and waitlist.
- **AI layer**: Three layers of increasing sophistication — plain text completion for research briefs, single tool calls for structured data (scores and plans), and multi-turn agent loops for the full pipeline.
- **Autonomous crawler**: Runs on a configurable cron schedule. Pulls bounties from 25+ platforms using dedicated API fetchers for Superteam Earn, First Dollar, Gitcoin Grants, Galxe (GraphQL), and Zealy (REST). Falls back to HTML scraping with a headless browser for SPAs that return empty HTML.
- **MCP Server**: A JSON-RPC 2.0 endpoint at POST /api/mcp that implements the full MCP handshake with five tools: list_bounties, score_bounty, run_pipeline, get_bounty_brief, and get_crawler_stats.

### AI Layer: Three Tiers

**Tier 1: Plain text completion** — `callQwen` is used for research briefs, which are free-form markdown. The prompt asks for 14 sections covering executive summary, product breakdown, market positioning, 20 content angles, 10 video hooks, 10 thread hooks, visual ideas, and key sources.

**Tier 2: Structured tool calling** — `callQwenWithTool` is used for bounty scoring and production plans. Instead of parsing free text, Qwen receives a JSON Schema defining the expected output fields and returns a structured tool call. The type system guarantees that `opportunityScore` is always an integer between 1 and 10, and `estimatedHours` is always a positive integer.

**Tier 3: Agentic orchestration** — `runQwenAgentLoop` runs a multi-step conversation where Qwen can call any of four tools: `score_bounty`, `generate_research_brief`, `generate_production_plan`, and `finalize_pipeline`. The model scores the bounty first, then decides whether to generate a brief based on the score, then generates the plan, and finally returns a recommendation. The loop runs up to 8 iterations, and every tool call and result is logged for auditability.

### Access Tier System

The SaaS layer uses a four-state plan model with time-aware logic:

- Before August 7, 2026: all signups get free access until the hackathon judging deadline
- August 7-10: existing users get a 3-day grace window while subscriptions are being built
- After August 7 (new signups): 7-day trial from the signup date

The effective trial end is computed on both backend and frontend from a single rule: if the stored trial end date is at or before the hackathon deadline (within 60 seconds), and the deadline has passed, the effective end is the deadline plus 3 days. This ensures the grace period applies consistently across all pre-deadline users.

### The Autonomous Crawler

The crawler has a three-layer fallback strategy:

1. **API fetchers** — Dedicated integrations for platforms with public APIs: Superteam Earn's REST API, First Dollar's REST API, Gitcoin's Grants Stack API, Galxe's GraphQL endpoint, and Zealy's REST quests API.
2. **Next.js data extraction** — For platforms that render with Next.js, the crawler extracts the `__NEXT_DATA__` script tag from the HTML and parses the embedded JSON to find bounty URLs.
3. **Headless browser** — For SPAs that return empty HTML to a plain fetch, the crawler uses a headless Chromium instance to render the page and extract links.

Each platform is processed with a 2-second delay between platforms and a 1.5-second delay between individual bounty scrapes to avoid rate limiting.

### MCP Server Design

The MCP server is a separate Express router mounted at `/api/mcp`. It handles two HTTP methods:

- GET /api/mcp returns a server manifest with tool descriptions and usage examples
- POST /api/mcp accepts JSON-RPC 2.0 requests. The standard MCP lifecycle is: `initialize` (handshake), `tools/list` (discover available tools), `tools/call` (execute a tool with arguments)

All five tools are implemented as async functions that interact with the database, the Qwen API, or the scraper. The `run_pipeline` tool is the most powerful: it takes a bounty URL, runs the full agentic pipeline, and returns a complete intelligence package with the score, research brief, production plan, and the agent's own recommendation.

## Challenges

**Web3 platform diversity is brutal.** Every bounty platform renders differently. Some are Next.js apps that return empty HTML to a plain fetch. Some have public JSON APIs. Some are behind Cloudflare. The crawler has three fallback layers — Next.js data extraction, generic link pattern matching, and a headless Chromium browser — each tried in sequence.

**Making the agent loop reliable.** Early versions of the agent loop would sometimes exhaust their iteration budget without calling `finalize_pipeline`, especially on low-reward bounties where Qwen decided the brief wasn't worth generating and had nothing left to do. The fix was a hard fallback after the loop: if the agent decision is still empty, use the final message content instead. The system degrades gracefully at every layer.

**Structured output without hallucination.** Prompt-engineered JSON responses occasionally returned fields with wrong types — a quoted string instead of a number, or a missing required key. Native function calling eliminated this class of bug entirely: the JSON Schema is enforced at the API level, and the TypeScript generic makes the type flow through the call site.

**Time-zone edge cases in trial logic.** "August 7, 10pm GMT+1" encodes to an explicit UTC timestamp. The UK observes BST in August, which is actually UTC+1, making the deadline 9pm UTC (or 21:00 UTC). Encoding the deadline as an explicit ISO string and doing all comparisons in UTC avoided ambiguity.

**GitHub push from a sandboxed environment.** The deployment environment blocks git push. The workaround was using the GitHub Trees/Commits/Refs API directly: read all tracked files, create a new tree blob, create a commit pointing to it, and PATCH the ref — all via authenticated fetch calls. It's more verbose than `git push origin main` but it works reliably.

---

Built with QwenCloud | Deployed at bountypilot.xyz
