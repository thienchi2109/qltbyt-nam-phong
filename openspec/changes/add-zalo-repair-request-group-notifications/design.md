## Context
The target workflow is narrow: when a user creates a repair request through the existing `repair_request_create` RPC, the hospital's existing Zalo group should receive one text alert.

Zalo Bot documentation separates two directions:
- Webhook is inbound: Zalo calls the application over HTTPS when users or group chats interact with the bot.
- `sendMessage` is outbound: the application calls Zalo Bot API with a `chat_id` and text.

The current hospital group exists, but the Zalo Bot does not. The implementation must support setup before production notification dispatch is enabled.

## Goals / Non-Goals
- Goals: create a fixed-group Zalo notification path for new repair requests, make onboarding observable, avoid blocking repair request creation on Zalo outages, and keep secrets server-side.
- Non-goals: per-khoa/phong routing, user-level subscription preferences, Firebase/browser push replacement, notification UI inside the app, two-way repair workflow commands in Zalo, or notifications for transfer/maintenance events.

## Decisions
- Group scope: use one fixed `ZALO_REPAIR_GROUP_CHAT_ID` for the whole hospital in this change.
- Webhook role: implement webhook only for inbound Zalo event validation and onboarding diagnostics. It must not be described as the outbound send mechanism.
- Chat ID capture: after the bot is added to the group, an operator mentions or replies to the bot; the webhook reads `result.message.chat.id` when `chat_type` is `GROUP`.
- Outbound delivery: call `https://bot-api.zaloplatforms.com/bot<BOT_TOKEN>/sendMessage` using POST JSON with `chat_id` and `text`.
- Secret handling: store `BOT_TOKEN`, webhook secret, and group chat ID in environment variables or the platform secret store; never persist bot tokens in database rows or logs.
- Reliability: repair request creation writes a durable pending notification event in the same transaction as the request/audit work, then a server-side dispatcher sends and marks success/failure. A Zalo outage must not roll back the repair request.
- Idempotency: one repair request creation should produce at most one successful Zalo message for the configured fixed-group event. Retries should update the same outbox row rather than creating duplicate logical events.
- Message content: use Vietnamese text, include request ID, equipment code/name if available, requesting person, facility/department when available, issue summary, and an app link when a stable repair request detail/deep-link URL is available. Keep text under Zalo's 2000-character limit.
- Feature gate: outbound sending should be disabled until live bot/group smoke verification passes. Enqueue/log can be enabled earlier for dry-run verification.

## Risks / Trade-offs
- Zalo group interaction is documented as Beta/internal trial; the rollout must verify real group send capability before production enablement.
- A database trigger that calls external HTTP would reduce application code but would make retries, secret handling, and observability harder. The outbox dispatcher is more operationally explicit.
- Fixed-group scope is intentionally simple. If the hospital later wants per-facility or per-department groups, add a separate routing change instead of expanding this one silently.
- Message duplication is more damaging than delayed notification for this workflow; prefer idempotent retry status over fire-and-forget sends.

## Verification
- Validate OpenSpec with `openspec validate add-zalo-repair-request-group-notifications --strict`.
- Before implementation, verify the real Zalo setup manually: bot created, webhook configured over HTTPS, bot added to the group, inbound group event received, group `chat.id` captured, and a test `sendMessage` succeeds.
- For SQL/DB changes, use Supabase MCP only, preserve `SECURITY DEFINER`, `SET search_path = public, pg_temp`, grants/revokes, JWT guards, and run Supabase security advisor after applying migrations.
- For TypeScript/React route/client changes, run repo gates in the required order: `verify:no-explicit-any`, `typecheck`, focused tests, and React Doctor diff scan.

