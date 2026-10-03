# Phase 9 evidence — legacy Next.js AI runtime cleanup

Ngày: 2026-10-03

## Phạm vi

Cleanup sau direct `/api/chat` cutover. Route sống vẫn đi qua Go BFF; UI shared
contracts, draft artifact types/renderers, request/stream contracts, allowlist,
query catalog và broker boundary được giữ lại khi còn consumer. Không migration,
live DB write, deploy hay runtime operation.

## 9.1–9.3 — inventory và cleanup

Đã xóa các nhóm runtime chỉ phục vụ orchestrator Next.js cũ:

- `src/app/api/chat/legacy-next-orchestrator.ts` và các route stream/validation
  helpers cùng test chỉ khóa implementation cũ.
- Intent routing, limits, kill-switch, usage metering, prompt system và toàn bộ
  repair-draft orchestration/session/tool/evidence/extraction phía Next.js.
- Next-side SQL executor/audit/guardrail/client/schema-cheatsheet và các query
  database/RPC tool executor/equipment identifier/troubleshooting tool.
- Registry được rút còn validation allowlist + catalog/RPC migration contract;
  routing metadata, routing-group helpers, SQL constants thừa và dead RPC mapping
  export đã bỏ.

Giữ lại có chủ đích: `src/app/api/chat/route.ts`, `dark/route.ts`, Go BFF/broker/
signing/request schema, `query-catalog`, tool-response envelope, compact UI
messages, draft schema types dùng bởi assistant/repair-request UI, provider
configuration cho quota reranker và các contract tests.

## 9.4 — reference audit

`rg` trên `src/app/api/chat`, `src/lib/ai` và `src/components` không còn runtime
import tới legacy orchestrator, `streamText`, `generateText`, `ToolLoopAgent`,
`reserveUsage` hoặc `finalizeUsage`. Các kết quả còn lại chỉ là negative
assertions trong contract tests và broker audit RPC contract còn được Go path sử
dụng. `route.go-cutover.test.ts` còn kiểm tra route dùng `postGoBffChat` và file
legacy không tồn tại.

Knip scoped output không còn dead file/export trong chat legacy scope. Các dòng
còn lại là baseline ngoài Phase 9 hoặc type-only/UI contracts có consumer.

## 9.5 — rollback và ownership

Rollback reference vẫn là Phase 8 exact-commit artifact: git revert cutover hoặc
khôi phục candidate/image đã được ghi trong
[`phase-8-evidence.md`](../phase-8/phase-8-evidence.md). Phase 9 chỉ xóa source
legacy sau khi route direct đã được maintainer chấp nhận; không xóa image/runtime
rollback artifact, không đổi DQSS/Web Push/Tunnel/DNS/Access.

Bifrost/platform, chat persistence và durable replay là follow-up riêng; Phase 9
không mở các boundary đó.

## 9.6 — verification

- `openspec validate refactor-ai-into-shared-go-service --strict` — PASS.
- `format:check`, `verify:no-explicit-any`, `verify:dedupe`, `typecheck` — PASS.
- Focused Go BFF/chat/catalog tests: **11 files, 68 tests — PASS**.
- `cd services/ai-service && go test ./...` — PASS.
- React Doctor diff scan — **100/100**.
- Full assistant UI suite vẫn có 8 assertion cũ từ Phase 8 (`h-14` vs
  `size-14`, placeholder `...` vs `…`); không liên quan đến cleanup và không được
  dùng làm evidence PASS cho UI visual assertions.
