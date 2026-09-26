# Phase 5 Evidence

Ngày: 2026-09-26  
Nhánh: `feat/shared-ai-service-phase5`  
Base code trước lượt này: `37a8a1da648bf22ab1a174159023a09ab0e56b09`
Phạm vi lượt này: chỉ Phase 5.7–5.8 trên dark path; giữ nguyên bằng chứng 5.1–5.6, không làm Phase 6, migration/live DB, paid-provider smoke hoặc production cutover.

## Kết quả theo task

- **5.1 PASS:** `src/app/api/chat/dark/route.ts` xác thực NextAuth session/role, đọc server config, validate request qua `buildGoBffRequest`, resolve facility scope, tạo broker credential, ký canonical HMAC `ai-service-v1`, rồi proxy stream qua `src/lib/ai/go-bff/GoBffProxy.ts`. Regression: `src/app/api/chat/dark/__tests__/route.test.ts` (3), `GoBffRequest.test.ts` (2), `GoBffCanonicalRequest.test.ts` (1), `GoBffBrokerCredential.test.ts` (2).
- **5.2 PASS:** Browser payload vẫn dùng `chatRequestSchema`/AI SDK UI messages; current-turn `uiArtifact`, mixed tool output và raw draft được giữ trong canonical message/fixture. Mapper giữ `provider_quota` riêng; app quota chỉ map `limit_exceeded` HTTP 429 sang `ai_usage_limited`, `reason`, `retryAfterMs`, `Retry-After`. `GoBffProxy.test.ts` (6), `GoBffProtocolError.test.ts` (11), `assistant-phase5-fixtures.test.tsx` (1), `AssistantMessageList.test.tsx` (10), `AssistantMarkdownRenderer.test.tsx` (3).
- **5.3 PASS:** `GoBffConfig.ts` import `server-only`; endpoint, HMAC key/secret, broker secret và Cloudflare Access ID/secret đều bắt buộc. Thiếu, rỗng hoặc URL không hợp lệ fail closed và không lộ secret. `GoBffConfig.test.ts` (9) và proxy header assertions chứng minh Access/HMAC headers được gửi server-side.
- **5.4 PASS:** `phase-5/fixtures/ui-contract.json` và fixture test bao phủ text, tool card, report/chart, repair draft với `current_turn`, sanitized provider error, stop/cancel và terminal completion. Existing assistant renderer/message tests giữ contract hiển thị.
- **5.5 PASS:** `assistant-dark-transport.test.tsx` render `useChat` với `DefaultChatTransport({ api: "/api/chat/dark" })`; transport tạo `Request` rồi gọi handler `POST` thật của `/api/chat/dark` trong process. Session/config được mock để handler chạy qua validation, signing và `proxyGoBffRequest`; upstream `fetch` được mock bằng một UI-message SSE đang mở. User-event `Dừng` sau khi status chuyển sang `streaming` làm cùng `AbortSignal` tới upstream bị abort. `AssistantPanel.error-state.test.tsx` giữ production transport ở `/api/chat` và xác nhận `useChat.stop()`. Proxy test xác nhận signal đi tiếp qua BFF; abort từ `AbortError` trả 499 tiếng Việt. Đây là composed route/UI transport contract với upstream mock, chưa phải browser network, Go service hoặc VM smoke.
- **5.6 PASS:** Dark route chỉ nằm ở `/api/chat/dark`; production `src/app/api/chat/route.ts` không import Go BFF. Không có fallback từ dark path sang orchestrator cũ; fixture đánh dấu `dark_path_only: true`. Chưa đổi traffic hoặc cutover.

## Bằng chứng bổ sung 5.7–5.8

