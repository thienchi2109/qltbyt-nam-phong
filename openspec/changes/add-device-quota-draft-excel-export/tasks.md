# Kế hoạch triển khai xuất Excel danh mục định mức dự thảo

> **For agentic workers:** Khi bắt đầu một phase, đọc proposal, design và
> acceptance của change này; áp dụng `superpowers:subagent-driven-development`
> khi có subagent (hoặc `superpowers:executing-plans`), TDD Red–Green–Refactor
> theo đặc tả OpenSpec (SDD); chỉ đánh dấu
> checkbox khi có evidence. Mỗi phase phải dừng ở mục `USER REVIEW` trước khi
> chuyển phase kế tiếp.

**Goal:** Tạo bản `.xlsx` một worksheet từ saved draft snapshot, trung thành với
phụ lục Thông tư 10/2026 và không ảnh hưởng luồng hiện hữu.

**Architecture:** Builder ExcelJS độc lập nhận export snapshot immutable; page
client/hook chỉ cung cấp snapshot đã khớp unit, branding và metadata; editor
đưa nút vào `HierarchicalEditorToolbar.actions`.

**Tech Stack:** Next.js/React, TypeScript strict, TanStack Query, ExcelJS,
`src/lib/excel-workbook.ts`, Vitest, Testing Library user-event.

## Phase 1: Hồ sơ, spec, reuse và acceptance (current)

Boundary: chỉ tài liệu và kiểm tra read-only. Không sửa runtime, SQL hoặc test
hiện hữu. Tất cả checkbox của phase này khởi đầu unchecked; parent chỉ đánh dấu
những mục có evidence rõ ràng.

- [x] 1.1 Đọc `openspec/AGENTS.md`, `openspec/project.md`, spec hiện tại
      `device-quota-category-workspace` và các archived appendix/polish docs;
      ghi lại Requirement/Scenario format, source order và non-goals.
- [x] 1.2 Tạo `proposal.md`, `design.md`, `tasks.md`,
      `specs/device-quota-category-workspace/spec.md` và `acceptance.md` trong
      change này bằng tiếng Việt; mọi requirement dùng SHALL/MUST và có ít nhất
      một `#### Scenario:`.
- [x] 1.3 Xác minh seam toolbar `actions` đứng trước Save, hook
      `lastSavedRows`/metadata, helper `createExcelWorkbook`/`downloadBlob`,
      `useTenantBranding` và source artifact PDF/manifest. Ghi path/identity
      vào acceptance; không suy diễn từ file ngoài repo.
- [x] 1.4 Đóng băng fixture contract: 42 rows, 5 sections, 37 items, 16 child,
      21 top-level, source pages 6-12, 3 footnotes, multiline quota và PDF
      SHA-256 trong acceptance.
- [x] 1.5 Chạy validation tài liệu:
      `openspec validate add-device-quota-draft-excel-export --strict --no-interactive`,
      `node scripts/npm-run.js run format:check`, và `git diff --check`.
- [x] 1.6 Review độc lập tính đúng đặc tả rồi chất lượng tài liệu; sửa finding
      hợp lệ, ghi kết quả vào `phase-1-evidence.md`, commit nhánh tài liệu sau
      khi các gate fresh pass.
- [x] 1.7 `USER REVIEW — Phase 1 approval:` người dùng đã explicit duyệt bộ docs,
      contract, reuse decision và acceptance trong lượt này; fast-forward to main
      được ủy quyền để parent land/closeout Phase 1. Việc này không ủy quyền
      Phase 2; các checkbox Phase 2–4 vẫn giữ nguyên unchecked.

Exit criteria: strict validation và formatting pass; không có runtime/SQL/test
source diff; acceptance đủ fixture/test matrix và layout contract; mục USER
REVIEW vẫn unchecked cho tới khi có phê duyệt trực tiếp.

## Phase 2: Workbook độc lập (TDD + sample artifact)

Boundary: builder/module/test độc lập, chưa nối nút UI. Không gọi RPC/query/
mutation. Dùng source artifact repository-owned làm fixture; không tạo test chỉ
để chứng minh implementation hiện chưa tồn tại.

Lặp bước 2.1–2.4 theo từng nhóm hành vi: cấu trúc/nội dung, null/zero/excluded,
rồi layout/serialization. Chạy và ghi Red đúng nguyên nhân trước khi viết
runtime tương ứng; lỗi import/setup đơn thuần không phải bằng chứng hành vi.

- [x] 2.1 Tạo test Red tại
      `src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts`
      cho schema một sheet/bảy cột, title/metadata, 42 source rows, multiline
      rules, 3 footnotes, null/zero và excluded styling; xác nhận
      `sourcePages`, `sourceReference`, `parentSourceIdentifier` cùng identity
      source/order/catalog chỉ là fixture/validation input và không render thêm
      cột, cột ẩn, comment, sheet hoặc ô user-facing.
- [x] 2.2 Chạy focused Red:
      `node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts"`;
      ghi failure có ý nghĩa của contract mới.
