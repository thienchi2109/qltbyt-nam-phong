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

## 3. Live Send Path
- [ ] 3.1 Add tests for successful ZBS phone API responses and persisted provider metadata.
- [ ] 3.2 Add tests for retryable and non-retryable provider/network errors.
- [ ] 3.3 Add tests proving one failed recipient send does not mark other recipients for the same source event as failed.
- [ ] 3.4 Enable outbound calls to `POST https://business.openapi.zalo.me/message/template` behind the dispatch feature gate.
- [ ] 3.5 Store successful `msg_id`, provider send timestamp, quota metadata when returned, and raw error classification per outbox row without logging secrets.
- [ ] 3.6 Implement retry transitions for retryable provider/network failures per outbox row.
- [ ] 3.7 Run a controlled live smoke test to the configured test phone number before any production enablement.

## 4. Webhook / Delivery Status
- [ ] 4.1 Add route-handler tests for validating `X-ZEvent-Signature`.
- [ ] 4.2 Add route-handler tests for `event_name=user_received_message` delivery events with `msg_id`, `tracking_id`, recipient phone, and delivery time.
- [ ] 4.3 Implement the ZBS delivery webhook route.
- [ ] 4.4 Match webhook events to outbox rows by `tracking_id` first.
- [ ] 4.5 Document webhook URL setup and secret rotation.

## 5. Runbook / Production Rollout
- [ ] 5.1 Document required env vars and secret ownership.
- [ ] 5.2 Document template approval, recipient phone normalization, and smoke-test steps.
- [ ] 5.3 Document monitoring queries for pending, failed, sent, and delivered notification rows.
- [ ] 5.4 Document rollback: disable dispatch feature gate while preserving outbox rows.
- [ ] 5.5 Run quality gates required by the touched files.
- [ ] 5.6 Record rollout decision: enable production dispatch only after smoke test succeeds and monitoring path is confirmed.
