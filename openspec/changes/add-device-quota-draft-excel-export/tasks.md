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

- [ ] 2.1 Tạo test Red tại
      `src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts`
      cho schema một sheet/bảy cột, title/metadata, 42 source rows, multiline
      rules, 3 footnotes, null/zero và excluded styling; xác nhận
      `sourcePages`, `sourceReference`, `parentSourceIdentifier` cùng identity
      source/order/catalog chỉ là fixture/validation input và không render thêm
      cột, cột ẩn, comment, sheet hoặc ô user-facing.
- [ ] 2.2 Chạy focused Red:
      `node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts"`;
      ghi failure có ý nghĩa của contract mới.
- [ ] 2.3 Tạo module hữu hạn
      `src/app/(app)/device-quota/categories/draft-catalog/device-quota-draft-catalog-excel-export.ts`
      với type snapshot immutable, mapper và builder; tái sử dụng helper ExcelJS
      hiện có, không thêm domain flags vào flat `exportToExcel`.
- [ ] 2.4 Implement Green tối thiểu: metadata block riêng, bảy headers đúng
      thứ tự, section/item source order, full source text, null/zero semantics,
      excluded row marker/style, footnotes và A4 landscape/fit width/header
      repeat contract.
- [ ] 2.5 Chạy focused Green cùng test path ở 2.2; kiểm tra worksheet thật bằng
      ExcelJS và tạo sample artifact tại
      `openspec/changes/add-device-quota-draft-excel-export/artifacts/device-quota-draft-export-sample.xlsx`.
- [ ] 2.6 Refactor sau Green: tách mapper/style/types nếu chạm ngưỡng 350 dòng,
      giữ hard ceiling 450 dòng, và chạy lại focused test không đổi hành vi.
- [ ] 2.7 Chạy đủ gate TS theo thứ tự tại 3.7, bao gồm hồi quy
      `src/lib/__tests__/excel-workbook.test.ts`; review spec rồi chất lượng,
      ghi Red/Green/gates vào evidence trước commit/push. Kiểm tra tái sử dụng
      liên file bằng Code Review Graph, GitNexus và `rg`; không chạy dedupe toàn repo.
- [ ] 2.8 `USER REVIEW — Phase 2 approval:` người dùng duyệt builder, sample
      artifact và filename trước khi nối vào editor.

Exit criteria: focused workbook tests pass; sample mở được, đúng bảy cột/42
rows/3 notes; không có fetch/mutation; file module nhỏ và reuse helper đã được
ghi evidence; toàn bộ gate TS bắt buộc đạt.

## Phase 3: Tích hợp download vào editor (TDD user-event)

Boundary: hook/page/editor wiring và test interaction. Không sửa RPC/SQL,
không đổi active category/import contracts.

- [ ] 3.1 Tạo Red user-event test tại
      `src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx`
      cho authorized `global`/`admin`/`to_qltb`, current session unit, nút ngay
      trước Save, và một download duy nhất; thêm ca unauthorized role và
      read-only mode để action bị ẩn, không tạo export context/builder/download.
- [ ] 3.2 Mở rộng Red cases cho dirty, save/exclude/restore pending, missing
      snapshot, missing/mismatched branding, exporting lock, builder/download
      error retry, session/unit change, thiếu authenticated `userId` hoặc
      `current_don_vi ?? don_vi` không phải số dương, không refetch và không
      gọi Save. Khi identity mất trong lúc pending, phải hủy và không tải Blob
      stale.
- [ ] 3.3 Chạy focused Red:
      `node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx"`.
- [ ] 3.4 Thêm context export nội bộ tối thiểu từ cùng server draft/catalog
      snapshot; revision/updated_at phải từ saved server response, không từ
      local staged state. Nối branding bằng `useTenantBranding` với id-match
      guard; không tạo public API/RPC.
- [ ] 3.5 Nối editor qua `HierarchicalEditorToolbar.actions`, giữ Save và
      existing mutation state; thêm status/toast retry tiếng Việt và duplicate
      lock.
- [ ] 3.6 Chạy focused Green user-event test; xác minh authorized roles tạo
      đúng một download, còn unauthorized/read-only hoặc thiếu identity ẩn/
      khóa action và không tạo context/builder/download; click không gọi query
      refetch, mutation Save hoặc RPC mới. Nếu fail, sửa implementation theo
      đặc tả; chỉ refactor khi Green, rồi chạy lại test. Không sửa assertion
      hoặc đặc tả chỉ để làm test pass.
- [ ] 3.7 Chạy bắt buộc theo đúng thứ tự cho TS/React diff:
      `node scripts/npm-run.js run format:check` →
      `node scripts/npm-run.js run verify:no-explicit-any` →
      `node scripts/npm-run.js run verify:dedupe` →
      `node scripts/npm-run.js run typecheck` → focused Vitest →
      `node scripts/npm-run.js run react-doctor`. Gom chuỗi kiểm tra trong
      một `ctx_batch_execute`; lưu kết quả có exit code, chạy review spec
      rồi chất lượng và kiểm tra reuse liên file trước commit/push.
- [ ] 3.8 `USER REVIEW — Phase 3 approval:` người dùng duyệt interaction và
      quyền trước khi visual/print closeout.

Exit criteria: user-event matrix pass, snapshot/branding coherence pass, no
duplicate/no refetch/no Save evidence pass, required TS/React gates pass.

## Phase 4: Visual, print và regression closeout

Boundary: kiểm tra artifact/UI đã nối, hồi quy các luồng liên quan và closeout.

- [ ] 4.1 Kiểm tra sample/UI ở A4 landscape: width một trang, height unlimited,
      header lặp, title/metadata/table/footnotes đủ, multiline không bị cắt.
- [ ] 4.2 Kiểm tra excluded rows: thứ tự không đổi, proposal cells strike,
      source text đọc được, marker và ghi chú cũ cùng tồn tại.
- [ ] 4.3 Chạy hồi quy Excel hiện hữu:
      `src/lib/__tests__/excel-workbook.test.ts`,
      `src/lib/__tests__/category-excel.test.ts`,
      `src/lib/__tests__/device-quota-excel.test.ts`.
- [ ] 4.4 Chạy hồi quy workspace:
      `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaPageCoexistence.integration.test.tsx`;
      xác minh category CRUD, mapping và cả hai import flow vẫn giữ entry point,
      quyền, payload và behavior.
- [ ] 4.5 Chạy lại required TypeScript/React gates ở Phase 3.7 trên cùng commit;
      báo riêng focused tests và React Doctor, không coi timeout là pass.
- [ ] 4.6 Ghi evidence layout/print/regression vào acceptance hoặc phase evidence
      tương ứng; không đánh dấu pass chỉ từ commit hoặc file tồn tại.
- [ ] 4.7 `USER REVIEW — Phase 4 closeout:` người dùng duyệt artifact và evidence
      cuối trước khi merge/land; không có live DB write trong change này.

Exit criteria: layout/print contract và hồi quy import/workspace pass; static
TS/React gates pass; mọi evidence gắn đúng commit; không có SQL/RPC mutation.

## Ngoài phạm vi

- Không mở rộng export thành import roundtrip, publish, ký số hoặc approval.
- Nếu cần nhiều format/worksheet khác, tạo change riêng với legal contract
  mới; không thêm cờ tùy chọn vào builder hiện tại.
