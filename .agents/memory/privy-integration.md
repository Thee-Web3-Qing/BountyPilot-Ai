---
name: Privy Integration
description: How Privy auth is wired into BountyPilot alongside existing JWT/Google/OTP auth.
---

## Setup

- `@privy-io/react-auth@3.31.0` installed. pnpm hoisting does NOT auto-create symlink in artifact's `node_modules` — must manually create: `mkdir -p artifacts/bountypilot/node_modules/@privy-io && ln -sfn <store-path> artifacts/bountypilot/node_modules/@privy-io/react-auth`
- `VITE_PRIVY_APP_ID` env var required on frontend.
- `PrivyProvider` wraps entire app in `App.tsx` (outermost, wrapping `GoogleAuthProvider`).

## Config quirk (v3.31)

`embeddedWallets.createOnLogin` is no longer top-level — it must be nested:
```ts
embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } }
```
Using the flat `createOnLogin` at the top level causes a TS error.

## Auth flow

1. User clicks "Continue with Privy" → `usePrivy().login()` opens Privy modal.
2. After Privy auth, `privyAuthenticated` becomes true in a `useEffect`.
3. Effect calls `getAccessToken()` then POSTs to `/api/auth/privy` with the Privy access token.
4. Backend verifies via `https://auth.privy.io/api/v1/users/me` (bearer token + `privy-app-id` header).
5. Backend upserts user by `privyId`, extracts email/wallet from `linked_accounts` array, returns BountyPilot JWT.
6. Frontend stores JWT in localStorage, calls `refreshUser()`, navigates.

## DB columns

`privy_id TEXT UNIQUE` and `wallet_address TEXT` added to `users` table.

**Why:** Privy users may not have a password or Google ID; need a separate identity anchor.

## How to apply

When adding new auth providers: follow same pattern — useEffect on `authenticated`, exchange token with backend, store JWT, call refreshUser().
