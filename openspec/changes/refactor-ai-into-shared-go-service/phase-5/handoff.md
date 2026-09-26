# Phase 5 Handoff

Ngày: 2026-09-26  
Nhánh: `feat/shared-ai-service-phase5`  
Base code hiện tại: `1de9333b37a9f43fba10d01e6512426890e357ad`

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

## Verification snapshot

Focused Phase 5 suite: 12 files, 61 tests PASS. Format, no-explicit-any, diff-only dedupe, typecheck, React Doctor (100/100) and strict OpenSpec validation PASS. The abort proof uses a mocked upstream fetch after the real dark handler/proxy path; full browser network, real Go/VM and paid-provider smoke were not run because they are outside this phase boundary.

## Next boundary

Parent agent should review the exact working-tree diff and evidence. Keep 5.7/5.8, Phase 6 deployment/Tunnel, live DB/migration and production routing deferred. Any cutover must be a separately authorized phase and must not add a fallback path.
