# Change: Thu hẹp phạm vi DB Quality Gate theo selector và registry

## Vì sao

Change đang hoạt động `add-database-quality-gate` đã có các hợp đồng fail-closed
cho migration integrity, bảo mật và baseline-forward. Tuy nhiên, việc coi toàn
bộ test `default-safe` là một tập chạy mặc định làm cho mỗi migration phải chạy
lại nhiều kiểm tra business không liên quan. Điều đó làm tăng thời gian chạy và
tạo false positive, trong khi việc bỏ nhầm một assertion RPC hoặc tenant lại
làm giảm lớp bảo vệ quan trọng.

Đề xuất này thu hẹp phạm vi chọn test bằng metadata có thể kiểm tra được, giữ
nguyên safety contract và giữ đầy đủ các kiểm tra nền tảng. Đây là proposed
change mới phụ thuộc vào `add-database-quality-gate`; nó không archive, sửa
checkbox, hay áp dụng lại change đang hoạt động.

## Thay đổi

- Bổ sung contract cho scope logic của test trong registry tương lai:
  `core-security` và `migration-specific` được tách khỏi `safety`.
- Chọn mọi test `default-safe` thuộc `core-security` trong default lane.
- Chọn test `default-safe` thuộc `migration-specific` chỉ khi
  `requiredForMigrations` chứa chính xác pending migration path trong
  `subjectCommit` hiện tại. Không dùng glob, substring, timestamp heuristic,
  tên file, hay suy luận từ SQL.
- Giữ nguyên ý nghĩa của `opt-in` và `live-only`; safety không bị đổi chỉ vì
  chi phí chạy.
- Giữ assertion RPC authorization, JWT role/user, tenant isolation, ACL
  public/anon/authenticated, `search_path`, và migration integrity trong lõi.
  Test trộn security và business phải tách assertion bảo mật trước khi phần
  business được loại khỏi default selection.
- Dùng cùng pending-path input và cùng selector cho static certification offline
  và baseline-forward dynamic lane. Static không thay thế bằng chứng dynamic.
- Giữ baseline preflight, baseline health, high-water, và full Technical
  Configuration parity. Thu hẹp selector không làm thu hẹp fingerprint,
  catalog parity, hoặc invariant contract.
- Tách baseline repair, catch-up, refresh và xử lý hạ tầng thành operations
  follow-up. Gate không tự sửa baseline để biến bằng chứng thiếu thành PASS.

## Ranh giới bắt buộc

Các quyết định #932, #933, #934, #935 và #936 tiếp tục là hard boundary của
change này. Những ranh giới sau được giữ nguyên:

- `subjectCommit` phải là exact landed commit. Mọi evidence phải bind vào
  migration path và canonical SHA tại commit đó cùng
  `supabase/applied-migrations.lock.json`.
- Applied migration và lock history là immutable, append-only; migration đã
  applied không được sửa, đổi tên, xóa, repair hoặc relabel.
- Baseline-forward chỉ chạy pending set trên disposable clone của restored
  baseline. Candidate không chạy trực tiếp trên persistent `qltbyt_test`.
- Static và baseline-forward là hai lane riêng. Cả hai phải có evidence đầy đủ
  cho cùng exact commit; thiếu executor, input, selected-set evidence,
  read-back, hoặc cleanup đáng tin cậy là `INCOMPLETE`, không phải `PASS`.
- PASS không cấp live-write permission. Mọi live write vẫn cần authorization
  mới, rõ ràng, affirmative cho đúng target và operation trong rollout session
  hiện tại, và phải dùng Supabase MCP.
- Baseline preflight phải tiếp tục kiểm tra health, high-water, structural
  state, catalog parity và full normalized `technical_configuration_*` parity.
  Baseline repair là operation riêng, không phải một nhánh ẩn của gate.

## Phạm vi và điều không thay đổi

Chunk 1 chỉ tạo bốn tài liệu trong proposed change này. Không có source code,
registry JSON/TypeScript, SQL test, database, Oracle baseline, `AGENTS.md`,
`CLAUDE.md`, runbook, hay live operation nào được thay đổi. Không tạo
`test-classification.md` và không thực hiện inventory Chunk 2.

Change này không thêm dependency, parser để đoán intent từ SQL, risk-scoring
engine, waiver framework mới, thin-trust cache, hay cơ chế bỏ qua full Technical
Configuration parity. Các waiver/debt contract hiện có tiếp tục được áp dụng;
required test không được debt-waive.

Issue #991 và analyzer follow-up #931 nằm ngoài change này. Không tạo migration,
không sửa catalog getter, và không sửa analyzer trong bất kỳ chunk nào của tài
liệu này.

## Lộ trình bảy chunk

| Chunk | Kết quả                                                       | Hành vi gate                          |
| ----- | ------------------------------------------------------------- | ------------------------------------- |
| 1     | Proposed change và contract docs                              | Chưa đổi runtime; chỉ chốt phạm vi    |
| 2     | Bảng phân loại test, batch tối đa 20 entry                    | Chưa sửa registry hay SQL             |
| 3     | Metadata tương thích và registry validation                   | Giữ selector cũ, vẫn chạy behavior cũ |
| 4     | Tách assertion security khỏi test trộn                        | Giữ behavior cũ cho tới khi cutover   |
| 5     | Selector thuần và unit tests                                  | Chưa nối vào lane                     |
| 6     | Nối selector vào cả static và dynamic lane, cập nhật vận hành | Cutover đồng thời, cùng selected set  |
| 7     | Acceptance trên disposable infrastructure                     | Chứng minh exact-commit và evidence   |

Mỗi chunk có review boundary riêng. Chunk 6 mới được phép chuyển behavior của
cả hai lane trong cùng một thay đổi; chunk 7 mới nghiệm thu dynamic behavior.

## Ảnh hưởng

- Affected spec: delta cho capability `database-quality-gate`.
- Dependency: `openspec/changes/add-database-quality-gate/` vẫn là nguồn contract
  nền. Các requirement không được nêu trong delta này giữ nguyên.
- Sau khi cutover, chi phí default lane giảm theo số test business thực sự gắn
  với pending path, trong khi core security và migration integrity vẫn luôn
  được kiểm tra.
- Gate vẫn fail-closed: selected-set mismatch, metadata thiếu, required test
  không chạy, hoặc evidence không đầy đủ đều không được chuyển thành PASS.

## Tiêu chí chấp nhận cho proposed change

- Strict OpenSpec validation PASS cho `narrow-db-quality-gate`.
- Delta spec có requirement/scenario hợp lệ, giữ nguyên requirement không bị
  ảnh hưởng, và mô tả rõ cutover tương lai.
- Tasks ghi đủ bảy chunk, giới hạn batch Chunk 2 là tối đa 20, và giữ các review
  boundary.
- Diff của Chunk 1 chỉ chứa `proposal.md`, `design.md`, `tasks.md`, và
  `specs/database-quality-gate/spec.md` trong change mới.
- Không chỉnh checkbox của `add-database-quality-gate`; việc tick hoàn thành do
  điều phối viên thực hiện sau khi có evidence review.
