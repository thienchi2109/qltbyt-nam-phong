# Implementation Tasks

Chi tiết phạm vi, dependency, file ownership, TDD gate và điểm dừng của từng delivery unit nằm trong [implementation-plan.md](./implementation-plan.md).

## Execution Rules

- Mỗi **leaf phase** (`P0`, `P1`, `P3A`...) tương ứng một GitHub issue, một branch, một PR và một phiên triển khai chính.
- Các phase cha như `P3`, `P7`, `P8`, `P9`, `P10`, `P12`, `P13`, `P14`
  chỉ dùng để nhóm roadmap, không phải đơn vị triển khai.
- Không bắt đầu leaf phase khi dependency chưa được merge và xác minh trên `main`.
- Trước khi sửa code, leaf phase phải có implementation plan TDD riêng với file path và test command chính xác theo code/live DB tại thời điểm đó.
- Không gộp leaf phase hoặc mở rộng phạm vi nếu chưa được người dùng phê duyệt.
- Mọi DB phase phải chạy authorization/migration gate ngay trong phase đó; không dồn kiểm tra quyền tới hardening cuối.
- Không apply migration lên live Supabase nếu chưa có quyền rõ ràng cho thao tác live DB cụ thể.
- Chỉ đánh dấu leaf phase hoàn thành sau khi code, tests, review, commit, push và issue status đều hoàn tất.

## Roadmap

