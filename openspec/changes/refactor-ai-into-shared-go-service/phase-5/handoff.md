# Phase 5 Handoff

Ngày: 2026-09-26  
Nhánh: `feat/shared-ai-service-phase5`  
Base code trước lượt này: `37a8a1da648bf22ab1a174159023a09ab0e56b09`

Phase 5.1–5.6 đã được implement và kiểm chứng local. Working tree còn uncommitted theo yêu cầu; không commit/push.

## Files chính

- `src/app/api/chat/dark/route.ts`: dark-only session boundary, request ID và fail-closed configuration.
- `src/lib/ai/go-bff/GoBffRequest.ts`: browser shape validation, facility scope, broker token, canonical body và HMAC signature.
- `src/lib/ai/go-bff/GoBffConfig.ts`: server-only HMAC/broker/Cloudflare credentials.
- `src/lib/ai/go-bff/GoBffProxy.ts`: stream proxy, signal propagation, UI stream validation, sanitized HTTP errors và quota mapping.
- `src/lib/ai/go-bff/GoBffProtocolError.ts`: fixed Vietnamese messages; `provider_quota` remains distinct from `ai_usage_limited`.
- `src/app/api/chat/dark/__tests__/route.test.ts` và `src/lib/ai/go-bff/__tests__/`: session/signing/proxy/error/config regressions.
- `openspec/changes/refactor-ai-into-shared-go-service/phase-5/fixtures/ui-contract.json`: declarative UI contract fixture.
- `src/components/assistant/__tests__/assistant-phase5-fixtures.test.tsx`: fixture assertions; `AssistantPanel.error-state.test.tsx`: user-event stop and production-route guard; `assistant-dark-transport.test.tsx`: real `useChat`/`DefaultChatTransport` request through the imported dark `POST` handler and BFF proxy, with a mocked open upstream UI stream and same-signal abort assertion.

## 5.7–5.8 bổ sung

- Prompt `src/lib/ai/prompts/system.ts` hiện là `v2.7.0` với guidance bảng theo thuộc tính tương đồng và wording giá trị thiếu đã duyệt; prompt/version assertion kiểm chứng contract.
- `phase-5/fixtures/ui-contract.json` có fixture bảng Markdown năm chunk. Direct renderer test kiểm tra Unicode, pipe escape, “Chưa có dữ liệu”, cell hostile an toàn, đủ dòng/cột và `overflow-x-auto`/`min-w-0`; composed dark transport test đưa chunk qua `useChat` và dark BFF route/proxy thật trước khi assertion DOM cuối.
- Đây vẫn chỉ là dark validation. Không chạy browser/layout automation vì không có credential browser thật; DOM contract là bằng chứng thay thế đã ghi rõ. Không chạy paid-provider smoke, Phase 6 deploy/Tunnel, migration/live DB write, production route cutover hoặc thêm stream parser.

## Verification snapshot

Focused Phase 5 final suite: 13 files, 82 tests PASS (the 5.1–5.6 baseline was 12 files / 61 tests); the two touched route assertion suites add 55 passing tests. No-explicit-any, diff-only dedupe, typecheck, React Doctor (100/100) and strict OpenSpec validation PASS; format remains the documented baseline-style blocker. The abort/table proofs use mocked upstream fetches after the real dark handler/proxy path; full browser network, real Go/VM and paid-provider smoke were not run because they are outside this phase boundary.

5.7–5.8 additions: focused renderer/prompt/fixture/dark-stream tests xanh; format check của working tree hiện BLOCKED bởi baseline non-Prettier ở sáu file bị chạm (xem status/decision của parent agent).

## Next boundary

Parent agent should review the exact working-tree diff and evidence. Keep 5.7/5.8, Phase 6 deployment/Tunnel, live DB/migration and production routing deferred. Any cutover must be a separately authorized phase and must not add a fallback path.
