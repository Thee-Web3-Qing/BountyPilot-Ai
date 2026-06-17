---
name: Novus MCP Auth
description: How Novus AI MCP authentication and transport work — OAuth2 + SSE.
---

# Novus MCP Authentication & Transport

## Credentials (all in Replit Secrets)
- `NOVUS_CLIENT_ID` — OAuth2 client ID
- `NOVUS_CLIENT_SECRET` — OAuth2 client secret
- `NOVUS_APP_ID` — required extra field for token request (Pendo app scoping)

## Token endpoint
`POST https://novus-api.pendo.io/mcp-auth/token`
- Content-Type: `application/x-www-form-urlencoded`
- Body fields: `grant_type=client_credentials`, `client_id`, `client_secret`, `scope=mcp`, `app_id`
- Returns: `{ access_token, token_type: "Bearer", expires_in: 86400 }`

## MCP endpoint
`POST https://novus-api.pendo.io/mcp`
- Authorization: `Bearer {access_token}`
- **Must send**: `Accept: application/json, text/event-stream` — omitting this returns 406
- Responses come as SSE (`text/event-stream`): parse lines starting with `data:` as JSON

## Discovery endpoints
- `/.well-known/oauth-protected-resource` — confirms auth server
- `/.well-known/oauth-authorization-server` — lists token_endpoint, registration_endpoint, grant_types

## Old NOVUS_API_KEY
The original `NOVUS_API_KEY` was a Pendo Web SDK key (wrong product). The correct auth is OAuth2 client credentials as above.

## Implementation
`artifacts/api-server/src/lib/novus.ts` — handles token caching, SSE parsing, and Qwen fallback.
50+ tools available including page/feature metrics, visitor activity, funnel analysis, session replays, NPS, signals.

**Why:** Novus uses OAuth 2.1 with Streamable HTTP (SSE) transport — not plain JSON-RPC. The Accept header and SSE parsing are both required for it to work.
