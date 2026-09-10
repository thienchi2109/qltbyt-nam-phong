# Technical Configuration Specialty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional free-text “Chuyên khoa” metadata field to technical-configuration dossiers, show it in the dossier table, allow editing existing dossiers, and filter dossiers with an Equipments-style filter button.

**Architecture:** Add one nullable `specialty` text column and forward-only RPC changes. Keep the existing dossier mutation permission and optimistic-revision flow. Add a separate read RPC for distinct specialty options so pagination does not hide available filters; do not create a specialty catalog table or backfill existing rows.

**Tech Stack:** Next.js/React, TypeScript, TanStack Query, Supabase PostgreSQL RPCs, Vitest, existing shared `FacetedMultiSelectFilter`/Equipments toolbar patterns.

**Spec:** User-approved requirements in the conversation; no separate design document.

## Global Constraints

- Existing `technical_configuration_dossiers` applied migrations are immutable; add a correctly ordered forward-only migration.
- `specialty` is nullable; null renders as `Chưa phân loại` and is never auto-backfilled.
- Existing dossier authorization remains unchanged; no new role is introduced.
- Specialty input is free text with suggestions from saved values; trim whitespace and compare/filter case-insensitively while preserving Vietnamese diacritics.
- Scope is dossier metadata only; do not alter evaluation workspace, exports, reports, or live DB state.
- Live migration apply requires separate explicit Supabase MCP authorization; this plan only prepares source and tests.

---

## Checkpoint thực thi (2026-09-10)

### Static DB Quality Gate evidence (2026-09-10)

- Re-run trên HEAD `0db7164caf8867d94ed86ff6da6430499229ebc0`: `FAILED`, digest `d5e783ca978d2ea54b75a1a08bf77fb98c0e523148b00da0613cd002caca76eb`, counts `WARNING=1541`, `DANGEROUS=3`, `BLOCKING=17`.
- Chunk 1-specific dangerous findings là các `GRANT EXECUTE` cho overload create/update và RPC options trong hai migration. Đây là privilege surface được migration khai báo có chủ đích, đi kèm `REVOKE ALL`, và cần cho caller `authenticated`; chưa có bằng chứng migration cấp thừa quyền ngoài contract.
- Đính chính evidence ACL: cặp `REVOKE ALL`/`GRANT EXECUTE` nêu trên chỉ thuộc overload mới và options; create/update cũ và get/list dùng `CREATE OR REPLACE`, giữ ACL sẵn có. Regression catalog trên disposable PostgreSQL 17 xác nhận authenticated có EXECUTE và PUBLIC/anon/service_role không có quyền. Chưa chứng minh nguyên nhân từng finding trong parser, nên không coi nhận định false positive trước đây là chứng nhận static PASS.
- `jwt-guards`: create/update/get/list/options gọi guard dùng chung (`_technical_configuration_require_global_user` hoặc `_technical_configuration_require_editable_dossier`). Regression quyền truy cập PASS trên disposable DB; chưa truy vết đầy đủ parser để kết luận mọi finding là false positive.
- `function-overload-ambiguous` là phân loại đúng theo hình thức overload nhưng không phải lỗi migration: overload mới giữ tương thích RPC cũ theo thiết kế Chunk 1; không đổi logic chỉ để vượt gate.
- Kết luận checkpoint: không sửa migration/harness, không waiver/bypass; static vẫn là blocker và baseline-forward chưa chạy.

Yêu cầu mới nhất: triển khai trực tiếp, không subagent, dừng theo từng chunk để duyệt.

- **Chunk 1:** DB-only, hai migration forward-only và regression SQL có rollback. Giữ proxy, types, adapter và UI hiện tại. Chưa đánh dấu Task 1 hoàn tất vì phần TypeScript/proxy được chuyển sang checkpoint kích hoạt sau.
- **Chunk 2:** hợp đồng typed client/proxy, server filter ba trạng thái và cache/list hook; chỉ bắt đầu sau khi duyệt Chunk 1.
- **Chunk 3:** form Edit/tạo, cột Chuyên khoa, filter button giống Equipments và kiểm thử tương tác.
- **Checkpoint live:** riêng biệt, chỉ sau static + baseline-forward hợp lệ cùng commit và quyền ghi live cụ thể.

