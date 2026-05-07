## Why
Repair requests currently rely on users opening the application to notice new work. The hospital already has a responsible Zalo group chat, so new repair requests should also create an operational alert in that fixed group.

Zalo Bot group support is currently documented as Beta/internal trial, and the bot has not been created yet. The change therefore needs an onboarding and verification path before wiring production notifications.

## What Changes
- Add a Zalo Bot notification path for newly created repair requests.
- Use one fixed hospital Zalo group for the initial rollout; do not add khoa/phong, tenant, or role-to-group routing in this change.
- Add a webhook endpoint only for Zalo-to-app events: verifying `X-Bot-Api-Secret-Token`, capturing the group `chat.id`, and supporting onboarding diagnostics.
- Send outbound notifications by calling Zalo Bot `sendMessage` with the stored fixed group `chat_id`.
- Add a durable notification outbox/log so repair request creation does not depend on Zalo API availability and failed sends can be retried or inspected.
- Add operational setup documentation for creating the bot, configuring the webhook, adding the bot to the existing group, capturing `chat.id`, setting secrets, and running a smoke test.

## Impact
- Affected specs: `zalo-repair-notifications` (new capability)
- Affected code:
  - Supabase migration for a notification outbox/log table and any helper RPC needed by the dispatcher.
  - `repair_request_create` SQL flow to enqueue the Zalo notification event after the repair request row is created.
  - Next.js route handler for inbound Zalo webhook verification and group chat ID capture.
  - Server-side Zalo Bot client/dispatcher for `sendMessage`.
  - Environment configuration for `ZALO_BOT_TOKEN`, `ZALO_WEBHOOK_SECRET_TOKEN`, and `ZALO_REPAIR_GROUP_CHAT_ID`.
  - Runbook for Bot onboarding and smoke verification.
- Testing:
  - SQL smoke coverage for outbox enqueue behavior and repair request creation compatibility.
  - Route handler tests for webhook secret validation and group `chat.id` parsing.
  - Unit tests for Zalo message formatting, outbound API error handling, idempotency, and retry status transitions.
  - Manual live smoke test against a real Zalo Bot/group before enabling production notification dispatch.

