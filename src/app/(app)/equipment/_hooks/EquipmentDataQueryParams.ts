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

  return {
    queryKeyParams: {
      tenant: effectiveTenantKey,
      role: userRole,
      diaBan: userDiaBanId,
      donVi: effectiveSelectedDonVi,
      q: debouncedSearch || null,
      khoa_phong_array: selectedDepartments,
      nguoi_su_dung_array: selectedUsers,
      vi_tri_lap_dat_array: selectedLocations,
      tinh_trang_array: selectedStatuses,
      phan_loai_array: selectedClassifications,
      nguon_kinh_phi_array: selectedFundingSources,
    },
    rpcArgs: {
      p_q: debouncedSearch || null,
      p_don_vi: effectiveSelectedDonVi,
      p_khoa_phong_array: selectedDepartments.length > 0 ? selectedDepartments : null,
      p_nguoi_su_dung_array: selectedUsers.length > 0 ? selectedUsers : null,
      p_vi_tri_lap_dat_array: selectedLocations.length > 0 ? selectedLocations : null,
      p_tinh_trang_array: selectedStatuses.length > 0 ? selectedStatuses : null,
      p_phan_loai_array: selectedClassifications.length > 0 ? selectedClassifications : null,
      p_nguon_kinh_phi_array: selectedFundingSources.length > 0 ? selectedFundingSources : null,
    },
  }
}
