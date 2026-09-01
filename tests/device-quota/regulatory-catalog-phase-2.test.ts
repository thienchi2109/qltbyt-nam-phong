import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { ALLOWED_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260901090000_device_quota_draft_persistence.sql"
)
const contractPath = join(process.cwd(), "src/lib/device-quota-draft-contract.ts")

const draftRpcNames = [
  "device_quota_unit_catalog_draft_create_or_open",
  "device_quota_unit_catalog_draft_get",
  "device_quota_unit_catalog_draft_save",
  "device_quota_unit_catalog_draft_exclude",
  "device_quota_unit_catalog_draft_restore",
] as const

describe("device quota Phase 2 draft catalog contract", () => {
  it("defines the isolated draft persistence model and guarded mutation RPCs", () => {
    const migration = readFileSync(migrationPath, "utf8")

    for (const objectName of [
      "unit_catalog_draft",
      "unit_catalog_draft_item",
      "device_quota_unit_catalog_audit_logs",
      "device_quota_regulatory_catalog_versions",
      "device_quota_regulatory_items",
      ...draftRpcNames,
    ]) {
      expect(migration).toContain(objectName)
    }

    expect(migration).toMatch(/UNIQUE INDEX[\s\S]*status = 'draft'/i)
    expect(migration).toMatch(/applied_quantity[\s\S]*CHECK[\s\S]*>= 0/i)
    expect(migration).toContain("revision BIGINT NOT NULL DEFAULT 1")
    expect(migration).toContain("revision = revision + 1")
    expect(migration).toContain("p_expected_revision BIGINT")
    expect(migration).toContain("RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409'")
    expect(migration).toContain("ON CONFLICT")
    expect(migration).toContain("FOR UPDATE")
    expect(migration).toContain("jsonb_to_recordset")
    expect(migration).toContain("INSERT INTO public.device_quota_unit_catalog_audit_logs")
  })

  it("keeps draft access session-scoped and source data immutable", () => {
    const migration = readFileSync(migrationPath, "utf8")

    expect(migration).toContain("request.jwt.claims")
    expect(migration).toContain("current_don_vi")
    expect(migration).toContain("WHEN v_role = 'admin' THEN 'global'")
    expect(migration).toContain("v_effective_role NOT IN ('global', 'to_qltb', 'regional_leader')")
    expect(migration).toContain("p_mutation AND v_effective_role NOT IN ('global', 'to_qltb')")
    expect(migration).toContain("regional_leader")
    expect(migration).toContain("mapping-only")
    expect(migration).toContain("source fields are immutable")
    expect(migration).toMatch(/SECURITY DEFINER[\s\S]*SET search_path = public, pg_temp/)
    expect(migration).toContain("REVOKE ALL ON TABLE")
    expect(migration).toContain("REVOKE ALL ON FUNCTION")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION")
    expect(migration).not.toContain("v_created BOOLEAN := false")
    expect(migration).toMatch(
      /Missing authenticated identity claims[\s\S]*v_created := false;[\s\S]*require_unit_catalog_session\(true\)/
    )

    for (const forbiddenName of [
      "INSERT INTO public.nhom_thiet_bi",
      "UPDATE public.nhom_thiet_bi",
      "INSERT INTO public.quyet_dinh_dinh_muc",
      "UPDATE public.quyet_dinh_dinh_muc",
      "INSERT INTO public.chi_tiet_dinh_muc",
      "UPDATE public.chi_tiet_dinh_muc",
      "UPDATE public.thiet_bi",
      "dinh_muc_nhom_bulk_import",
      "dinh_muc_unified_import",
      "dinh_muc_chi_tiet_bulk_import",
    ]) {
      expect(migration).not.toContain(forbiddenName)
    }
  })

  it("exposes only the Phase 2 draft RPCs through the existing proxy", () => {
    for (const rpcName of draftRpcNames) {
      expect(ALLOWED_FUNCTIONS.has(rpcName)).toBe(true)
    }
  })

  it("provides typed contracts for the future Phase 3 consumer", () => {
    const contract = readFileSync(contractPath, "utf8")

    for (const typeName of [
      "DeviceQuotaDraft",
      "DeviceQuotaDraftItem",
      "DeviceQuotaDraftSaveItem",
      "DeviceQuotaDraftRpc",
    ]) {
      expect(contract).toContain(`export type ${typeName}`)
    }

    expect(contract).toContain("expected_revision")
    expect(contract).toContain("applied_quantity")
    expect(contract).toContain("is_excluded")
    expect(contract).toContain("device_quota_unit_catalog_draft_save")
  })
})
