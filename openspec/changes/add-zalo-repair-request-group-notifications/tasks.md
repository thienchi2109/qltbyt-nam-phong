## 1. Zalo Bot Onboarding
- [ ] 1.1 Create the Zalo Bot and capture the `BOT_TOKEN` in the deployment secret store.
- [ ] 1.2 Configure a production HTTPS webhook with `setWebhook` and a generated `ZALO_WEBHOOK_SECRET_TOKEN`.
- [ ] 1.3 Add the bot to the existing hospital Zalo group.
- [ ] 1.4 Trigger an inbound group event by mentioning or replying to the bot, then capture the group `chat.id`.
- [ ] 1.5 Run a manual `sendMessage` smoke test to the captured group `chat.id` before enabling production dispatch.

## 2. Data Contract / SQL
- [ ] 2.1 Add failing SQL smoke coverage for repair request creation enqueueing one pending Zalo notification event.
- [ ] 2.2 Add an idempotent notification outbox/log schema for Zalo repair request notifications, including request ID, fixed event key, status, retry metadata, provider response metadata, and timestamps.
- [ ] 2.3 Update the latest `repair_request_create` implementation to enqueue the pending notification event after successful insert/audit work without changing the RPC signature.
- [ ] 2.4 Preserve existing repair request tenant/department guards, `SECURITY DEFINER`, `SET search_path = public, pg_temp`, grants/revokes, and audit behavior.
- [ ] 2.5 Run focused SQL smoke tests and Supabase MCP `get_advisors(security)` after applying the migration.

## 3. Webhook / Configuration
- [ ] 3.1 Add route-handler tests for rejecting missing or invalid `X-Bot-Api-Secret-Token`.
- [ ] 3.2 Add route-handler tests for parsing a valid Zalo group event and exposing/logging the `chat.id` without logging secrets.
- [ ] 3.3 Implement the inbound Zalo webhook route for onboarding diagnostics only.
- [ ] 3.4 Document required env vars: `ZALO_BOT_TOKEN`, `ZALO_WEBHOOK_SECRET_TOKEN`, `ZALO_REPAIR_GROUP_CHAT_ID`, and the dispatch feature gate.

## 4. Outbound Dispatcher
- [ ] 4.1 Add failing unit tests for Zalo repair request message formatting, 2000-character limit handling, and required field fallbacks.
- [ ] 4.2 Add failing unit tests for successful `sendMessage`, provider errors, retryable failures, permanent failures, and idempotent status transitions.
- [ ] 4.3 Implement a server-side Zalo Bot client that calls `sendMessage` with POST JSON and keeps the token out of logs.
- [ ] 4.4 Implement a dispatcher endpoint/job that reads pending outbox rows, sends to the fixed group, records `message_id` on success, and records error metadata on failure.
- [ ] 4.5 Ensure failed Zalo sends do not fail or roll back repair request creation.

## 5. Runbook / Verification
- [ ] 5.1 Add a Vietnamese runbook for bot creation, webhook setup, group onboarding, chat ID capture, env setup, smoke test, and rollback/disable steps.
- [ ] 5.2 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 5.3 Run `node scripts/npm-run.js run typecheck`.
- [ ] 5.4 Run focused SQL smoke tests.
- [ ] 5.5 Run focused route-handler and dispatcher tests.
- [ ] 5.6 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main` if any React/Next app code changes.
- [ ] 5.7 Run `openspec validate add-zalo-repair-request-group-notifications --strict`.

