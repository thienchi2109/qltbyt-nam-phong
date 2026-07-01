# Design: ZBS phone notifications for repair requests

## Context

The target workflow is narrow: when `repair_request_create` successfully creates a row in `yeu_cau_sua_chua`, the system should notify one or more configured Zalo recipients by phone number for the same tenant (`don_vi_id`) as that repair request.

Official ZBS docs separate the main choices:

- Phone delivery uses `POST https://business.openapi.zalo.me/message/template` with `phone`, `template_id`, `template_data`, and `tracking_id`.
- UID delivery uses `POST https://openapi.zalo.me/v3.0/oa/message/template` with `user_id`, `template_id`, and `template_data`.
- ZBS templates are structured messages registered and reviewed by Zalo Business Solutions. A template can be used for both phone and UID delivery, but each send request must match the approved template data shape.
- Webhooks are inbound events from Zalo to the app. For phone sends, delivery events include `event_name=user_received_message`, recipient phone, `msg_id`, `tracking_id`, and delivery time, signed by `X-ZEvent-Signature`.

## Goals / Non-Goals

Goals:

- Send repair-request creation notifications through ZBS to specific normalized phone numbers.
- Avoid blocking repair request creation when Zalo is unavailable.
- Preserve one logical notification per repair request recipient.
- Preserve tenant isolation: a repair request from tenant A must only notify tenant A recipients.
- Keep the outbox schema reusable for future event types, while implementing only repair-request creation now.
- Keep Zalo secrets and access tokens server-side.
- Record provider IDs, delivery events, retries, and failure metadata for operations.

Non-goals:

- Zalo Bot group chat delivery.
- Capturing group `chat.id`.
- UID sending in the first implementation.
- Per-department, role, or shift routing inside a tenant.
- Cross-tenant fallback recipient routing.
- Transfer-request notification behavior.
- In-app notification UI.
- Enqueueing notifications for other event types.

## Decisions

- Primary channel: ZBS Template Message via phone number.
  - Reason: the requirement is to send to a specific Zalo phone number, and official ZBS phone docs support that directly.
- Recipient identity: normalized phone number in Vietnam country format.
  - Example accepted by docs: `84987654321` or `+84987654321`.
  - Store only values needed for dispatch and audit. Avoid logging access tokens or full raw provider payloads if they contain sensitive data.
- Recipient routing: configure recipients by tenant and event type.
  - A recipient configuration row should include `don_vi_id`, `event_type='repair_request_created'`, normalized `recipient_phone`, active status, and optional display/owner metadata.
  - Multiple active recipient configuration rows are allowed for the same `don_vi_id` and `event_type`.
  - Each active recipient gets an independent outbox row and send attempt.
  - Do not store comma-separated phone lists. Each phone number must be stored as one recipient configuration row.
  - Department-level routing inside a tenant is intentionally out of scope.
  - Do not use a global fallback recipient. If no active recipient exists for the repair request's `don_vi_id`, leave the event unsent/inspectable rather than notifying the wrong tenant.
- Event model: keep the outbox generic enough for future ZBS events.
  - Use `event_type`, `source_type`, and `source_id` instead of hardcoding only `repair_request_id`.
  - This change only enqueues `event_type='repair_request_created'` with `source_type='repair_request'`.
  - A future transfer notification can add `event_type='transfer_request_created'` and `source_type='transfer_request'` without replacing the outbox schema.
- Template dependency: production dispatch stays disabled until the OA/ZBS template is approved and `template_id` plus expected `template_data` fields are configured.
  - A repair-request template should likely be Tag 2 `CUSTOMER_CARE`, because it is a service/operational notification rather than marketing.
- Token lifecycle:
  - Do not use a static `ZALO_ZBS_ACCESS_TOKEN` Vercel env var as the production source of truth.
  - Access tokens are short-lived. The dispatcher must load a still-valid access token from durable server-only state or refresh it before live sends.
  - Vercel env should hold only bootstrap/static secret material: `ZALO_ZBS_APP_ID`, `ZALO_ZBS_APP_SECRET`, and an initial refresh token or equivalent approved secret source.
  - Token state must be durable and server-only: current access token, access-token expiry, current refresh token, refresh-token issue/expiry metadata when available, last refresh timestamp, and sanitized last refresh error metadata.
  - Refresh success must persist access token and any rotated refresh token atomically. If concurrent refresh attempts happen, stale refresh-token writes must fail rather than overwrite newer state.
  - Refresh failure must not log plaintext access tokens, refresh tokens, app secret, or provider payloads containing tokens. Claimed outbox rows should fail with clear sanitized internal/provider error metadata.
