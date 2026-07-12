export interface EquipmentDataQueryParamsInput {
  effectiveTenantKey: string
  userRole: string
  userDiaBanId?: number | null
  effectiveSelectedDonVi: number | null
  debouncedSearch: string
  selectedDepartments: string[]
  selectedUsers: string[]
  selectedLocations: string[]
  selectedStatuses: string[]
  selectedClassifications: string[]
  selectedFundingSources: string[]
}

/** Builds the shared equipment query-key parameters and RPC arguments. */
export function buildEquipmentDataQueryParams(params: EquipmentDataQueryParamsInput) {
  const {
    effectiveTenantKey,
    userRole,
    userDiaBanId,
    effectiveSelectedDonVi,
    debouncedSearch,
    selectedDepartments,
    selectedUsers,
    selectedLocations,
    selectedStatuses,
    selectedClassifications,
    selectedFundingSources,
  } = params

  const q = debouncedSearch || null
  const departmentFilters = selectedDepartments.length > 0 ? selectedDepartments : null
  const userFilters = selectedUsers.length > 0 ? selectedUsers : null
  const locationFilters = selectedLocations.length > 0 ? selectedLocations : null
  const statusFilters = selectedStatuses.length > 0 ? selectedStatuses : null
  const classificationFilters = selectedClassifications.length > 0 ? selectedClassifications : null
  const fundingSourceFilters = selectedFundingSources.length > 0 ? selectedFundingSources : null

  return {
    queryKeyParams: {
      tenant: effectiveTenantKey,
      role: userRole,
      diaBan: userDiaBanId,
      donVi: effectiveSelectedDonVi,
      q,
      khoa_phong_array: departmentFilters,
      nguoi_su_dung_array: userFilters,
      vi_tri_lap_dat_array: locationFilters,
      tinh_trang_array: statusFilters,
      phan_loai_array: classificationFilters,
      nguon_kinh_phi_array: fundingSourceFilters,
    },
    rpcArgs: {
      p_q: q,
      p_don_vi: effectiveSelectedDonVi,
      p_khoa_phong_array: departmentFilters,
      p_nguoi_su_dung_array: userFilters,
      p_vi_tri_lap_dat_array: locationFilters,
      p_tinh_trang_array: statusFilters,
      p_phan_loai_array: classificationFilters,
      p_nguon_kinh_phi_array: fundingSourceFilters,
    },
  }
}
