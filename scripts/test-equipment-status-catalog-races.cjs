const fs = require("fs")
const cp = require("child_process")
const path = require("path")
const crypto = require("crypto")
// Usage: STATUS_RACE_PSQL_COMMAND='["ssh","host","docker","exec","-i","supabase-db","psql"]'
// node scripts/test-equipment-status-catalog-races.cjs equipment_status_catalog_race_<suffix>
// Supply connection/credentials using psql environment or the explicit command; never printed.
const root = path.resolve(__dirname, "..")
const db = process.argv[2]
if (!/^equipment_status_catalog_race_[a-z0-9_]+$/.test(db || "")) {
  throw Error("An explicit equipment_status_catalog_race_<suffix> disposable database is required")
}
let command
try {
  command = JSON.parse(process.env.STATUS_RACE_PSQL_COMMAND || '["psql"]')
} catch {
  throw Error("STATUS_RACE_PSQL_COMMAND must be a JSON argv array ending in psql")
}
if (
  !Array.isArray(command) ||
  !command.length ||
  command.some((x) => typeof x !== "string") ||
  command.at(-1) !== "psql"
) {
  throw Error("STATUS_RACE_PSQL_COMMAND must be a JSON argv array ending in psql")
}
const fixtures = []
const sessions = new Set()
function record(s) {
  console.log(s)
}
function args(role = "postgres") {
  return [...command.slice(1), "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", role, "-d", db]
}
function sql(s, role = "postgres") {
  const x = cp.spawnSync(command[0], args(role), {
    input: "SET statement_timeout='12s'; SET lock_timeout='5s';" + s,
    encoding: "utf8",
    timeout: 20000,
  })
  if (x.status !== 0) throw Error(x.stderr || "SQL execution timed out")
  return x.stdout.trim()
}
function session() {
  const child = cp.spawn(command[0], args(), { stdio: ["pipe", "pipe", "pipe"] })
  child.on("error", () => {
    child.spawnFailed = true
  })
  sessions.add(child)
  const timer = setTimeout(() => child.kill("SIGKILL"), 20000)
  child.on("close", () => {
    clearTimeout(timer)
    sessions.delete(child)
  })
  return child
}
function cleanup() {
  for (const child of sessions) child.kill("SIGKILL")
  for (const f of fixtures) {
    if (f.plan)
      sql(
        `BEGIN; DELETE FROM public.cong_viec_bao_tri WHERE ke_hoach_id=${f.plan}; DELETE FROM public.ke_hoach_bao_tri WHERE id=${f.plan}; COMMIT;`
      )
    sql(`BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='12s';
      DELETE FROM public.audit_logs WHERE admin_user_id=${f.user} OR target_user_id=${f.user};
      DELETE FROM public.thiet_bi WHERE id=${f.equipment} AND don_vi=${f.tenant};
      DELETE FROM public.nhan_vien WHERE id=${f.user} AND don_vi=${f.tenant};
      DELETE FROM public.don_vi WHERE id=${f.tenant}; COMMIT;`)
    if (sql(`SELECT count(*) FROM public.don_vi WHERE id=${f.tenant};`) !== "0")
      throw Error("Fixture cleanup did not complete")
  }
  record("PASS: owned fixtures cleaned up")
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function run() {
  if (sql("SELECT current_database();") !== db) throw Error("Connection database mismatch")
  record("DISPOSABLE ONLY; 5s lock/12s statement/20s process limits")
  const source = Buffer.concat(
    fs
      .readdirSync(path.join(root, "supabase/migrations"))
      .filter((f) => /^2026100910(1[0-9]|2[0-4])00_/.test(f))
      .sort()
      .map((f) => fs.readFileSync(path.join(root, "supabase/migrations", f)))
  )
  record("source SHA256 " + crypto.createHash("sha256").update(source).digest("hex"))
  const files = fs
    .readdirSync(path.join(root, "supabase/migrations"))
    .filter((f) => /^2026100910(1[0-9]|2[0-4])00_/.test(f))
    .sort()
  const definitions = JSON.parse(
    sql(
      "SELECT jsonb_agg(pg_get_functiondef(oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname = ANY (ARRAY['equipment_filter_buckets','equipment_status_distribution','equipment_list_enhanced','repair_request_create','usage_session_start','maintenance_tasks_bulk_insert','maintenance_task_update','maintenance_task_complete','maintenance_tasks_delete','repair_request_update','repair_request_sync_equipment_status','repair_request_approve','repair_request_complete','repair_request_delete']);"
    )
  )
  const normalize = (s) => s.replace(/\r/g, "").trim().replace(/;$/, "")
  for (const file of files) {
    const content = fs.readFileSync(path.join(root, "supabase/migrations", file), "utf8")
    const definition = content.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$;/)?.[0]
    if (!definition || !definitions.some((s) => normalize(s) === normalize(definition)))
      throw Error("Database RPC differs from source: " + file)
  }
  for (const op of ["approve", "complete", "delete", "maintenance-delete", "repair-update"])
    for (const ordering of op === "maintenance-delete" || op === "repair-update"
      ? ["equipment-first"]
      : ["terminal-first", "operation-first"]) {
      const suffix = Date.now() + "_" + op + "_" + ordering
      const fixture = JSON.parse(
        sql(
          `WITH tenant AS (INSERT INTO public.don_vi(name,active) VALUES ('Race ${suffix}',true) RETURNING id), usr AS (INSERT INTO public.nhan_vien(username,password,full_name,role,don_vi,current_don_vi) SELECT 'race_${suffix}','gate','Race gate','to_qltb',id,id FROM tenant RETURNING id,don_vi), equipment AS (INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,tinh_trang_hien_tai,don_vi,is_deleted) SELECT 'RACE-${suffix}','Race gate','Chờ sửa chữa',don_vi,false FROM usr RETURNING id,don_vi), request AS (INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id,mo_ta_su_co,hang_muc_sua_chua,nguoi_yeu_cau,trang_thai,tinh_trang_thiet_bi_truoc_yeu_cau) SELECT id,'gate','gate','gate','Chờ xử lý','Hoạt động' FROM equipment RETURNING id,thiet_bi_id) SELECT json_build_object('tenant',(SELECT id FROM tenant),'user',(SELECT id FROM usr),'equipment',request.thiet_bi_id,'request',request.id) FROM request;`
        )
      )
      fixtures.push(fixture)
      if (op === "maintenance-delete") {
        const extra = JSON.parse(
          sql(
            `WITH plan AS (INSERT INTO public.ke_hoach_bao_tri(ten_ke_hoach,nam,loai_cong_viec,khoa_phong,nguoi_lap_ke_hoach,trang_thai,don_vi) VALUES ('gate',2026,'kiem_tra','gate','gate','Bản nháp',${fixture.tenant}) RETURNING id), task AS (INSERT INTO public.cong_viec_bao_tri(ke_hoach_id,thiet_bi_id,loai_cong_viec) SELECT id,${fixture.equipment},'kiem_tra' FROM plan RETURNING id) SELECT json_build_object('plan',(SELECT id FROM plan),'task',(SELECT id FROM task));`
          )
        )
        Object.assign(fixture, extra)
      }
      const claims = JSON.stringify({
        app_role: "to_qltb",
        role: "authenticated",
        user_id: String(fixture.user),
        sub: String(fixture.user),
        don_vi: String(fixture.tenant),
      })
      const preamble = `BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='12s'; SET LOCAL idle_in_transaction_session_timeout='20s'; SELECT set_config('request.jwt.claims','${claims}',true); SET LOCAL ROLE authenticated;`
      const terminal = `SELECT public.equipment_update(${fixture.equipment},'{"tinh_trang_hien_tai":"Thanh lý nội bộ","ngay_ngung_su_dung":"2026-10-01"}'::jsonb);`
      const isPeer = ordering === "equipment-first"
      const operational =
        op === "approve"
          ? `SELECT public.repair_request_approve(${fixture.request},'gate',NULL,NULL);`
          : op === "complete"
            ? `SELECT public.repair_request_complete(${fixture.request},'History close',NULL,NULL);`
            : op === "delete"
              ? `SELECT public.repair_request_delete(${fixture.request});`
              : op === "maintenance-delete"
                ? `SELECT public.maintenance_tasks_delete(ARRAY[${fixture.task}]::bigint[]);`
                : `SELECT public.repair_request_update(${fixture.request},'changed','gate',NULL,NULL,NULL);`
      const holder = session()
      const holderCompleted = new Promise((resolve) => {
        holder.on("close", (status) => resolve(status))
        holder.on("error", () => resolve(-1))
      })
      let holderOut = "",
        holderError = ""
      holder.stdout.on("data", (b) => (holderOut += b))
      holder.stderr.on("data", (b) => (holderError += b))
      holder.stdin.write(
        preamble +
          (isPeer
            ? `SELECT public.equipment_update(${fixture.equipment},'{"ten_thiet_bi":"Locked peer"}'::jsonb);`
            : ordering === "terminal-first"
              ? terminal
              : operational) +
          "SELECT 'LOCK_READY';\n"
      )
      const started = Date.now()
      while (!holderOut.includes("LOCK_READY")) {
        if (holder.spawnFailed) throw Error("Holder process failed to start")
        if (Date.now() - started > 10000) throw Error("holder did not acquire lock " + holderError)
        await delay(100)
      }
      const app = "catalog_race_" + fixture.equipment
      const waiter = session()
      let waiterOut = "",
        waiterError = ""
      waiter.stdout.on("data", (b) => (waiterOut += b))
      waiter.stderr.on("data", (b) => (waiterError += b))
      const completed = new Promise((resolve) => {
        waiter.on("close", (status) => resolve(status))
        waiter.on("error", () => resolve(-1))
      })
      waiter.stdin.end(
        `\\set VERBOSITY verbose\nSET application_name='${app}';` +
          preamble +
          (isPeer || ordering === "terminal-first" ? operational : terminal) +
          "COMMIT;\n"
      )
      let observed = false
      for (let i = 0; i < 30; i++) {
        const n = sql(
          `SELECT count(*) FROM pg_stat_activity WHERE application_name='${app}' AND wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid))>0;`,
          "supabase_admin"
        )
        if (n === "1") {
          observed = true
          break
        }
        await delay(100)
      }
      if (!observed) {
        holder.stdin.end("ROLLBACK;\n")
        throw Error("no observed blocking for " + op + " " + ordering + " " + waiterError)
      }
      record(`observed lock wait ${op} ${ordering}`)
      holder.stdin.end(
        (isPeer
          ? op === "maintenance-delete"
            ? `SELECT public.maintenance_task_update(${fixture.task},'{"ghi_chu":"changed"}'::jsonb);`
            : `SELECT public.repair_request_complete(${fixture.request},'close',NULL,NULL);`
          : "") + "COMMIT;\n"
      )
      const [holderStatus, status] = await Promise.all([holderCompleted, completed])
      const after = JSON.parse(
        sql(
          `SELECT json_build_object('status',tinh_trang_hien_tai,'date',ngay_ngung_su_dung,'request_status',(SELECT trang_thai FROM public.yeu_cau_sua_chua WHERE id=${fixture.request}),'task_count',(SELECT count(*) FROM public.cong_viec_bao_tri WHERE thiet_bi_id=${fixture.equipment}), 'history',(SELECT count(*) FROM public.lich_su_thiet_bi WHERE thiet_bi_id=${fixture.equipment})) FROM public.thiet_bi WHERE id=${fixture.equipment};`
        )
      )
      const blocked = ordering === "terminal-first" && op === "approve"
      const guardPass = blocked
        ? status !== 0 &&
          waiterError.includes("55000") &&
          waiterError.includes("equipment_status_blocks_operational_actions") &&
          after.request_status === "Chờ xử lý" &&
          after.history === 0
        : status === 0
      const holderPassed = holderStatus === 0
      const preserved = isPeer
        ? op === "maintenance-delete"
          ? after.task_count === 0
          : after.request_status === "Hoàn thành"
        : after.status === "Thanh lý nội bộ" && after.date === "2026-10-01"
      record(
        `${holderPassed && guardPass && preserved ? "PASS" : "FAIL"} ${op} ${ordering} holderExit=${holderStatus} waiterExit=${status} final=${JSON.stringify(after)} stderr=${waiterError.trim()}`
      )
      if (!holderPassed || !guardPass || !preserved) throw Error("race failed")
    }
}
run()
  .catch((e) => {
    record("FAIL: " + e.message)
    process.exitCode = 1
  })
  .finally(() => {
    try {
      cleanup()
    } catch (e) {
      record("FAIL cleanup: " + e.message)
      process.exitCode = 1
    }
  })
