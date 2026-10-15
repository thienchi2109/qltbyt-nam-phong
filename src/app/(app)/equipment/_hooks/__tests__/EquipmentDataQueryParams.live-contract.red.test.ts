import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { buildEquipmentDataQueryParams } from "../EquipmentDataQueryParams"

const frontendInput = {
  effectiveTenantKey: "tenant-42",
  userRole: "to_qltb",
  userDiaBanId: 7,
  effectiveSelectedDonVi: 42,
  debouncedSearch: "monitor",
  selectedDepartments: ["ICU"],
  selectedUsers: ["Dr A"],
  selectedLocations: ["Room 1"],
  selectedStatuses: ["Hoat dong"],
  selectedClassifications: ["Class A"],
  selectedFundingSources: ["Fund A"],
}

const frontendCompatibilityArgumentNames = [
  "p_q",
  "p_sort",
  "p_page",
  "p_page_size",
  "p_don_vi",
  "p_khoa_phong_array",
  "p_nguoi_su_dung_array",
  "p_vi_tri_lap_dat_array",
  "p_tinh_trang_array",
  "p_phan_loai_array",
  "p_nguon_kinh_phi_array",
  "p_liquidation_last",
  "p_equipment_dataset",
].sort()

describe("equipment_list_enhanced live contract", () => {
  it("uses the compatibility overload for the current frontend payload", () => {
    const { rpcArgs } = buildEquipmentDataQueryParams(frontendInput)
    const frontendPayload = {
      ...rpcArgs,
      p_sort: "id.asc",
      p_page: 1,
      p_page_size: 25,
      p_liquidation_last: true,
    }

    expect(Object.keys(frontendPayload).sort()).toEqual(frontendCompatibilityArgumentNames)
  })

  it("delegates omitted scalar filters as NULL to the canonical overload", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20261015110000_equipment_list_enhanced_frontend_compatibility.sql"
      ),
      "utf8"
    )

    expect(migration).toContain("p_khoa_phong => NULL")
    expect(migration).toContain("p_nguoi_su_dung => NULL")
    expect(migration).toContain("p_vi_tri_lap_dat => NULL")
    expect(migration).toContain("p_tinh_trang => NULL")
    expect(migration).toContain("p_phan_loai => NULL")
    expect(migration).toContain("p_nguon_kinh_phi => NULL")
    expect(migration).toContain("TO authenticated, service_role")
  })
})
