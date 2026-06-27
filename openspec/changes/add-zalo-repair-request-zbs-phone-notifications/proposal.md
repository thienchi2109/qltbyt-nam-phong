# Change: ZBS phone notifications for repair requests

## Why
Repair requests currently rely on users opening the application to notice new work. The hospital now has a Zalo Official Account and wants an automatic Zalo notification sent to a specific Zalo phone number when a repair request is created.

The existing draft `add-zalo-repair-request-group-notifications` targets Zalo Bot group chat delivery. This change intentionally replaces that rollout direction with ZBS Template Message delivery to individual recipients by phone number.

## What Changes
- Add a ZBS Template Message notification path for newly created repair requests.
- Use the official ZBS "Gửi tin Template qua SĐT" API as the primary outbound channel:
  - `POST https://business.openapi.zalo.me/message/template`
  - `access_token` header
  - `phone`, `template_id`, `template_data`, and `tracking_id` request fields
- Store target recipients as normalized phone numbers for the initial rollout.
- Configure recipients per tenant (`don_vi_id`) and event type.
- Support multiple active recipient phone numbers within the same tenant and event type.
- Use a generic event outbox shape (`event_type`, `source_type`, `source_id`) so later ZBS notifications, such as transfer-request creation, can reuse the same infrastructure.
- Implement only `repair_request_created` in this change.
- Enqueue notifications only for active recipients whose `don_vi_id` matches the created repair request's `don_vi_id`.
- Require an approved ZBS template before production dispatch is enabled.
- Add a durable notification outbox/log so repair request creation does not depend on Zalo API availability.
- Add a ZBS webhook endpoint for delivery events and quota/status diagnostics where useful.
- Keep UID-based sending as a later enhancement only if the system later stores OA-scoped `user_id` values.

## Out of Scope
- Zalo Bot group chat notifications and `chat_id` capture.
- Free-form OA consultation messages.
- Per-department recipient routing.
- Cross-tenant fallback recipients.
- Implementing transfer-request notifications; this change only keeps the schema ready for that future event type.
- User subscription preferences.
- Two-way repair workflow commands in Zalo.
- Notifications for transfers, maintenance plans, or inventory events.

## Roadmap / Review Slices
This change should be implemented in small reviewable slices:

1. Zalo readiness only: confirm OA/App/ZBS linkage, phone-send permission, approved template, exact `template_data` fields, and a controlled test phone number.
2. Tenant-scoped data contract only: add recipient configuration by `don_vi_id` and `event_type`, add the generic outbox/log schema, and update `repair_request_create` to enqueue one `repair_request_created` event per matching active recipient, without outbound Zalo calls.
3. Dispatcher dry-run only: implement phone normalization, template-data mapping, request construction, and tests behind a dry-run/disabled dispatch gate.
4. Live send path: call the ZBS phone endpoint behind the feature gate, persist `msg_id`/send metadata, classify errors, and retry safely.
5. Delivery webhook: validate ZBS webhook signatures and update delivery status from `user_received_message` events.
6. Rollout/ops: document env vars, token rotation, template setup, smoke testing, monitoring queries, and rollback by disabling dispatch.

## Impact
- Affected specs: `zalo-repair-zbs-notifications` (new capability)
- Affected code in future implementation:
  - Supabase migration for tenant-scoped ZBS recipient configuration and a generic ZBS notification outbox/log table.
  - `repair_request_create` SQL flow to enqueue one pending `repair_request_created` ZBS notification event per active recipient phone in the same tenant as the created repair request.
  - Server-side ZBS client/dispatcher for the phone API.
  - Next.js route handler for ZBS webhook event validation and delivery-status updates.
  - Environment configuration for Zalo App/OA credentials, template ID, ZBS access token handling, webhook secret material, and dispatch feature gate.
  - Runbook for template approval, phone normalization, recipient setup, and live smoke testing.
- Testing in future implementation:
  - SQL smoke coverage for tenant-scoped outbox enqueue behavior and idempotency.
  - Unit tests for ZBS message template-data mapping, phone normalization, request construction, provider error handling, retry status transitions, and delivery webhook signature validation.
  - Manual live smoke test to a controlled phone number before enabling production dispatch.

## Official Docs Reviewed
- ZBS Template Message overview: `https://developers.zalo.me/docs/zbs-template-message/bat-dau/gioi-thieu-zbs-template-message`
- ZBS API gửi tin qua SĐT: `https://developers.zalo.me/docs/zbs-template-message/gui-tin-template-qua-sdt/api-gui-tin-qua-sdt/api-gui-tin`
- ZBS API gửi tin qua UID: `https://developers.zalo.me/docs/zbs-template-message/gui-tin-template-qua-uid/api-gui-tin-qua-uid`
- ZBS webhook sự kiện người dùng nhận tin qua SĐT: `https://developers.zalo.me/docs/zbs-template-message/gui-tin-template-qua-sdt/webhook-gui-tin-qua-sdt/su-kien-nguoi-dung-nhan-tin-qua-sdt`
- Template overview: `https://developers.zalo.me/docs/zbs-template-message/quan-ly-template/bat-dau/gioi-thieu-chung-ve-template`
- OA webhook overview: `https://developers.zalo.me/docs/official-account/webhook/tong-quan`
