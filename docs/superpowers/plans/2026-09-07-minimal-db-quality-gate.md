# Thu gọn DB Quality Gate về lõi tối thiểu đáng tin cậy Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents are available) or superpowers:executing-plans to implement this plan. Các bước dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Giảm universal DB Quality Gate xuống các bất biến migration và bảo mật RPC/JWT/tenant/ACL/search_path, đồng thời chạy business logic theo migration bằng khai báo rõ ràng.

**Architecture:** Giữ static/baseline preflight, exact landed commit, applied lock, baseline health và fail-closed semantics hiện có. Thêm một selector nhỏ dùng chung cho static certification và Oracle dynamic lane: test `default-safe` lõi bảo mật chạy luôn, test `default-safe` theo migration chỉ chạy khi `requiredForMigrations` khớp chính xác pending path; test `opt-in` và `live-only` giữ nguyên nghĩa.

**Tech Stack:** TypeScript, Vitest, Zod registry, PostgreSQL/psql trên Oracle disposable clone, Supabase MCP chỉ cho live operation được cấp phép riêng.

---

## Phạm vi và bằng chứng đã chốt

- Chỉ tạo, kiểm tra và commit/push tài liệu plan trong lượt này; không sửa source, SQL, registry, OpenSpec checkbox, Oracle baseline hoặc live DB.
- OpenSpec hiện hành là `openspec/changes/add-database-quality-gate/`; không tự tick lại 65/72 task hoặc sửa lịch sử của change này.
- Sau khi plan được duyệt mới tạo proposed change mới `openspec/changes/narrow-db-quality-gate/` để thực thi hành vi đã duyệt.
- [#991](https://github.com/thienchi2109/qltbyt-nam-phong/issues/991) xác nhận defect thật ở `public.don_vi_branding_get(bigint)`; migration forward-only và live apply sẽ là quyết định riêng.
- #991 cũng xác nhận catalog getter là `SECURITY DEFINER` có `search_path=public, pg_temp`, ACL authenticated-only; advisor này là finding đã được review, không được đổi sang invoker.
- [#931](https://github.com/thienchi2109/qltbyt-nam-phong/issues/931) ghi nhận `_get_jwt_claim` bị static analyzer bỏ sót và catalog `GRANT EXECUTE` unchanged bị exact-diff false positive.
- Bằng chứng #931 nằm tại `openspec/changes/archive/2026-09-07-add-device-quota-draft-excel-export/phase-3.5-evidence.md:125-170`.
- Evidence còn ghi nhận tenant-mismatch từng thiếu SQLSTATE `42501`; đây là regression thật cần giữ trong lõi RPC/tenant.
- Registry hiện có 103 SQL tests: 77 `default-safe`, 25 `opt-in`, 1 `live-only`; không được gọi toàn bộ 77 là cùng một lớp rủi ro.
- Registry hiện có 50 table-security invariants, trong đó 49 `unresolved`; giữ nguyên chúng như debt được báo cáo, không xóa hoặc tự giải quyết.

## Cách thực hiện từng chunk

Mỗi lượt chỉ thực hiện chunk được user duyệt, báo kết quả rồi dừng trước chunk tiếp theo. Điều phối viên giao phần thực hiện cho `gpt-5.6-luna`, reasoning `max`; không chạy đồng thời các chunk phụ thuộc nhau. Không cần khảo sát lại toàn bộ repo ở mỗi lượt.

| Chunk | Đầu ra                                                     | Phụ thuộc | Phạm vi DB                          |
| ----- | ---------------------------------------------------------- | --------- | ----------------------------------- |
| 1     | OpenSpec proposal và contract đề xuất                      | Không     | Không                               |
| 2     | Bảng phân loại test theo từng batch                        | 1         | Không                               |
| 3     | Schema registry tương thích và metadata đã phân loại       | 2         | Không                               |
| 4     | Tách assertion bảo mật khỏi test hỗn hợp                   | 3         | SQL test files; chưa chạy Oracle    |
| 5     | Selector thuần được bảo vệ bằng unit tests                 | 4         | Không                               |
| 6     | Nối selector vào cả hai lane và cập nhật contract vận hành | 5         | Không; chưa nghiệm thu Oracle       |
| 7     | Nghiệm thu, đo chi phí và bàn giao                         | 6         | Disposable Oracle; không live write |

Chunk 3–5 chỉ chuẩn bị khả năng mới; chưa bật cơ chế chọn test mới. Chunk 6 chuyển cả hai lane cùng lúc để tránh trạng thái static và dynamic chọn khác nhau. Commit ở chunk trung gian không đồng nghĩa gate mới đã được nghiệm thu. Các kiểm tra bắt buộc của repo vẫn áp dụng theo diff thực tế.

## Chunk 1: Chốt contract bằng tài liệu

**Files:**

- Read: `openspec/changes/add-database-quality-gate/proposal.md`
- Read: `openspec/changes/add-database-quality-gate/design.md`
- Read: `openspec/changes/add-database-quality-gate/specs/database-quality-gate/spec.md`
- Read: `openspec/changes/add-database-quality-gate/tasks.md`
- Create later, after approval: `openspec/changes/narrow-db-quality-gate/proposal.md`, `design.md`, `tasks.md`, `specs/database-quality-gate/spec.md`
- Align later: `AGENTS.md`, `CLAUDE.md`, `docs/runbooks/db-quality-gate-oracle.md`

- [ ] Ghi rõ trong proposed change mới rằng #932/#933/#934/#935/#936 vẫn là hard boundary.
- [ ] Giữ exact `subjectCommit`, migration path/SHA, `supabase/applied-migrations.lock.json`, applied-history immutability và live-write authorization.
- [ ] Giữ baseline preflight/certification hiện có trong scope đầu; không thiết kế thin-trust cache mới và không bỏ full Technical Configuration parity.
- [ ] Tách baseline repair thành operations follow-up; không tự sửa baseline trong migration gate.
- [ ] Giữ static và baseline-forward là hai lane; thiếu evidence đáng tin là `INCOMPLETE`, không tự chuyển thành `PASS`.
- [ ] Ghi rõ đây là selector/registry scope reduction; không thêm dependency, risk-scoring engine hay waiver framework mới.
- [ ] Kiểm tra proposed change không sửa checkbox lịch sử của `add-database-quality-gate` và không biến #991 thành scope của change này.
- [ ] Ghi đề xuất thay điều khoản chạy toàn bộ `default-safe` thành core + required contracts trong OpenSpec; chưa đổi quy định vận hành trong `AGENTS.md`, `CLAUDE.md` hoặc runbook.
- [ ] Chạy `openspec validate narrow-db-quality-gate --strict`, kỳ vọng PASS.

**Điểm dừng:** proposal có phạm vi và acceptance rõ ràng; user duyệt trước chunk 2. Không sửa runtime, registry hoặc SQL.

## Chunk 2: Phân loại test, chưa thay registry

**Files:**

- Review: `supabase/db-quality-gate-tests.json`
- Review: `supabase/db-quality-gate-invariants.json`
- Review: `scripts/db-quality-gate/expected-state-registry.ts`
- Review: `scripts/db-quality-gate/expected-state.ts`
- Record later: existing `evidence` fields and the new proposed change

- [ ] Giữ nguyên `safety` của từng test; test business an toàn không được gắn `opt-in` chỉ để làm xanh selector.
- [ ] Trong bảng phân loại, đề xuất `gateScope: "core-security" | "migration-specific"`; chưa ghi field vào registry.
- [ ] Gán `core-security` chỉ cho assertion về RPC authorization, JWT role/user/tenant, tenant mismatch/isolation, ACL public/anon/authenticated, search_path và migration integrity.
- [ ] Gán `migration-specific` cho business workflow/phase-gate/smoke không thuộc security contract; giữ `safety: "default-safe"` nếu fixture và transaction thực sự an toàn.
- [ ] Với test trộn security và business, liệt kê assertion và đường dẫn SQL test sẽ tách tại chunk 4; chưa sửa SQL.
- [ ] Ghi bảng phân loại từng path và assertion được giữ/tách trong `openspec/changes/narrow-db-quality-gate/test-classification.md`; xác định chính xác SQL test cần tách tại đây trước khi giao worker sửa. Không chọn theo tên file hoặc category.
- [ ] Giữ các catalog/search_path invariants đang active; không dùng 49 invariant `unresolved` làm lý do xóa coverage.
- [ ] Mỗi migration business mới phải có review record và test `migration-specific` với `requiredForMigrations` exact path; selector không được suy luận từ SQL.
- [ ] Default-safe chưa được phân loại phải làm registry cutover `BLOCKING`; không âm thầm bỏ test khỏi coverage.
- [ ] Missing declared migration path trong canonical source/subject commit là `BLOCKING`; không coi như test không liên quan.

**Chia nhỏ lượt khảo sát:** lấy danh sách `default-safe` tại exact commit, sắp path ổn định và chia batch tối đa 20 test (snapshot 77 test tương ứng bốn batch). Mỗi lượt cập nhật bảng cho đúng batch đã giao, ghi rationale/coverage rồi dừng; không chạy test hay sửa lỗi nghiệp vụ. Nếu registry thay đổi, đối chiếu phần chênh lệch trước khi chốt đủ coverage.

**Điểm dừng:** mọi default-safe test có phân loại và rationale; test hỗn hợp có danh sách file/assertion cụ thể. Không có test chưa phân loại bị bỏ ngầm.

## Chunk 3: Thêm metadata, giữ nguyên hành vi chạy gate

**Files:**

- Modify later: `scripts/db-quality-gate/expected-state-registry.ts`
- Modify later: `supabase/db-quality-gate-tests.json`
- Test: `scripts/__tests__/database-quality-gate-registry.test.ts`

- [ ] Viết RED cho enum sai và mapping path không tồn tại; thêm field `gateScope` tương thích với consumer hiện tại.
- [ ] Ghi metadata theo bảng đã duyệt; test hỗn hợp tạm giữ `core-security` cho tới khi chunk 4 hoàn tất tách coverage.
- [ ] Giữ nguyên selector đang chạy toàn bộ `default-safe`; không giảm số test được thực thi trong chunk này.
- [ ] Chuẩn bị kiểm tra đầy đủ metadata; bật yêu cầu bắt buộc trên đường chạy mới tại chunk 6, không phá reader/fixture lịch sử ngoài phạm vi.
- [ ] Chạy focused registry tests, kỳ vọng PASS; kiểm tra selected paths của selector cũ không đổi.

**Điểm dừng:** metadata đã được ghi nhưng gate vẫn chạy như trước. Không sửa SQL test hoặc lane orchestration.

## Chunk 4: Tách bảo mật khỏi test nghiệp vụ hỗn hợp

**Files:** các SQL test path đã chốt trong `test-classification.md`, `supabase/db-quality-gate-tests.json` và fixture/contract tests liên quan.

- [ ] Chỉ giao tối đa một nhóm nghiệp vụ mỗi lượt; nếu có nhiều nhóm, ghi thành 4a/4b/... trong bảng phân loại trước khi bắt đầu.
- [ ] Tách assertion RPC/tenant/ACL thành test `core-security`, giữ business assertions trong test `migration-specific` và giữ nguyên safety contract.
- [ ] Dùng fixture của harness để kiểm tra đăng ký, source, rollback và selection contract; không tạo test chỉ chứng minh file tồn tại.
- [ ] Chuẩn bị ca SQL tenant/ACL hợp lệ và vi phạm để chạy ở chunk 7; chưa tuyên bố semantic SQL PASS khi chưa thực thi.
- [ ] Chạy focused checks liên quan; nếu không có test hỗn hợp, ghi evidence và đánh dấu chunk không cần thay đổi.

**Điểm dừng:** bảng phân loại chứng minh không mất security assertion. Không có production migration hoặc business bugfix; kiểm chứng SQL động còn chờ chunk 7.

## Chunk 5: Viết selector thuần, chưa nối vào lane

**Files:** `scripts/db-quality-gate/expected-state.ts`, `scripts/__tests__/database-quality-gate-expected-state.test.ts`, và registry test hỗ trợ khi cần.

- [ ] Viết RED cho selector: mọi `core-security` được chọn; `migration-specific` chỉ được chọn khi `requiredForMigrations` giao với pending paths exact.
- [ ] Viết RED cho selector: `opt-in`/`live-only` không bị kéo vào default lane; không thay đổi semantics safety của chúng.
- [ ] Viết RED cho default-safe thiếu scope: selector mới phải từ chối, không bỏ qua test.
- [ ] Thêm selector thuần nhận registry và `pendingMigrationPaths`, giữ entrypoint selector cũ cho các lane tới chunk 6; không parse SQL để đoán business/security.
- [ ] Để `requiredForMigrations` là exact path match; không glob, substring, migration timestamp heuristic hoặc implicit fallback.
- [ ] Một migration business mới không có mapping phải dừng registry review với evidence thiếu; không tự coi là core-security.
- [ ] Giữ `baselineDebt` comparison tại `scripts/db-quality-gate/sql-test-debt.ts:90-122`; chỉ downgrade exact source-bound control/candidate failure ngoài protected scope.
- [ ] Không sửa baseline health, high-water, catalog parity, clone model hoặc reconciliation trong phase selector.

**Điểm dừng:** focused selector tests PASS; các lane production chưa gọi selector mới. Không Oracle và không đổi quy định vận hành.

## Chunk 6: Tích hợp static và dynamic trong một thay đổi

**Files:**

- Modify later: `scripts/db-quality-gate/static-lane-expected-state.ts`, `scripts/db-quality-gate/dynamic-lane-inputs.ts`, `scripts/db-quality-gate/dynamic-lane.ts`
- Verify consumers: `scripts/db-quality-gate/static-artifacts.ts`, `scripts/db-quality-gate/registries.ts`
- Align: `AGENTS.md`, `CLAUDE.md`, `docs/runbooks/db-quality-gate-oracle.md`
- Review: `scripts/db-quality-gate/static-policy-authorization.ts`
- Review: `scripts/db-quality-gate/static-policy-dangerous.ts`
- Review: `scripts/db-quality-gate/expected-state.ts:281-288`
- Test: `scripts/__tests__/database-quality-gate-static-lane.test.ts`
- Test: `scripts/__tests__/database-quality-gate-static-lane-evidence.test.ts`
- Test: `scripts/__tests__/database-quality-gate-static-policy-rpc.test.ts`
- Test: `scripts/__tests__/database-quality-gate-static-policy-acl-replay-adversarial.test.ts`
- Test: `scripts/__tests__/database-quality-gate-dynamic-lane.test.ts`

- [ ] Viết RED cho core security violation và required business failure: đều blocking; required contract không được miễn bằng baseline debt.
- [ ] Viết RED cho selected/attempted/executed mismatch: phải `INCOMPLETE`; business không liên quan không được thực thi.
- [ ] Xác định pending migrations bằng identity/path/SHA hiện có trước khi gọi selector; thay cả hai lane sang selector mới trong cùng chunk.
- [ ] Bật kiểm tra metadata đầy đủ và cập nhật hướng dẫn vận hành cùng diff; không đổi contract ở các chunk chuẩn bị.
- [ ] Static certification phải gọi cùng selector và cùng pending path set như dynamic lane; evidence selected paths lấy từ existing report data, không thêm report API nếu không cần.
- [ ] Dùng manifest/baseline input và identity resolver hiện có để xác định pending set; static vẫn offline, không SSH/đọc live. Thêm regression khi changed-files khác pending set: hai lane cùng input phải chọn cùng test. Thiếu input cần thiết phải `INCOMPLETE`, không dùng changed-files thay thế ngầm.
- [ ] Static phải certify mọi selected test có source hash, `psql` runner, rollback/isolation contract và fixture contract hợp lệ.
- [ ] Giữ static core cho ACL, public/anon denial, authenticated contract, JWT/tenant guards, search_path và applied migration integrity.
- [ ] Nếu #931 còn gây false positive, báo blocker/follow-up riêng; không gộp sửa analyzer vào chunk tích hợp.
- [ ] Không demote unrecognized JWT guard thành safe để im lặng static; unresolved analyzer finding vẫn `FAILED`/`INCOMPLETE` tùy evidence.
- [ ] Catalog `GRANT` unchanged vẫn giữ historical `FAILED` + exact-bound waiver; không generalized waiver cho mọi authenticated grant.
- [ ] Historical waivers không được áp dụng cho candidate fingerprint, changed object, changed source SHA hoặc new finding.

**Điểm dừng:** ordered TS checks và focused integration tests PASS; hai lane chọn cùng tập test từ cùng input. Chưa tuyên bố aggregate gate PASS trước chunk 7.

## Chunk 7: Nghiệm thu và đo chi phí một lần

**Files:**

- Evidence later: `openspec/changes/narrow-db-quality-gate/`
- Runbook: `docs/runbooks/db-quality-gate-oracle.md`
- Operational reference: `/root/Oracle/supabase-test.md`
- Read-only state: `supabase/applied-migrations.lock.json`

- [ ] Trên một exact landed commit, chạy static và baseline-forward với cùng source, registry, lock, baseline identity và harness hashes.
- [ ] Oracle chỉ apply pending migrations vào disposable clone của restored baseline; không apply candidate trực tiếp vào persistent baseline.
- [ ] Read-back phải chứng minh migration identity/SHA, baseline health có high-water và structural checks, catalog parity contract hiện hành, không có `postgres CREATE` ngoài contract.
- [ ] Cleanup phải chứng minh mọi disposable database/lock do chính run tạo đã được thu hồi; không xóa tài nguyên của run khác. Thiếu read-back/cleanup là `INCOMPLETE`.
- [ ] Dùng fixture regression để chứng minh ba trường hợp: core security luôn chạy, business contract chỉ chạy khi mapped, migration không có business mapping không kéo cả corpus vào. Không tạo migration giả trong lịch sử production chỉ để nghiệm thu harness.
- [ ] #991 là migration forward-only riêng chưa được tạo trong plan này; có thể dùng làm trường hợp vận hành đầu tiên sau khi gate mới được nghiệm thu. Chưa có quyền live apply và không tái sử dụng migration/evidence Phase 3.5 để chứng nhận #991.
- [ ] Nếu static hoặc Oracle fail do candidate/invariant, báo `FAILED`; nếu stale baseline, permission, executor, parser hoặc cleanup blocker lặp lại, dừng và báo `INCOMPLETE`, không retry vô hạn hoặc nới gate.
- [ ] Thực thi các ca SQL bảo mật tách ở chunk 4 trên disposable infrastructure; chứng minh fixture vi phạm bị bắt và fixture hợp lệ PASS.

**Điểm dừng:** evidence exact-commit và số đo chi phí đã ghi; user review kết quả. Nếu blocker hạ tầng thì bàn giao `INCOMPLETE`, không chuyển sang nhiệm vụ sửa Oracle. #991 và live apply tiếp tục tách riêng.

## Lựa chọn và khuyến nghị

- [ ] A — Giữ 77 `default-safe` chạy mọi migration: diff nhỏ nhất nhưng tiếp tục trả giá runtime và false positive business; không chọn.
- [ ] B — Thêm `gateScope` và chọn `core-security` luôn, `migration-specific` theo `requiredForMigrations`: giữ safety metadata đúng, selector nhỏ, traceable; khuyến nghị.
- [ ] C — Đổi toàn bộ business test sang `opt-in`: rẻ về selector nhưng làm sai nghĩa safety và dễ mất coverage; không chọn.
- [ ] Chốt B trong proposed change mới; không mở rộng sang parser/risk scoring/waiver framework.

## Đo lường, lệnh kiểm tra và tiêu chí chấp nhận

- [ ] Baseline runtime hiện chưa có số đo đáng tin cho selected-set mới; ghi wall time, selected count, run ID, report digest và exact commit trước khi đặt ngưỡng cuối.
- [ ] Budget đề xuất để đo: static local `<=60s`, focused Vitest `<=120s`, một Oracle baseline-forward `<=15m`; vượt ngưỡng là observation, không tự nới policy.
- [ ] Future worker chạy focused tests bằng lệnh có sẵn: `node scripts/npm-run.js exec -- vitest run scripts/__tests__/database-quality-gate-expected-state.test.ts scripts/__tests__/database-quality-gate-registry.test.ts scripts/__tests__/database-quality-gate-dynamic-lane.test.ts scripts/__tests__/database-quality-gate-static-lane.test.ts scripts/__tests__/database-quality-gate-static-lane-evidence.test.ts`.
- [ ] Với TS diff, theo đúng thứ tự: `node scripts/npm-run.js run format:check`; `node scripts/npm-run.js run verify:no-explicit-any`; `node scripts/npm-run.js run verify:dedupe`; `node scripts/npm-run.js run typecheck`; focused Vitest; `node scripts/npm-run.js run react-doctor`.
- [ ] Doc-only lượt này chỉ format/check bằng main; không chạy test, Oracle, DB, live apply hoặc CLI migration.
- [ ] Chỉ gọi aggregate `PASS` khi static và baseline-forward đều `PASS` trên cùng exact commit; otherwise preserve `FAILED`/`INCOMPLETE`.
- [ ] Một reviewer tập trung Critical/Important cho implementation; sửa finding trong scope và kiểm chứng, không tự mở vòng review hoặc unrelated debt fixes mới. Finding chưa giải quyết vẫn phải báo, không tuyên bố hoàn tất.
- [ ] Sau khi cùng lỗi hạ tầng lặp lại một lần, dừng lượt nghiệm thu và báo `INCOMPLETE` cùng blocker cụ thể; chỉ chạy lại khi input hoặc hạ tầng đã thay đổi có bằng chứng. Không tự mở nhiệm vụ sửa Oracle trong phase này.

## Handoff

- Trạng thái hiện tại: plan đã được soạn cho user review; chưa tạo proposed change, chưa thay assertion gate, chưa thay registry và chưa thay OpenSpec task state.
- Khảo sát và bản nháp do các subagent `gpt-5.6-luna`, reasoning `max` thực hiện. Lượt review độc lập cuối chạm usage limit; điều phối viên rà soát và sửa tài liệu, không ghi nhận subagent review PASS.
- Bước tiếp theo chỉ là chunk 1 khi được duyệt. Worker dùng `superpowers:subagent-driven-development`, thực hiện đúng chunk được giao với evidence riêng rồi dừng; không chạy liền cả bảy chunk.
- Kết quả mong đợi là universal gate nhỏ hơn nhưng vẫn giữ RPC/JWT/tenant/ACL/search_path và migration integrity; business verification vẫn tồn tại theo migration hoặc opt-in.

### Review checklist trước khi mở implementation

- [ ] User duyệt contract ở chunk 1 và mapping sau chunk 2 trước khi sửa registry tại chunk 3.
- [ ] Reviewer xác nhận không có test business an toàn nào bị đổi `safety` chỉ vì cost.
- [ ] Reviewer xác nhận core-security và migration-specific cùng dùng một exact path selector.
- [ ] Reviewer xác nhận baseline health/49 unresolved intents vẫn được báo cáo nguyên trạng.
- [ ] Reviewer xác nhận #991 vẫn là live operation riêng, không có implicit authorization.
- [ ] Proposed change được tạo ở chunk 1; source diff chỉ bắt đầu từ chunk 3 sau các điểm duyệt tương ứng.
