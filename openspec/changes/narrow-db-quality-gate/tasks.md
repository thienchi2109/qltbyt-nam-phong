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

**Review boundary:** Chunk1 chỉ gồm bốn file proposed change; Chunk2 BATCH1–4
chỉ cập nhật `test-classification.md` và progress này. Không registry/SQL/source/
DB/runbook edit.

**Trạng thái:** Chunk1 tài liệu hoàn tất. Chunk2 đã review đủ BATCH1–4, tổng
`77/77` path; mọi entry có assertion evidence và mapping status. Các mục
2.3–2.5 đã hoàn tất cho toàn bộ inventory; Chunk3 vẫn chưa bắt đầu.

## Chunk 2 — Phân loại test theo batch tối đa 20

- [x] 2.1 Chụp danh sách `default-safe` tại exact subject commit và sắp path
      ổn định; không suy luận scope từ tên file hoặc category.
- [x] 2.2 Chia inventory thành các batch không quá 20 test; mỗi batch ghi path,
      assertion, rationale, safety hiện tại và coverage dự kiến.
- [x] 2.3 Gán đề xuất `core-security` cho RPC/JWT/tenant/ACL/search_path và
      migration integrity; gán `migration-specific` cho business workflow.
- [x] 2.4 Liệt kê từng mixed test và assertion security/business cần tách ở
      Chunk 4; không sửa SQL hoặc registry trong chunk này.
- [x] 2.5 Phân biệt entry migration-specific lịch sử có
      `requiredForMigrations` trống/không có (ghi intentional unmapped,
      rationale và giữ ngoài default lane) với path đã khai báo nhưng invalid
      (evidence blocking); không ép backfill lịch sử hoặc âm thầm bỏ test.

**Review boundary:** Chỉ bảng phân loại; chưa đổi behavior, chưa chạy Oracle.

**BATCH1–4 status (2026-09-07):** `test-classification.md` giữ snapshot đầy đủ
77 path tại exact subject commit
`1940887e9fe09d2264912602e43aee3b785a06bd`, chia `20/20/20/17`, và đã review
thực tế cả 77 SQL body. BATCH1 có 2 đề xuất `core-security`, 4
`migration-specific`, 14 mixed; BATCH2 có 5 `core-security`, 6
`migration-specific`, 9 mixed; BATCH3 có 0 pure `core-security`, 6
`migration-specific`, 14 mixed; BATCH4 có 0 pure `core-security`, 2
`migration-specific`, 15 mixed. Cumulative là 7 pure `core-security`, 18
`migration-specific`, 52 mixed. Bốn `requiredForMigrations` path đã khai báo
đều trỏ canonical path hợp lệ tại exact subject commit; BATCH4 không có
declared mapping. Historical migration-specific không có mapping được ghi
intentional-unmapped; declared-path invalid count là `0`. Mọi mixed entry đã
có cặp extraction path và giữ nguyên trong default lane cho tới Chunk 4.

**USER REVIEW required trước Chunk 3:** Đây là điểm dừng theo yêu cầu SDD.
Không tick hoặc bắt đầu bất kỳ mục Chunk 3 nào trước khi user review/duyệt
classification cumulative `77/77` và các ranh giới mixed trong
`test-classification.md`.

## Chunk 3 — Thêm metadata, giữ nguyên behavior cũ

- [x] 3.1 Viết RED cho enum `gateScope`, metadata thiếu và
      `requiredForMigrations` path không tồn tại.
- [x] 3.2 Thêm metadata tương thích vào registry theo bảng đã duyệt, vẫn giữ
      `safety` hiện tại.
- [x] 3.3 Giữ selector hiện tại chạy toàn bộ `default-safe`; chứng minh selected
      set trước/sau metadata không đổi.
- [x] 3.4 Chạy focused registry checks và dừng trước lane cutover.

**Review boundary:** Metadata và validation only; không giảm coverage hoặc sửa
SQL test.

**Handoff evidence (2026-09-08, commit `cd2068db`):**

- Kiểm tra RED hồi cứu: chép test scope từ `cd2068db` vào worktree baseline
  `0cfaec28`, chạy `node scripts/npm-run.js exec vitest run
scripts/__tests__/database-quality-gate-scope-metadata.test.ts`: 5/9 tests
  failed. Bốn case enum sai đã PASS với parser strict cũ; missing metadata và
  mapping path failed do validator chưa tồn tại. Kết quả này không chứng minh
  thứ tự RED trước implementation của phiên ban đầu. GREEN trên `cd2068db`:
  20/20 focused tests PASS.
- `scripts/__tests__/database-quality-gate-scope-metadata.test.ts` và
  `database-quality-gate-registry.test.ts`: 20/20 tests PASS.
- `format:check`, `verify:no-explicit-any`, `verify:dedupe`, `typecheck`: PASS.
- `react-doctor`: PASS, score 100/100.
- Registry metadata đối chiếu 77/77 test; selector legacy giữ nguyên selected set.
- Đã merge/push vào `main`; Chunk 4+ chưa bắt đầu.

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
