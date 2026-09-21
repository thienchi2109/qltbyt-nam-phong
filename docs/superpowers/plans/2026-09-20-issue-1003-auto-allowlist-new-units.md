# Issue #1003 Auto-Allowlist New Units Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo đơn vị mới qua ứng dụng sẽ tự thêm ID vào cả hai Web Push allowlist trong cùng transaction; việc nhận thông báo vẫn cần cấu hình người nhận, browser opt-in và quyền hiện hành.

**Architecture:** Bổ sung một câu `UPDATE` vào RPC `public.don_vi_create` ngay sau `INSERT ... RETURNING`. Giữ các ID đã có, chỉ append ID mới; không thêm mode, trigger lifecycle, job đồng bộ hay UI. Migration forward-only không thực hiện tạo đơn vị hoặc backfill dữ liệu khi apply.

**Tech Stack:** PostgreSQL/Supabase RPC, SQL rollback tests, Database Quality Gate Oracle, OpenSpec.

---

## Quyết định đã duyệt và bằng chứng

Maintainer đã chốt qua grilling trong phiên #1003:

- Thêm vào **cả registration và dispatch allowlist một lần khi tạo**.
- Cùng transaction: insert và hai allowlist cùng thành công hoặc cùng rollback.
- Gỡ ID thủ công về sau thì hệ thống không tự thêm lại.
- 28 đơn vị hiện tại đã được mở theo xác nhận maintainer; không cần backfill.
- Không đổi kill switches, recipient config, browser permission, ownership, tenant, epoch hay VAPID.
- Không thêm mode, quản trị UI, reconcile định kỳ hoặc thay đổi chính sách inactive/reactivate.
- Chỉ plan được thực hiện trong phiên này. Implementation và live apply là hai bước riêng.

Source đã khảo sát:

