---
name: Payout System
description: Wallet-based referral commission payout flow — DB schema, endpoints, UI
---

## How it works
1. User accumulates "approved" commission rows in `commissions` table
2. On `/referral` page they pick network + currency and click "Request Payout"
3. `POST /api/referrals/payout` validates: wallet linked, balance ≥ $5, no in-flight payout → creates `payouts` row (status=requested), marks commissions as "processing"
4. Admin goes to `/admin` → Payouts tab, pastes tx hash, clicks Mark Paid
5. `PATCH /api/admin/payouts/:id` cascades: payouts.status → "paid", commissions → "paid", sets paid_at

## Conditions to withdraw
- `wallet_address` populated on users table (from Privy linked accounts, synced at login)
- Available balance ≥ $5
- No payout with status "requested" or "processing" already exists

## Admin tab
- Tab key: `"payouts"`, icon: `ArrowDownCircle`
- Loads from `GET /api/admin/payouts` → `{ payouts: AdminPayoutRow[] }`
- Buttons: Mark Processing / Mark Paid (with tx hash input) / Failed

## DB
- Table: `payouts` — id, user_id, wallet_address, amount, currency (USDC default), network (ethereum default), status, tx_hash, notes, created_at, paid_at

**Why:** Express 5 types make `req.params.id` type `string | string[]` — always cast with `req.params["id"] as string` before parseInt.
