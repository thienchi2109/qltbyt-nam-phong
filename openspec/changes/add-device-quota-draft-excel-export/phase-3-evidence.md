# Bằng chứng Phase 3 — Tích hợp download vào editor

## Phạm vi, remediation và commit

- Phase 3 runtime chỉ gồm hook/page/editor wiring và user-event interaction.
  Không sửa RPC/API/SQL/migration/grants, không ghi live DB, không đổi
  category/import contract.
- Exact remediation implementation commit:
  `a137e971d07e9b6a74392e7787e82154bffd1b71`.
- Diff remediation `6352c97ebc844a764c9e7e34de389838ae087d5f..a137e971` chỉ
  thay đổi bốn file test/export-local: readonly export context, page branding
  no-context assertion, và catalog/source snapshot identity guard. Không có
  path RPC, SQL, migration, shared branding hook hoặc proxy trong diff.
- Phase 3.5 là follow-up OpenSpec docs-only ở lượt này; chưa tạo/apply
  migration, chưa live write. Docs commit được tạo sau khi cập nhật artifacts.

## TDD Red → Green → Refactor

### Red ban đầu của Phase 3

Focused command đã chạy trước wiring runtime:

```text
node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx"
```

Toolbar khi đó chỉ có `["Lưu"]` thay vì `["Xuất Excel", "Lưu"]`; các wait
cho export không hoàn tất và harness timeout, quan sát được 19 failed/5 passed
trong 24 cases. Đây là failure hành vi do wiring thiếu, không sửa assertion;
harness lần đó không trả một mã exit số riêng.

### Remediation Red

Sau review, thêm Red cases cho readonly hook thực tế và accepted snapshot đổi
`catalogVersionId`/`sourcePdfSha256` trong lúc builder pending. Command:

```text
node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/_hooks/__tests__/useDeviceQuotaDraftCatalog.test.tsx" "src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx"
```

Kết quả `EXIT_CODE=1`: 2 files, `3 failed/37 passed`. Readonly vẫn lộ
`exportSnapshot`; hai identity case vẫn gọi `downloadBlob` vì key chưa chứa
catalog/source identity. Failure đúng nguyên nhân, không chỉnh assertion để né.

### Green và refactor

- Green cùng command remediation: `EXIT_CODE=0`, 2 files, `40/40` tests.
  Readonly hook trả `exportSnapshot: null`; page không gọi branding khi
  readonly context không có. Identity key hiện bao phủ user, unit, revision,
  saved time, unit name, `catalogVersionId`, `sourcePdfMarker` và
  `sourcePdfSha256`; stale export bị hủy trước download.
- Final required focused command trên exact remediation SHA pass `1 file / 26
tests`, `EXIT_CODE=0`.
- Regression matrix bổ sung sau remediation pass `4 files / 60 tests`,
  `EXIT_CODE=0`: export matrix (26), hook (14), editor (10), builder (10).
- Fixture factories đã được tách trước remediation thành
  `DeviceQuotaDraftCatalogExportTestSupport.ts`; matrix còn 292 dòng, support
  68 dòng.

## User-event matrix sau remediation

File: `src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx`

| Nhóm contract                                                                                 | Số case | Bằng chứng                                                |
| --------------------------------------------------------------------------------------------- | ------: | --------------------------------------------------------- |
| `global`, `admin`, `to_qltb`; current session unit; action ngay trước Save; đúng một download |       3 | Builder nhận snapshot unit hiện tại; Save không bị gọi    |
| Role không được phép (`guest`, `analyst`)                                                     |       2 | Action ẩn; không builder/download                         |
| Read-only                                                                                     |       1 | `exportSnapshot` null; page không gọi branding; action ẩn |
| Dirty, save/exclude/restore/recover pending, missing snapshot                                 |       6 | Action disabled; không builder/download                   |
| Branding missing/mismatched/blank                                                             |       3 | Disabled, status tiếng Việt, retry branding               |
| Export đang pending                                                                           |       1 | Duplicate click không tạo generation/download thứ hai     |
| Builder error và download error                                                               |       2 | Vietnamese retry status và retry thành công               |
| User/unit/revision-time/catalog/source identity đổi khi builder pending                       |       5 | Abort trước `downloadBlob`; không tải Blob cũ             |
| Thiếu `userId` hoặc unit không hợp lệ                                                         |       2 | Action ẩn; không context/builder/download                 |
| `current_don_vi ?? don_vi` và branding options                                                |       1 | Client ưu tiên current unit và truyền `formTenantId` đúng |
| **Tổng**                                                                                      |  **26** | **26/26 pass**                                            |

Click export không refetch, Save/mutation hoặc RPC mới; test kiểm tra trực tiếp
`save`/`retry` không bị gọi và chỉ builder/download mock được phép chạy. Unit
fallback/branding evidence ở đây chỉ là client-side; trusted cross-layer
tenant claim/branding alignment chuyển sang Phase 3.5.

## Review outcome và triage

Một independent reviewer đã rà soát diff/spec và triage bốn Important findings:

1. **Actual catalog UUID mismatch:** canonical
   `device_quota_regulatory_catalog_get()` không trả `v.id`; create/open có thể
   reopen draft cũ. Client không được giả gắn `draft.catalog_version_id` vào
   response. Chuyển thành blocking Phase 3.5.
2. **Current tenant cross-layer mismatch:** draft/export dùng
   `current_don_vi ?? don_vi`, nhưng trusted RPC claims và branding DB function
   còn dùng raw `don_vi`. Không sửa client-only; chuyển thành blocking Phase 3.5.
