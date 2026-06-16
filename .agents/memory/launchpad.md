---
name: Launchpad Campaign Hub
description: Launchpad redesigned into a campaign hub with 4 isolated referral campaigns + enrollment tracking.
---

# Launchpad Campaign Hub

## Architecture

The Launchpad (`/launchpad`) is now a campaign hub. Each campaign has an isolated leaderboard and individual detail page at `/launchpad/campaign/:slug`.

**4 campaign slugs (completely isolated):**
- `crypto-50` — monthly paid referrals only (tier = "monthly" OR tier IS NULL AND plan = "active")
- `free-access` — free signups (plan NOT IN active/lifetime)
- `yearly-challenge` — yearly subscribers (tier = "yearly")
- `lifetime-challenge` — lifetime members (tier = "lifetime" OR plan = "lifetime")

## DB Tables

- `campaign_enrollments` (id, user_id, campaign_slug, joined_at) — UNIQUE(user_id, campaign_slug)
- `referrals.tier` — "monthly" / "yearly" / "lifetime" / NULL. Set by dextopus webhook on payment completion (ALL tiers now, not just yearly/lifetime).

## Key API Endpoints

- `GET /api/referrals/campaigns` — list all 4 campaigns with enrollment counts + user enrollment status (optional auth)
- `POST /api/referrals/campaigns/:slug/join` — enroll (requireAuth)
- `GET /api/referrals/campaigns/:slug/leaderboard` — isolated leaderboard per campaign (optional auth)

## Isolation Rule (confirmed by user)

Each campaign is completely isolated — a yearly referral does NOT count toward the crypto-50 board or any other campaign. Each referral goes to exactly one campaign based on the referred user's plan/tier.

**Why:** User explicitly confirmed this — "you can't use yearly referrals to win in monthly campaign and vice versa."

## Frontend Files

- `artifacts/bountypilot/src/pages/launchpad.tsx` — campaign hub (4 clickable cards with live enrollment counts)
- `artifacts/bountypilot/src/pages/launchpad-campaign.tsx` — campaign detail page (join button, leaderboard, milestone progress for yearly/lifetime, referral link, prizes)
- Routes added to `artifacts/bountypilot/src/App.tsx`: `/launchpad/campaign/:slug`