| Phase                                                                                                     | Mục tiêu                                       | Depends on                                       | Requirements                                           |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| [P0](./implementation-plan.md#phase-p0---discovery-and-contract-freeze)                                   | Discovery và đóng băng contract                | Không                                            | TC-01, TC-02, TC-03, TC-05, TC-08, TC-19, TC-20        |
| [P1](./implementation-plan.md#phase-p1---dossier-foundation-and-authorization)                            | Nền tảng hồ sơ và quyền                        | P0                                               | TC-01, TC-02, TC-19, TC-20                             |
| [P2](./implementation-plan.md#phase-p2---baseline-draft-data-contracts)                                   | Data contract cho bản nháp cơ sở               | P1                                               | TC-02, TC-03, TC-20                                    |
| [P3A](./implementation-plan.md#phase-p3a---route-workspace-shell-and-dossier-list)                        | Route, workspace shell, danh sách và tạo hồ sơ | P1                                               | TC-02, TC-04                                           |
| [P3B](./implementation-plan.md#phase-p3b---manual-baseline-editor-and-save-conflicts)                     | Editor cơ sở và save/conflict                  | P2, P3A                                          | TC-03, TC-04, TC-20                                    |
| [P3C](./implementation-plan.md#phase-p3c---bulk-text-entry)                                               | Nhập nhanh nhiều tiêu chí                      | P3B                                              | TC-03, TC-04                                           |
| [P4](./implementation-plan.md#phase-p4---baseline-versioning-lock-and-history)                            | Phiên bản, khóa bất biến và lịch sử            | P2, P3B                                          | TC-02, TC-06, TC-07, TC-20                             |
| [P5A](./implementation-plan.md#phase-p5a---shared-equipment-excel-primitives)                             | Shared Excel primitives từ Equipment           | P0; triển khai sau P4                            | TC-05                                                  |
| [P5B](./implementation-plan.md#phase-p5b---baseline-workbook-codec)                                       | Baseline workbook codec                        | P3B, P4, P5A                                     | TC-05                                                  |
| [P5C](./implementation-plan.md#phase-p5c---atomic-baseline-import-contract)                               | Atomic baseline import RPC                     | P4, P5B                                          | TC-02, TC-05, TC-20                                    |
| [P5D](./implementation-plan.md#phase-p5d---baseline-import-workflow-ui)                                   | Baseline import workflow UI                    | P5B, P5C                                         | TC-05, TC-20                                           |
| [P6A](./implementation-plan.md#phase-p6a---url-document-contracts-and-shared-primitives)                  | URL document contracts và shared primitives    | P0; triển khai sau P5D                           | TC-11                                                  |
| [P6B](./implementation-plan.md#phase-p6b---equipment-url-document-consumer-migration)                     | Chuyển Equipment sang shared primitives        | P6A                                              | TC-11                                                  |
| [P7A1](./implementation-plan.md#phase-p7a1---reference-product-data-contracts)                            | Data contract sản phẩm tham chiếu              | P3A, P4                                          | TC-02, TC-04, TC-06, TC-08, TC-20                      |
| [P7A2](./implementation-plan.md#phase-p7a2---reference-product-workspace)                                 | Workspace đối chiếu sản phẩm tham chiếu        | P7A1                                             | TC-04, TC-06, TC-08, TC-20                             |
| [P7B1](./implementation-plan.md#phase-p7b1---baseline-and-reference-evidence-contracts)                   | Data contract tài liệu/trích dẫn cơ sở         | P4, P6B, P7A2                                    | TC-02, TC-04, TC-06, TC-11, TC-12, TC-20               |
| [P7B2](./implementation-plan.md#phase-p7b2---baseline-and-reference-evidence-workspace)                   | Workspace tài liệu/trích dẫn cơ sở             | P7B1                                             | TC-04, TC-06, TC-11, TC-12, TC-20                      |
| [P8A1](./implementation-plan.md#phase-p8a1---supplier-data-contracts)                                     | Data contract nhà cung cấp                     | P1                                               | TC-09, TC-20                                           |
| [P8A2](./implementation-plan.md#phase-p8a2---option-identity-data-contracts)                              | Identity và metadata nhiều phương án           | P8A1                                             | TC-09, TC-20                                           |
| [P8A3](./implementation-plan.md#phase-p8a3---baseline-bound-option-response-contracts)                    | Response phương án theo baseline version       | P4, P7A1, P8A2                                   | TC-02, TC-07, TC-09, TC-17, TC-20                      |
| [P8A4](./implementation-plan.md#phase-p8a4---side-effect-free-option-response-read-contract)              | Read-only nullable comparison-set contract     | P8A3                                             | TC-02, TC-04, TC-07, TC-09, TC-17, TC-20               |
| [P8B1](./implementation-plan.md#phase-p8b1---supplier-and-option-identity-crud-workspace)                 | UI CRUD supplier và option identity            | P3A, P8A2                                        | TC-04, TC-09, TC-20                                    |
| [P8B2](./implementation-plan.md#phase-p8b2---exact-baseline-option-response-workspace)                    | UI response theo exact baseline                | P4, P8A3, P8A4, P8B1                             | TC-04, TC-09, TC-17, TC-20                             |
| [P8B3](./implementation-plan.md#phase-p8b3---focused-option-response-comparison-ux)                       | UX đối chiếu và nhập response từng tiêu chí    | P8B2                                             | TC-04, TC-09, TC-17, TC-20                             |
| [P9A1](./implementation-plan.md#phase-p9a1---supplier-option-workbook-codec)                              | Contract và codec Excel phương án              | P5A, P8B2                                        | TC-10                                                  |
| [P9A2](./implementation-plan.md#phase-p9a2---atomic-supplier-option-import-contracts)                     | Preview/apply nguyên tử cho Excel phương án    | P8A4, P9A1                                       | TC-02, TC-10, TC-20                                    |
| [P9A3](./implementation-plan.md#phase-p9a3---supplier-option-import-workspace)                            | UI import Excel phương án                      | P8B3, P9A2                                       | TC-04, TC-10, TC-20                                    |
| [P9B1](./implementation-plan.md#phase-p9b1---supplier-option-evidence-contracts)                          | Data contract tài liệu/trích dẫn phương án     | P7B1, P8A4, P9A3                                 | TC-02, TC-11, TC-12, TC-20                             |
| [P9B2](./implementation-plan.md#phase-p9b2---supplier-option-evidence-workspace)                          | Workspace tài liệu/trích dẫn phương án         | P6B, P7B2, P8B2, P9B1                            | TC-04, TC-11, TC-12, TC-20                             |
| [P10A1](./implementation-plan.md#phase-p10a1---comparison-matrix-read-rpc-and-performance-contract)       | RPC/query/performance contract cho so sánh     | P7B2, P9B2                                       | TC-02, TC-13, TC-17                                    |
| [P10A2](./implementation-plan.md#phase-p10a2---comparison-read-client-contract)                           | Typed client/proxy contract cho so sánh        | P10A1 merged/applied/gated                       | TC-13, TC-17                                           |
| [P10B1](./implementation-plan.md#phase-p10b1---core-read-only-comparison-matrix)                          | Core matrix read-only                          | P3A, P10A2                                       | TC-13, TC-17                                           |
| [P10B2](./implementation-plan.md#phase-p10b2---many-option-column-ergonomics)                             | Column selection, pinning và focus             | P10B1                                            | TC-13                                                  |
| [P10B3](./implementation-plan.md#phase-p10b3---lazy-read-only-evidence-inspector)                         | Lazy evidence inspector                        | P10B2                                            | TC-13                                                  |
| [P11A](./implementation-plan.md#phase-p11a---manual-evaluation-domain-contract)                           | Domain và derived-status contract              | P4, P8A3                                         | TC-15, TC-16, TC-19                                    |
| [P11B](./implementation-plan.md#phase-p11b---manual-assessment-persistence-and-security)                  | Persistence, RPC DB và security gate           | P11A                                             | TC-02, TC-15, TC-18-S06, TC-19, TC-20                  |
| [P11C](./implementation-plan.md#phase-p11c---manual-assessment-client-contract)                           | Proxy, typed client và hook contract           | P8A4, P8B2, P11B gated                           | TC-15, TC-19, TC-20                                    |
| [P11D](./implementation-plan.md#phase-p11d---complete-manual-assessment-collection)                       | Thu thập đầy đủ assessment sparse              | P7B2, P11C                                       | TC-14, TC-15, TC-20                                    |
| [P12A1](./implementation-plan.md#phase-p12a1---evaluation-core-and-shared-composition)                    | Core đánh giá và composition dùng chung        | P10B3, P11D                                      | TC-04, TC-13, TC-14, TC-15, TC-16, TC-17, TC-20        |
| [P12A2](./implementation-plan.md#phase-p12a2---guarded-navigation-and-workspace-activation)               | Kích hoạt workflow và navigation có guard      | P12A1                                            | TC-04, TC-13, TC-14, TC-15, TC-16, TC-17, TC-20        |
| [P12B1](./implementation-plan.md#phase-p12b1---selected-option-progress-foundation)                       | Nền tảng tiến độ option đang chọn              | P12A2                                            | TC-04, TC-14, TC-16                                    |
| [P12B2](./implementation-plan.md#phase-p12b2---filtered-guarded-navigation)                               | Lọc và điều hướng có guard                     | P12B1                                            | TC-04, TC-14, TC-16, TC-20                             |
| [P12C1](./implementation-plan.md#phase-p12c1---complete-option-ranking-read-contract)                     | Contract đọc xếp hạng đầy đủ                   | P12B2 merged/applied/gated                       | TC-18-S01, S02, S03, S05, S06                          |
| [P12C2](./implementation-plan.md#phase-p12c2---optional-reference-ranking-ui)                             | UI xếp hạng tham khảo tùy chọn                 | P12C1 merged/applied/gated                       | TC-18                                                  |
| [P13A-P1](./implementation-plan.md#phase-p13a-p1---mandatory-representative-ranking-performance-evidence) | Bằng chứng hiệu năng ranking đại diện bắt buộc | P12C1 merged/applied/gated                       | TC-20 DB prerequisite                                  |
| [P13A-P2](./implementation-plan.md#phase-p13a-p2---conditional-ranking-query-remediation)                 | Remediation query/index ranking có điều kiện   | P13A-P1 fail, scope chính xác                    | TC-20 exact failed invariant                           |
| [P13A-V](./implementation-plan.md#phase-p13a-v---final-database-security-and-performance-verification)    | Gate DB security/performance cuối              | P13A-P1 pass; hoặc P13A-P2 gated + P1 rerun pass | TC-02, final TC-20                                     |
| [P13B](./implementation-plan.md#phase-p13b---ui-accessibility-and-regression-hardening)                   | Hardening UI, accessibility và regression      | P12C2                                            | TC-03, TC-04, TC-11, TC-13, TC-14, TC-17, TC-18, TC-20 |
| [P14A1](./implementation-plan.md#phase-p14a1---canonical-export-snapshot-manifest)                        | Manifest snapshot export canonical             | P12C1 merged/applied/gated                       | TC-21-S02, S06, S07, S08                               |
| [P14A2](./implementation-plan.md#phase-p14a2---paginated-export-ranking-and-matrix-contracts)             | RPC export ranking/matrix phân trang           | P14A1 merged/applied/gated                       | TC-21-S03, S04, S06, S07, S08                          |
| [P14A3](./implementation-plan.md#phase-p14a3---typed-export-adapters-and-stable-dataset-collector)        | Adapter typed và collector snapshot ổn định    | P14A2 merged/applied/gated                       | TC-21-S02, S04, S06, S07, S08                          |
| [P14A4](./implementation-plan.md#phase-p14a4---ordered-result-export-axes)                                | Trục option/criterion có thứ tự độc lập        | P14A3 merged/applied/gated                       | TC-21-S03, S04, S06, S07, S08                          |
| [P14B1](./implementation-plan.md#phase-p14b1---result-workbook-schema-and-representative-fixtures)        | Schema workbook và fixture đại diện            | P14A4 merged/applied/gated                       | TC-21-S03, S04, S05, S09                               |
| [P14B1F](./implementation-plan.md#phase-p14b1f---ranking-presentation-contract-repair)                    | Repair dữ liệu/copy ranking trong pure model   | P14B1                                            | TC-21-S03, S05, S09                                    |
| [P14B2](./implementation-plan.md#phase-p14b2---approved-exceljs-workbook-rendering)                       | Render ExcelJS đúng mockup đã duyệt            | P14B1F                                           | TC-21-S03, S04, S05, S09                               |
| [P14C1](./implementation-plan.md#phase-p14c1---export-scope-dialog-and-state-machine)                     | Dialog chọn nội dung và phạm vi export         | P14B2                                            | TC-21-S01, S02, S04                                    |
| [P14C2](./implementation-plan.md#phase-p14c2---export-orchestration-download-and-workspace-activation)    | Mount trigger, orchestration và download       | P14C1                                            | TC-21                                                  |
| [P13C](./implementation-plan.md#phase-p13c---release-openspec-and-ai-boundary-audit)                      | Release, OpenSpec và audit AI boundary         | P13A-V, P13B, P7A2, P9A3, P14C2                  | TC-19                                                  |

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

## Phase P12B1 - Selected-Option Progress Foundation

Legacy mapping: hoàn tất P12B.1 và phần counter/cache/integration của P12B.5.
Filter/navigation và task scope-guard P12B.4 không thuộc leaf này.

- [x] P12B1.1 Chốt entry gate về group-summary density; recommended default là
      `đã đánh giá / tổng`, không seven-status breakdown, percentage hoặc card grid.
- [x] P12B1.2 Viết RED tests dùng complete
      `selectedVersion.groups[].criteria[]`, sparse/>100 assessments, đủ bảy
      derived statuses với repeated/mixed distributions, group/option totals
      reconcile và mỗi criterion đóng góp đúng một status theo `criterion_id`.
- [x] P12B1.3 Thêm selected-option progress model, option/group counters và
      loading/error/no-comparison-set states; không thêm filter/navigation.
- [x] P12B1.4 Adopt assessment trả về sau save vào complete cache theo
      `criterion_id`, vẫn giữ prefix invalidation và P11D collection contracts.
- [x] P12B1.5 Truyền complete `selectedVersion.groups[].criteria[]` từ
      `useTechnicalConfigurationBaselineVersionSelection` vào evaluation
      composition và extract summary/model ownership để active workspace không
      vượt file ceiling; không lấy denominator từ bounded comparison page.
- [x] P12B1.6 Viết counter/cache/workspace integration tests và khóa deploy state:
      summary đúng, existing navigation/save-next không đổi, không DB/RPC/proxy.

### Evidence P12B1 - 2026-07-30

- RED:
  - pure progress tests fail vì production model chưa tồn tại;
  - cache contract fail vì complete cache còn assessment revision 2 thay vì
    mutation result revision 3;
  - workspace integration fail vì selected-option summary và loading/error
    progress states chưa được compose.
- GREEN:
  - pure model dùng complete `selectedVersion.groups[].criteria[]`, reconcile
    assessment bằng `criterion_id`, cover zero/sparse/repeated/mixed/>100 và đủ
    bảy derived statuses;
  - summary chỉ hiện option đang chọn và compact group `đã đánh giá / tổng`,
    không percentage, progressbar, card grid hoặc seven-status breakdown;
  - successful save publish assessment vào complete cache trước prefix
    invalidation; P11D consumer test giữ refetch pending để chứng minh immediate
    adoption;
  - `TechnicalConfigurationEvaluationActiveWorkspace.tsx` còn 347 dòng; không
    đổi navigation, save-next, dirty/pending guards, DB/RPC/proxy/query contract.
- Verification:
  - `format:check`, `verify:no-explicit-any`, `verify:dedupe`, `typecheck`: pass;
  - focused P11D/P12A1/P12A2/P12B1: 12 files, 103 tests pass;
  - React Doctor changed-scope: 100/100, no issues;
  - `openspec validate add-technical-configuration-comparison --type change
--strict --no-interactive`: valid.

## Phase P12B2 - Filtered Guarded Navigation

Legacy mapping: hoàn tất P12B.2, P12B.3, task scope-guard P12B.4 và phần
filter/selection/navigation journeys của P12B.5.

- [x] P12B2.1 Chốt entry gate cho post-save `Lưu`, no-more-match save-next và
      filter state khi đổi option theo resolved defaults trong design.
- [x] P12B2.2 Viết RED tests cho exact server-filtered IDs, canonical order,
      filtered pagination, canonical comparison-page mapping, empty result và
      dirty-cancel rollback đầy đủ filter/page/criterion/panel/draft.
- [x] P12B2.3 Thêm guarded read-only RPC lọc status ở Postgres, bounded complete
      ID collection và single-select filtered projection; không thay data
      shape/counter/cache ownership của P12B1.
- [x] P12B2.4 Extract navigator owner; bảo toàn selection khi còn visible và
      reuse dirty-confirm/pending-block khi filter làm đổi selection; cancel
      restore filter, filtered page, criterion, panel/open state và local draft.
- [x] P12B2.5 Thêm filter-aware save-next chỉ sau success qua group/page boundary,
      giữ state khi failure và xử lý final match theo entry gate đã chốt.
- [x] P12B2.6 Viết SQL/RPC/query contract, pure navigation, hook collection và
      user-event regressions; không thêm write path, ranking/scoring/AI hoặc
      browser/accessibility/responsive matrix thuộc P13B.

### Evidence P12B2 - 2026-07-30

- Entry decisions:
  - `Lưu` giữ current panel khi criterion rời filter và hiển thị filtered-out
    state;
  - `Lưu & tiếp tục` không wrap ở final match, giữ saved panel và hiển thị
    no-more-match;
  - đổi option giữ active filter và resolve selection deterministic.
- RED:
  - focused P12B2 run ban đầu: 9 fail, 5 pass vì chưa có filter contract,
    canonical filtered IDs, guarded reconciliation và filter-aware save-next.
- GREEN:
  - thêm guarded read-only RPC
    `technical_configuration_evaluation_criteria_list` với four-filter
    validation, canonical index/page, bounded pagination, explicit grants và
    không có write path;
  - client thu complete server-filtered pages qua shared stable collector, map
    exact IDs sang locked-baseline rows và chỉ paginate presentation;
  - navigator owner reuse shared dirty-confirm/pending-block contract cho
    filter/option/page/criterion, giữ P12B1 progress/counter/cache ownership;
  - user-event coverage khóa exact IDs cho từng filter, empty state,
    dirty-cancel rollback, pending hard-block, option change, `Lưu` filtered-out,
    deferred-response race, save-next failure, cross-page next và final no-wrap;
  - PR review follow-up giữ transition pending xuyên suốt criteria reload sau
    save-next và document rollback forward-only bằng migration REVOKE/DROP riêng;
    không đưa `SUPABASE_JWT_SECRET` vào SQL function vì RPC proxy mới là boundary
    ký request;
  - rollback-only SQL phase gate khóa auth/ACL, validation, exact filter IDs và
    canonical page độc lập với transport page size.
- Verification:
  - `verify:no-explicit-any`, `verify:dedupe`, `typecheck`: pass;
  - full technical-configuration + assessment proxy regression: 59 files,
    499 tests pass;
  - React Doctor changed-scope review-fix rerun: 98/100; một warning
    maintainability về boolean props của navigator pane, không nằm trong
    review-fix diff và không block gate;
  - strict OpenSpec validation: valid;
  - semantic dedupe reused shared page collector and guarded-navigation hook;
    no equivalent canonical filtered-navigation helper existed;
  - live Supabase inspection và canonical-page expression check đều read-only;
    migration/SQL phase gate chưa được apply hoặc chạy trên live DB.

## Phase P12C1 - Complete Option Ranking Read Contract

- [x] P12C1.1 Khóa product entry gate cho tie numbering trước RED tests;
      `not_applicable` đã theo normative/P11A semantics, không phải local gate.
- [x] P12C1.2 Thêm
      `technical_configuration_reference_ranking_list(p_dossier_id,
p_baseline_version_id, p_page, p_page_size)` read-only, set-based cho toàn
      bộ option/criterion universe; page 1-based, page size 1-100, collector dùng
      100 và không gọi get-or-create comparison set.
- [x] P12C1.3 Tính eligibility từ raw technical/evidence axes cho mọi criterion
      áp dụng; `technical_axis = not_applicable` hoàn tất criterion dù evidence
      null; không reuse `evaluated === total` của progress hiện tại.
- [x] P12C1.4 Tính các bộ đếm và hạng theo ba quy tắc minh bạch; ties giữ cùng
      rank; tính trên full universe trước pagination và chỉ dùng canonical option
      order để ổn định presentation.
- [x] P12C1.5 Chặn cross-dossier/version và loại reference products; không join
      supplier response/document source data, không persist rank và không thêm AI.
- [x] P12C1.6 Thêm migration, rollback-only phase gate, RPC manifest, integration
      vào `allowed-functions.ts`, typed wire contract, opaque snapshot identity,
      adapter, bounded query key/hook và focused tests.
- [x] P12C1.7 Chỉ apply migration sau explicit approval riêng cho migration.
- [x] P12C1.8 Sau apply, xin explicit approval thứ hai trước rollback-only live
      phase gate; reject toàn bộ page collection khi snapshot identity đổi và
      chạy read-only security/performance advisors.
- [x] P12C1.9 Khóa exact response root/item fields, `option_id` collection key,
      page exhaustion, no-partial-publication và invalid page-size/metadata/
      total/duplicate-key regressions; phase gate phải có hơn 100 options và hơn
      100 criteria.

## Phase P12C2 - Optional Reference Ranking UI

- [x] P12C2.1 Chỉ request ranking sau hành động rõ ràng của người dùng; không tự
      chạy ranking khi mở evaluation workspace hoặc sau khi dossier/baseline đổi.
- [x] P12C2.2 Render option đủ điều kiện, option thiếu dữ liệu, ties và mandatory
      disclaimer; không thêm score, percentage, export hoặc award decision.
- [x] P12C2.3 Compose ranking như sibling của selected-option evaluation flow;
      không đưa all-option ownership vào active-workspace state.
- [x] P12C2.4 Invalidate/refetch ranking đang hiển thị sau successful assessment
      save; supplier source changes không tạo manual stale marker.
- [x] P12C2.5 Viết explicit-request, loading/error/retry, precedence, eligibility,
      ties, disclaimer, scope và no-stale React regressions.
- [x] P12C2.6 Reset request/result state theo dossier/baseline identity, cancel
      hoặc ignore request cũ và khóa bằng context-switch regressions.

## Phase P13A-P1 - Mandatory Representative Ranking Performance Evidence

> Decision source đã được chấp thuận cho việc tách P13A:
> [P13A discovery and split decision](./verification/P13A-discovery-and-split-decision.md).

- [ ] P13A-P1.1 Xác định dataset ranking bounded cho normal và upper-limit; case
      upper-limit bắt buộc có `>100 options x 102 criteria`, dùng pagination `100`
      và được ghi vào `./verification/P13A-P1-representative-ranking-plan.md`.
- [ ] P13A-P1.2 Capture read-only plan cho cả hai case bằng
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` hoặc JSON-plan seam tương đương.
- [ ] P13A-P1.3 Assert deterministic ranking, pagination `100`, bounded result
      cardinality/work và các index, row estimate, join, sort, paging path thực tế.
- [ ] P13A-P1.4 Assert không có temp spill, repeated correlated `SubPlan` hoặc
      unbounded full rescan ngoài ranking contract; không đặt hard wall-clock
      pass/fail threshold khi chưa có SLO được chấp thuận.
- [ ] P13A-P1.5 Nếu dữ liệu hiện có không đủ chứng minh representative scale, dừng
      và xin explicit user approval riêng trước rollback-only seeded scale gate qua
      Supabase MCP; leaf này không apply migration và không sửa production code.
- [ ] P13A-P1.6 Chạy focused TC-20 ranking performance assertions, lưu plan/result
      evidence và xác minh mọi scale seed đã được rollback.

> **Execution status (2026-08-02): blocked before representative plan capture.**
> Read-only discovery found `max_options_per_dossier = 1`,
> `max_criteria_per_baseline = 102` and `representative_candidate_count = 0`.
> The user cancelled production seeding before any live write. Exact evidence:
> [P13A-P1 representative ranking plan](./verification/P13A-P1-representative-ranking-plan.md).
> Issue #836 read-only discovery also found `0` Supabase development branches,
> only two available VPS snapshots with `1` option and `102` criteria each, no
> other local dump, no dump in `gdrive:qltbyt-backup/` and no GitHub Actions
> artifact. No non-seeded source satisfies `>100 options x 102 criteria`.
> The non-seeded dataset blocker is tracked by
> [GitHub issue #836](https://github.com/thienchi2109/qltbyt-nam-phong/issues/836).
> P13A-P2 is not instantiated because no query/index invariant failed;
> P13A-V remains blocked.

- [ ] P13A-P1.7 Nếu tất cả assertion pass, bỏ qua P13A-P2 và unblock P13A-V; nếu
      fail, giữ P13A-P1 failed, ghi đúng query/index invariant tái lập được, chỉ
      instantiate P13A-P2 với scope đó và giữ P13A-V blocked.

## Phase P13A-P2 - Conditional Ranking Query Remediation

- [ ] P13A-P2.1 Chỉ bắt đầu khi P13A-P1 fail với evidence tái lập được và exact
      ranking query/index scope; không tạo leaf này khi P13A-P1 pass.
- [ ] P13A-P2.2 Thêm RED SQL/plan assertion tái lập đúng failure của P13A-P1 và
      ghi evidence vào `./verification/P13A-P2-ranking-query-remediation.md`.
- [ ] P13A-P2.3 Implement remediation nhỏ nhất cho đúng ranking RPC/index gap,
      không đổi result/paging contract và không chạm UI, accessibility,
      browser/agent-browser thuộc P13B hay DB surface lân cận.
- [ ] P13A-P2.4 Verify migration order, fresh replay, rollback cleanliness,
      before/after plans và toàn bộ focused ranking SQL/RPC suites.
- [ ] P13A-P2.5 Chỉ apply qua Supabase MCP sau explicit user approval; xin
      approval riêng trước rollback-only live gate, rồi mới chạy read-only
      security/performance advisors.
- [ ] P13A-P2.6 Sau khi remediation được apply và phase-gated, rerun P13A-P1 từ
      đầu; chỉ unblock P13A-V khi P13A-P1 rerun green.

## Phase P13A-V - Final Database Security And Performance Verification

- [ ] P13A-V.1 Chỉ bắt đầu khi P13A-P1 pass trực tiếp, hoặc P13A-P2 đã apply/gated
      và P13A-P1 rerun green; ghi evidence vào
      `./verification/P13A-V-db-security-performance.md`.
- [ ] P13A-V.2 Rerun complete authorization matrix và direct-backend denial tests
      cho `global`, raw `admin`, missing claims và denied roles.
- [ ] P13A-V.3 Inspect live schema read-only cho grants, RLS, JWT guards,
      `search_path`, ownership/cascade và locked-baseline immutability.
- [ ] P13A-V.4 Audit migration order, fresh-DB replay, list/matrix/ranking bounds,
      selected columns, indexes, absence of N+1 và final TC-20 evidence.
- [ ] P13A-V.5 Chạy read-only security/performance advisors trên final DB state.
- [ ] P13A-V.6 Không sửa production code, apply migration hay chạy live write
      trong leaf này; nếu có gap, tạo exact blocking fix leaf, dừng P13A-V và
      rerun từ đầu sau khi fix được phase-gated.
- [ ] P13A-V.7 Accepted TC-02 + final TC-20 evidence chỉ thỏa dependency P13A của
      P13C; P13C vẫn blocked cho đến khi P13B, P7A2, P9A3 và P14C2 cũng hoàn
      tất.

## Phase P13B - UI, Accessibility And Regression Hardening

- [ ] P13B.1 Kiểm tra keyboard/focus/accessibility và dirty-navigation.
- [ ] P13B.2 Kiểm tra long Vietnamese text, many options, narrow viewport và
      P10B3 evidence detail states/focus restoration trên desktop/mobile.
- [ ] P13B.3 Kiểm tra default/editable groups, many reference products và không xuất hiện custom content-column controls.
- [ ] P13B.4 Kiểm tra concurrent edits và conflict recovery qua hai tab.
- [ ] P13B.5 Kiểm tra P12A1/P12A2 reuse P10B detail và supplementary information vẫn
      non-scoring sau save/save-next/derived status.
- [ ] P13B.6 Kiểm tra full TC-18 ranking flow trên desktop/mobile: explicit
      request, loading/retry, incomplete options, ties, disclaimer, context reset
      và refresh sau assessment save.
- [ ] P13B.7 Chạy Equipment attachment regression và full relevant React tests.
- [ ] P13B.8 Chạy full React Doctor command và browser screenshot/interaction verification.
- [ ] P13B.9 Không sửa production code; mỗi gap tạo blocking fix leaf riêng rồi rerun P13B.

## Phase P14A1 - Canonical Export Snapshot Manifest

- [x] P14A1.1 Khóa exact manifest request/response, canonical scope và hai opaque
      snapshot token bằng RED migration/source tests.
- [x] P14A1.2 Thêm helper + manifest RPC read-only nhỏ nhất; không get-or-create,
      không ghi row/revision/audit.
- [x] P14A1.3 Thêm đúng một RPC name vào dedicated manifest/proxy allowlist và
      kiểm tra `admin/global`, denied roles, missing claims.
- [x] P14A1.4 Chỉ apply/rollback-only gate qua Supabase MCP sau explicit approval;
      chạy security advisor và strict OpenSpec validation.

## Phase P14A2 - Paginated Export Ranking And Matrix Contracts

- [x] P14A2.1 Khóa exact ranking/matrix payload, pagination, canonical order,
      repeated scope/totals/tokens và empty/null semantics bằng RED tests.
- [x] P14A2.2 Reuse P12C1 ranking semantics; thêm set-based read-only matrix
      contract, không tạo ranking algorithm/query loop song song và không chạy
      paged P12C1 lần hai chỉ để lấy ranking token; dùng chung immutable helper
      cho option display label và derived status.
- [x] P14A2.3 Thêm hai RPC names vào manifest/allowlist và phase-gate
      authorization, bounds, query plan sau explicit live approval.
- [x] P14A2.4 Xác minh không có client/UI/workbook/download trong leaf.

## Phase P14A3 - Typed Export Adapters And Stable Dataset Collector

- [x] P14A3.1 Khóa exact wire decoding, typed errors, nullable fields và malformed
      identity/total/token rejection.
- [x] P14A3.2 Thu tuần tự mọi required page, validate keys/totals/tokens, đọc lại
      manifest và không publish partial dataset.
- [x] P14A3.3 Không fetch ranking hoặc matrix surface ngoài mode người dùng chọn.
- [x] P14A3.4 Không mount query/UI, không import ExcelJS và không download.

## Phase P14A4 - Ordered Result-Export Axes

- [x] P14A4.1 Khóa exact option-axis/criterion-axis payload, page bounds,
      canonical ordinality, repeated totals/tokens và authorization bằng RED
      migration/source tests.
- [x] P14A4.2 Expose descriptor đã nằm trong private full-token payload, giữ
      public manifest exact shape và không duplicate matrix joins.
- [x] P14A4.3 Thêm typed decoders/adapters, thu tuần tự từng axis, await đủ hai
      axes và deep-freeze trước ranking/matrix; reject duplicate/missing/
      reordered IDs hoặc drift.
- [x] P14A4.4 Khóa deterministic `0 x 0`, `1 x 0`, `0 x 1`, normal `N x M`;
      không seed, workbook, ExcelJS, UI, Blob/download hay parser/import/apply.
- [x] P14A4.5 Chỉ apply/phase-gate qua Supabase MCP sau fresh explicit approval;
      chạy security advisor, semantic dedupe và strict OpenSpec validation.

## Phase P14B1 - Result Workbook Schema And Representative Fixtures

- [x] P14B1.1 Khóa ba content mode, visible sheet order, hidden `_meta`, bốn
      context columns và ba cột cho mỗi option.
- [x] P14B1.2 Tạo output-only versioned workbook model, không parser/import/apply.
- [x] P14B1.3 Partition continuation matrix sheets theo giới hạn cột vật lý,
      không truncate/hidden cap.
- [x] P14B1.4 Tạo fixture in-memory deterministic lớn hơn 100 options x 102
      criteria; tuyệt đối không seed hoặc đọc/ghi live DB.

## Phase P14B1F - Ranking Presentation Contract Repair

- [x] P14B1F.1 Khóa RED cho `model`, `criterion_total`, narrowed order và
      missing option descriptor trong pure output model.
- [x] P14B1F.2 Join ranking với ordered `optionAxis`; reuse cùng enriched rows
      cho overview top-ten và ranking sheet.
- [x] P14B1F.3 Khóa `Đã hoàn thiện` / `Chưa hoàn thiện` và deterministic
      aggregate `Ghi chú`; không suy diễn `not_applicable` thành đạt.
- [x] P14B1F.4 Ghi nhận Stitch tạo screen semantic mới thay vì mutate artifact
      gốc; dùng OpenSpec/P14B1F làm chuẩn nội dung và giữ visual direction,
      không ExcelJS, RPC/DB, UI hoặc download.

## Phase P14B2 - Approved ExcelJS Workbook Rendering

- [x] P14B2.1 Khóa values, exact `_meta`, hidden state, multi-link fallback,
      filters, panes, dimensions, borders/fills và continuation round-trip bằng
      focused workbook tests.
- [x] P14B2.2 Reuse `createExcelWorkbook()` và lazy ExcelJS serialization;
      không thêm cờ domain vào flat `exportToExcel()`.
- [x] P14B2.3 Dùng hai workbook screen Stitch làm visual guidance, giữ
      OpenSpec/P14B1F làm chuẩn nội dung, với màu `#166534`, zebra, wrap/top
      alignment, amber disclaimer và restrained conclusion fills.
- [x] P14B2.4 Xác minh không chart, gradient, score, percentage, award decision,
      mounted trigger hoặc download side effect.

## Phase P14C1 - Export Scope Dialog And State Machine

- [ ] P14C1.1 Khóa open/reset/confirm/cancel, content mode và option/criterion
      scope bằng pure-state + React user-event RED tests.
- [ ] P14C1.2 Mặc định toàn bộ option + toàn bộ criterion; không âm thầm dùng
      selected options hoặc criterion page hiện tại.
- [ ] P14C1.3 Khi source có pagination, bắt buộc người dùng xác nhận phạm vi rõ
      ràng trước export.
- [ ] P14C1.4 Giữ đúng Stitch dialog mockup đã duyệt, để dialog unmounted và
      không cho nó biết RPC, ExcelJS hoặc Blob.

## Phase P14C2 - Export Orchestration, Download And Workspace Activation

- [ ] P14C2.1 Mount một action `Xuất kết quả Excel` trong evaluation workspace và
      giữ nguyên ownership/pagination hiện tại.
- [ ] P14C2.2 Orchestrate collector -> renderer -> shared `downloadBlob()`; chỉ
      download một lần sau final manifest revalidation.
- [ ] P14C2.3 Abort stale/context-switched work, không partial download và cho
      retry explicit.
- [ ] P14C2.4 Chạy standard TS/React gates, focused Excel/Equipment,
      evaluation/ranking regressions, React Doctor và strict OpenSpec; không
      thêm P13B real-browser gate.

## Phase P13C - Release, OpenSpec And AI Boundary Audit

- [ ] P13C.1 Chạy full quality gates và `openspec validate ... --strict`.
- [ ] P13C.2 Dùng feature baseline SHA để audit commit/file coverage và tổng hợp per-leaf gate evidence.
- [ ] P13C.3 Xác minh không có AI UI/API/job/cache/quota/table trong MVP.
- [ ] P13C.4 Xác minh stable IDs/data boundaries hỗ trợ AI follow-up.
- [ ] P13C.5 Hoàn tất runbook, release notes, rollout và rollback instructions.
- [ ] P13C.6 Trong future P13C, chỉ sau final acceptance mới archive OpenSpec
      change và lưu archived-state evidence.
- [ ] P13C.7 Xác minh P14A1-P14C2 đã landed và result workbook vẫn read-only,
      snapshot-stable, không scoring/award semantics.
- [ ] P13C.8 Cập nhật OpenSpec tasks theo trạng thái landed và hoàn tất release review.
