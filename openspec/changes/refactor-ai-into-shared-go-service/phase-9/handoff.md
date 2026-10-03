# Phase 9 handoff

Phase 9 cleanup đã hoàn tất ngày 2026-10-03. Legacy Next.js AI model/provider/
tool orchestration và dead route helpers đã bị xóa sau direct Go cutover. Route
`/api/chat` và `/api/chat/dark` vẫn giữ UI/BFF contract; shared UI schemas,
envelope, request/stream types, catalog và broker contracts vẫn còn.

Evidence chi tiết nằm ở
[`phase-9-evidence.md`](./phase-9-evidence.md). OpenSpec tasks `9.1–9.6` đã
được tick theo evidence. Không có live DB write, migration, deploy hoặc runtime
operation trong phase này.

Rollback vẫn tham chiếu exact-commit/image artifact của Phase 8. Follow-up ngoài
scope: Bifrost/platform, chat persistence và durable replay.
