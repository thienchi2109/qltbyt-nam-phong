# Phase 4 Evidence

Ngày: 2026-09-26  
Nhánh: `feat/shared-ai-service-phase4`  
Base: `5fc2f7668f27006b418521ed7895f87d1a5ea0ed`

## Phạm vi đã kiểm chứng

- `POST /v1/chat` giữ protocol/capability version, body/message/tool ceilings, request correlation và pre-stream JSON error.
- HMAC dùng canonical `ai-service-v1`, SHA-256 raw body, raw URL-safe base64, key/issuer/audience/capability binding, skew `30s`, validity `120s`, nonce cap `4096`, quarantine `150s`. Trusted capability claims không được phép mở rộng quyền của key.
- Admission là bounded và bắt buộc phải được cấu hình; gate thiếu hoặc zero-capacity làm readiness false, còn overload trả `503 limit_exceeded` retryable trước provider. Nonce bị release khi admission từ chối nên retry hợp lệ không bị khóa. Duplicate request ID vẫn trả `409` trước provider/reservation thứ hai.
- UI Message Stream v1 giữ `start`, step boundaries, text/tool/artifact/error parts, artifact trước `finish`, rồi `[DONE]`; writer short/error được trả về và ghi outcome `client_disconnected`.
- Context HTTP giữ forwarded deadline và dành `protocol.CleanupBudget` `5s` bên trong deadline đó; request không có deadline nhận `WorkBudget` `55s`. Runner tiếp tục dùng detached cleanup chung cho observe/finalize.
- `/healthz` trả process health; `/readyz` false trong replay quarantine, khi signing-key registry rỗng/malformed/trùng ID, khi admission thiếu/zero-capacity, hoặc khi registry/runner/provider/accounting chưa đủ. Probe không gọi model.
- `ai-sdk-parser-proof.mjs` dùng package `ai@6.0.105` và `eventsource-parser` đã cài trong workspace để parse wire chunks, kiểm tra text, artifact và terminal ordering.
- Gemini smoke test local (2026-09-26): một request `generateContent` với model `gemini-3.5-flash-lite` trả HTTP `200`, text `OK`, `STOP`, 7 total tokens trong khoảng 1.15 giây. API key không được ghi vào evidence hoặc log.

## Lệnh và kết quả

Từ `services/ai-service`:

- `go test ./...` — PASS
- `go test -race ./...` — PASS
- `go vet ./...` — PASS
- `gofmt -l .` — PASS (không có output)

Từ repository root:

- `node openspec/changes/refactor-ai-into-shared-go-service/phase-4/ai-sdk-parser-proof.mjs` — PASS

Regression tests nằm tại `services/ai-service/internal/ingress/phase4_test.go` và bao phủ deadline, admission, trusted capability claim, readiness quarantine, writer failure và artifact/finish order. Existing Phase 0–3 tests tiếp tục PASS.

## Ranh giới còn giữ nguyên

- Concrete PostgreSQL driver/pool, BFF RPC broker thật, credential custody, deployment/Tunnel/Access và live DB wiring vẫn deferred tới dark integration Phase 4–5/Phase 6; không có SQL, migration, deploy hoặc live write trong phase này.
- Mapping `provider_quota` → `ai_usage_limited`, Vietnamese BFF errors, browser request compatibility, UI fixtures và `/api/chat` production route thuộc Phase 5; route hiện tại không đổi.
- End-to-end streaming từ handler qua concrete tool/RPC broker cần dark BFF/driver contract ở phase sau; Phase 4 chỉ khóa HTTP cancellation context, provider reader close, bounded cleanup và writer failure boundary bằng local/mock tests.