### Chunk 2: triển khai theo phép tiếp tục của maintainer

- Commit implementation: `85e0423bed06bbd6b6c15291c83f62218020653b`. Static exact-commit: FAILED, digest `2f1a09592d64761347d12c57c6a62e1f77207a8682cb53ac673cde05b30026e9`, 1541 WARNING / 4 DANGEROUS / 23 BLOCKING. Pre-push cũng FAILED static (digest `44f0dc127984fab320b044f5a50bf8d5552e7f48b5b89551d062dc6c3c74ab23`); chưa push, không bypass hooks.
- Baseline-forward run `specialty-chunk2-85e0423` bị timeout cục bộ sau 45 giây, không có report JSON/digest hợp lệ: INCOMPLETE, không phải PASS. Kiểm tra không còn kết nối vào control clone rồi xóa `dq_baseline_control_specialty_chunk2_85e0423`; clone regression `specialty_chunk2_20260910` cũng đã xóa. Không xóa hai clone Chunk 1 từ session trước.
- Sau bổ sung assertion specialty trong cache merge/stale retry: 6 tests/2 files PASS; các gate TypeScript/format/JSDoc PASS. Aggregate DB gate vẫn BLOCKING. Câu hỏi của maintainer về bypass/apply live chưa phải quyền ghi cụ thể; chưa ghi live và chưa triển khai Chunk 3.

- Ngày 2026-09-10, maintainer cho phép qua Chunk 2 dù static Chunk 1 vẫn FAILED. Đây là phép triển khai phase tiếp theo, không phải waiver DB gate hoặc quyền ghi live; không sang Chunk 3.
- Thêm migration `20260910110000_technical_configuration_dossier_specialty_filter.sql`, sau hai migration Chunk 1. Lọc server-side trong CTE trước COUNT/LIMIT/OFFSET, giữ search ranking và set-based can_delete. Overload sáu tham số dùng `p_filter_specialty` + `p_specialty`: false/NULL = tất cả, true/NULL = chưa phân loại, true/text = nhãn chính xác không phân biệt hoa thường, có phân biệt dấu. Chữ ký bốn tham số giữ defaults và delegate sang cùng truy vấn.
- Typed payload thêm specialty nullable, create/update yêu cầu p_specialty; form cũ chỉ chuyển tiếp giá trị hiện có (create NULL), chưa thêm control. Options RPC dùng manifest allowlist sẵn có; hook options có pagination độc lập và cùng query root để được invalidation sau mutation. List key và visible request identity giữ filter, reset trang khi đổi filter; cache merge/stale retry giữ specialty.
- Reuse: dùng RPC transport, query root, pagination và guard/normalizer hiện có. GitNexus tìm được list/detail key; Code Review Graph của worktree trống nên không dùng kết quả zero làm bằng chứng không trùng. Đối chiếu source trực tiếp; không sửa harness hoặc mở rộng gate narrowing.
- RED: hai test hành vi key/filter fail trước thay đổi hook. SQL test fail vì thiếu overload sáu tham số trên disposable clone chỉ có Chunk 1; sau migration Chunk 2 PASS. Clone `specialty_chunk2_20260910` từ qltbyt_test; CREATE tạm cho postgres chỉ ở clone, không thay đổi restored baseline/live.
- Regression: 105 tests/17 files PASS; no-explicit-any, diff-only dedupe, typecheck PASS; React Doctor 93/100, no issues. SQL specialty, search, delete, delete-audit PASS (exit 0) trên disposable PostgreSQL 17. Hai assertion cấu trúc search/delete được cập nhật cho overload/delegation; không bỏ kiểm tra hành vi cũ.
- Static trước commit (dirty input, không chứng nhận commit): INCOMPLETE, digest `473b0f26182037134d4b65cdbfec0c38b43179589bfc9902c964681c31309fc4`, 1541 WARNING / 4 DANGEROUS / 25 BLOCKING; gồm subject-input và registry evidence chưa commit. Phải chạy lại trên commit. Kiểm thử SQL riêng không thay thế baseline-forward chính thức; aggregate gate chưa PASS.

Quyết định kỹ thuật cho Chunk 1:

