# Implementation Tasks

Chi tiết phạm vi, dependency, file ownership, TDD gate và điểm dừng của từng delivery unit nằm trong [implementation-plan.md](./implementation-plan.md).

## Execution Rules

- Mỗi **leaf phase** (`P0`, `P1`, `P3A`...) tương ứng một GitHub issue, một branch, một PR và một phiên triển khai chính.
- Các phase cha như `P3`, `P7`, `P8`, `P9`, `P10`, `P12`, `P13` chỉ dùng để nhóm roadmap, không phải đơn vị triển khai.
- Không bắt đầu leaf phase khi dependency chưa được merge và xác minh trên `main`.
- Trước khi sửa code, leaf phase phải có implementation plan TDD riêng với file path và test command chính xác theo code/live DB tại thời điểm đó.
- Không gộp leaf phase hoặc mở rộng phạm vi nếu chưa được người dùng phê duyệt.
- Mọi DB phase phải chạy authorization/migration gate ngay trong phase đó; không dồn kiểm tra quyền tới hardening cuối.
- Không apply migration lên live Supabase nếu chưa có quyền rõ ràng cho thao tác live DB cụ thể.
- Chỉ đánh dấu leaf phase hoàn thành sau khi code, tests, review, commit, push và issue status đều hoàn tất.

## Roadmap

