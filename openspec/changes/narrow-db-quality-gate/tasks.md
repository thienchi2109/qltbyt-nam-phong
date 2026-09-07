# Tasks: Thu hẹp phạm vi DB Quality Gate

## Quy tắc delivery

- Thực hiện đúng thứ tự Chunk 1 đến Chunk 7; mỗi chunk có review boundary và
  dừng trước chunk kế tiếp.
- Không sửa checkbox hoặc tài liệu của
  `openspec/changes/add-database-quality-gate/` trong change này.
- Giữ nguyên hard boundary của #932/#933/#934/#935/#936, exact
  `subjectCommit`, migration path/SHA, applied lock immutability và explicit
  live-write authorization.
- Không chạy candidate trên persistent `qltbyt_test`; dynamic acceptance chỉ
  dùng disposable Oracle clone.
- Không biến baseline repair, catch-up hoặc refresh thành một bước ngầm của
  selector hoặc migration gate.
- Không thêm dependency, SQL intent parser, risk engine, waiver framework mới,
  hay thin-trust cache.
- Không thay đổi safety của test vì chi phí chạy. Required test không được
  debt-waive.
- Chunk 1 là docs-only. Không sửa source, registry, SQL, DB, Oracle baseline,
  `AGENTS.md`, `CLAUDE.md`, runbook, #991 hoặc #931.

## Chunk 1 — Chốt contract bằng OpenSpec (hiện tại)

- [x] 1.1 Tạo `proposal.md` mô tả selector/registry narrowing, dependency với
      `add-database-quality-gate`, các hard boundary, phạm vi không đổi và
      không có live/database operation.
- [x] 1.2 Tạo `design.md` mô tả tách `safety` khỏi `gateScope`, exact pending
      path matching, mixed-test transition, shared selector input, baseline
      parity và evidence fail-closed.
- [x] 1.3 Tạo delta spec với requirement/scenario hợp lệ; ghi rõ requirement
      không bị ảnh hưởng vẫn giữ nguyên và cutover tương lai chỉ xảy ra ở
      Chunk 6.
- [x] 1.4 Tạo kế hoạch bảy chunk và acceptance criteria; chạy
      `openspec validate narrow-db-quality-gate --strict`, parse
      `openspec show narrow-db-quality-gate --json --deltas-only` và chạy
      focused Prettier cho bốn file.
- [x] 1.5 Ghi boundary publication/archive: chỉ archive sau khi canonical
      `database-quality-gate` có base requirement, delta đã reconcile/rebase và
      strict validate/show PASS; nếu thiếu thì STOP và yêu cầu canonicalization
      riêng, không auto archive change cũ hay đổi Chunks 2–7.

**Review boundary:** Chỉ bốn file trong proposed change mới. Không inventory,
không `test-classification.md`, không registry/SQL/source/DB/runbook edit.

**Trạng thái:** Chunk1 tài liệu hoàn tất, USER REVIEW trước Chunk2 đang chờ.

## Chunk 2 — Phân loại test theo batch tối đa 20

- [ ] 2.1 Chụp danh sách `default-safe` tại exact subject commit và sắp path
      ổn định; không suy luận scope từ tên file hoặc category.
- [ ] 2.2 Chia inventory thành các batch không quá 20 test; mỗi batch ghi path,
      assertion, rationale, safety hiện tại và coverage dự kiến.
- [ ] 2.3 Gán đề xuất `core-security` cho RPC/JWT/tenant/ACL/search_path và
      migration integrity; gán `migration-specific` cho business workflow.
- [ ] 2.4 Liệt kê từng mixed test và assertion security/business cần tách ở
      Chunk 4; không sửa SQL hoặc registry trong chunk này.
- [ ] 2.5 Phân biệt entry migration-specific lịch sử có
      `requiredForMigrations` trống/không có (ghi intentional unmapped,
      rationale và giữ ngoài default lane) với path đã khai báo nhưng invalid
      (evidence blocking); không ép backfill lịch sử hoặc âm thầm bỏ test.

**Review boundary:** Chỉ bảng phân loại; chưa đổi behavior, chưa chạy Oracle.

## Chunk 3 — Thêm metadata, giữ nguyên behavior cũ

- [ ] 3.1 Viết RED cho enum `gateScope`, metadata thiếu và
      `requiredForMigrations` path không tồn tại.
- [ ] 3.2 Thêm metadata tương thích vào registry theo bảng đã duyệt, vẫn giữ
      `safety` hiện tại.
- [ ] 3.3 Giữ selector hiện tại chạy toàn bộ `default-safe`; chứng minh selected
      set trước/sau metadata không đổi.
- [ ] 3.4 Chạy focused registry checks và dừng trước lane cutover.

**Review boundary:** Metadata và validation only; không giảm coverage hoặc sửa
SQL test.

## Chunk 4 — Tách mixed security assertions, giữ behavior cũ