- Chữ ký create/update cũ giữ nguyên; overload mới thêm `p_specialty TEXT` bắt buộc ở cuối. Không truyền tham số này giữ nguyên chuyên khoa; truyền `NULL` hoặc chuỗi trắng sẽ xóa. Dùng RPC cũ để giữ khóa dòng và một lần tăng revision.
- Chuẩn hóa NFC, gộp khoảng trắng và trim; tối đa 200 ký tự sau chuẩn hóa. Giữ dấu tiếng Việt và nhãn đã nhập, gộp hoa/thường khi truy vấn gợi ý.
- RPC `technical_configuration_dossiers_specialties(p_page, p_page_size, p_search)` trả `{data: string[], total, page, page_size}`, tối đa 100 mục/trang; chỉ các hồ sơ active, độc lập pagination của datatable. Nhãn đại diện được chọn ổn định bằng `min(... COLLATE "C")`. `Tất cả`/`Chưa phân loại` là lựa chọn UI tổng hợp, không phải giá trị text lưu DB.
- Chưa thêm server filter trong Chunk 1. Chunk 2 phải phân biệt no-filter với lọc NULL bằng hợp đồng wire rõ ràng; không dùng JSON `undefined` để biểu diễn NULL.
- Hai migration lần lượt là `20260910100000_technical_configuration_dossier_specialty.sql` và `20260910100100_technical_configuration_dossier_specialty_reads.sql`, tránh file nguồn vượt 450 dòng.
- DB Quality Gate đang có giới hạn: giữ kết quả FAILED/INCOMPLETE, kiểm tra từng finding bằng SQL/catalog, không tự waive và không đổi logic đúng chỉ để im parser.

### Task 1: Add the nullable dossier field and RPC contracts

**Files:**

- Create: `supabase/migrations/<next-correctly-ordered>_technical_configuration_dossier_specialty.sql`
- Modify: `src/app/(app)/technical-configurations/types.ts`
- Modify: `src/app/(app)/technical-configurations/technical-configuration-rpc.ts`
- Modify: `src/lib/technical-configuration-dossier-rpcs.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Test: `src/app/api/rpc/__tests__/technical-configuration-dossier-specialty-migration.test.ts`

**Interfaces:**

- Add `specialty: string | null` to dossier list/detail wire types.
- Add `p_specialty: string | null` to create/update RPC argument types.
- Add a typed `listTechnicalConfigurationDossierSpecialties()` read adapter returning distinct saved labels plus a null option; register its RPC in the shared function constants and proxy allowlist.

- [ ] **Step 1: Write migration contract tests** asserting the new migration adds a nullable text column, returns `specialty` from list/get/create/update, trims empty input to null, preserves existing authorization/revision guards, and exposes a read-only distinct-options RPC with the same authorization guard.
- [ ] **Step 2: Run the focused migration test and verify it fails** because the migration and contract are absent.
- [ ] **Step 3: Compare migration timestamp ordering** against all dossier foundation/list/update/search migrations; choose a timestamp after every migration redefining these functions.
- [ ] **Step 4: Implement the forward-only migration** with `ALTER TABLE ... ADD COLUMN specialty TEXT`, updated function signatures/bodies, `NULLIF(btrim(p_specialty), '')`, a separate distinct-options function with case-insensitive ordering, explicit revoke/grant statements, and no data update/backfill. Preserve update compatibility by requiring the new parameter explicitly in the typed client; do not use a fallback that silently clears a value.
- [ ] **Step 5: Update TypeScript wire/argument types and the RPC adapter** to carry the new field and expose the options query.
- [ ] **Step 6: Run the focused migration test and verify it passes.**
- [ ] **Step 7: Run `node scripts/npm-run.js run db:quality-gate:local`; record static result separately.** Baseline-forward remains a separate Oracle gate for the landed commit.
- [ ] **Step 8: Commit** with `feat: add specialty metadata to technical configuration dossiers`.

### Task 2: Add list filtering and specialty-option query state

**Files:**

- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDossierList.ts`
- Modify: `src/app/(app)/technical-configurations/TechnicalConfigurationsClient.tsx`
- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDossierActions.ts`
- Modify: `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Test: `src/app/(app)/technical-configurations/__tests__/use-technical-configuration-dossier-list.test.tsx`

**Interfaces:**

