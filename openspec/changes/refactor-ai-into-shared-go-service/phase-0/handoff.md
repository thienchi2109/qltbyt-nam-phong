# Phase 0 Handoff

Ngày: 2026-09-25  
Nhánh: `chore/shared-ai-service-phase0`  
Base commit: `241efdf369bac7a59cf7ce15ea4b618597c05b27`

## Trạng thái

Phase 0 đã có đủ evidence và review cho các mục `0.1`–`0.9`. Các checklist
Phase 1 trở đi vẫn để nguyên chưa tick và chưa được thực hiện. Handoff này chỉ
ghi nhận tài liệu/evidence; không sửa runtime production, không migration/DDL,
không live DB write, không deploy và không paid-provider smoke.

## Kết quả đã xác minh

- Characterization hiện tại: `38` test files, `354` tests PASS; fixture giữ
  nguyên UI/tool/draft-only/no-submit behavior.
- Proof Go/Eino độc lập: `35` top-level tests PASS; full `go test`, `go test
-race`, `go vet`, `go mod verify` PASS và `gofmt` sạch. Adapter thật cho
  gateway-shaped OpenAI, openai-compatible và Gemini chỉ chạy với local stubs.
- Security/accounting proof đã xử lý các findings thực tế của post-implementation
  code review: identity binding; nonce expiry/concurrency; restart quarantine;
  BFF signed RPC broker; adapter thật; streaming/secondary usage aggregation;
  missing-usage normalization; retry aggregation; finalize-before-marker
  idempotency; torn-journal fail-closed; và file extraction.
- `openspec validate refactor-ai-into-shared-go-service --strict` PASS ngày
  2026-09-25.

## Quyết định Phase 0

- Giữ compatibility scope cho `gateway`, `google` và `openai-compatible`; Google
  key-pool rotation/reset được ghi nhận, chưa chạy paid-provider smoke.
- HMAC dùng SHA-256/raw URL-safe base64, skew `30s`, validity/replay `120s`,
  nonce cap `4096`, restart quarantine `150s`; MVP không có verified replay
  snapshot.
- Dùng append-only usage journal với write-ahead intent, `fsync`, replay trước
  expiry và finalize idempotent theo reservation ID.
- Mapping usage giữ `knownZero` là measured zero; empty/invalid là `unknown`;
  thiếu một dimension giữ dimension còn biết dưới `partial`; unknown/partial
  không refund reservation. QLTBYT DB access dùng application-owned BFF RPC
  broker; Go không nhận `SUPABASE_JWT_SECRET` hoặc browser cookie.

## Giới hạn đã được chấp thuận

Ngày 2026-09-25, sau khi được giải thích, user chấp thuận boundary sau
reservation expiry: nếu crash chỉ được recovery sau khi reservation hết hạn,
provider cost có thể đã phát sinh nhưng DB quota/token accounting bị undercount
vì `ai_quota_finalize` bỏ qua reservation hết hạn. Chấp thuận này không bao
gồm mất accounting trước expiry; replay và finalize trước expiry vẫn bắt buộc.

Jev chỉ là advisory đã được ghi nhận trong mục `Advisory triage` của
`phase-0-evidence.md`; nó không thay thế test evidence và không cấp quyền
runtime, SQL hay deploy. Không có claim về paid provider, VM/Tunnel, live
Supabase, migration hoặc production cutover.

## Bước tiếp theo

Chờ user duyệt rõ việc bắt đầu Phase 1. Khi được duyệt, chỉ triển khai đúng
Phase 1 và giữ các phase sau ở trạng thái chưa tick.
