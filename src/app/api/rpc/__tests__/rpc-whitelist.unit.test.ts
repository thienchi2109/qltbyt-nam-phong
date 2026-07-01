import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { ALLOWED_FUNCTIONS, SERVICE_ROLE_RPC_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"
import { POST } from "@/app/api/rpc/[fn]/route"
import { hashZbsInternalRpcBody, signZbsInternalRpc } from "@/lib/zbs/internal-rpc-signature"

const INTERNAL_RPC_SECRET = "test-internal-rpc-secret"

async function invokeRpcProxy(fn: string, headers: HeadersInit = {}) {
  const req = new Request(`http://localhost/api/rpc/${fn}`, { method: "POST", headers })
  return POST(req as never, { params: Promise.resolve({ fn }) })
}

function signedInternalCronHeaders(fn: string, secret = INTERNAL_RPC_SECRET) {
  const timestamp = String(Date.now())
  const bodySha256 = hashZbsInternalRpcBody("")
  return {
    authorization: "Bearer cron-secret",
    "x-qltbyt-internal-rpc": "zbs-dispatch",
    "x-qltbyt-internal-rpc-body-sha256": bodySha256,
    "x-qltbyt-internal-rpc-signature": signZbsInternalRpc(secret, fn, timestamp, bodySha256),
    "x-qltbyt-internal-rpc-timestamp": timestamp,
  }
}

describe("RPC proxy whitelist", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejects unknown RPC functions", async () => {
    const res = await invokeRpcProxy("unknown_rpc_fn")
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Function not allowed" })
  })

  it("allows equipment_bulk_delete through whitelist checks", async () => {
    const res = await invokeRpcProxy("equipment_bulk_delete")

    // Whitelist check passed; next guard is missing Content-Length.
    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: "Content-Length header required" })
  })

  it("allows transfer_request_get through whitelist checks", async () => {
    const res = await invokeRpcProxy("transfer_request_get")

    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: "Content-Length header required" })
  })

  it("allows repair_request_change_history_list through whitelist checks", async () => {
    const res = await invokeRpcProxy("repair_request_change_history_list")

    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: "Content-Length header required" })
  })

  it("allows the ZBS pending dispatch read RPC through whitelist checks", async () => {
    const res = await invokeRpcProxy("zbs_notification_outbox_pending_for_dispatch")

    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: "Content-Length header required" })
  })

  it.each([
    "zbs_notification_outbox_claim_for_dispatch",
    "zbs_notification_outbox_mark_sent",
    "zbs_notification_outbox_mark_failed",
  ])('rejects cron-only ZBS dispatch RPC "%s" without the internal cron bearer', async (fn) => {
    const res = await invokeRpcProxy(fn)

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Cron-only RPC not allowed" })
  })

  it.each([
    "zbs_notification_outbox_claim_for_dispatch",
    "zbs_notification_outbox_mark_sent",
    "zbs_notification_outbox_mark_failed",
  ])('allows cron-only ZBS dispatch RPC "%s" through the internal cron gate', async (fn) => {
    vi.stubEnv("CRON_SECRET", "cron-secret")
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-jwt-secret")
    vi.stubEnv("ZBS_INTERNAL_RPC_SECRET", INTERNAL_RPC_SECRET)
    const res = await invokeRpcProxy(fn, signedInternalCronHeaders(fn))

    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: "Content-Length header required" })
  })

  it("rejects cron-only ZBS dispatch RPCs signed with the Supabase JWT secret fallback", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret")
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-jwt-secret")
    delete process.env.ZBS_INTERNAL_RPC_SECRET

    const res = await invokeRpcProxy("zbs_notification_outbox_claim_for_dispatch", {
      ...signedInternalCronHeaders("zbs_notification_outbox_claim_for_dispatch", "test-jwt-secret"),
      "content-length": "0",
    })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Cron-only RPC not allowed" })
  })

  it("rejects the cron bearer and internal source header without a server signature", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret")
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-jwt-secret")
    const res = await invokeRpcProxy("zbs_notification_outbox_claim_for_dispatch", {
      authorization: "Bearer cron-secret",
      "x-qltbyt-internal-rpc": "zbs-dispatch",
    })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Cron-only RPC not allowed" })
  })

  it("keeps ZBS dispatch RPCs on the server-only DB role path", () => {
    expect(SERVICE_ROLE_RPC_FUNCTIONS.has("zbs_notification_outbox_pending_for_dispatch")).toBe(
      true
    )
    expect(SERVICE_ROLE_RPC_FUNCTIONS.has("zbs_notification_outbox_claim_for_dispatch")).toBe(true)
    expect(SERVICE_ROLE_RPC_FUNCTIONS.has("zbs_notification_outbox_mark_sent")).toBe(true)
    expect(SERVICE_ROLE_RPC_FUNCTIONS.has("zbs_notification_outbox_mark_failed")).toBe(true)
    expect([...SERVICE_ROLE_RPC_FUNCTIONS].every((fn) => ALLOWED_FUNCTIONS.has(fn))).toBe(true)
  })

  it("allows dashboard_recent_activities through whitelist checks", async () => {
    const res = await invokeRpcProxy("dashboard_recent_activities")

    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: "Content-Length header required" })
  })

  it("allows unused_equipment_report_for_reports through whitelist checks", async () => {
    const res = await invokeRpcProxy("unused_equipment_report_for_reports")

    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: "Content-Length header required" })
  })

  it("allows change_password through whitelist checks", async () => {
    const res = await invokeRpcProxy("change_password")

    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: "Content-Length header required" })
  })

  it.each([
    "user_list_for_admin",
    "user_update_profile",
    "user_delete_by_admin",
    "reset_password_by_admin",
  ])('allows user-management RPC "%s" through whitelist checks', async (fn) => {
    const res = await invokeRpcProxy(fn)

    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: "Content-Length header required" })
  })

  it.each([
    "equipment_filter_buckets",
    "equipment_department_distribution",
    "dashboard_kpi_summary",
    "equipment_aggregate_search",
  ])('allows performance RPC "%s" through whitelist checks', async (fn) => {
    const res = await invokeRpcProxy(fn)

    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: "Content-Length header required" })
  })

  it.each([
    "ai_equipment_lookup",
    "ai_maintenance_summary",
    "ai_maintenance_plan_lookup",
    "ai_repair_summary",
    "ai_usage_summary",
    "ai_attachment_metadata",
    "ai_device_quota_lookup",
    "ai_quota_compliance_summary",
    "ai_category_suggestion",
    "ai_department_list",
    "ai_kill_switch_status",
    "ai_kill_switch_set",
  ])('allows AI RPC "%s" through whitelist checks', async (fn) => {
    const res = await invokeRpcProxy(fn)

    // Whitelist check passed; next guard is missing Content-Length.
    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: "Content-Length header required" })
  })

  it("rejects non-existent AI RPC", async () => {
    const res = await invokeRpcProxy("ai_does_not_exist")
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Function not allowed" })
  })

  it("rejects ai_query_database before any SQL runtime path is introduced", async () => {
    const res = await invokeRpcProxy("ai_query_database")
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Function not allowed" })
  })

  it("allows assistant_query_database_audit_log through whitelist checks", async () => {
    const res = await invokeRpcProxy("assistant_query_database_audit_log")

    // Whitelist check passed; next guard is missing Content-Length.
    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: "Content-Length header required" })
  })

  it("allows dinh_muc_unified_import through whitelist checks", async () => {
    const res = await invokeRpcProxy("dinh_muc_unified_import")

    // Whitelist check passed; next guard is missing Content-Length.
    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: "Content-Length header required" })
  })

  it("rejects retired hybrid_search_category_batch fallback RPC", async () => {
    const res = await invokeRpcProxy("hybrid_search_category_batch")

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Function not allowed" })
  })

  it("allows dinh_muc_thiet_bi_unassigned_names through whitelist checks", async () => {
    const res = await invokeRpcProxy("dinh_muc_thiet_bi_unassigned_names")

    // Whitelist check passed; next guard is missing Content-Length.
    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: "Content-Length header required" })
  })
})