- List hook accepts a tri-state `specialtyFilter`: `undefined` means no filter, `null` means only unclassified rows, and a string means an exact case-insensitive specialty match.
- Specialty options query returns distinct saved labels plus a synthetic `null`/“Chưa phân loại” option.
- Mutation cache merging preserves `specialty` in list and detail caches.

- [ ] **Step 1: Add failing hook tests** for exact specialty filtering, null filtering, option loading independent of page size, reset-to-all behavior, and cache merge after editing specialty.
- [ ] **Step 2: Run the focused hook tests and verify they fail.**
- [ ] **Step 3: Add query keys and hook state** for the specialty options query and tri-state filter value; retain existing search/pagination identity semantics and keep the options query independent of the paginated list.
- [ ] **Step 4: Implement the RPC arguments and cache updates** without changing existing search ranking or pagination behavior.
- [ ] **Step 5: Run the focused hook tests and verify they pass.**
- [ ] **Step 6: Commit** with `feat: filter technical configuration dossiers by specialty`.

### Task 3: Add specialty field and table column

**Files:**

- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierForm.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierTable.tsx`
- Modify: `src/app/(app)/technical-configurations/TechnicalConfigurationsClient.tsx`
- Test: `src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-form.test.tsx`
- Test: `src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-shell.test.tsx`

**Interfaces:**

- Form field `specialty` is optional, trimmed, and submitted as `null` when blank.
- Table renders `dossier.specialty ?? "Chưa phân loại"`.

- [ ] **Step 1: Add failing form/table tests** for create, edit/backfill of a null specialty, clearing an existing specialty, and the null display label.
- [ ] **Step 2: Run the focused tests and verify they fail.**
- [ ] **Step 3: Add the optional combobox/free-text field** with suggestions from the options query; preserve existing form validation and revision payloads. On edit, initialize from the dossier value; blank submits null so users can explicitly clear it.
- [ ] **Step 4: Add the Chuyên khoa table column** with accessible text and stable rendering for null values.
- [ ] **Step 5: Wire the options query and mutation callbacks through the existing page/action ownership seam.**
- [ ] **Step 6: Run the focused form and shell tests and verify they pass.**
- [ ] **Step 7: Commit** with `feat: edit and display dossier specialties`.

### Task 4: Add the Equipments-style specialty filter button

**Files:**

- Modify: `src/app/(app)/technical-configurations/TechnicalConfigurationsClient.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierTable.tsx` only if the existing table owns the toolbar seam
- Test: `src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-search-actions.test.tsx`

- [ ] **Step 1: Add failing interaction tests** for opening the filter button, selecting a distinct specialty, selecting “Chưa phân loại”, clearing filters, showing active-filter state, and preserving the existing search text.
- [ ] **Step 2: Run the focused interaction tests and verify they fail.**
- [ ] **Step 3: Reuse the shared faceted filter/button pattern used by Equipments; do not introduce a new generic filter abstraction.**
- [ ] **Step 4: Wire filter selection to the list hook, include “Tất cả”, “Chưa phân loại”, and saved distinct values, and invalidate/refetch only dossier-list queries when needed. Treat “Tất cả” as `undefined` and “Chưa phân loại” as `null`; do not collapse those states.**
- [ ] **Step 5: Run the focused interaction tests and verify they pass.**
- [ ] **Step 6: Commit** with `feat: add specialty filter control to dossier list`.

### Task 5: Run repository verification and prepare handoff

- [ ] **Step 1:** Run `node scripts/npm-run.js run format:check`.
- [ ] **Step 2:** Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] **Step 3:** Run `node scripts/npm-run.js run verify:dedupe`; invoke the `code-deduplication` skill if any reusable logic was added or copied.
- [ ] **Step 4:** Run `node scripts/npm-run.js run typecheck`.
- [ ] **Step 5:** Run the focused dossier migration, hook, form, shell, and filter tests together.
- [ ] **Step 6:** Run `node scripts/npm-run.js run react-doctor`.
- [ ] **Step 7:** Run the static migration gate and document static versus baseline-forward status for the exact commit; do not claim aggregate migration PASS without both lanes.
- [ ] **Step 8:** Review `git diff --check`, confirm no live DB write occurred, and report files/tests plus the separate live-apply approval boundary.
