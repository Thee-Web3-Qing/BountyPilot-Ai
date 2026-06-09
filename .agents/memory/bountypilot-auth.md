---
name: BountyPilot Auth
description: JWT auth architecture for BountyPilot — token storage, injection, and middleware pattern.
---

## Pattern
- JWT signed with `process.env.JWT_SECRET || "bountypilot-dev-secret-2025"`, 30-day expiry
- Token stored in `localStorage` under key `bountypilot_token`; user object under `bountypilot_user`
- Frontend calls `setAuthTokenGetter(() => localStorage.getItem("bountypilot_token"))` on mount — this injects `Authorization: Bearer <token>` on every API call automatically via the existing custom-fetch.ts in api-client-react
- All API routes protected via `requireAuth` middleware from `artifacts/api-server/src/lib/auth.ts`
- Auth routes at `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/profile`
- Signup always creates an empty `user_profiles` row for the new user

**Why:** The api-client-react custom-fetch already has `setAuthTokenGetter` built in — this is the correct injection point, no need to modify generated code.

**How to apply:** When adding new protected routes, add `requireAuth` as the first middleware on the router (e.g. `router.use(requireAuth)`). All data queries must include `WHERE user_id = req.user.userId`.
