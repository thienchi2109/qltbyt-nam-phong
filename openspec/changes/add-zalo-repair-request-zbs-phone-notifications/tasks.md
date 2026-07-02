## 0. Zalo Readiness

- [ ] 0.1 Confirm the OA, Zalo App, and ZBS Account are linked and enabled for ZBS Template Message.
- [ ] 0.2 Request/approve the repair-request notification template.
- [ ] 0.3 Record the approved `template_id` and exact `template_data` field names in deployment configuration.
- [ ] 0.4 Confirm the app has the "Gửi tin qua số điện thoại" permission.
- [ ] 0.5 Configure a controlled recipient phone number in normalized country-code format for smoke testing.
- [ ] 0.6 Stop before implementation if the approved template and field list are unavailable.

## 1. Tenant-Scoped Data Contract / SQL

- [ ] 1.1 Add failing SQL smoke coverage proving a tenant A repair request enqueues notifications only for active tenant A recipients.
- [ ] 1.2 Add failing SQL smoke coverage proving a tenant B repair request does not enqueue tenant A recipients.
- [ ] 1.3 Add failing SQL smoke coverage proving no cross-tenant fallback occurs when the created repair request's tenant has no active recipients.
- [ ] 1.4 Add failing SQL smoke coverage proving multiple active recipients in the same tenant each receive one independent outbox row.
- [ ] 1.5 Add a tenant-scoped ZBS recipient configuration schema with `don_vi_id`, `event_type`, one normalized recipient phone per row, active status, and audit timestamps.
- [ ] 1.6 Add an idempotent generic ZBS notification outbox/log schema with `event_type`, `source_type`, `source_id`, `don_vi_id`, recipient configuration ID, recipient phone, template ID, template data snapshot, tracking ID, status, retry metadata, provider response metadata, and timestamps.
- [ ] 1.7 Update the latest `repair_request_create` implementation to derive `don_vi_id` from the created repair request row and enqueue pending `repair_request_created` ZBS phone notifications only for matching active recipient configuration without changing the RPC signature.
- [ ] 1.8 Preserve existing repair request tenant/department guards, `SECURITY DEFINER`, `SET search_path = public, pg_temp`, grants/revokes, and audit behavior.
- [ ] 1.9 Apply migration through Supabase MCP only, then run focused SQL smoke tests and `get_advisors(security)`.

## 2. Dispatcher Dry-Run

- [ ] 2.1 Add failing unit tests for phone normalization and rejection of invalid/unconfigured recipients.
- [ ] 2.2 Add failing unit tests for mapping repair request context to the approved ZBS `template_data` fields.
- [ ] 2.3 Add failing unit tests for ZBS phone API request construction: endpoint, method, `access_token` header, `phone`, `template_id`, `template_data`, and `tracking_id`.
- [ ] 2.4 Implement dispatcher request construction behind a dry-run or disabled-dispatch feature gate.
- [ ] 2.5 Verify dry-run output without making outbound Zalo API calls.

## 3. Token Lifecycle

- [ ] 3.1 Add failing unit tests for using a still-valid durable access token without refresh.
- [ ] 3.2 Add failing unit tests for refreshing a missing/expired/near-expired access token.
- [ ] 3.3 Add failing unit tests for persisting rotated refresh tokens and expiry metadata atomically.
- [ ] 3.4 Add failing unit tests proving refresh failures record sanitized metadata and do not leak plaintext tokens in errors/logs.
- [ ] 3.5 Add a server-only durable token-state schema for access token, access-token expiry, refresh token, refresh-token issue/expiry metadata, refresh timestamp, and sanitized refresh error metadata.
- [ ] 3.6 Add service-role-only RPCs for reading token state, persisting refresh success, and recording refresh errors.
- [ ] 3.7 Implement the server-side ZBS token manager using `ZALO_ZBS_APP_ID`, `ZALO_ZBS_APP_SECRET`, and bootstrap refresh token material instead of static `ZALO_ZBS_ACCESS_TOKEN`.
- [ ] 3.8 Apply migration through Supabase MCP only, then run targeted metadata checks and `get_advisors(security)`.

## 4. Live Send Path

- [ ] 4.1 Add tests for successful ZBS phone API responses and persisted provider metadata.
- [ ] 4.2 Add tests for retryable and non-retryable provider/network errors.
- [ ] 4.3 Add tests proving one failed recipient send does not mark other recipients for the same source event as failed.
- [ ] 4.4 Add tests proving token refresh failure marks claimed rows failed/retryable without outbound Zalo sends.
- [ ] 4.5 Enable outbound calls to `POST https://business.openapi.zalo.me/message/template` behind the dispatch feature gate using the managed access token.
- [ ] 4.6 Store successful `msg_id`, provider send timestamp, quota metadata when returned, and raw error classification per outbox row without logging secrets.
- [ ] 4.7 Implement retry transitions for retryable provider/network failures per outbox row.
- [ ] 4.8 Run a controlled live smoke test to the configured test phone number before any production enablement.

## 5. Webhook / Delivery Status

- [ ] 5.1 Add route-handler tests for validating `X-ZEvent-Signature`.
- [ ] 5.2 Add route-handler tests for `event_name=user_received_message` delivery events with `msg_id`, `tracking_id`, recipient phone, and delivery time.
- [ ] 5.3 Implement the ZBS delivery webhook route.
- [ ] 5.4 Match webhook events to outbox rows by `tracking_id` first.
- [ ] 5.5 Document webhook URL setup and secret rotation.

## 6. Runbook / Production Rollout

- [x] 6.1 Document required env vars and secret ownership, including app ID, app secret, initial refresh token, and removal of static access-token env dependency.
- [x] 6.2 Document template approval, recipient phone normalization, refresh-token bootstrap, and smoke-test steps.
- [x] 6.3 Document monitoring queries for pending, failed, sent, delivered notification rows, and token refresh state.
- [x] 6.4 Document rollback: disable dispatch feature gate while preserving outbox rows and token state.
- [x] 6.5 Run quality gates required by the touched files.
- [x] 6.6 Record rollout decision: enable production dispatch only after smoke test succeeds and monitoring path is confirmed.