- **5.7 PASS (working tree sau `37a8a1da`):** `src/lib/ai/prompts/system.ts` nâng `SYSTEM_PROMPT_VERSION` từ `v2.6.1` lên `v2.7.0` và hướng dẫn QLTBYT mặc định dùng bảng Markdown khi nhiều mục có cùng thuộc tính (thiết bị, lịch bảo trì, so sánh). Prompt ưu tiên 3–5 cột ngắn gọn/ô ngắn, dùng đúng “Chưa có dữ liệu” cho giá trị thiếu, cấm tự điền hoặc suy diễn, giữ đoạn văn/danh sách cho giải thích/quy trình/clarification và giữ nguyên tool/artifact cards. `src/lib/ai/prompts/__tests__/system.test.ts` cùng các route assertion đã cập nhật kiểm chứng version và guidance.
- **5.8 PASS (fixture dark-only):** `phase-5/fixtures/ui-contract.json` thêm fixture `markdown-table` với năm text chunk cắt giữa header, delimiter và cell. Regression trực tiếp của `AssistantMarkdownRenderer` kiểm tra đủ header/dòng, Unicode, pipe được escape, text thiếu dữ liệu, cell hostile an toàn (không có DOM `img` hoặc `onerror`) và contract `overflow-x-auto` + `min-w-0`. Test composed `assistant-dark-transport.test.tsx` đưa các chunk qua `useChat` → `DefaultChatTransport` → handler `/api/chat/dark` → BFF proxy thật và kiểm tra bảng cuối đủ dòng/cột cùng contract an toàn/cuộn ngang. Contract text/tool/artifact hỗn hợp hiện có vẫn được test cũ bao phủ; không thêm stream parser.

## Verification

- `node scripts/npm-run.js run format:check` — BLOCKED / INCOMPLETE với narrow diff: sáu file TypeScript/TSX bị chạm đang có baseline formatting không theo Prettier; format toàn file sẽ PASS nhưng tạo churn không liên quan. Các gate cuối còn lại bên dưới PASS.
- `node scripts/npm-run.js run verify:no-explicit-any` — PASS.
- `node scripts/npm-run.js run verify:dedupe` — PASS (diff-only).
- `node scripts/npm-run.js run typecheck -- --pretty false` — PASS.
- Focused Vitest final run: `node scripts/npm-run.js exec vitest run src/app/api/chat/dark/__tests__/route.test.ts src/lib/ai/go-bff/__tests__ src/lib/ai/prompts/__tests__/system.test.ts src/components/assistant/__tests__/assistant-phase5-fixtures.test.tsx src/components/assistant/__tests__/AssistantMarkdownRenderer.test.tsx src/components/assistant/__tests__/AssistantPanel.error-state.test.tsx src/components/assistant/__tests__/AssistantMessageList.test.tsx src/components/assistant/__tests__/assistant-dark-transport.test.tsx --reporter=dot` — PASS, 13 files / 82 tests (5.1–5.6 baseline was 12 files / 61 tests).
- Touched route version assertion suites: `node scripts/npm-run.js exec vitest run src/app/api/chat/__tests__/route.troubleshooting.test.ts src/app/api/chat/__tests__/route.draft-output.test.ts --reporter=dot` — PASS, 2 files / 55 tests.
- `node scripts/npm-run.js run react-doctor` — PASS, score 100/100, 7 changed files scanned.
- `openspec validate refactor-ai-into-shared-go-service --strict` — PASS.
- 5.7–5.8 focused additions: `AssistantMarkdownRenderer.test.tsx` (4), `assistant-phase5-fixtures.test.tsx` (1), `assistant-dark-transport.test.tsx` (2), `system.test.ts` (19) — PASS.

## Giới hạn và deferred

- Không chạy paid provider, Cloudflare Tunnel/VM smoke, production `/api/chat` cutover, migration, live DB write hoặc Phase 6 deploy artifacts.
- 5.7/5.8 đã được kiểm chứng ở phần bổ sung phía trên; các giới hạn ngoài phạm vi vẫn giữ nguyên.
- 5.7/5.8 không chạy browser/layout automation vì môi trường không có credential browser; DOM contracts được kiểm tra trực tiếp (`overflow-x-auto`, `min-w-0`). Không chạy paid-provider smoke và không coi fixture là bảo đảm provider luôn sinh bảng.
- User-event coverage chứng minh UI stop contract và request-signal propagation xuyên handler/proxy tới mocked upstream. Chưa chạy browser network thật, Go service thật hoặc VM smoke; các kiểm tra đó cần phase/deploy được duyệt riêng.