- [ ] 4.1 Giao tối đa một nhóm business mỗi lượt; ghi nhóm tiếp theo trước khi
      bắt đầu nếu cần nhiều lượt.
- [ ] 4.2 Tách assertion RPC/JWT/tenant/ACL/search_path thành core-security
      coverage; giữ business assertion trong migration-specific test.
- [ ] 4.3 Giữ safety, fixture, transaction, rollback và source contract của
      test cũ; kiểm tra đăng ký bằng harness.
- [ ] 4.4 Giữ test trộn trong selected set cũ cho tới khi Chunk 6 cutover; không
      tuyên bố dynamic semantic PASS trước Chunk 7.

**Review boundary:** SQL test files và metadata liên quan; behavior gate cũ vẫn
được giữ.

## Chunk 5 — Selector pure, chưa wire vào lane

- [ ] 5.1 Viết RED cho core-security luôn được chọn và migration-specific chỉ
      được chọn khi `requiredForMigrations` khớp exact pending path.
- [ ] 5.2 Viết RED cho `opt-in`/`live-only` không vào default lane, scope thiếu
      bị từ chối, và safety enum/purpose restrictions hiện hành không bị
      `gateScope` nâng cấp; `performance`, `concurrency`, `live-acceptance`
      không được trở thành `default-safe`.
- [ ] 5.3 Implement selector pure nhận exact subject/pending identity, registry
      đã validate và trả selected paths/reasons ổn định.
- [ ] 5.4 Chứng minh selector không glob, substring, timestamp heuristic, SQL
      parser hoặc implicit fallback.
- [ ] 5.5 Giữ các lane gọi selector cũ; chưa chạy Oracle và chưa đổi baseline
      preflight/parity.
- [ ] 5.6 Viết RED phân biệt mapping lịch sử cố ý để trống vẫn ngoài default
      lane, path `requiredForMigrations` đã khai báo nhưng không tồn tại
      canonical là BLOCKING, và migration business mới thiếu relevant exact
      mapping đã review thì chặn review; không suy luận bằng SQL.

**Review boundary:** Pure selector và unit tests; production lane chưa dùng
selector mới.

## Chunk 6 — Cutover đồng thời cho static và baseline-forward

- [ ] 6.1 Viết RED cho core security violation và required business failure;
      baseline debt không được miễn required contract.
- [ ] 6.2 Dùng cùng pending-path resolver và selector cho static certification
      offline và baseline-forward dynamic lane.
- [ ] 6.3 Bật metadata completeness, selected/attempted/executed evidence và
      mismatch `INCOMPLETE` trong cả hai lane.
- [ ] 6.4 Giữ static offline, dynamic disposable-only; không dùng changed-files
      làm fallback cho pending set và không đọc live từ static.
- [ ] 6.5 Cập nhật operational docs ở phạm vi được duyệt, giữ baseline
      preflight/full Technical Configuration parity và mô tả baseline repair
      là operation follow-up.
- [ ] 6.6 Nếu #931 hoặc #991 còn finding, ghi follow-up riêng; không gộp
      analyzer fix, migration forward-only hoặc live apply vào cutover.

**Review boundary:** Cả hai lane chuyển cùng một contract trong cùng chunk;
chưa tuyên bố aggregate acceptance cuối cùng.

## Chunk 7 — Acceptance trên disposable infrastructure

- [ ] 7.1 Chạy static và baseline-forward trên cùng exact landed commit, lock,
      registry, baseline identity và harness hashes.
- [ ] 7.2 Xác nhận core security luôn chạy, business chỉ chạy khi exact path
      match, và business không mapping không kéo cả corpus.
- [ ] 7.3 Chạy selected SQL tests trên disposable Oracle clone; persistent
      `qltbyt_test` không bị candidate mutate.
- [ ] 7.4 Kiểm tra baseline health, high-water, structural state, full
      Technical Configuration parity, catalog parity và cleanup evidence.
- [ ] 7.5 Xác nhận missing/stale/permission/executor/cleanup evidence là
      `INCOMPLETE`; candidate hoặc invariant failure là `FAILED`.
- [ ] 7.6 Ghi run ID, selected count, wall time, report digest và exact commit;
      không áp dụng live migration và không tạo evidence cho #991.

**Review boundary:** Disposable acceptance và handoff; live write vẫn cần
authorization riêng.

## Tiêu chí bàn giao

- [ ] Static và baseline-forward PASS chỉ khi cùng exact commit và selected set
      có evidence đầy đủ; nếu một lane thiếu hoặc khác set thì giữ
      `FAILED`/`INCOMPLETE` tương ứng.
- [ ] Core security, migration integrity, baseline preflight và full Technical
      Configuration parity vẫn hiện diện trong report.
- [ ] Không có source/registry/SQL/DB change nào bị lẫn vào Chunk 1.
- [ ] Các follow-up #931, #991 và baseline repair được ghi riêng, không được
      hấp thụ vào selector change.
