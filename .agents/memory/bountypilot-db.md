---
name: BountyPilot DB migration
description: DB migration command and schema additions for BountyPilot.
---

## Correct migration command
```
cd lib/db && pnpm run push
```
NOT `db:push` — that script doesn't exist.

## Schema additions
- `users` table: id, email (unique), username (unique), password_hash, timestamps
- `user_profiles` table: userId (FK to users), all creator profile fields (platforms, niche, skill level, etc.)
- `bounties` table: added `user_id` (integer) and `confidence_score` (integer)
- `submissions` table: added `user_id` (integer)
- `earnings` table: added `user_id` (integer)

**Why:** Multi-user SaaS — all data is scoped per user. confidence_score reflects extraction quality (0-99) calculated in scraper.ts.

**How to apply:** Any new table that stores user-generated content should have a `user_id` column and all queries should filter by it.