- [x] 2.3 Tạo module hữu hạn
      `src/app/(app)/device-quota/categories/draft-catalog/device-quota-draft-catalog-excel-export.ts`
      với type snapshot immutable, mapper và builder; tái sử dụng helper ExcelJS
      hiện có, không thêm domain flags vào flat `exportToExcel`.
- [x] 2.4 Implement Green tối thiểu: metadata block riêng, bảy headers đúng
      thứ tự, section/item source order, full source text, null/zero semantics,
      excluded row marker/style, footnotes và A4 landscape/fit width/header
      repeat contract.
- [x] 2.5 Chạy focused Green cùng test path ở 2.2; kiểm tra worksheet thật bằng
      ExcelJS và tạo sample artifact tại
      `openspec/changes/add-device-quota-draft-excel-export/artifacts/device-quota-draft-export-sample.xlsx`.
- [x] 2.6 Refactor sau Green: tách mapper/style/types nếu chạm ngưỡng 350 dòng,
      giữ hard ceiling 450 dòng, và chạy lại focused test không đổi hành vi.
- [x] 2.7 Chạy đủ gate TS theo thứ tự tại 3.7, bao gồm hồi quy
      `src/lib/__tests__/excel-workbook.test.ts`; review spec rồi chất lượng,
      ghi Red/Green/gates vào evidence trước commit/push. Kiểm tra tái sử dụng
      liên file bằng Code Review Graph, GitNexus và `rg`; không chạy dedupe toàn repo.
- [x] 2.8 `USER REVIEW — Phase 2 approval:` người dùng duyệt builder, sample
      artifact và filename trước khi nối vào editor.

Exit criteria: focused workbook tests pass; sample mở được, đúng bảy cột/42
rows/3 notes; không có fetch/mutation; file module nhỏ và reuse helper đã được
ghi evidence; toàn bộ gate TS bắt buộc đạt.

## Phase 3: Tích hợp download vào editor (TDD user-event)

Boundary: hook/page/editor wiring và test interaction. Không sửa RPC/SQL,
không đổi active category/import contracts.

- [x] 3.1 Tạo Red user-event test tại
      `src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx`
      cho authorized `global`/`admin`/`to_qltb`, current session unit, nút ngay
      trước Save, và một download duy nhất; thêm ca unauthorized role và
      read-only mode để action bị ẩn, không tạo export context/builder/download.
- [x] 3.2 Mở rộng Red cases cho dirty, save/exclude/restore pending, missing
      snapshot, missing/mismatched branding, exporting lock, builder/download
      error retry, session/unit change, thiếu authenticated `userId` hoặc
      `current_don_vi ?? don_vi` không phải số dương, không refetch và không
      gọi Save. Khi identity mất trong lúc pending, phải hủy và không tải Blob
      stale.
- [x] 3.3 Chạy focused Red:
      `node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx"`.
- [ ] 3.4 Thêm context export nội bộ tối thiểu từ cùng server draft/catalog
      snapshot; revision/updated_at phải từ saved server response, không từ
      local staged state. Nối branding bằng `useTenantBranding` với id-match
      guard; không tạo public API/RPC. Client-side rows/revision và branding
      guard đã có evidence, nhưng strict catalog UUID equality và trusted
      current-unit coherence chưa thể chứng minh từ payload hiện tại; phần này
      bị giữ unchecked và chuyển sang Phase 3.5.
- [x] 3.5 Nối editor qua `HierarchicalEditorToolbar.actions`, giữ Save và
      existing mutation state; thêm status/toast retry tiếng Việt và duplicate
      lock.
- [x] 3.6 Chạy focused Green user-event test; xác minh authorized roles tạo
      đúng một download, còn unauthorized/read-only hoặc thiếu identity ẩn/
      khóa action và không tạo context/builder/download; click không gọi query
      refetch, mutation Save hoặc RPC mới. Nếu fail, sửa implementation theo
      đặc tả; chỉ refactor khi Green, rồi chạy lại test. Không sửa assertion
      hoặc đặc tả chỉ để làm test pass.
- [x] 3.7 Chạy bắt buộc theo đúng thứ tự cho TS/React diff:
      `node scripts/npm-run.js run format:check` →
      `node scripts/npm-run.js run verify:no-explicit-any` →
      `node scripts/npm-run.js run verify:dedupe` →
      `node scripts/npm-run.js run typecheck` → focused Vitest →
      `node scripts/npm-run.js run react-doctor`. Gom chuỗi kiểm tra trong
      một `ctx_batch_execute`; lưu kết quả có exit code, chạy review spec
      rồi chất lượng và kiểm tra reuse liên file trước commit/push.
- [ ] 3.8 `USER REVIEW — Phase 3 approval:` người dùng duyệt interaction và
      quyền trước khi visual/print closeout.

Exit criteria: user-event matrix pass, client-side saved-snapshot/branding
guards pass, no duplicate/no refetch/no Save evidence pass, required TS/React
gates pass. Cross-layer catalog/tenant coherence remains the blocking Phase 3.5
exit criterion before Phase 4.

