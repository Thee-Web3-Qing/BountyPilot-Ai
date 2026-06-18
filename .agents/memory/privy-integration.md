---
name: Privy Integration
description: How Privy auth is wired into BountyPilot alongside existing JWT/Google/OTP auth.
---

## Setup

- `@privy-io/react-auth@3.31.0` installed. pnpm hoisting does NOT auto-create symlink in artifact's `node_modules` — must manually create: `mkdir -p artifacts/bountypilot/node_modules/@privy-io && ln -sfn <store-path> artifacts/bountypilot/node_modules/@privy-io/react-auth`
- `VITE_PRIVY_APP_ID` env var required on frontend. `PRIVY_APP_SECRET` secret for backend API calls.
- `PrivyProvider` wraps entire app in `App.tsx` (outermost provider).
- Google login removed from UI — Privy handles all social logins including Google.

## Config quirk (v3.31)

`embeddedWallets.createOnLogin` is no longer top-level — it must be nested:
```ts
embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } }
```

## CRITICAL: Token verification

Privy v3+ tokens are **RS256** (asymmetric, signed by Privy's private key). Do NOT attempt `jwt.verify(token, appSecret, { algorithms: ['HS256'] })` — this will always fail.

The App Secret is for authenticating **server-to-server admin API calls**, not for JWT signature verification.

**Correct approach:** Call `https://auth.privy.io/api/v1/users/me` with:
- `Authorization: Bearer <accessToken>`
- `privy-app-id: <appId>`
- `privy-app-secret: <appSecret>` (optional, for authenticated calls)

This both verifies the token AND returns the user's `linked_accounts` in one call.

**Why:** Attempted local HS256 verification broke login with "Invalid Privy token". Always use the API endpoint approach.

## Auth flow

1. User clicks "Continue with Privy" → `usePrivy().login()` opens Privy modal.
2. After Privy auth, `privyAuthenticated` becomes true in a `useEffect`.
3. Effect calls `getAccessToken()` then POSTs to `/api/auth/privy` with the access token.
4. Backend calls `/api/v1/users/me` to verify token and get `linked_accounts`.
5. Backend upserts user by `privyId`, extracts email/wallet, returns BountyPilot JWT.
6. If no email (e.g. X/Twitter), returns `{ needsEmailLink: true }` → frontend shows email prompt.
7. Frontend stores JWT in localStorage, calls `refreshUser()`, navigates.

## DB columns

`privy_id TEXT UNIQUE` and `wallet_address TEXT` on `users` table.

## How to apply

When adding new auth providers: follow same pattern — useEffect on `authenticated`, exchange token with backend, store JWT, call refreshUser().
