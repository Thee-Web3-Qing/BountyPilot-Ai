---
name: Telegram Alerts
description: Telegram bot integration for BountyPilot — connect flow, webhook, and notification fan-out.
---

# Telegram Alerts Integration

**Bot:** @Bountypilotaibot (token via `TELEGRAM_BOT_TOKEN` secret)

## Connect flow
- User clicks "Connect Telegram" in Settings page
- `POST /api/telegram/connect` generates a 20-byte hex one-time token, stored in `users.telegram_connect_token` (expires in 10 min)
- Returns a deep link: `https://t.me/Bountypilotaibot?start={token}`
- User opens link in Telegram, taps Start
- Webhook receives `/start {token}`, matches user, writes `users.telegram_chat_id`
- Settings page polls `/api/telegram/status` every 3s and updates UI when connected

## DB columns added to `users`
- `telegram_chat_id TEXT` — Telegram chat ID when connected
- `telegram_connect_token TEXT` — one-time connect token
- `telegram_connect_token_expires TIMESTAMPTZ` — 10-minute expiry

## Files
- `artifacts/api-server/src/lib/telegram.ts` — sendTelegramMessage(), registerWebhook(), BOT_USERNAME, isTelegramEnabled()
- `artifacts/api-server/src/routes/telegram.ts` — /status, /connect, /disconnect, /webhook, /register-webhook
- `artifacts/api-server/src/routes/notifications.ts` — fan-out on site update creation
- `artifacts/bountypilot/src/pages/settings.tsx` — Connect/Disconnect UI with polling

## Notification fan-out
When admin posts a site update via `POST /api/notifications/updates`, the handler also sends a Telegram message to all users with a `telegram_chat_id`. Fire-and-forget (errors are swallowed).

## Webhook registration
Server registers the webhook to `https://bountypilot.xyz/api/telegram/webhook` on every startup (non-fatal if it fails).

**Why:** Telegram requires a public HTTPS webhook URL — production domain is used. In dev, registration will succeed but Telegram can only reach the production server.