## Phase 3.5: Cross-layer catalog/tenant coherence (blocking Phase 4)

Boundary: forward-only RPC/query/branding alignment và database-quality evidence
cho các contract mà client-only Phase 3 không thể chứng minh. Không thực hiện
trong Phase 3; mọi checkbox và user review dưới đây phải còn unchecked cho tới
khi có implementation, gate và phê duyệt riêng.

- [ ] 3.5.1 Tạo forward-only RPC SQL migration trả actual catalog version UUID
      (hoặc query đúng requested version), không giả gắn
      `draft.catalog_version_id` vào canonical response.
- [ ] 3.5.2 Nối parser/query/export context để strict-equality với
      `draft.catalog_version_id`, fail closed khi thiếu/mismatch UUID hoặc
      catalog payload không chứng minh được version.
- [ ] 3.5.3 Align trusted RPC tenant claims và branding resolution với
      `current_don_vi ?? don_vi` cho `global`/`admin`/`to_qltb`, không nới tenant
      isolation và không dùng raw `don_vi` sai tenant.
- [ ] 3.5.4 Viết TDD negative authorization/tenant tests cho mismatch unit,
      cross-tenant branding và role normalization; chứng minh không rò rỉ
      context hoặc workbook.
- [ ] 3.5.5 Chạy SQL Database Quality Gate static và Oracle baseline-forward
      trên cùng exact implementation commit; ghi static/baseline-forward riêng
      và chỉ coi aggregate PASS khi cả hai pass.
- [ ] 3.5.6 Có independent review, explicit USER REVIEW và operation-specific
      approval trước mọi live-write/apply; không apply migration trong task này.
- [ ] 3.5.7 Giữ Phase 4 hard-blocked cho tới khi toàn bộ Phase 3.5 và approval
      hoàn tất; không tick layout/regression closeout dựa trên client-only
      evidence.

Exit criteria: actual catalog UUID, trusted tenant/branding identity, negative
authorization tests và cả hai database-quality lanes có evidence trên cùng
commit; user review và live-write approval rõ ràng.

## Phase 4: Visual, print và regression closeout

Boundary: kiểm tra artifact/UI đã nối, hồi quy các luồng liên quan và closeout.
Theo explicit USER REVIEW ngày 2026-09-07, Phase 4 được phép land bằng
maintainer override/waiver cho phần print renderer không khả dụng. Phase 3.5
vẫn giữ nguyên toàn bộ checkbox unchecked và không được gọi là PASS.

- [x] 4.1 Kiểm tra sample/UI ở A4 landscape: structural width một trang, height
      unlimited, header lặp, title/metadata/table/footnotes đủ, multiline wrap
      và row-height đúng.
      Evidence structural workbook PASS; maintainer chấp thuận/waive việc thiếu
      print renderer độc lập, nên không claim independent render hoặc no-clipping.
- [x] 4.2 Kiểm tra excluded rows: thứ tự không đổi, proposal cells strike,
      source text đọc được, marker và ghi chú cũ cùng tồn tại.
- [x] 4.3 Chạy hồi quy Excel hiện hữu:
      `src/lib/__tests__/excel-workbook.test.ts`,
      `src/lib/__tests__/category-excel.test.ts`,
      `src/lib/__tests__/device-quota-excel.test.ts`.
- [x] 4.4 Chạy hồi quy workspace:
      `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaPageCoexistence.integration.test.tsx`;
      xác minh category CRUD, mapping và cả hai import flow vẫn giữ entry point,
      quyền, payload và behavior. Test drive cụ thể mapping bằng user-event,
      bắt exact `saveBatch`, exact payload của `dinh_muc_nhom_bulk_import` và
      `dinh_muc_unified_import`, exact draft-save payload, và kiểm tra manager
      (`admin`) đối lập non-manager (`technician`).
- [x] 4.5 Chạy lại required TypeScript/React gates ở Phase 3.7 trên cùng commit;
      báo riêng focused tests và React Doctor, không coi timeout là pass. Evidence
      exact SHA lịch sử được giữ trong phase evidence; parent refresh SHA sau land.
- [x] 4.6 Ghi evidence layout/print/regression vào acceptance hoặc phase evidence
      tương ứng; không đánh dấu pass chỉ từ file tồn tại.
- [x] 4.7 `USER REVIEW — Phase 4 closeout:` explicit user approval ngày
      2026-09-07 cho artifact/evidence, maintainer waiver và land trực tiếp;
      không có live DB write trong change này.

Exit criteria: structural layout/print contract và hồi quy import/workspace có
evidence; phần independent print renderer được explicit waiver; static TS/React
gates có evidence exact SHA và parent sẽ cập nhật landed SHA; không có SQL/RPC
mutation/live DB write. Đây không phải là Phase 3.5 PASS.

## Ngoài phạm vi

- Không mở rộng export thành import roundtrip, publish, ký số hoặc approval.
- Nếu cần nhiều format/worksheet khác, tạo change riêng với legal contract
  mới; không thêm cờ tùy chọn vào builder hiện tại.
