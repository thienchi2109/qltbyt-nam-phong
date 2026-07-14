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

| Phase                                                                                        | Mục tiêu                                        | Depends on             | Requirements                                    |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------- | ----------------------------------------------- |
| [P0](./implementation-plan.md#phase-p0---discovery-and-contract-freeze)                      | Discovery và đóng băng contract                 | Không                  | TC-01, TC-02, TC-03, TC-05, TC-08, TC-19, TC-20 |
| [P1](./implementation-plan.md#phase-p1---dossier-foundation-and-authorization)               | Nền tảng hồ sơ và quyền                         | P0                     | TC-01, TC-02, TC-19, TC-20                      |
| [P2](./implementation-plan.md#phase-p2---baseline-draft-data-contracts)                      | Data contract cho bản nháp cơ sở                | P1                     | TC-02, TC-03, TC-20                             |
| [P3A](./implementation-plan.md#phase-p3a---route-workspace-shell-and-dossier-list)           | Route, workspace shell, danh sách và tạo hồ sơ  | P1                     | TC-02, TC-04                                    |
| [P3B](./implementation-plan.md#phase-p3b---manual-baseline-editor-and-save-conflicts)        | Editor cơ sở và save/conflict                   | P2, P3A                | TC-03, TC-04, TC-20                             |
| [P3C](./implementation-plan.md#phase-p3c---bulk-text-entry)                                  | Nhập nhanh nhiều tiêu chí                       | P3B                    | TC-03, TC-04                                    |
| [P4](./implementation-plan.md#phase-p4---baseline-versioning-lock-and-history)               | Phiên bản, khóa bất biến và lịch sử             | P2, P3B                | TC-02, TC-06, TC-07, TC-20                      |
| [P5A](./implementation-plan.md#phase-p5a---shared-equipment-excel-primitives)                | Shared Excel primitives từ Equipment            | P0; triển khai sau P4  | TC-05                                           |
| [P5B](./implementation-plan.md#phase-p5b---baseline-workbook-codec)                          | Baseline workbook codec                         | P3B, P4, P5A           | TC-05                                           |
| [P5C](./implementation-plan.md#phase-p5c---atomic-baseline-import-contract)                  | Atomic baseline import RPC                      | P4, P5B                | TC-02, TC-05, TC-20                             |
| [P5D](./implementation-plan.md#phase-p5d---baseline-import-workflow-ui)                      | Baseline import workflow UI                     | P5B, P5C               | TC-05, TC-20                                    |
| [P6](./implementation-plan.md#phase-p6---shared-url-document-primitives)                     | Shared URL document primitives                  | P0; triển khai sau P5D | TC-11                                           |
| [P7A](./implementation-plan.md#phase-p7a---reference-products)                               | Sản phẩm tham chiếu và đối chiếu theo tiêu chí  | P3A, P4                | TC-02, TC-04, TC-06, TC-08, TC-20               |
| [P7B](./implementation-plan.md#phase-p7b---baseline-documents-and-citations)                 | Tài liệu/trích dẫn cơ sở và sản phẩm tham chiếu | P4, P6, P7A            | TC-02, TC-04, TC-06, TC-11, TC-12, TC-20        |
| [P8A](./implementation-plan.md#phase-p8a---supplier-and-option-data-contracts)               | Data contract nhà cung cấp và phương án         | P4                     | TC-02, TC-07, TC-09, TC-17, TC-20               |
| [P8B](./implementation-plan.md#phase-p8b---supplier-option-manual-workspace)                 | UI nhập thủ công phương án                      | P3A, P8A               | TC-04, TC-09, TC-17, TC-20                      |
| [P9A](./implementation-plan.md#phase-p9a---supplier-option-excel)                            | Excel phương án                                 | P5A, P8B               | TC-10, TC-20                                    |
| [P9B](./implementation-plan.md#phase-p9b---supplier-option-documents-and-citations)          | Tài liệu và trích dẫn phương án                 | P6, P7B, P8B           | TC-02, TC-04, TC-11, TC-12, TC-20               |
| [P10A](./implementation-plan.md#phase-p10a---comparison-read-contract)                       | Query contract cho so sánh                      | P7B, P9B               | TC-02, TC-13, TC-17                             |
| [P10B](./implementation-plan.md#phase-p10b---comparison-matrix-ui)                           | Ma trận so sánh                                 | P3A, P10A              | TC-13, TC-17                                    |
| [P11](./implementation-plan.md#phase-p11---manual-evaluation-domain-and-persistence)         | Domain và persistence đánh giá thủ công         | P4, P8A                | TC-02, TC-15, TC-16, TC-19, TC-20               |
| [P12A](./implementation-plan.md#phase-p12a---manual-evaluation-save-and-navigation-workflow) | Nhập đánh giá, save và navigation               | P10B, P11              | TC-04, TC-14, TC-15, TC-16, TC-17, TC-20        |
| [P12B](./implementation-plan.md#phase-p12b---evaluation-progress-and-filters)                | Tiến độ và bộ lọc đánh giá                      | P12A                   | TC-14, TC-16                                    |
| [P12C](./implementation-plan.md#phase-p12c---optional-reference-ranking)                     | Xếp hạng tham khảo                              | P12B                   | TC-18                                           |
| [P13A](./implementation-plan.md#phase-p13a---database-security-and-performance-hardening)    | Hardening DB, quyền và hiệu năng                | P12C                   | TC-02, TC-20                                    |
| [P13B](./implementation-plan.md#phase-p13b---ui-accessibility-and-regression-hardening)      | Hardening UI, accessibility và regression       | P12C                   | TC-03, TC-04, TC-11, TC-13, TC-14, TC-20        |
| [P13C](./implementation-plan.md#phase-p13c---release-openspec-and-ai-boundary-audit)         | Release, OpenSpec và audit AI boundary          | P13A, P13B, P7A, P9A   | TC-19                                           |

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

- [ ] P5C.1 Thêm authoritative preview và atomic apply RPC cho toàn baseline draft.
- [ ] P5C.2 Dùng chung một server-side validator/normalizer cho preview và apply; không sao chép validation giữa hai RPC.
- [ ] P5C.3 Enforce JWT claims, archived/locked/editable guards, template metadata và `p_expected_revision`.
- [ ] P5C.4 Giữ mã/ID/source linkage của tiêu chí hiện có; sinh mã mới theo `next_criterion_number` trong transaction.
- [ ] P5C.5 Reconcile group/criterion tree và tăng revision đúng một lần; mọi lỗi rollback toàn bộ.
- [ ] P5C.6 Viết trust-boundary tests buộc cả preview/apply từ chối metadata lệch target, payload malformed hoặc canonical rows bị sửa.
- [ ] P5C.7 Mở rộng RPC map/allowlist/types và chạy migration contract, role/claim, full-tree reconciliation, exact revision/counter, atomicity, stale-revision và phase-gate tests.

## Phase P5D - Baseline Import Workflow UI

- [ ] P5D.1 Thêm import/download action chỉ cho selected draft; download phải dùng P5B generator và P5A Blob helper.
- [ ] P5D.2 Dùng `useBulkImportState` custom parser seam và shared `BulkImportDialogParts` cho file/parse/error lifecycle.
- [ ] P5D.3 Hiển thị authoritative server preview, provisional codes và row-level actionable errors trước mutation.
- [ ] P5D.4 Chỉ gọi atomic apply RPC sau confirmation; không dùng chuỗi group/criterion CRUD RPC.
- [ ] P5D.5 Giữ file, canonical rows và preview khi stale conflict; refresh revision/history mà không mất input.
- [ ] P5D.6 Chặn lock affordance khi import preview/error transient còn mở; không persist import-error entity.
- [ ] P5D.7 Viết draft-only, template-download delegation, no-persistence-before-confirm, success/cache, locked-target và conflict-preservation React tests.

## Phase P6 - Shared URL Document Primitives

- [ ] P6.1 Khóa regression behavior hiện tại của Equipment attachments bằng tests.
- [ ] P6.2 Trích shared URL validation, form/list presentation và safe external links.
- [ ] P6.3 Giữ persistence adapter riêng cho Equipment.
- [ ] P6.4 Chuyển Equipment consumer sang shared primitive không đổi UX.
- [ ] P6.5 Chạy semantic dedup review và Equipment regression verification.

## Phase P7A - Reference Products

- [ ] P7A.1 Thêm optional reference products và nội dung đối chiếu text theo từng baseline criterion.
- [ ] P7A.2 Thêm bề mặt hàng nhóm/tiêu chí, cột baseline sticky và cột reference-product động.
- [ ] P7A.3 Thêm chọn cột, cuộn ngang và panel full text; không tạo cột tài liệu cố định.
- [ ] P7A.4 Thêm explicit save, dirty-state và expected-revision CRUD cho bản nháp.
- [ ] P7A.5 Enforce bất biến sau khóa và chạy DB phase gate.
- [ ] P7A.6 Thêm UI vào baseline workspace shell.
- [ ] P7A.7 Viết optional/multiple/criterion-response/many-column/conflict/reference-not-ranking tests.

## Phase P7B - Baseline Documents And Citations

- [ ] P7B.1 Thêm document URL metadata và criterion citations cho baseline và từng sản phẩm tham chiếu.
- [ ] P7B.2 Reuse document cho nhiều tiêu chí không sao chép URL.
- [ ] P7B.3 Giữ owner rõ ràng để trích dẫn sản phẩm tham chiếu không bị trộn với baseline hoặc phương án.
- [ ] P7B.4 Enforce locked immutability; editable delete phải xác nhận và nêu số liên kết.
- [ ] P7B.5 Thêm explicit save, dirty-state, expected-revision guard và tích hợp P6 primitives.
- [ ] P7B.6 Chạy DB phase gate cho quyền, ownership, cascade và concurrency.
- [ ] P7B.7 Viết owner-scope, reuse, deletion, locked, conflict và long-excerpt tests.

## Phase P8A - Supplier And Option Data Contracts

- [ ] P8A.1 Thêm supplier, nhiều options và option response datasets theo baseline version.
- [ ] P8A.2 Thêm supplementary information tách khỏi compliance.
- [ ] P8A.3 Thêm direct-edit/no-lock/no-version contract và optimistic concurrency.
- [ ] P8A.4 Chạy DB phase gate cho quyền, ownership, cascade và historical linkage.
- [ ] P8A.5 Viết contract tests cho multiple options, baseline binding và source updates.

## Phase P8B - Supplier Option Manual Workspace

- [ ] P8B.1 Thêm UI nhóm nhẹ theo supplier và nhãn `Supplier · Model/option`.
- [ ] P8B.2 Thêm manual response/supplementary editor với explicit save.
- [ ] P8B.3 Hiển thị thời điểm cập nhật gần nhất của dữ liệu option.
- [ ] P8B.4 Thêm conflict/unsaved/error states và tích hợp workspace shell.
- [ ] P8B.5 Viết manual-entry, multiple-option và no-lock-control tests.

## Phase P9A - Supplier Option Excel

- [ ] P9A.1 Sinh option template từ baseline version đã chọn.
- [ ] P9A.2 Parse/preview/import response và supplementary information.
- [ ] P9A.3 Từ chối arbitrary/wrong-version/unknown/duplicate criteria và partial writes.
- [ ] P9A.4 Thêm expected-revision guard và giữ preview/input khi conflict.
- [ ] P9A.5 Tích hợp import vào option workspace.
- [ ] P9A.6 Viết round-trip, conflict và atomic-import tests.

## Phase P9B - Supplier Option Documents And Citations

- [ ] P9B.1 Thêm option document URLs và criterion citations.
- [ ] P9B.2 Reuse P6 primitives và P7B citation behavior.
- [ ] P9B.3 Editable delete phải xác nhận và hiển thị affected-link count.
- [ ] P9B.4 Thêm explicit save, dirty-state, expected-revision guard và chạy DB phase gate.
- [ ] P9B.5 Viết URL/evidence integration tests.

## Phase P10A - Comparison Read Contract

- [ ] P10A.1 Thêm bounded/paginated matrix query contract không N+1.
- [ ] P10A.2 Chỉ select trường cần thiết và review indexes/query plan.
- [ ] P10A.3 Chạy DB phase gate và performance advisor sau apply được phê duyệt.
- [ ] P10A.4 Giữ supplementary information tách khỏi compliance.
- [ ] P10A.5 Viết query shape, authorization, bounds và query-count tests.

## Phase P10B - Comparison Matrix UI

- [ ] P10B.1 Hiển thị nhóm/tiêu chí theo hàng, sticky baseline và option columns động.
- [ ] P10B.2 Thêm column selection, pinning, horizontal scroll và focus mode.
- [ ] P10B.3 Thêm detail panel cho full text, supplementary information và citations; không tạo arbitrary content/evidence columns.
- [ ] P10B.4 Tích hợp matrix tab vào workspace shell.
- [ ] P10B.5 Viết interaction, long-text, keyboard và responsive verification.

## Phase P11 - Manual Evaluation Domain And Persistence

- [ ] P11.1 Thêm canonical two-axis enums và shared derived-status function.
- [ ] P11.2 Thêm assessment persistence, notes, evaluator metadata và concurrency.
- [ ] P11.3 Giữ manual conclusions tách khỏi source updates và AI future data.
- [ ] P11.4 Chạy DB phase gate và audit không có AI runtime artifact.
- [ ] P11.5 Viết exhaustive mapping, auth, conflict và no-staleness tests.

## Phase P12A - Manual Evaluation Save And Navigation Workflow

- [ ] P12A.1 Thêm criterion list bên trái và detail panel bên phải cho một option.
- [ ] P12A.2 Thêm hai trục, notes, `Lưu` và `Lưu & tiếp tục`.
- [ ] P12A.3 Giữ current criterion/input khi save thất bại.
- [ ] P12A.4 Chặn hoặc bảo toàn thay đổi khi chọn tiêu chí/chuyển trang lúc dirty.
- [ ] P12A.5 Tích hợp evaluation tab và viết workflow/browser tests.

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

## Phase P13A - Database Security And Performance Hardening

- [ ] P13A.1 Rerun full authorization matrix và direct-backend denial tests.
- [ ] P13A.2 Audit grants/RLS/search_path/ownership/cascade trên live schema read-only.
- [ ] P13A.3 Audit migration order, query bounds, indexes, N+1 và representative plans.
- [ ] P13A.4 Chạy security/performance advisors sau các live apply đã được phê duyệt.
- [ ] P13A.5 Không sửa production code; mỗi gap tạo blocking fix leaf riêng rồi rerun P13A.

## Phase P13B - UI, Accessibility And Regression Hardening

- [ ] P13B.1 Kiểm tra keyboard/focus/accessibility và dirty-navigation.
- [ ] P13B.2 Kiểm tra long Vietnamese text, many options và narrow viewport.
- [ ] P13B.3 Kiểm tra default/editable groups, many reference products và không xuất hiện custom content-column controls.
- [ ] P13B.4 Kiểm tra concurrent edits và conflict recovery qua hai tab.
- [ ] P13B.5 Chạy Equipment attachment regression và full relevant React tests.
- [ ] P13B.6 Chạy full React Doctor command và browser screenshot/interaction verification.
- [ ] P13B.7 Không sửa production code; mỗi gap tạo blocking fix leaf riêng rồi rerun P13B.

## Phase P13C - Release, OpenSpec And AI Boundary Audit

- [ ] P13C.1 Chạy full quality gates và `openspec validate ... --strict`.
- [ ] P13C.2 Dùng feature baseline SHA để audit commit/file coverage và tổng hợp per-leaf gate evidence.
- [ ] P13C.3 Xác minh không có AI UI/API/job/cache/quota/table trong MVP.
- [ ] P13C.4 Xác minh stable IDs/data boundaries hỗ trợ AI follow-up.
- [ ] P13C.5 Hoàn tất runbook, release notes, rollout và rollback instructions.
- [ ] P13C.6 Cập nhật OpenSpec tasks theo trạng thái landed và hoàn tất release review.