| Nguồn                                                                               | Vai trò                                                   |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/components/add-tenant-dialog.tsx:53`                                           | Luồng tạo đơn vị của ứng dụng gọi `don_vi_create`         |
| `supabase/migrations/2025-09-30/20250930_add_google_drive_folder_to_don_vi.sql:112` | Định nghĩa source mới nhất tìm được của RPC, 6 tham số    |
| `supabase/migrations/20260912000100_web_push_controls_nonce.sql`                    | Hai arrays NOT NULL, mặc định rỗng; registration controls |
| `supabase/migrations/20260913020200_web_push_claim_recipient_eligibility.sql`       | Dispatch lọc cả intent và delivery bằng allowlist         |
| `src/app/api/rpc/__tests__/user-tenant-management-rbac-characterization.test.ts`    | Source regression cho global/admin create guard           |
| `supabase/tests/web_push_phase4.sql` và `supabase/tests/web_push_phase45.sql`       | Fixtures và assertions runtime/authorization có sẵn       |
| `docs/runbooks/db-quality-gate-oracle.md`                                           | Gate, exact-commit evidence và Oracle boundary            |

Phạm vi kỹ thuật là luồng tạo đơn vị qua RPC hiện hữu. SQL INSERT trực tiếp của DBA/restore không phải API ứng dụng; không cài trigger rộng lên bảng để thay đổi các đường đó. Trước triển khai phải xác minh không có đường tạo đơn vị được hỗ trợ nào khác; nếu có, báo lại phạm vi thay vì âm thầm bỏ sót.

Fact-check bổ sung: `web_push_subject_can_receive` chỉ enforce `don_vi.active` ở nhánh `regional_leader`; không có active guard chung cho mọi role. `web_push_recipient_is_eligible` không thêm active guard. #1003 không thay đổi contract này. Pending queue có thể tiếp tục trước deadline khi được allowlist lại; đó không phải backfill event. Không hứa hủy queue hoặc chỉ nhận event mới sau reactivate.

## File map

| Hành động | File                                                                        | Trách nhiệm                                                              |
| --------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Tạo       | `supabase/migrations/20260920100000_web_push_auto_allowlist_new_don_vi.sql` | Thay RPC bằng định nghĩa forward-only, giữ signature/ACL                 |
| Tạo       | `supabase/tests/web_push_new_unit_allowlist.sql`                            | Regression riêng, BEGIN/ROLLBACK, không phình test phase4                |
| Sửa       | `supabase/db-quality-gate-tests.json`                                       | Đăng ký test mới, migration-specific, requiredForMigrations              |
| Sửa       | `openspec/changes/add-web-push-notifications/specs/notifications/spec.md`   | Contract tạo đơn vị tự append                                            |
| Sửa       | `openspec/changes/add-web-push-notifications/tasks.md`                      | Checklist #1003, chỉ tick theo evidence                                  |
| Sửa       | `openspec/changes/add-web-push-notifications/phase-7A-handoff.md`           | Ghi chú vận hành sau #1003, giữ lịch sử snapshot                         |
| Tạo       | `openspec/changes/add-web-push-notifications/issue-1003-evidence.md`        | RED/GREEN, file hashes, giới hạn; formal exact-HEAD reports ở ngoài repo |

Không sửa TS/TSX, worker Go, UI hoặc migration đã apply. Timestamp trên là tên dự kiến: xác minh thứ tự source mới nhất trước khi tạo; nếu có migration mới hơn cho cùng object, chọn timestamp sau nó và cập nhật toàn bộ registry/reference cùng lúc.

## Chunk 1: Implementation và kiểm chứng

### Task 1: Chốt baseline và fixture trước khi viết runtime

**Files:** đọc các nguồn trong bảng; chưa sửa runtime.

- [ ] **Step 1:** Tạo worktree implementation riêng; giữ plan branch chỉ có tài liệu. Dùng @superpowers:using-git-worktrees và @superpowers:subagent-driven-development. Coordinator giao Luna-max implement, rồi review theo acceptance bên trên.
- [ ] **Step 2:** Đọc @supabase-postgres-best-practices, @superpowers:test-driven-development và @code-deduplication. Kiểm tra reuse bằng Code Review Graph trước GitNexus; không tạo helper mới cho một câu UPDATE.
- [ ] **Step 3:** Kiểm tra mọi definition/ALTER FUNCTION của `don_vi_create`, callers và policies. Dùng Supabase MCP read-only `pg_get_functiondef`, `proconfig`, owner và ACL để đối chiếu source với live; không copy đè định nghĩa nếu phát hiện live drift.
- [ ] **Step 4:** Chốt migration source order và ghi baseline SHA. Kiểm tra Oracle theo `/root/Oracle/supabase-test.md` và `docs/runbooks/db-quality-gate-oracle.md`; không refresh/catch-up baseline trong scope này.
- [ ] **Step 5:** Tạo file evidence với trạng thái `NOT RUN` cho RED, GREEN, static, baseline-forward. Ghi rõ trạng thái waiver cũ `FAILED/INCOMPLETE` không được tái sử dụng cho migration mới.

### Task 2: Viết regression RED có giá trị hành vi

**Create:** `supabase/tests/web_push_new_unit_allowlist.sql`.

- [ ] **Step 1:** Viết core test dưới đây, giữ mọi fixture trong transaction rollback. Set JWT trong transaction, gọi RPC với role `authenticated`; việc kiểm tra controls do test owner thực hiện sau `RESET ROLE`.

```sql
BEGIN;
CREATE TEMP TABLE wp1003_result (id bigint);
GRANT INSERT, SELECT ON wp1003_result TO authenticated;
CREATE TEMP TABLE wp1003_before AS
SELECT to_jsonb(c) AS controls FROM public.web_push_runtime_controls c
WHERE singleton;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"app_role":"global"}', true);
INSERT INTO pg_temp.wp1003_result
SELECT id FROM public.don_vi_create(
  'wp1003-' || txid_current()::text, 'Issue 1003 fixture', true, NULL, NULL, NULL
);
RESET ROLE;
DO $$
DECLARE v_id bigint; v_before jsonb; v_after jsonb;
BEGIN
  SELECT id INTO STRICT v_id FROM pg_temp.wp1003_result;
  SELECT controls INTO STRICT v_before FROM pg_temp.wp1003_before;
  SELECT to_jsonb(c) INTO STRICT v_after
  FROM public.web_push_runtime_controls c WHERE singleton;
  ASSERT v_after->'registration_canary_don_vi_ids' =
    (v_before->'registration_canary_don_vi_ids') || jsonb_build_array(v_id),
    'new unit must append to registration allowlist';
  ASSERT v_after->'dispatch_canary_don_vi_ids' =
    (v_before->'dispatch_canary_don_vi_ids') || jsonb_build_array(v_id),
    'new unit must append to dispatch allowlist';
  ASSERT (v_after - 'registration_canary_don_vi_ids' - 'dispatch_canary_don_vi_ids') =
    (v_before - 'registration_canary_don_vi_ids' - 'dispatch_canary_don_vi_ids'),
    'create must preserve all other controls';