3. **Readonly context leak:** fix trong Phase 3 remediation bằng điều kiện
   `mode !== "readonly"`; test chứng minh không context, không branding,
   không builder/download.
4. **Accepted snapshot stale key:** fix trong Phase 3 remediation bằng việc
   thêm catalog/source identity vào key; Red/Green evidence ở trên.

Passive-effect residual risk: `currentSnapshotRef` hiện cập nhật qua passive
`useEffect`. Không có deterministic test chứng minh race giữa commit và effect,
nên không sửa production bằng suy đoán; residual risk này phải được xem lại
trong review Phase 3.5/Phase 4 và không được coi là cross-layer PASS.

Complexity/file-size triage: test fixture đã được tách hợp lý; hook
`useDeviceQuotaDraftCatalog.ts` vẫn 356 dòng và React Doctor còn cảnh báo
complexity ở hook/editor nhưng exit `0`, score `93/100`. Không refactor rộng chỉ
để đổi score; không file nào vượt hard ceiling 450 dòng.

## Coherence hiện đã chứng minh và phần bị chặn

- `revision`, `updated_at` và saved rows lấy từ accepted server draft/catalog;
  staged row thay đổi không làm đổi export rows/revision; hook suite pass 14/14.
- Readonly mode hiện không tạo export context. Page chỉ gọi
  `useTenantBranding({ formTenantId: snapshot.unitId, useFormContext: true })`
  khi có editable export context; branding client-side chỉ nhận id khớp và tên
  sau `trim()` không rỗng.
- `catalog_version_id` được carry trong context và identity key, nhưng strict
  equality với actual canonical catalog UUID chưa được chứng minh vì RPC payload
  thiếu UUID. Không claim catalog UUID coherence đã pass.
- Current-unit fallback và branding request đúng ở client, nhưng trusted RPC
  claim/branding DB resolution chưa đồng nhất. Không claim cross-layer tenant
  coherence đã pass.

## Reuse và graph/dedupe review

- Code Review Graph current tại base
  `f22d2f58bcfe7d023d351999eee892ba24c5050e`; GitNexus index cùng exact base;
  `rg` kiểm tra các seam trước khi thêm logic.
- Reuse `createExcelWorkbook` và `downloadBlob` hiện hữu. Builder/context vẫn
  domain-local vì contract draft/catalog đặc thù; không thêm domain flag vào
  generic helper, không tạo duplicate shared hook/service.

## File-size audit

| File                                                 | Dòng |
| ---------------------------------------------------- | ---: |
| `useDeviceQuotaDraftCatalog.ts`                      |  356 |
| `DeviceQuotaDraftCatalogEditor.tsx`                  |  327 |
| `DeviceQuotaDraftCatalogPageClient.tsx`              |  145 |
| `useDeviceQuotaDraftCatalogExport.ts`                |  142 |
| `device-quota-draft-catalog-excel-export-context.ts` |   65 |
| `device-quota-draft-catalog-excel-export.ts`         |  312 |
| `DeviceQuotaDraftCatalogExport.test.tsx`             |  295 |
| `DeviceQuotaDraftCatalogExportTestSupport.ts`        |   68 |

Tất cả dưới hard ceiling 450; hook 356 được giữ nguyên vì chưa có extraction
nhỏ, rõ nghĩa mà không mở rộng scope.

## Full gate trên exact remediation implementation SHA

Tất cả command chạy tuần tự trong **một** `ctx_batch_execute`, `concurrency: 1`,
trên `a137e971d07e9b6a74392e7787e82154bffd1b71`:

| Thứ tự | Command                                                                           |                                                Exit |
| -----: | --------------------------------------------------------------------------------- | --------------------------------------------------: |
|      1 | `node scripts/npm-run.js run format:check`                                        |                                                 `0` |
|      2 | `node scripts/npm-run.js run verify:no-explicit-any`                              |                                                 `0` |
|      3 | `node scripts/npm-run.js run verify:dedupe`                                       |                                                 `0` |
|      4 | `node scripts/npm-run.js run typecheck`                                           |                                                 `0` |
|      5 | focused `DeviceQuotaDraftCatalogExport.test.tsx`                                  |                                         `0` — 26/26 |
|      6 | `node scripts/npm-run.js run react-doctor`                                        | `0` — score 93/100; 2 complexity warnings, no error |
|      7 | `openspec validate add-device-quota-draft-excel-export --strict --no-interactive` |                                                 `0` |
|      8 | `git diff --check`                                                                |                                                 `0` |

Focused hook/page/editor/builder regression sau remediation cũng `EXIT_CODE=0`,
60/60 tests. Hook tests còn warning `act(...)` của testing environment nhưng
không làm fail test.

## Checkbox và dependency state

- Tasks `3.1`, `3.2`, `3.3`, `3.5`, `3.6`, `3.7` có evidence và được tick.
- Task `3.4` **unchecked**: client-side context có evidence, nhưng strict
  catalog UUID/current-tenant coherence bị chuyển Phase 3.5.
- `3.8 USER REVIEW — Phase 3 approval` vẫn unchecked.
- Acceptance Phase 3 user-event/client guards đã tick; acceptance strict
  snapshot/catalog/tenant coherence **unchecked**; required gates đã tick;
  `USER REVIEW — Phase 3 approval` vẫn unchecked.
- Toàn bộ Phase 3.5 tasks và `USER REVIEW — Phase 3.5 approval` unchecked.
- Toàn bộ Phase 4 execution/approval unchecked và hard-block tới khi Phase 3.5
  hoàn tất.
- Không có Phase 3.5 runtime/RPC/SQL/migration implementation hoặc live write.