| Phase                                                                                               | Mục tiêu                                       | Depends on                 | Requirements                                    |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------- | ----------------------------------------------- |
| [P0](./implementation-plan.md#phase-p0---discovery-and-contract-freeze)                             | Discovery và đóng băng contract                | Không                      | TC-01, TC-02, TC-03, TC-05, TC-08, TC-19, TC-20 |
| [P1](./implementation-plan.md#phase-p1---dossier-foundation-and-authorization)                      | Nền tảng hồ sơ và quyền                        | P0                         | TC-01, TC-02, TC-19, TC-20                      |
| [P2](./implementation-plan.md#phase-p2---baseline-draft-data-contracts)                             | Data contract cho bản nháp cơ sở               | P1                         | TC-02, TC-03, TC-20                             |
| [P3A](./implementation-plan.md#phase-p3a---route-workspace-shell-and-dossier-list)                  | Route, workspace shell, danh sách và tạo hồ sơ | P1                         | TC-02, TC-04                                    |
| [P3B](./implementation-plan.md#phase-p3b---manual-baseline-editor-and-save-conflicts)               | Editor cơ sở và save/conflict                  | P2, P3A                    | TC-03, TC-04, TC-20                             |
| [P3C](./implementation-plan.md#phase-p3c---bulk-text-entry)                                         | Nhập nhanh nhiều tiêu chí                      | P3B                        | TC-03, TC-04                                    |
| [P4](./implementation-plan.md#phase-p4---baseline-versioning-lock-and-history)                      | Phiên bản, khóa bất biến và lịch sử            | P2, P3B                    | TC-02, TC-06, TC-07, TC-20                      |
| [P5A](./implementation-plan.md#phase-p5a---shared-equipment-excel-primitives)                       | Shared Excel primitives từ Equipment           | P0; triển khai sau P4      | TC-05                                           |
| [P5B](./implementation-plan.md#phase-p5b---baseline-workbook-codec)                                 | Baseline workbook codec                        | P3B, P4, P5A               | TC-05                                           |
| [P5C](./implementation-plan.md#phase-p5c---atomic-baseline-import-contract)                         | Atomic baseline import RPC                     | P4, P5B                    | TC-02, TC-05, TC-20                             |
| [P5D](./implementation-plan.md#phase-p5d---baseline-import-workflow-ui)                             | Baseline import workflow UI                    | P5B, P5C                   | TC-05, TC-20                                    |
| [P6A](./implementation-plan.md#phase-p6a---url-document-contracts-and-shared-primitives)            | URL document contracts và shared primitives    | P0; triển khai sau P5D     | TC-11                                           |
| [P6B](./implementation-plan.md#phase-p6b---equipment-url-document-consumer-migration)               | Chuyển Equipment sang shared primitives        | P6A                        | TC-11                                           |
| [P7A1](./implementation-plan.md#phase-p7a1---reference-product-data-contracts)                      | Data contract sản phẩm tham chiếu              | P3A, P4                    | TC-02, TC-04, TC-06, TC-08, TC-20               |
| [P7A2](./implementation-plan.md#phase-p7a2---reference-product-workspace)                           | Workspace đối chiếu sản phẩm tham chiếu        | P7A1                       | TC-04, TC-06, TC-08, TC-20                      |
| [P7B1](./implementation-plan.md#phase-p7b1---baseline-and-reference-evidence-contracts)             | Data contract tài liệu/trích dẫn cơ sở         | P4, P6B, P7A2              | TC-02, TC-04, TC-06, TC-11, TC-12, TC-20        |
| [P7B2](./implementation-plan.md#phase-p7b2---baseline-and-reference-evidence-workspace)             | Workspace tài liệu/trích dẫn cơ sở             | P7B1                       | TC-04, TC-06, TC-11, TC-12, TC-20               |
| [P8A1](./implementation-plan.md#phase-p8a1---supplier-data-contracts)                               | Data contract nhà cung cấp                     | P1                         | TC-09, TC-20                                    |
| [P8A2](./implementation-plan.md#phase-p8a2---option-identity-data-contracts)                        | Identity và metadata nhiều phương án           | P8A1                       | TC-09, TC-20                                    |
| [P8A3](./implementation-plan.md#phase-p8a3---baseline-bound-option-response-contracts)              | Response phương án theo baseline version       | P4, P7A1, P8A2             | TC-02, TC-07, TC-09, TC-17, TC-20               |
| [P8A4](./implementation-plan.md#phase-p8a4---side-effect-free-option-response-read-contract)        | Read-only nullable comparison-set contract     | P8A3                       | TC-02, TC-04, TC-07, TC-09, TC-17, TC-20        |
| [P8B1](./implementation-plan.md#phase-p8b1---supplier-and-option-identity-crud-workspace)           | UI CRUD supplier và option identity            | P3A, P8A2                  | TC-04, TC-09, TC-20                             |
| [P8B2](./implementation-plan.md#phase-p8b2---exact-baseline-option-response-workspace)              | UI response theo exact baseline                | P4, P8A3, P8A4, P8B1       | TC-04, TC-09, TC-17, TC-20                      |
| [P8B3](./implementation-plan.md#phase-p8b3---focused-option-response-comparison-ux)                 | UX đối chiếu và nhập response từng tiêu chí    | P8B2                       | TC-04, TC-09, TC-17, TC-20                      |
| [P9A1](./implementation-plan.md#phase-p9a1---supplier-option-workbook-codec)                        | Contract và codec Excel phương án              | P5A, P8B2                  | TC-10                                           |
| [P9A2](./implementation-plan.md#phase-p9a2---atomic-supplier-option-import-contracts)               | Preview/apply nguyên tử cho Excel phương án    | P8A4, P9A1                 | TC-02, TC-10, TC-20                             |
| [P9A3](./implementation-plan.md#phase-p9a3---supplier-option-import-workspace)                      | UI import Excel phương án                      | P8B3, P9A2                 | TC-04, TC-10, TC-20                             |
| [P9B1](./implementation-plan.md#phase-p9b1---supplier-option-evidence-contracts)                    | Data contract tài liệu/trích dẫn phương án     | P7B1, P8A4, P9A3           | TC-02, TC-11, TC-12, TC-20                      |
| [P9B2](./implementation-plan.md#phase-p9b2---supplier-option-evidence-workspace)                    | Workspace tài liệu/trích dẫn phương án         | P6B, P7B2, P8B2, P9B1      | TC-04, TC-11, TC-12, TC-20                      |
| [P10A1](./implementation-plan.md#phase-p10a1---comparison-matrix-read-rpc-and-performance-contract) | RPC/query/performance contract cho so sánh     | P7B2, P9B2                 | TC-02, TC-13, TC-17                             |
| [P10A2](./implementation-plan.md#phase-p10a2---comparison-read-client-contract)                     | Typed client/proxy contract cho so sánh        | P10A1 merged/applied/gated | TC-13, TC-17                                    |
| [P10B1](./implementation-plan.md#phase-p10b1---core-read-only-comparison-matrix)                    | Core matrix read-only                          | P3A, P10A2                 | TC-13, TC-17                                    |
| [P10B2](./implementation-plan.md#phase-p10b2---many-option-column-ergonomics)                       | Column selection, pinning và focus             | P10B1                      | TC-13                                           |
| [P10B3](./implementation-plan.md#phase-p10b3---lazy-read-only-evidence-inspector)                   | Lazy evidence inspector                        | P10B2                      | TC-13                                           |
| [P11A](./implementation-plan.md#phase-p11a---manual-evaluation-domain-contract)                     | Domain và derived-status contract              | P4, P8A3                   | TC-15, TC-16, TC-19                             |
| [P11B](./implementation-plan.md#phase-p11b---manual-assessment-persistence-and-security)            | Persistence, RPC DB và security gate           | P11A                       | TC-02, TC-15, TC-18-S06, TC-19, TC-20           |
| [P11C](./implementation-plan.md#phase-p11c---manual-assessment-client-contract)                     | Proxy, typed client và hook contract           | P8A4, P8B2, P11B gated     | TC-15, TC-19, TC-20                             |
| [P11D](./implementation-plan.md#phase-p11d---complete-manual-assessment-collection)                 | Thu thập đầy đủ assessment sparse              | P7B2, P11C                 | TC-14, TC-15, TC-20                             |
| [P12A1](./implementation-plan.md#phase-p12a1---evaluation-core-and-shared-composition)              | Core đánh giá và composition dùng chung        | P10B3, P11D                | TC-04, TC-13, TC-14, TC-15, TC-16, TC-17, TC-20 |
| [P12A2](./implementation-plan.md#phase-p12a2---guarded-navigation-and-workspace-activation)         | Kích hoạt workflow và navigation có guard      | P12A1                      | TC-04, TC-13, TC-14, TC-15, TC-16, TC-17, TC-20 |
| [P12B](./implementation-plan.md#phase-p12b---evaluation-progress-and-filters)                       | Tiến độ và bộ lọc đánh giá                     | P12A2                      | TC-14, TC-16                                    |
| [P12C](./implementation-plan.md#phase-p12c---optional-reference-ranking)                            | Xếp hạng tham khảo                             | P12B                       | TC-18                                           |
| [P13A](./implementation-plan.md#phase-p13a---database-security-and-performance-hardening)           | Hardening DB, quyền và hiệu năng               | P12C                       | TC-02, TC-20                                    |
| [P13B](./implementation-plan.md#phase-p13b---ui-accessibility-and-regression-hardening)             | Hardening UI, accessibility và regression      | P12C                       | TC-03, TC-04, TC-11, TC-13, TC-14, TC-17, TC-20 |
| [P13C](./implementation-plan.md#phase-p13c---release-openspec-and-ai-boundary-audit)                | Release, OpenSpec và audit AI boundary         | P13A, P13B, P7A2, P9A3     | TC-19                                           |

## Phase P0 - Discovery And Contract Freeze

- [x] P0.1 Tạo issue discovery và phase-specific plan.
- [x] P0.2 Rà live DB read-only, RPC/auth, attachment, Excel, route và migration patterns.
- [x] P0.3 Chốt schema/RPC/type/error/state/concurrency contracts và migration split.
- [x] P0.4 Chốt bốn nhóm gợi ý dạng dữ liệu chỉnh sửa được, fixed criterion columns và quy tắc không có arbitrary content columns.
- [x] P0.5 Chốt requirement traceability, authorization matrix và test matrix cho toàn roadmap.
- [x] P0.6 Ghi feature baseline SHA dùng để audit toàn bộ rollout ở P13.
- [x] P0.7 Review contract, cập nhật OpenSpec nếu cần và đóng issue không sửa production code.

## Phase P1 - Dossier Foundation And Authorization

- [x] P1.1 Thêm schema/RPC tối thiểu cho hồ sơ độc lập và một configuration lineage.
- [x] P1.2 Thêm deny-by-default authorization cho `global`, raw `admin` và role bị từ chối.
- [x] P1.3 Thêm revision guard cho update/archive ngay từ foundation.
- [x] P1.4 Chạy DB phase gate, migration verification và advisors sau live apply được phê duyệt.
- [x] P1.5 Thêm TypeScript contracts, RPC allowlist và focused tests.

## Phase P2 - Baseline Draft Data Contracts

- [x] P2.1 Thêm schema/RPC cho nhóm và tiêu chí bản nháp.
- [x] P2.2 Thêm bốn nhóm gợi ý dưới dạng records chỉnh sửa được; không dùng enum hoặc validation khóa tên nhóm.
- [x] P2.3 Thêm ordering, criterion codes, multiline text và transactional mutations với fixed structural fields.
- [x] P2.4 Thêm optimistic concurrency và structured errors.
- [x] P2.5 Chạy DB phase gate cho quyền, grants/RLS, ownership/cascade và migration.
- [x] P2.6 Viết tests cho nhóm mặc định, tùy biến nhóm, hai cấp, reorder, duplicate code, rollback và conflict.

## Phase P3A - Route, Workspace Shell And Dossier List

- [x] P3A.1 Thêm route và navigation boundary chỉ cho `admin/global`.
- [x] P3A.2 Thêm dossier list/create/open workflow.
- [x] P3A.3 Thêm workspace/tab shell làm integration surface cho các phase sau.
- [x] P3A.4 Giữ shell mỏng và theo dõi extraction threshold.
- [x] P3A.5 Viết role visibility, list/create và browser tests.

## Phase P3B - Manual Baseline Editor And Save Conflicts

- [x] P3B.1 Thêm editor hai cấp group/criterion theo chiều dọc với bốn nhóm gợi ý có thể chỉnh sửa.
- [x] P3B.2 Thêm reorder, multiline content và explicit `Lưu`.
- [x] P3B.3 Không thêm schema builder hoặc custom content-column controls.
- [x] P3B.4 Thêm unsaved, failed-save và optimistic-conflict preservation.
- [x] P3B.5 Tích hợp editor vào workspace shell mà không làm shell phình to.
- [x] P3B.6 Viết focused React tests và browser verification.

## Phase P3C - Bulk Text Entry

- [x] P3C.1 Thêm bulk-entry inline trong nhóm đang chọn.
- [x] P3C.2 Parse text thành preview trước khi mutation.
- [x] P3C.3 Không ghi dữ liệu khi preview còn lỗi.
- [x] P3C.4 Giữ explicit-save contract sau khi bulk add.
- [x] P3C.5 Viết parser, preview, cancel và persistence tests.

## Phase P4 - Baseline Versioning, Lock And History

- [x] P4.1 Thêm state machine `Bản nháp`/`Đã khóa` và version history.
- [x] P4.2 Enforce khóa bất biến ở database/backend, kể cả `admin/global`.
- [x] P4.3 Thêm confirmation, hiển thị `locked_by`/`locked_at` và loại edit affordance.
- [x] P4.4 Thêm expected-revision guard cho lock/copy và giữ form khi conflict.
- [x] P4.5 Thêm tạo draft từ trống hoặc bản đã khóa và historical linkage.
- [x] P4.6 Chạy DB phase gate và tests cho prerequisites/direct mutation/history.

## Phase P5A - Shared Equipment Excel Primitives

- [x] P5A.1 Khóa behavior import/export Excel hiện tại của Equipment bằng focused regression tests.
- [x] P5A.2 Trích workbook creation/loading, worksheet conversion và Blob download primitives khỏi `excel-utils.ts`; giữ compatibility exports.
- [x] P5A.3 Mở rộng `useBulkImportState` bằng custom workbook parser seam có backward-compatible default cho Equipment.
- [x] P5A.4 Tái dùng `BulkImportDialogParts`; không tạo file-input, parse lifecycle, download hoặc error-list primitives song song.
- [x] P5A.5 Chuyển Equipment template download sang shared Blob download primitive mà không đổi filename, workbook hoặc UX.
- [x] P5A.6 Chạy semantic dedup review và toàn bộ Equipment Excel regression verification.

## Phase P5B - Baseline Workbook Codec

- [x] P5B.1 Định nghĩa versioned baseline workbook contract trên shared Excel primitives của P5A.
- [x] P5B.2 Sinh sheet `Baseline`, sheet `_meta` ẩn, tập cột cố định và bốn nhóm gợi ý có thể chỉnh bằng dòng dữ liệu.
- [x] P5B.3 Parse toàn workbook, giữ Unicode/multiline và từ chối sheet, metadata hoặc cột ngoài contract.
- [x] P5B.4 Chuẩn hóa workbook thành canonical rows độc lập UI; mã hiện có read-only và mã mới phải để trống.
- [x] P5B.5 Thêm row-level structural/domain errors và duplicate detection trước khi gọi server preview.
- [x] P5B.6 Viết round-trip, custom-group, extra-column, Unicode, multiline, malformed và version-mismatch tests.

## Phase P5C - Atomic Baseline Import Contract

- [x] P5C.1 Thêm authoritative preview và atomic apply RPC cho toàn baseline draft.
- [x] P5C.2 Dùng chung một server-side validator/normalizer cho preview và apply; không sao chép validation giữa hai RPC.
- [x] P5C.3 Enforce JWT claims, archived/locked/editable guards, template metadata và `p_expected_revision`.
- [x] P5C.4 Giữ mã/ID/source linkage của tiêu chí hiện có; sinh mã mới theo `next_criterion_number` trong transaction.
- [x] P5C.5 Reconcile group/criterion tree và tăng revision đúng một lần; mọi lỗi rollback toàn bộ.
- [x] P5C.6 Viết trust-boundary tests buộc cả preview/apply từ chối metadata lệch target, payload malformed hoặc canonical rows bị sửa.
- [x] P5C.7 Mở rộng RPC map/allowlist/types và chạy migration contract, role/claim, full-tree reconciliation, exact revision/counter, atomicity, stale-revision và phase-gate tests.

## Phase P5D - Baseline Import Workflow UI

- [ ] P5D.1 Thêm import/download action chỉ cho selected draft; download phải dùng P5B generator và P5A Blob helper.
- [ ] P5D.2 Dùng `useBulkImportState` custom parser seam và shared `BulkImportDialogParts` cho file/parse/error lifecycle.
- [ ] P5D.3 Hiển thị authoritative server preview, provisional codes và row-level actionable errors trước mutation.
- [ ] P5D.4 Chỉ gọi atomic apply RPC sau confirmation; không dùng chuỗi group/criterion CRUD RPC.
- [ ] P5D.5 Giữ file, canonical rows và preview khi stale conflict; refresh revision/history mà không mất input.
- [ ] P5D.6 Chặn lock affordance khi import preview/error transient còn mở; không persist import-error entity.
- [ ] P5D.7 Viết draft-only, template-download delegation, no-persistence-before-confirm, success/cache, locked-target và conflict-preservation React tests.

## Phase P6A - URL Document Contracts And Shared Primitives

- [ ] P6A.1 Viết direct characterization tests cho `EquipmentDetailFilesTab`; không dựa vào dialog tests đang mock component/hook.
- [ ] P6A.2 Khóa loading, empty, listed-link, invalid URL, add/reset, rejected-add retry, add-pending inputs/button/spinner, delete cancel/confirm và delete-pending behavior.
- [ ] P6A.3 Viết failing unit tests rồi thêm pure URL parser/policy với exact
      TypeScript signatures; yêu cầu lexical `^https?://`, không có backslash,
      parsed HTTP(S), chấp nhận mixed-case
      `HtTpS://EXAMPLE.com/a/../spec.pdf`, giữ accepted raw value và khóa cả
      resolved anchor destination thay vì expose normalized `URL.href`.
- [ ] P6A.4 Viết failing component tests rồi thêm controlled `UrlDocumentForm`/`UrlDocumentList`, gồm `role="alert"` inline error và outer-form-safe accessible delete buttons.
- [ ] P6A.5 Giữ mutation, toast, confirmation, dirty-state và affected-link policy ngoài shared primitives.
- [ ] P6A.6 Thêm TypeScript-AST source-contract test recursive inventory mọi TS/JS module extension, parse import/import-equals/export-from/dynamic import/`require()`/`ImportTypeNode`, fail computed refs, enforce concrete per-file set equality và tự khóa extractor bằng synthetic fixtures; chạy semantic dedup/focused/TypeScript/React gates và không sửa Equipment production code.

## Phase P6B - Equipment URL Document Consumer Migration

- [ ] P6B.1 Chuyển `EquipmentDetailFilesTab` sang P6A primitives và map `Attachment` sang `id`/`name`/`url`.
- [ ] P6B.2 Giữ local form state, invalid-URL toast, delete confirmation và Google Drive affordance trong Equipment wrapper; gate folder `href` bằng cùng P6A URL utility.
- [ ] P6B.3 Không sửa `useEquipmentAttachments`, RPC names, query keys hoặc `file_dinh_kem` adapter.
- [ ] P6B.4 Chạy P6A baseline green, append red behavior +
      runtime-delegation + consumer AST tests, gồm
      protocol-only/single-slash/backslash URL cases và mixed-case accepted
      vector qua cả add/list/folder sinks; dùng `fireEvent.submit` cho
      handler-level matrix, xác nhận red trước migration, rồi rerun toàn bộ
      characterization/shared/delegation/source-contract tests cùng focused
      dialog/repository gates ở green.
- [ ] P6B.5 Chỉ browser-smoke read-only qua `/equipment?highlight=<fixture-id>` khi đã có authenticated non-production fixture/mock path; nếu không thì ghi `N/A` và dùng focused React tests làm mandatory gate.
- [ ] P6B.6 Enforce exact shared path/named-binding AST contract với cumulative
      manifest chỉ gồm Equipment ở P6B; delegation test mock form/list/utility
      và chứng minh props/callbacks drive active add/list/delete/folder workflow.

## Phase P7A1 - Reference Product Data Contracts

- [x] P7A1.1 Thêm reference products và criterion responses theo exact baseline version.
- [x] P7A1.2 Thêm expected-revision CRUD/upsert, archived/locked guards và ownership/cascade constraints.
- [x] P7A1.3 Mở rộng locked-baseline copy để clone products/responses với ID mới và remap criterion links.
- [x] P7A1.4 Giữ reference products ngoài supplier/option/assessment/ranking domains.
- [x] P7A1.5 Thêm typed RPC names, wire types, module-local wrappers và RPC allowlist mà không đổi shared RPC helper.
- [x] P7A1.6 Chạy migration/source/authorization/concurrency/copy SQL tests và DB phase gate sau explicit live-write approval.
- [x] P7A1.7 Không thêm reference-product UI, hook hoặc workspace state.

## Phase P7A2 - Reference Product Workspace

- [ ] P7A2.1 Thêm bề mặt hàng nhóm/tiêu chí, cột baseline sticky và reference-product columns động.
- [ ] P7A2.2 Thêm chọn cột, cuộn ngang và panel full text; không tạo cột tài liệu cố định.
- [ ] P7A2.3 Thêm explicit save, dirty-state và conflict preservation cho product/criterion-response edits.
- [ ] P7A2.4 Render locked version read-only và không tạo mutation affordance.
- [ ] P7A2.5 Thêm UI qua workspace shell; không thêm P7 state vào baseline tab/editor hook.
- [ ] P7A2.6 Viết optional/multiple/criterion-response/many-column/conflict/reference-not-ranking tests.

## Phase P7B1 - Baseline And Reference Evidence Contracts

- [x] P7B1.1 Thêm document URL metadata và criterion citations cho baseline và từng sản phẩm tham chiếu.
- [x] P7B1.2 Dùng một paginated
      `technical_configuration_baseline_documents_list` aggregate cho cả
      baseline/reference owners; trả exact `owner_type`/`owner_id`, raw URL và
      nested citations chỉ trong cùng baseline version.
- [x] P7B1.3 Reuse document cho nhiều tiêu chí không sao chép URL.
- [x] P7B1.4 Giữ owner rõ ràng để trích dẫn sản phẩm tham chiếu không bị trộn với baseline hoặc phương án.
- [x] P7B1.5 Enforce expected revision, archived/locked immutability, affected-link count và locked-copy remapping.
- [x] P7B1.6 Tạo
      `public._technical_configuration_validate_document_url(text) RETURNS void`
      và dùng trong baseline/reference document create/update RPC trước
      write/revision increment; cùng lexical HTTP(S)/no-backslash contract và
      không rewrite accepted raw URL.
- [x] P7B1.7 Thêm typed RPC names, wire types, module-local wrappers và RPC allowlist mà không đổi shared RPC helper.
- [x] P7B1.8 Chạy DB phase gate cho quyền, ownership,
      malformed/disallowed/protocol-only/single-slash/backslash URL, exact raw
      mixed-case create/update/list stored-returned equality, aggregate-list
      owner/citation scope, cascade, concurrency và `pg_get_functiondef`
      exact-caller contract: bốn callers trước P9B1, sáu callers khi rerun sau
      P9B1, mọi list/delete/citation RPC là non-caller.
- [x] P7B1.9 Không thêm document/citation UI hoặc URL-document consumer mới.

## Phase P7B2 - Baseline And Reference Evidence Workspace

- [x] P7B2.1 Thêm explicit save, dirty-state, expected-revision conflict preservation và tích hợp
      P6B-proven primitives; enforce cumulative Equipment + baseline exact
      path/named-binding AST manifest và runtime-delegation assertions chống
      dead import/local duplicate form/list/URL parsing.
- [x] P7B2.2 Wire baseline/reference owner routing và nested same-version citations từ P7B1 aggregate.
- [x] P7B2.3 Hiển thị reference evidence bằng indicator/detail panel, không thêm permanent evidence columns.
- [x] P7B2.4 Hiển thị affected-link count trước editable delete confirmation.
- [x] P7B2.5 Chặn locked edit/delete trước confirmation flow.
- [x] P7B2.6 Tích hợp qua workspace/reference surfaces; không thêm document state vào baseline tab/editor hook.
- [x] P7B2.7 Viết owner-scope, reuse, raw create/update/list/render, URL
      rejection, delegation, deletion, locked, conflict và long-excerpt tests.
- [x] P7B2.8 Chạy focused React/source-contract/file-size gates; browser gate
      `N/A` vì không có credentials và dev server được yêu cầu giữ dừng; không
      apply live DB.

## Phase P8A1 - Supplier Data Contracts

- [x] P8A1.1 Thêm supplier dossier-scoped với normalized-name uniqueness.
- [x] P8A1.2 Thêm list/create/update/delete RPC với global/raw-admin authorization.
- [x] P8A1.3 Dùng dossier revision cho optimistic concurrency và từ chối mutation khi dossier archived.
- [x] P8A1.4 Giữ supplier RPC-only, RLS deny-by-default và explicit grants.
- [x] P8A1.5 Viết migration/source/RPC allowlist/authorization/ownership/cascade contract tests.
- [x] P8A1.6 Chuẩn bị DB phase gate nhưng không apply hoặc chạy live trước explicit live-write approval.

## Phase P8A2 - Option Identity Data Contracts

- [x] P8A2.1 Thêm nhiều options cho mỗi supplier với model/manufacturer/option-name/notes/audit/display-label contract.
- [x] P8A2.2 Thêm direct-edit/no-lock/no-version contract và optimistic concurrency.
- [x] P8A2.3 Giữ option identity ngoài baseline aggregate và không copy trong baseline-copy flow.
- [x] P8A2.4 Chạy contract/DB phase gate cho authorization, archived reads, ownership, index, cascade và multiple options.

## Phase P8A3 - Baseline-Bound Option Response Contracts

- [x] P8A3.1 Thêm option response datasets bound tới exact baseline version và criterion.
- [x] P8A3.2 Tách response và supplementary information ở cả storage/wire contract; không thêm compliance/evaluation fields trong P8A3.
- [x] P8A3.3 Giữ dataset lịch sử riêng khi nguồn/baseline version thay đổi; không sửa response cũ ngầm.
- [x] P8A3.4 Dùng dossier-revision concurrency với existing-read snapshot nhất quán; existing dataset vẫn đọc được sau archive, còn create/upsert bị chặn; draft/locked baseline đều không chặn.
- [x] P8A3.5 Sau hai quyền live-write riêng cho migration apply và transaction-wrapped phase gate, chạy dedicated option-response contract/DB gate cho baseline binding, ownership, cascade và historical linkage.

## Phase P8A4 - Side-Effect-Free Option Response Read Contract

- [ ] P8A4.1 Thêm nullable `technical_configuration_comparison_set_get` cho exact option + baseline pair.
- [ ] P8A4.2 Trả existing snapshot hoặc `data: null` mà không insert, lock row, tăng dossier revision hoặc đổi audit metadata.
- [ ] P8A4.3 Giữ archived read, exact ownership guards, fixed `search_path`, RPC-only grants và `anon` denial.
- [ ] P8A4.4 Mở rộng typed adapter, allowlist và contract tests nhưng không đổi P8A3 mutation semantics.
- [ ] P8A4.5 Chuẩn bị migration/source/transaction phase gate; apply và phase gate cần hai quyền live-write rõ ràng.

## Phase P8B1 - Supplier And Option Identity CRUD Workspace

- [x] P8B1.1 Thêm UI nhóm nhẹ theo supplier, bật tab `options` và dùng nhãn
      `Nhà cung cấp · Model hoặc tên phương án`.
- [x] P8B1.2 Thêm explicit create/update/delete cho supplier và option identity.
- [x] P8B1.3 Xác nhận xóa option với response-dataset warning; xác nhận xóa supplier với affected-option count và cascade warning.
- [x] P8B1.4 Hiển thị thời điểm cập nhật option metadata gần nhất.
- [x] P8B1.5 Thêm conflict/reload, unsaved, pending, archived read-only và workspace-shell navigation states.
- [x] P8B1.6 Viết multiple-option CRUD, delete, beforeunload, responsive và no-lock-control tests.

## Phase P8B2 - Exact-Baseline Option Response Workspace

- [x] P8B2.1 Dùng P8A4 để đọc existing/null snapshot mà không tạo comparison set khi chọn option/baseline.
- [x] P8B2.2 Thêm manual response/supplementary editor với explicit save.
- [x] P8B2.3 Khi first save, chạy get-or-create rồi upsert bằng revision mới nhất
      được trả về từ chính lời gọi get-or-create đó.
- [x] P8B2.4 Hiển thị `max(option.updated_at, response.updated_at)` cho editor context hiện tại.
- [x] P8B2.5 Giữ option/baseline/criterion/draft khi validation, persistence hoặc conflict thất bại.
- [x] P8B2.6 Thêm dirty navigation cho option/baseline/tab/dossier, archived read-only và draft/locked baseline tests.
- [x] P8B2.7 Viết no-write-on-open, exact-baseline, supplementary-non-scoring, responsive và no-lock-control tests.

## Phase P8B3 - Focused Option Response Comparison UX

- [x] P8B3.1 Giữ supplier selector và option identity editor ở vùng trên; chuyển
      exact-baseline response workspace thành một vùng desktop toàn chiều rộng
      bên dưới.
- [x] P8B3.2 Hiển thị ba vùng ổn định: criterion navigator, panel cấu hình cơ bản
      chỉ đọc và panel response/supplementary chỉnh sửa cho đúng criterion đang
      chọn; không render toàn bộ matrix.
- [x] P8B3.3 Hiển thị trạng thái `chưa có response`, `đã lưu` và `đang có thay đổi
chưa lưu` trong criterion navigator bằng icon/màu nhỏ.
- [x] P8B3.4 Thêm nút `Sao chép từ cấu hình cơ bản`: chỉ copy
      `requirement_text` vào response draft, giữ nguyên supplementary, vẫn cho
      sửa tiếp và không mutation trước explicit save; response không rỗng phải
      xác nhận trước khi ghi đè.
- [x] P8B3.5 Đổi action hiện tại thành secondary `Lưu` và thêm primary
      `Lưu & tiếp theo`; chỉ chuyển sau save thành công tới criterion liền sau
      theo canonical baseline order, không skip criterion đã lưu, không chuyển
      khi validation/conflict/persistence thất bại và criterion cuối chỉ hiển
      thị `Lưu`.
- [x] P8B3.6 Giữ nguyên P8B2 RPC/data semantics, locked-baseline editability,
      archived read-only, dirty navigation và conflict recovery; không thêm API,
      migration, data contract, live DB write, bulk-copy, batch-save hoặc mobile
      responsive acceptance.
- [x] P8B3.7 Viết focused state/React tests cho desktop layout, selected criterion
      binding, status indicators, copy/confirm/cancel, supplementary preservation,
      explicit save và save-next ordering. Browser test được bỏ theo chỉ định thực
      thi ngày 2026-07-25.

## Phase P9A1 - Supplier Option Workbook Codec

- [x] P9A1.1 Đóng băng option workbook v1 với đúng một sheet dữ liệu hiển thị,
      đúng một sheet `_meta` ẩn và tập cột cố định.
- [x] P9A1.2 Sinh template từ exact option + baseline version, giữ criterion
      ID/code, group và requirement context ở dạng read-only.
- [x] P9A1.3 Parse toàn bộ criterion set; mỗi criterion phải xuất hiện đúng một
      lần, thiếu/unknown/duplicate criterion đều bị từ chối.
- [x] P9A1.4 Canonicalize ô response/supplementary trống thành empty string để
      import sau đó xóa nội dung cũ một cách rõ ràng.
- [x] P9A1.5 Từ chối arbitrary/wrong-version/metadata-less/extra-sheet/
      extra-column workbook và giữ URL documents/citations ngoài Excel.
- [x] P9A1.6 Reuse P5A workbook/download primitives; không thêm RPC, migration
      hoặc UI trong leaf này.
- [x] P9A1.7 Viết exact-contract, Vietnamese round-trip và malformed workbook
      tests.

## Phase P9A2 - Atomic Supplier Option Import Contracts

- [x] P9A2.1 Thêm authoritative preview/apply RPC dùng chung một server-side
      validator/normalizer cho exact option + baseline version.
- [x] P9A2.2 Preview là read-only: không tạo comparison set, không ghi response
      và không tăng dossier revision.
- [x] P9A2.3 Apply chỉ chạy sau confirmation, được phép tạo comparison set trong
      transaction và dùng dossier revision làm optimistic concurrency token.
- [x] P9A2.4 Reconcile full response snapshot: mọi criterion phải có mặt đúng
      một lần; empty string xóa response/supplementary cũ; revision tăng đúng
      một lần cho toàn apply.
- [x] P9A2.5 Từ chối stale revision, archived dossier, metadata lệch target,
      malformed/tampered canonical rows và mọi partial write.
- [x] P9A2.6 Không thay đổi option identity, URL documents, citations,
      assessments hoặc baseline aggregate.
- [x] P9A2.7 Mở rộng RPC map/types/allowlist và chạy migration/source,
      role/claim, no-write preview, full-snapshot, atomicity và rollback phase
      gates.

## Phase P9A3 - Supplier Option Import Workspace

- [x] P9A3.1 Thêm download/import action vào exact-baseline option response
      workspace, không đặt vào option identity editor.
- [x] P9A3.2 Dùng P9A1 codec, P5A `useBulkImportState`, Blob helper và shared
      bulk-import dialog parts.
- [x] P9A3.3 Không mutation trước preview confirmation; apply chỉ gọi P9A2
      atomic RPC.
- [x] P9A3.4 Giữ selected file, canonical rows và preview khi stale conflict;
      refresh revision mà không làm mất input.
- [x] P9A3.5 Adopt complete returned snapshot và đồng bộ option-response,
      dossier/detail caches sau success.
- [x] P9A3.6 Import pending/dirty state phải chặn identity mutations và
      option/baseline/tab/dossier navigation; locked baseline vẫn editable,
      archived dossier read-only.
- [x] P9A3.7 Viết template delegation, full-snapshot clear, missing-row reject,
      no-write-before-confirm, success/cache và conflict-preservation React
      tests.

## Phase P9B1 - Supplier Option Evidence Contracts

- [x] P9B1.1 Thêm option-level document URL metadata và exact-comparison-set
      criterion citations với composite ownership/FK guards.
- [x] P9B1.2 Document được dùng chung cho option trên nhiều baseline; citation
      chỉ thuộc exact option + baseline + criterion.
- [x] P9B1.3 List theo option + baseline không tạo comparison set, trả document
      dùng chung, citations của exact set và tổng affected citation count trên
      mọi baseline.
- [x] P9B1.4 Reuse authoritative P7B1 HTTP(S) validator trong option document
      create/update; exact caller set tăng từ bốn lên sáu.
- [x] P9B1.5 Document/citation mutations dùng dossier revision, vẫn cho phép khi
      baseline locked và từ chối khi dossier archived.
- [x] P9B1.6 Confirmed document delete xóa document cùng mọi citation liên quan
      trong một transaction; không có unconfirmed mutation.
- [x] P9B1.7 Thêm typed RPC names/wire types/wrappers/allowlist mà chưa mở UI.
- [x] P9B1.8 Chạy migration/source, role/claim, RLS/grants/search_path,
      owner/version isolation, raw URL, affected-count, cascade, stale revision
      và exact-six-caller phase gates.

## Phase P9B2 - Supplier Option Evidence Workspace

- [x] P9B2.1 Thêm option-specific evidence hook/component; không mở rộng
      baseline/reference document hook bằng option-specific branching.
- [x] P9B2.2 Reuse P6B-proven `UrlDocumentForm`/`UrlDocumentList` và
      P7B2-proven owner-neutral citation editor behavior.
- [x] P9B2.3 First citation save dùng established comparison-set
      get-or-create revision chain; list/open vẫn side-effect-free.
- [x] P9B2.4 Thêm explicit save, dirty/conflict preservation, option-level
      document reuse và delete confirmation hiển thị tổng affected citations.
- [x] P9B2.5 Locked baseline vẫn cho sửa option evidence; archived dossier
      read-only; pending evidence state chặn identity/response mutations và
      navigation.
- [x] P9B2.6 Enforce cumulative Equipment + baseline + option exact
      path/named-binding AST manifest và runtime-delegation assertions.
- [x] P9B2.7 Rerun baseline/reference SQL + React suites cùng option evidence
      suites; chỉ leaf này mark TC-11-S01..S05 và TC-12-S01/S02 complete.

## Phase P10A1 - Comparison Matrix Read RPC And Performance Contract

- [ ] P10A1.1 Thêm `technical_configuration_comparison_get` set-based,
      side-effect-free cho một baseline version và 1-8 option IDs có thứ tự.
- [ ] P10A1.2 Thêm raw admin/global claim guard, fail-closed claims và
      same-dossier validation không tạo ownership oracle.
- [ ] P10A1.3 Phân trang criteria trước aggregation, trả tối đa 100 criteria và
      giữ option request order bằng ordinality; reject NULL/duplicate/0/9 IDs.
- [ ] P10A1.4 Aggregate exact baseline/option response cùng fixed-size
      `document_count`/`citation_count`/`has_evidence`; không nhúng full
      evidence/reference-product data và giữ supplementary tách khỏi
      response/compliance.
- [ ] P10A1.5 Giữ archived/locked read-only semantics, explicit grants/revokes,
      `search_path`; nếu inner-query `EXPLAIN` sau apply chứng minh cần index,
      thêm follow-up index migration trong cùng P10A1 rồi apply/gate lại.
- [ ] P10A1.6 Viết migration source contract và rollback-only SQL phase gate cho
      exact nested/error schema, null/bounds, authorization, no-write, exact
      scope, 450-line ceiling và fixture 500 x 50 x 8.
- [ ] P10A1.7 Chỉ apply/chạy live phase gate sau từng permission cụ thể; sau
      apply chạy security/performance advisors.

## Phase P10A2 - Comparison Read Client Contract

- [ ] P10A2.1 Thêm RPC-name manifest và proxy allowlist entry, không đổi behavior
      của shared RPC transport.
- [ ] P10A2.2 Thêm wire/domain types và typed adapter bám nguyên contract P10A1.
- [ ] P10A2.3 Thêm query key gồm baseline version, immutable snapshot của
      ordered option IDs, page và page size; không sort/deduplicate IDs.
- [ ] P10A2.4 Thêm `useTechnicalConfigurationComparison` với enablement,
      `AbortSignal`, `staleTime: 30_000`, `retry: false` và
      `refetchOnWindowFocus: false`.
- [ ] P10A2.5 Viết source/contract tests cho RPC name, allowlist, args, response,
      ordered key, one-call/disabled behavior và rerun P10A1 source contracts.

## Phase P10B1 - Core Read-Only Comparison Matrix

- [x] P10B1.1 Thêm baseline-version selection, ordered selected-option controls
      tối đa 8 phương án và fixed criterion page size 50.
- [x] P10B1.2 Reuse một shared read-only option-list query seam mà không đổi P8
      draft/mutation behavior.
- [x] P10B1.3 Hiển thị ordered groups/criteria theo hàng, sticky baseline,
      dynamic option columns và bounded horizontal scroll.
- [x] P10B1.4 Thêm concise read-only cells cùng text-only detail panel cho full
      requirement, response và supplementary information.
- [x] P10B1.5 Tích hợp và enable comparison tab nhưng giữ matrix state/data hooks
      ngoài workspace shell.
- [x] P10B1.6 Khóa ownership: không response editor, copy, dirty draft, save,
      assessment persistence, ranking hoặc derived compliance.
- [x] P10B1.7 Viết ordered-selection, paging, long-text, empty/loading/error,
      keyboard, responsive-source và P8 regression tests; không browser test.

## Phase P10B2 - Many-Option Column Ergonomics

- [x] P10B2.1 Tách selected request order khỏi view-only visible option order;
      visibility không đổi query key.
- [x] P10B2.2 Giữ baseline luôn sticky và cho ghim tối đa 2 visible option
      columns theo selected-option order.
- [x] P10B2.3 Thêm focus mode baseline + một option, thoát focus khôi phục
      visible/pinned state trước đó.
- [x] P10B2.4 Giữ stable widths/offsets và horizontal access với 8 options ở
      narrow/wide layout.
- [x] P10B2.5 Viết reducer, keyboard/focus, pin-limit, many-column,
      responsive-source và file-size tests; không browser test.

## Phase P10B3 - Lazy Read-Only Evidence Inspector

- [x] P10B3.1 Lazy-load read-only documents, excerpts và criterion citations cho
      đúng một baseline hoặc option cell đang mở.
- [x] P10B3.2 Không fetch khi panel đóng hoặc evidence summary báo không có dữ
      liệu; dùng bounded page/load-more.
- [x] P10B3.3 Reuse nguyên P7 baseline và P9 exact-baseline option RPC/query-key
      paths; không thêm per-option comparison fetch path thứ hai.
- [x] P10B3.4 Giữ reference-product evidence ngoài matrix và không render
      mutation/assessment controls.
- [x] P10B3.5 Viết lazy enablement, exact RPC, citation filtering, long excerpt,
      keyboard/focus và P7/P9 regression tests; không browser test.
- [x] P10B3.6 Ghi rõ browser screenshot/interaction verification của toàn P10B
      được defer sang P13B theo chỉ định product owner.

## Phase P11A - Manual Evaluation Domain Contract

- [x] P11A.1 Thêm stable ASCII values và Vietnamese label maps cho hai trục và
      derived status.
- [x] P11A.2 Thêm pure derived-status function; không persist hoặc cho sửa trực
      tiếp derived status.
- [x] P11A.3 Chốt cả missing technical-axis và missing evidence-axis thành
      `not_evaluated` theo canonical precedence.
- [x] P11A.4 Viết exhaustive table-driven mapping và invalid-value tests.
- [x] P11A.5 Audit leaf không thêm DB, RPC, hook, UI hoặc AI runtime artifact.

## Phase P11B - Manual Assessment Persistence And Security

- [x] P11B.1 Thêm bảng assessment unique theo comparison set + criterion với
      exact ownership FKs và canonical two-axis values.
- [x] P11B.2 Thêm notes, row-level `revision BIGINT`; dùng
      `updated_by`/`updated_at` làm latest evaluator metadata.
- [x] P11B.3 Đóng băng và triển khai exact list/upsert arguments, nullability,
      wire order, first-create revision semantics cùng JWT, admin/global,
      archived-dossier và deny-by-default guards.
- [x] P11B.4 Giữ manual conclusions tách khỏi source updates và future AI data;
      không thêm derived/stale/machine-result fields.
- [x] P11B.5 Viết migration source tests và rollback-only DB phase gate cho
      auth, ownership, conflict, source preservation, cascade, grants/RLS và
      no-AI audit.
- [x] P11B.6 Xin explicit approval riêng để apply exact migration; sau apply chạy
      read-only security/performance advisors.
- [x] P11B.7 Xin explicit approval riêng để chạy rollback-only phase gate; xác
      nhận rollback/fixture cleanup và chạy lại read-only advisors.

## Phase P11C - Manual Assessment Client Contract

- [x] P11C.1 Thêm dedicated RPC manifest và proxy allowlist sau khi P11B đã
      merged/applied/gated.
- [x] P11C.2 Thêm typed wire/request contracts, RPC adapter và bounded query key.
- [x] P11C.3 Reuse P8A4 nullable read và P8B2 no-write-on-open/first-save
      orchestration trên P8A3 get-or-create; thêm assessment hook ngoài
      workspace shell, dedupe in-flight acquisition cho concurrent first saves
      nhưng không tạo mutation path thứ hai, production controls hoặc navigation.
- [x] P11C.4 Bảo toàn validation/auth/conflict errors và row revisions cho
      P11D/P12A.
- [x] P11C.5 Viết manifest, whitelist, wire, adapter và hook contract tests;
      invalidate mọi bounded assessment page sau save và audit không có
      ranking/AI runtime artifact.

## Phase P11D - Complete Manual Assessment Collection

- [x] P11D.1 Thêm complete-collection query dưới assessment query prefix hiện
      có; giữ bounded single-page contract của P11C.
- [x] P11D.2 Thu thập các trang ổn định qua RPC hiện có và
      `collectStableTechnicalConfigurationPages()`, sau đó reconcile theo
      `criterion_id`; không ghép assessment page N với criterion page N.
- [x] P11D.3 Bảo toàn `AbortSignal`, exact wire values, typed errors,
      no-write-on-open và comparison-set acquisition hiện có.
- [x] P11D.4 Khóa zero/sparse/>100 rows, duplicate/incomplete-page protection,
      prefix invalidation và no-write-on-mount bằng test.
- [x] P11D.5 Không thêm migration, RPC/proxy path, UI, navigation, ranking hoặc
      AI runtime artifact.

## Phase P12A1 - Evaluation Core And Shared Composition

- [x] P12A1.1 Thêm criterion list theo canonical group/order với simple current
      status badge; chưa thêm counter, summary hoặc filter.
- [x] P12A1.2 Compose evaluation panel từ P10B
      `TechnicalConfigurationCriterionPanel`; không duplicate read
      renderer/query/evidence path.
- [x] P12A1.3 Thêm assessment controls cho hai trục, notes và derived status từ
      đúng P11A source of truth.
- [x] P12A1.4 Thêm local draft/save state machine, adopt row revision sau save
      bằng cùng immutable draft snapshot cho saving state và mutation payload;
      reject stale callback sau context switch và giữ criterion/input khi
      validation/auth/conflict/persistence thất bại.
- [x] P12A1.5 Viết core/state/composition tests; giữ toàn bộ component/hook
      dormant, khóa edit-then-save cùng một nhịp và chưa mount vào production UI.

## Phase P12A2 - Guarded Navigation And Workspace Activation

- [x] P12A2.1 Mount evaluation workspace bằng internal segmented mode
      `Ma trận` / `Đánh giá` trong tab `So sánh & đánh giá`; không thêm
      top-level tab thứ sáu.
- [x] P12A2.2 Dùng một option selector, canonical criterion page controls và chỉ
      hai action chính `Lưu`, `Lưu & tiếp tục`.
- [x] P12A2.3 `Lưu` giữ criterion; save-next chỉ chuyển sau success, đi qua page
      boundary và giữ criterion cuối.
- [x] P12A2.4 Dùng một dirty-navigation contract cho option/criterion/page/view/
      tab/dossier: pending hard-block, dirty idle confirm-discard, cancel giữ draft.
- [x] P12A2.5 Tích hợp workspace revision đúng ownership; viết workflow,
      navigation và shell-integration tests bằng `@testing-library/user-event`;
      defer toàn bộ browser verification sang P13B.

## Phase P12B - Evaluation Progress And Filters

- [ ] P12B.1 Thêm progress/status summaries theo group và option.
- [ ] P12B.2 Thêm lọc chưa đánh giá, không đạt và thiếu bằng chứng.
- [ ] P12B.3 Bảo toàn selection/navigation khi đổi filter.
- [ ] P12B.4 Không thêm ranking hoặc AI trong phase này.
- [ ] P12B.5 Viết counter/filter/navigation tests.

## Phase P12C - Optional Reference Ranking

- [ ] P12C.1 Thêm ranking theo ba quy tắc minh bạch đã khóa.
- [ ] P12C.2 Loại option chưa đủ hai trục cho mọi tiêu chí áp dụng.
- [ ] P12C.3 Thêm ties, disclaimer và scope guards.
- [ ] P12C.4 Ngăn cross-dossier/version/reference-product ranking.
- [ ] P12C.5 Viết precedence, eligibility, ties và disclaimer tests.
- [ ] P12C.6 Giữ manual conclusions và ranking eligibility khi source data thay
      đổi; viết regression test không có manual stale marker.

## Phase P13A - Database Security And Performance Hardening

- [ ] P13A.1 Rerun full authorization matrix và direct-backend denial tests.
- [ ] P13A.2 Audit grants/RLS/search_path/ownership/cascade trên live schema read-only.
- [ ] P13A.3 Audit migration order, query bounds, indexes, N+1 và representative plans.
- [ ] P13A.4 Chạy security/performance advisors sau các live apply đã được phê duyệt.
- [ ] P13A.5 Không sửa production code; mỗi gap tạo blocking fix leaf riêng rồi rerun P13A.

## Phase P13B - UI, Accessibility And Regression Hardening

- [ ] P13B.1 Kiểm tra keyboard/focus/accessibility và dirty-navigation.
- [ ] P13B.2 Kiểm tra long Vietnamese text, many options, narrow viewport và
      P10B3 evidence detail states/focus restoration trên desktop/mobile.
- [ ] P13B.3 Kiểm tra default/editable groups, many reference products và không xuất hiện custom content-column controls.
- [ ] P13B.4 Kiểm tra concurrent edits và conflict recovery qua hai tab.
- [ ] P13B.5 Kiểm tra P12A1/P12A2 reuse P10B detail và supplementary information vẫn
      non-scoring sau save/save-next/derived status.
- [ ] P13B.6 Chạy Equipment attachment regression và full relevant React tests.
- [ ] P13B.7 Chạy full React Doctor command và browser screenshot/interaction verification.
- [ ] P13B.8 Không sửa production code; mỗi gap tạo blocking fix leaf riêng rồi rerun P13B.

## Phase P13C - Release, OpenSpec And AI Boundary Audit

- [ ] P13C.1 Chạy full quality gates và `openspec validate ... --strict`.
- [ ] P13C.2 Dùng feature baseline SHA để audit commit/file coverage và tổng hợp per-leaf gate evidence.
- [ ] P13C.3 Xác minh không có AI UI/API/job/cache/quota/table trong MVP.
- [ ] P13C.4 Xác minh stable IDs/data boundaries hỗ trợ AI follow-up.
- [ ] P13C.5 Hoàn tất runbook, release notes, rollout và rollback instructions.
- [ ] P13C.6 Cập nhật OpenSpec tasks theo trạng thái landed và hoàn tất release review.