END;
$$;
ROLLBACK;
```

- [ ] **Step 2:** Thêm subtransaction test lỗi sau insert: xóa singleton controls bên trong `BEGIN ... EXCEPTION` block của DO; gọi create với code khác; kỳ vọng SQLSTATE `55000` và message `Web Push runtime controls missing`. Sau catch, assert không có đơn vị đó và controls snapshot được phục hồi. Lỗi sai SQLSTATE/message phải làm test fail. Test này chứng minh lỗi append rollback insert, không chỉ validation trước insert.
- [ ] **Step 3:** Thêm transaction abort sau create thành công, bắt custom SQLSTATE `ZX003`, rồi assert cả đơn vị lẫn hai arrays quay lại snapshot trước block. Đồng thời giữ case duplicate code/empty name và non-global bị từ chối, raw admin vẫn được chuẩn hóa như cũ.
- [ ] **Step 4:** Thêm case arrays ban đầu khác nhau/rỗng, manual remove rồi rename/active-toggle, và tạo đơn vị thứ hai. Assert chỉ ID mới được append, ID bị gỡ không xuất hiện lại, ID cũ không bị reorder/dedupe, kill switches không tự bật. Tạo với `p_active=false` vẫn append: allowlisting không đồng nghĩa được gửi push và không thêm policy active mới.
- [ ] **Step 5:** Chạy test trước migration trên disposable Oracle clone; giữ assertion `new unit must append to registration allowlist` là ASSERT đầu tiên. Lưu hash source cùng SQLSTATE `P0004`, failureSignature và stderrSha256 từ executor; executor không trả raw stderr/message. Không dùng static parser PASS hay fixture setup error làm bằng chứng RED.

Lệnh RED cụ thể: dùng driver tạm dưới đây gọi **executor hiện hữu**. Cấu hình môi trường Oracle/pinned host theo runbook trước khi chạy. Driver dùng `esbuild` đã cài như `scripts/db-quality-gate/run-cli.cjs`; không thêm dependency/harness vào repo. Mọi lock, preflight, clone, role migration `postgres`, temporary schema privilege, rollback parser và cleanup đều tái sử dụng executor.

```bash
cat > /tmp/issue1003-sql-check.cjs <<'JS'
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = process.cwd();
const { buildSync } = require(require.resolve('esbuild', { paths: [root] }));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'issue1003-check-'));
const runId = `issue1003-${Date.now()}-${process.pid}`;
const databaseName = `dq_issue1003_${Date.now()}_${process.pid}`;
let executor;
let locked = false;
let created = false;
function expectOk(label, result) {
  console.log(JSON.stringify({ step: label, result }));
  if (result.status !== 'ok') throw new Error(`${label}: ${result.kind}`);
  return result.value;
}
try {
  const bundle = path.join(temporary, 'executor.cjs');
  buildSync({ entryPoints: [path.join(root, 'scripts/db-quality-gate/oracle-remote-executor.ts')],
    bundle: true, platform: 'node', target: 'node20', format: 'cjs', outfile: bundle });
  executor = require(bundle).oracleRemoteExecutorFromEnvironment();
  if (!executor) throw new Error('INCOMPLETE: Oracle configuration unavailable');
  expectOk('lock', executor.acquireLock(runId));
  locked = true;
  expectOk('preflight', executor.preflight());
  expectOk('clone', executor.createDatabase({ databaseName, template: 'qltbyt_test' }));
  created = true;
  const migrationPath = process.argv[2];
  if (migrationPath) {
    const content = fs.readFileSync(migrationPath, 'utf8');
    expectOk('apply', executor.applyMigrations({ databaseName, migrations: [{
      path: migrationPath, content,
      sha256: createHash('sha256').update(content).digest('hex')
    }] }));
  }
  const testPath = 'supabase/tests/web_push_new_unit_allowlist.sql';
  const result = executor.runSqlTest({ databaseName, path: testPath,
    content: fs.readFileSync(testPath, 'utf8'), fixtureContract: 'isolated-fixture',
    runnerRequirements: ['psql'], timeoutSeconds: 60,
    transactionContract: 'rollback-required' });
  if (!migrationPath) {
    console.log(JSON.stringify({ step: 'red-sql-test', result }));
    const diagnostic = result.diagnostic;
    if (result.status !== 'error' || result.kind !== 'failed' ||
        diagnostic?.sqlState !== 'P0004' || !diagnostic.failureSignature ||
        !diagnostic.stderrSha256) {
      throw new Error('INCOMPLETE: expected behavioral assertion RED with digests');
    }
    console.log('RED: first assertion is new-unit registration append; retain source hash and diagnostics');
    process.exitCode = 1;
  } else {
    expectOk('green-sql-test', result);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (created) {
    try { expectOk('drop', executor.dropDatabase(databaseName)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
  if (locked) {
    try { expectOk('unlock', executor.releaseLock(runId)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
  fs.rmSync(temporary, { recursive: true, force: true });
}
JS
node /tmp/issue1003-sql-check.cjs
```

RED được xác minh bằng ASSERT đầu tiên trong source đã hash, SQLSTATE `P0004` và diagnostic digests; không ghi như đã đọc raw message. Lỗi SSH/role/parser/fixture không được tính RED. Không terminate connection của `qltbyt_test` để ép clone; nếu baseline đang bận, lock/preflight/clone không sẵn sàng hoặc cleanup fail, báo `INCOMPLETE`. Không ghi SQL ứng viên lên baseline. Driver tạm này không thay thế certification bằng harness chính thức ở Task 5. Chỉ ghi nhận RED sau khi xác định SQL failure đúng assertion mục tiêu; sanitized diagnostic không đủ chi tiết thì ghi thiếu evidence, không tự suy diễn.

### Task 3: Migration tối thiểu và GREEN

**Create:** `supabase/migrations/20260920100000_web_push_auto_allowlist_new_don_vi.sql`.

- [ ] **Step 1:** Giữ nguyên signature/validation/return của RPC source đã đối chiếu. Nội dung dự kiến dưới đây; `search_path` phải được khóa, không kế thừa caller-writable path. Nếu live/source có hardening khác, giữ hardening thay vì hạ cấp.

```sql
BEGIN;
CREATE OR REPLACE FUNCTION public.don_vi_create(
  p_code text,
  p_name text,
  p_active boolean DEFAULT true,
  p_membership_quota integer DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_google_drive_folder_url text DEFAULT NULL
)
RETURNS TABLE (
  id bigint, code text, name text, active boolean,
  membership_quota integer, logo_url text,
  google_drive_folder_url text, used_count integer
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_role text; v_new_id bigint;
BEGIN
  v_role := lower(coalesce(public._get_jwt_claim('app_role'),
                           public._get_jwt_claim('role'), ''));
  IF v_role = 'admin' THEN v_role := 'global'; END IF;
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Tên đơn vị không được trống' USING HINT = 'validation_error';
  END IF;
  IF p_code IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.don_vi dv WHERE dv.code = p_code
  ) THEN
    RAISE EXCEPTION 'Mã đơn vị đã tồn tại' USING HINT = 'code_unique';
  END IF;
  INSERT INTO public.don_vi(code, name, active, membership_quota, logo_url, google_drive_folder_url)
  VALUES (p_code, btrim(p_name), coalesce(p_active, true),
          p_membership_quota, p_logo_url, p_google_drive_folder_url)
  RETURNING public.don_vi.id INTO v_new_id;

  UPDATE public.web_push_runtime_controls AS c
  SET registration_canary_don_vi_ids = array_append(c.registration_canary_don_vi_ids, v_new_id),
      dispatch_canary_don_vi_ids = array_append(c.dispatch_canary_don_vi_ids, v_new_id)
  WHERE c.singleton;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Web Push runtime controls missing' USING ERRCODE = '55000';
  END IF;

  RETURN QUERY
  SELECT d.id, d.code, d.name, d.active, d.membership_quota,
         d.logo_url, d.google_drive_folder_url, d.used_count
  FROM public.don_vi_get(v_new_id) d;
END;
$$;
REVOKE ALL ON FUNCTION public.don_vi_create(text, text, boolean, integer, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.don_vi_create(text, text, boolean, integer, text, text)
  TO authenticated;
COMMIT;
```

ID được DB sinh mới, nên append một lần trong RPC đủ; không thêm array sort/dedupe hoặc helper. UPDATE trên row singleton lấy row lock và append từ giá trị hiện tại, tránh read-modify-write phía ứng dụng. Giữ owner và quyền gọi ứng dụng được hỗ trợ; khai báo REVOKE PUBLIC/GRANT authenticated tường minh theo static policy. Kiểm tra effective ACL, quyền owner cập nhật controls, và authenticated/service_role vẫn không có direct controls write. Nếu live có direct grantee bất ngờ ngoài contract đã đối chiếu, báo drift trước khi áp dụng, không tự loại quyền hoặc nới quyền.

- [ ] **Step 2:** Chạy `node /tmp/issue1003-sql-check.cjs supabase/migrations/20260920100000_web_push_auto_allowlist_new_don_vi.sql`; migration chỉ apply lên clone mới, cùng SQL test phải GREEN. Executor phải cleanup clone kể cả khi test fail. Không thêm concurrency harness riêng cho một UPDATE đã được row lock bảo vệ.
- [ ] **Step 3:** Bổ sung tối đa một bridge scenario dùng fixture pattern của `web_push_phase45.sql`: đơn vị **do RPC vừa tạo**, manager/region/equipment, không sửa allowlist thủ công. Kiểm tra tuần tự chưa config rồi có config nhưng chưa subscription đều không có delivery; sau opt-in hợp lệ và event mới, registration/materialize/claim thành công. Chỉ kiểm tra DB claim, không gọi provider hoặc gửi push. Fixture để trong file test mới, không tạo framework/helper dùng chung.
- [ ] **Step 4:** Dùng coverage hiện hữu trong `web_push_phase2.sql`, `web_push_phase4.sql`, `web_push_phase45.sql` làm tham chiếu cho cross-unit, ownership/revision/epoch, VAPID, kill switches. Không sao chép matrix này vào test mới hoặc sửa predicate/worker để hợp thức hóa #1003. Test mới chỉ assert create không tự tạo config/subscription/intent/delivery, không thay controls khác và không đổi deadline/status queue có sẵn. Formal gate chạy đúng registry selection; chỉ chạy phase test bổ sung nếu blast-radius/review chỉ ra lý do cụ thể, ghi rõ baseline failures nếu có.
- [ ] **Step 5:** Xác minh gỡ ID mới khỏi hai arrays vẫn chặn registration/claim và không bị create/update đơn vị khác thêm lại. Ghi runbook rollback theo controls hiện hành; không xây thêm suite queue retry/terminal. Tắt kill switch là emergency stop, không hứa thu hồi notification đã in-flight.

### Task 4: Registry và tài liệu

**Modify:** ba file OpenSpec trong file map và `supabase/db-quality-gate-tests.json`.
**Create:** `openspec/changes/add-web-push-notifications/issue-1003-evidence.md`.

- [x] **Step 1:** Thêm registry entry bắt buộc dưới đây vào mảng tests; không đổi safety/gateScope của các test lịch sử.

```json
{
  "evidence": ["openspec/changes/add-web-push-notifications/issue-1003-evidence.md"],
  "fixtureContract": "isolated-fixture",
  "path": "supabase/tests/web_push_new_unit_allowlist.sql",
  "purpose": "phase-gate",
  "runnerRequirements": ["psql"],
  "requiredForMigrations": [
    "supabase/migrations/20260920100000_web_push_auto_allowlist_new_don_vi.sql"
  ],
  "safety": "default-safe",
  "timeoutSeconds": 60,
  "transactionContract": "rollback-required",
  "gateScope": "migration-specific"
}
```

- [x] **Step 2:** Thêm scenario vào spec: new unit auto-append; thiếu config/permission không nhận; manual remove không tự thêm lại; failed create rollback; kill switches/canary giữ hiệu lực. Không đổi eligibility inactive/reactivate.
- [x] **Step 3:** Thêm ghi chú runbook vào handoff: snapshot 28 là lịch sử rollout; sau migration, RPC append tự động. Canary không còn là tập cố định qua các lần tạo đơn vị: đơn vị mới vẫn được append, muốn ngừng mọi gửi dùng kill switch. Không tự bật flags hoặc backfill 28 IDs.
- [x] **Step 4:** Thêm checklist #1003 và ghi evidence tracked: RED/GREEN, local static, migration/test hashes, giới hạn. Formal static/baseline-forward ghi `NOT RUN at document commit`; kết quả exact HEAD về sau nằm ở external reports + handoff. Không ghi SHA của chính commit chứa file vào file đó. Chưa tick baseline-forward/live apply nếu chưa có bằng chứng tương ứng.

### Task 5: Kiểm chứng, commit và ranh giới live

- [ ] **Step 1:** Chạy các lệnh sau qua context-mode (không chạy full duplicate scan). Kỳ vọng format PASS, characterization PASS, OpenSpec valid.

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js exec vitest run src/app/api/rpc/__tests__/user-tenant-management-rbac-characterization.test.ts
openspec validate add-web-push-notifications --strict
node scripts/npm-run.js run db:quality-gate:local
```

Static lane chỉ kiểm tra static/rollback contract; không thực thi assertions PostgreSQL. Diff dự kiến SQL/JSON/Markdown nên không cần React Doctor/TS gates ngoài các hook hiện hữu. Nếu xuất hiện JS/TS diff, chạy đầy đủ verification order của AGENTS.md.

- [ ] **Step 2:** Commit migration, regression và registry sau GREEN, giữ hooks bật. Commit docs/evidence sau khi đối chiếu kết quả, không dùng `--no-verify`.

```bash
git add supabase/migrations/20260920100000_web_push_auto_allowlist_new_don_vi.sql supabase/tests/web_push_new_unit_allowlist.sql supabase/db-quality-gate-tests.json openspec/changes/add-web-push-notifications/issue-1003-evidence.md
git commit -m "fix(web-push): auto-allowlist newly created units"
git add openspec/changes/add-web-push-notifications/specs/notifications/spec.md openspec/changes/add-web-push-notifications/tasks.md openspec/changes/add-web-push-notifications/phase-7A-handoff.md
git commit -m "docs(web-push): document new-unit allowlisting contract"
```

- [ ] **Step 3:** Theo runbook cấu hình Oracle bằng các biến môi trường hiện hữu, xác minh host fingerprint và baseline state v2. Chạy hai lane trên cùng HEAD đã commit, dùng run-id duy nhất; giữ exact-HEAD report IDs/digests ngoài tracked files và trong handoff để không đổi commit vừa chứng nhận. Nếu cần commit cập nhật evidence/checklist thì bắt buộc chạy lại cả hai lane trên HEAD mới.

```bash
ISSUE1003_SHA="$(git rev-parse HEAD)"
ISSUE1003_RUN="issue1003-$(date -u +%Y%m%dT%H%M%SZ)"
node scripts/npm-run.js run db:quality-gate -- --lane static --subject-commit "$ISSUE1003_SHA" --run-id "$ISSUE1003_RUN-static"
node scripts/npm-run.js run db:quality-gate -- --lane baseline-forward --subject-commit "$ISSUE1003_SHA" --run-id "$ISSUE1003_RUN-forward"
```

Kỳ vọng cả lane PASS, digest đọc được, required regression được thực thi. Nếu preflight/Oracle bị chặn, ghi `BLOCKING / INCOMPLETE`; không nới waiver cũ, không sửa baseline hoặc hạ mức test để làm xanh. Nếu baseline control tái hiện bug, candidate phải PASS; không miễn test bug cần sửa. Sau merge hoặc bất kỳ commit mới, chứng nhận lại exact landed SHA theo runbook, không dùng chứng nhận SHA cũ.

- [ ] **Step 4:** Dùng @superpowers:requesting-code-review, reviewer `post_implementation_reviewer` với base ref cố định và acceptance trong plan; chỉ sửa findings thuộc #1003. Push branch sau checks/hook, không tự đóng issue như đã rollout khi live apply còn pending.
- [ ] **Step 5:** Dừng tại handoff cho maintainer: diff, tests, static/baseline-forward riêng, commit, rollback. Live apply qua Supabase MCP cần quyền riêng cho đúng migration. Không deploy, gửi push, hoặc sửa live controls trong bước implementation.

## Handoff của plan

Plan này chỉ chốt công việc để triển khai sau. Không tạo migration/test/runtime trong phiên viết plan. Dùng SDD cho lượt thực thi sau khi maintainer yêu cầu; chỉ tick checkbox sau bằng chứng thật.
