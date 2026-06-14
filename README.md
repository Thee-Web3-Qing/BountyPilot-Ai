# BountyPilot AI

> Your creator revenue autopilot. AI-powered bounty discovery, scoring, and production planning for crypto content creators.

**Live Demo:** [bountypilot.xyz](https://bountypilot.xyz)

Built for the **Alibaba Cloud x DoraHacks Hackathon 2025** — hackathon.bounty.global

---

## What It Does

BountyPilot is an AI agent that hunts, scores, and plans around Web3 bounties so you can focus on shipping.

| Feature | What It Does |
|---------|--------------|
| **Auto Discovery** | Crawls 9+ bounty platforms (Devpost, Galxe, Superteam Earn, Gitcoin, etc.) hourly |
| **AI Scoring** | Qwen-powered 1-10 score on fit, difficulty, reward, and deadline |
| **Smart Filters** | "For You" personalized filter based on your skills, budget, and content format |
| **Research Briefs** | Auto-generated strategy + deliverable breakdown per bounty |
| **Production Plans** | Step-by-step timeline with word counts, tool suggestions, and milestones |
| **Pipeline** | Track bounties from discovery → claimed → submitted → earned |
| **Crypto Checkout** | Dextopus-powered — pay with any token, auto-bridged to treasury |

---

## Architecture

This is a **pnpm monorepo** with the following structure:

```
.
├── artifacts/
│   ├── bountypilot/          # React + Vite frontend (shadcn/ui, Tailwind)
│   │   ├── src/
│   │   │   ├── pages/        # Route pages (discover, bounties, profile, pricing)
│   │   │   ├── components/   # UI components (trial-gate, trial-banner)
│   │   │   └── contexts/     # Auth context (JWT, plan status, trial logic)
│   │   └── package.json
│   ├── api-server/           # Express API + Drizzle ORM + PostgreSQL
│   │   ├── src/
│   │   │   ├── routes/       # API routes (auth, bounties, discover, dextopus, research, production)
│   │   │   ├── lib/          # Core logic (scraper, crawler, qwen, access, dextopus)
│   │   │   └── lib/db.ts     # Database connection (Drizzle)
│   │   └── package.json
│   └── mockup-sandbox/       # Component preview server (canvas, design)
├── lib/
│   ├── db/                   # Shared Drizzle schema (users, bounties, submissions, earnings)
│   └── integrations/         # Shared integration packages
├── scripts/                  # Seed scripts, seed-stripe-products.ts
├── .env.example              # Environment template
├── pnpm-workspace.yaml       # Workspace configuration
└── package.json
```

### Key Technologies

- **Frontend:** React 19, Vite, Tailwind CSS v4, shadcn/ui, wouter (routing)
- **Backend:** Express, Drizzle ORM, PostgreSQL, node-cron
- **AI:** Alibaba Cloud Qwen API (via DashScope)
- **Payments:** Dextopus (crypto auto-bridging)
- **Auth:** JWT in localStorage
- **Deployment:** Replit (live at bountypilot.xyz)

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+
- PostgreSQL (or use Replit's built-in DB)

### 1. Clone & Install

```bash
git clone https://github.com/Thee-Web3-Qing/BountyPilot-Ai.git
cd BountyPilot-Ai
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your keys:

```bash
# Required
JWT_SECRET=your-jwt-secret-here
QWEN_API_KEY=your-qwen-api-key

# Optional — AI model tuning
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus-2025-07-28
QWEN_BRIEF_MODEL=qwen-turbo

# Optional — Dextopus crypto payments
DEXTOPUS_API_KEY=your-dextopus-api-key
DEXTOPUS_WEBHOOK_SECRET=your-webhook-secret
TREASURY_WALLET_ADDRESS=0x-your-treasury-wallet
```

> **Replit users:** `DATABASE_URL` and `PORT` are automatically provided.

### 3. Push Database Schema

```bash
cd lib/db && pnpm run push
```

### 4. Run Development

```bash
# Terminal 1 — API Server
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend
pnpm --filter @workspace/bountypilot run dev
```

---

## Demo Flow

1. **Sign up** → Free trial until Aug 7, 2026 (hackathon open access)
2. **Set your profile** → Skills, content formats, minimum reward
3. **Browse Discover** → "For You" filters bounties by your profile
4. **Claim a bounty** → Add to your pipeline
5. **Generate AI Research** → Click "Generate Brief" for strategy
6. **Generate Production Plan** → Click "Generate Plan" for step-by-step timeline
7. **Upgrade** → Crypto checkout via Dextopus (Monthly $5, Yearly $45, Lifetime $250)

---

## Qwen Setup

BountyPilot uses **Alibaba Cloud Qwen** via DashScope for all AI features:

| Feature | Model | Purpose |
|---------|-------|---------|
| Bounty Scoring | `QWEN_MODEL` (default: `qwen-plus-2025-07-28`) | 1-10 fit score |
| Research Briefs | `QWEN_BRIEF_MODEL` (default: `qwen-turbo`) | Strategy + deliverables |
| Production Plans | `QWEN_MODEL` | Step-by-step timeline |

### Without API Key
If `QWEN_API_KEY` is not set, the app runs in **mock mode** with rule-based fallback scoring (no AI generation).

---

## Alibaba Cloud Proof

This project is deployed and running on **Alibaba Cloud infrastructure** via the DashScope Qwen API:

- **Base URL:** `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **Models:** `qwen-plus-2025-07-28`, `qwen-turbo`
- **Features:** AI scoring, research briefs, production plans
- **API Docs:** https://help.aliyun.com/zh/dashscope/

All AI generation flows through the Qwen API endpoint configured in `QWEN_BASE_URL`.

---

## License

MIT License — see [LICENSE](./LICENSE)

---

## Hackathon Info

- **Hackathon:** Alibaba Cloud x DoraHacks 2025
- **Deadline:** August 7, 2026 (20:00 GMT+1)
- **Submission:** https://hackathon.bounty.global
- **Repo:** https://github.com/Thee-Web3-Qing/BountyPilot-Ai
