# Phase 4 Handoff

Ngày: 2026-09-26  
Nhánh: `feat/shared-ai-service-phase4`  
Base: `5fc2f7668f27006b418521ed7895f87d1a5ea0ed`

Phase 4 đã hoàn tất implementation local/mock cho các task 4.1–4.6. Không commit hoặc push trong handoff này; parent agent sẽ review diff và quyết định bước tiếp theo.

## Files chính

- `services/ai-service/internal/ingress/handler.go`: authenticated POST boundary, request context/deadline, admission, probes, pre/post stream errors.
- `services/ai-service/internal/ingress/admission.go`: required bounded in-memory admission gate; missing/zero capacity fails closed.
- `services/ai-service/internal/ingress/replay.go`: nonce release sau admission reject và trusted capability claim binding.
- `services/ai-service/internal/ingress/stream.go`: SSE writer short/error propagation qua provider stream.
- `services/ai-service/internal/ingress/phase4_test.go`: regression evidence.
- `phase-4/ai-sdk-parser-proof.mjs`: installed Vercel AI SDK parser proof.

## Verification

`go test ./...`, `go test -race ./...`, `go vet ./...`, `gofmt -l .` và parser proof đều PASS. Không dùng paid provider, container deploy, Supabase MCP write, migration hoặc production `/api/chat`.

## Deferred boundary

Concrete PostgreSQL/pool và application-owned BFF RPC broker chưa được giả vờ coi là đã xong; chúng cần dark integration contract và credential review trước khi chạm DB thật. Phase 5 giữ nguyên Vietnamese mapping, browser/UI fixtures, Cloudflare credentials và production route. Recovery caller tiếp tục được inject qua Phase 3 `QuotaCaller`, không nới user/facility scope.
