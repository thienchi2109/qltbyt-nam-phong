# Phase 5 Evidence

Ngày: 2026-09-26  
Nhánh: `feat/shared-ai-service-phase5`  
Base code hiện tại: `1de9333b37a9f43fba10d01e6512426890e357ad`  
Phạm vi: chỉ Phase 5.1–5.6; không làm 5.7/5.8, Phase 6, migration/live DB, paid-provider smoke hoặc production cutover.

## Kết quả theo task

- **5.1 PASS:** `src/app/api/chat/dark/route.ts` xác thực NextAuth session/role, đọc server config, validate request qua `buildGoBffRequest`, resolve facility scope, tạo broker credential, ký canonical HMAC `ai-service-v1`, rồi proxy stream qua `src/lib/ai/go-bff/GoBffProxy.ts`. Regression: `src/app/api/chat/dark/__tests__/route.test.ts` (3), `GoBffRequest.test.ts` (2), `GoBffCanonicalRequest.test.ts` (1), `GoBffBrokerCredential.test.ts` (2).
- **5.2 PASS:** Browser payload vẫn dùng `chatRequestSchema`/AI SDK UI messages; current-turn `uiArtifact`, mixed tool output và raw draft được giữ trong canonical message/fixture. Mapper giữ `provider_quota` riêng; app quota chỉ map `limit_exceeded` HTTP 429 sang `ai_usage_limited`, `reason`, `retryAfterMs`, `Retry-After`. `GoBffProxy.test.ts` (6), `GoBffProtocolError.test.ts` (11), `assistant-phase5-fixtures.test.tsx` (1), `AssistantMessageList.test.tsx` (10), `AssistantMarkdownRenderer.test.tsx` (3).
- **5.3 PASS:** `GoBffConfig.ts` import `server-only`; endpoint, HMAC key/secret, broker secret và Cloudflare Access ID/secret đều bắt buộc. Thiếu, rỗng hoặc URL không hợp lệ fail closed và không lộ secret. `GoBffConfig.test.ts` (9) và proxy header assertions chứng minh Access/HMAC headers được gửi server-side.
- **5.4 PASS:** `phase-5/fixtures/ui-contract.json` và fixture test bao phủ text, tool card, report/chart, repair draft với `current_turn`, sanitized provider error, stop/cancel và terminal completion. Existing assistant renderer/message tests giữ contract hiển thị.
- **5.5 PASS:** `assistant-dark-transport.test.tsx` render `useChat` với `DefaultChatTransport({ api: "/api/chat/dark" })`; transport tạo `Request` rồi gọi handler `POST` thật của `/api/chat/dark` trong process. Session/config được mock để handler chạy qua validation, signing và `proxyGoBffRequest`; upstream `fetch` được mock bằng một UI-message SSE đang mở. User-event `Dừng` sau khi status chuyển sang `streaming` làm cùng `AbortSignal` tới upstream bị abort. `AssistantPanel.error-state.test.tsx` giữ production transport ở `/api/chat` và xác nhận `useChat.stop()`. Proxy test xác nhận signal đi tiếp qua BFF; abort từ `AbortError` trả 499 tiếng Việt. Đây là composed route/UI transport contract với upstream mock, chưa phải browser network, Go service hoặc VM smoke.
- **5.6 PASS:** Dark route chỉ nằm ở `/api/chat/dark`; production `src/app/api/chat/route.ts` không import Go BFF. Không có fallback từ dark path sang orchestrator cũ; fixture đánh dấu `dark_path_only: true`. Chưa đổi traffic hoặc cutover.

## Verification

- `node scripts/npm-run.js run format:check` — PASS.
- `node scripts/npm-run.js run verify:no-explicit-any` — PASS.
- `node scripts/npm-run.js run verify:dedupe` — PASS (diff-only).
- `node scripts/npm-run.js run typecheck -- --pretty false` — PASS.
- Focused Vitest: `node scripts/npm-run.js exec vitest run src/app/api/chat/dark/__tests__/route.test.ts src/lib/ai/go-bff/__tests__ src/components/assistant/__tests__/assistant-phase5-fixtures.test.tsx src/components/assistant/__tests__/AssistantPanel.error-state.test.tsx src/components/assistant/__tests__/AssistantMessageList.test.tsx src/components/assistant/__tests__/AssistantMarkdownRenderer.test.tsx src/components/assistant/__tests__/assistant-dark-transport.test.tsx --reporter=dot` — PASS, 12 files / 61 tests.
- `node scripts/npm-run.js run react-doctor` — PASS, score 100/100, 7 changed files scanned.
- `openspec validate refactor-ai-into-shared-go-service --strict` — PASS.

## Giới hạn và deferred

- Không chạy paid provider, Cloudflare Tunnel/VM smoke, production `/api/chat` cutover, migration, live DB write hoặc Phase 6 deploy artifacts.
- Không tick 5.7/5.8; Markdown prompt/table chunk fixtures vẫn deferred.
- User-event coverage chứng minh UI stop contract và request-signal propagation xuyên handler/proxy tới mocked upstream. Chưa chạy browser network thật, Go service thật hoặc VM smoke; các kiểm tra đó cần phase/deploy được duyệt riêng.
