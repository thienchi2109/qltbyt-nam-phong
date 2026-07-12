import { describe, expect, it } from "vitest"

import { buildEquipmentDataQueryParams } from "../EquipmentDataQueryParams"

const baseInput = {
  effectiveTenantKey: "tenant-42",
  userRole: "to_qltb",
  userDiaBanId: 7,
  effectiveSelectedDonVi: 42,
  debouncedSearch: "monitor",
}

describe("buildEquipmentDataQueryParams", () => {
  it("preserves non-empty filter array references across query keys and RPC args", () => {
    const selectedDepartments = ["ICU"]
    const selectedUsers = ["Dr A"]
    const selectedLocations = ["Room 1"]
    const selectedStatuses = ["Hoat dong"]
    const selectedClassifications = ["Class A"]
    const selectedFundingSources = ["Fund A"]

    const { queryKeyParams, rpcArgs } = buildEquipmentDataQueryParams({
      ...baseInput,
      selectedDepartments,
      selectedUsers,
      selectedLocations,
      selectedStatuses,
      selectedClassifications,
      selectedFundingSources,
    })

    expect(queryKeyParams.khoa_phong_array).toBe(selectedDepartments)
    expect(rpcArgs.p_khoa_phong_array).toBe(selectedDepartments)
    expect(queryKeyParams.nguoi_su_dung_array).toBe(selectedUsers)
    expect(rpcArgs.p_nguoi_su_dung_array).toBe(selectedUsers)
    expect(queryKeyParams.vi_tri_lap_dat_array).toBe(selectedLocations)
    expect(rpcArgs.p_vi_tri_lap_dat_array).toBe(selectedLocations)
    expect(queryKeyParams.tinh_trang_array).toBe(selectedStatuses)
    expect(rpcArgs.p_tinh_trang_array).toBe(selectedStatuses)
    expect(queryKeyParams.phan_loai_array).toBe(selectedClassifications)
    expect(rpcArgs.p_phan_loai_array).toBe(selectedClassifications)
    expect(queryKeyParams.nguon_kinh_phi_array).toBe(selectedFundingSources)
    expect(rpcArgs.p_nguon_kinh_phi_array).toBe(selectedFundingSources)
  })

  it("normalizes empty filter arrays and an empty search to null in both outputs", () => {
    const { queryKeyParams, rpcArgs } = buildEquipmentDataQueryParams({
      ...baseInput,
      debouncedSearch: "",
      selectedDepartments: [],
      selectedUsers: [],
      selectedLocations: [],
      selectedStatuses: [],
      selectedClassifications: [],
      selectedFundingSources: [],
    })

    expect(queryKeyParams).toMatchObject({
      q: null,
      khoa_phong_array: null,
      nguoi_su_dung_array: null,
      vi_tri_lap_dat_array: null,
      tinh_trang_array: null,
      phan_loai_array: null,
      nguon_kinh_phi_array: null,
    })
    expect(rpcArgs).toMatchObject({
      p_q: null,
      p_khoa_phong_array: null,
      p_nguoi_su_dung_array: null,
      p_vi_tri_lap_dat_array: null,
      p_tinh_trang_array: null,
      p_phan_loai_array: null,
      p_nguon_kinh_phi_array: null,
    })
  })

  it("keeps cache-isolation fields query-only while aligning donVi and q", () => {
    const { queryKeyParams, rpcArgs } = buildEquipmentDataQueryParams({
      ...baseInput,
      selectedDepartments: [],
      selectedUsers: [],
      selectedLocations: [],
      selectedStatuses: [],
      selectedClassifications: [],
      selectedFundingSources: [],
    })

    expect(queryKeyParams).toMatchObject({
      tenant: "tenant-42",
      role: "to_qltb",
      diaBan: 7,
      donVi: 42,
      q: "monitor",
    })
    expect(rpcArgs).toMatchObject({
      p_don_vi: queryKeyParams.donVi,
      p_q: queryKeyParams.q,
    })
    expect(rpcArgs).not.toHaveProperty("tenant")
    expect(rpcArgs).not.toHaveProperty("role")
    expect(rpcArgs).not.toHaveProperty("diaBan")
  })
})