- Enqueue point: update the latest `repair_request_create` implementation to insert outbox rows after the repair request insert/audit work succeeds.
  - The RPC signature should remain unchanged.
  - Enqueue must derive `don_vi_id` from the created repair request row, not from unaudited client input.
  - Enqueue must join active recipient configuration on the same `don_vi_id` and `event_type`.
  - Enqueue must be idempotent on `(event_type, source_type, source_id, recipient_config_id)` or an equivalent logical key.
  - One recipient failure must not block or roll back other recipients for the same source event after the repair request has been created.
- Dispatch shape:
  - Dispatcher reads pending outbox rows.
  - Before the first live send in a batch, dispatcher obtains a managed access token from the token lifecycle component.
  - Builds `template_data` from repair request and equipment context.
  - Calls the phone endpoint with `tracking_id` derived from the outbox event ID.
  - Stores Zalo `msg_id`, send timestamp, quota metadata when returned, and provider response status.
- Delivery webhook:
  - Webhook is not the trigger that sends notifications. It is only the inbound callback path after our dispatcher has sent a ZBS message.
  - Implement only after the outbound send path has stable tracking IDs.
  - Validate `X-ZEvent-Signature` using the documented SHA-256 signature input before trusting payloads.
  - Match delivery events by `tracking_id` first, then `msg_id` as secondary metadata.
- UID path:
  - Do not implement in this change. UID requires OA-scoped `user_id`, which the current requirement does not provide.
  - If added later, model it as a second recipient identifier type rather than replacing phone delivery.

## Data Flow

1. User creates a repair request in the app.
2. Existing client/API flow calls `repair_request_create`.
3. RPC validates tenant/role claims and creates the repair request as it does today.
4. RPC reads the created repair request's `don_vi_id`.
5. RPC enqueues one pending ZBS phone notification for each active recipient configured for that same `don_vi_id` and `event_type='repair_request_created'`.
6. If no active recipient exists for that `don_vi_id`, no cross-tenant fallback is used.
7. A server-side dispatcher claims pending rows for live dispatch.
8. The dispatcher loads a durable valid access token or refreshes it from the durable/bootstrap refresh token.
9. If token refresh fails, dispatcher records sanitized token-refresh error metadata and marks claimed rows failed/retryable according to the token error class.
10. If a valid access token is available, dispatcher sends pending rows through the ZBS phone endpoint.
11. Zalo returns success or failure; dispatcher updates outbox status and retry metadata.
12. Zalo later posts delivery webhook events; webhook route validates the signature and updates delivery status.

## Slice Boundaries

- Slice 0, Zalo readiness: no repository runtime code is required. The output is approved operational inputs: permission, template ID, template field list, credentials owner, and one test recipient phone.
- Slice 1, tenant-scoped data contract: recipient configuration by `don_vi_id` and `event_type`, generic outbox schema, and `repair_request_create` enqueue behavior only. No outbound HTTP client is introduced in this slice.
- Slice 2, dispatcher dry-run: request construction and data mapping only. The dispatcher can produce the exact ZBS request payload for inspection, but production sending remains gated off.
- Slice 3, token lifecycle: server-only token state, refresh-token bootstrap, access-token refresh, atomic rotated-token persistence, sanitized refresh failure handling, and no token leakage.
- Slice 4, live send: outbound HTTP is enabled behind the dispatch feature gate and limited to configured recipients. This slice owns provider response persistence and retry transitions.
- Slice 5, delivery webhook: inbound callback processing is added after stable `tracking_id` behavior exists.
- Slice 6, rollout/ops: production enablement is treated as an operational slice with runbook, monitoring, smoke test, and rollback path.

## Risks / Trade-offs

- Phone delivery requires the recipient phone number to be linked to a Zalo account. Invalid or unlinked phone numbers must fail visibly in the outbox.
- Tenant-scoped routing is safety-critical. The enqueue tests must prove tenant A repair requests cannot notify tenant B recipients.
- Multiple recipients in one tenant mean partial delivery is possible. Status and retry metadata must be per recipient, not per source event only.
- ZBS requires approved templates. Implementation cannot be fully production-ready until the real template and field names are known.
- Zalo access tokens are short-lived and refresh tokens can rotate. Static access-token env deployment is not production-safe; token state must be durable and refresh failures must be operator-visible without leaking secrets.
- Webhook delivery time is distinct from webhook receipt time; store both if callback support is implemented.
- Delayed notification is safer than duplicate notification for this workflow; retries must preserve idempotency.

## Verification

- Validate the OpenSpec change with `openspec validate add-zalo-repair-request-zbs-phone-notifications --strict`.
- During implementation, follow repo gates for TypeScript/React and SQL changes.
- Apply any DB migration through Supabase MCP only.
- Before enabling production dispatch, perform a live smoke test to a controlled phone number using the approved template.
