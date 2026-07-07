"use client"

import * as React from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { ColumnFiltersState } from "@tanstack/react-table"

import { callRpc } from "@/lib/rpc-client"
import type { FilterBottomSheetData } from "../types"

export interface UseEquipmentFilterBucketsParams {
  shouldFetchData: boolean
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

export interface EquipmentSelectedFilters {
  selectedDepartments: string[]
  selectedUsers: string[]
  selectedLocations: string[]
  selectedStatuses: string[]
  selectedClassifications: string[]
  selectedFundingSources: string[]
}

export interface UseEquipmentFilterBucketsReturn {
  departments: string[]
  users: string[]
  locations: string[]
  statuses: string[]
  classifications: string[]
  fundingSources: string[]
  filterData: FilterBottomSheetData
}

type FilterBucketItem = { name: string; count: number }

type EquipmentFilterBucketsResponse = Partial<{
  department: FilterBucketItem[]
  user: FilterBucketItem[]
  location: FilterBucketItem[]
  status: FilterBucketItem[]
  classification: FilterBucketItem[]
  fundingSource: FilterBucketItem[]
}>

const EMPTY_FILTER_BUCKET: FilterBucketItem[] = []

const EMPTY_FILTER_DATA: FilterBottomSheetData = {
  status: [],
  department: [],
  location: [],
  user: [],
  classification: [],
  fundingSource: [],
}

function normalizeBucket(
  data: EquipmentFilterBucketsResponse | undefined,
  key: keyof EquipmentFilterBucketsResponse
) {
  return data?.[key] ?? EMPTY_FILTER_BUCKET
}

function getArrayFilter(columnFilters: ColumnFiltersState, id: string): string[] {
  const entry = columnFilters.find((filter) => filter.id === id)
  if (!Array.isArray(entry?.value)) return []
  return entry.value.filter((value): value is string => typeof value === "string")
}

/** Extracts equipment filter arrays from TanStack column filter state. */
export function getEquipmentSelectedFilters(
  columnFilters: ColumnFiltersState
): EquipmentSelectedFilters {
  return {
    selectedDepartments: getArrayFilter(columnFilters, "khoa_phong_quan_ly"),
    selectedUsers: getArrayFilter(columnFilters, "nguoi_dang_truc_tiep_quan_ly"),
    selectedLocations: getArrayFilter(columnFilters, "vi_tri_lap_dat"),
    selectedStatuses: getArrayFilter(columnFilters, "tinh_trang_hien_tai"),
    selectedClassifications: getArrayFilter(columnFilters, "phan_loai_theo_nd98"),
    selectedFundingSources: getArrayFilter(columnFilters, "nguon_kinh_phi"),
  }
}

/** Loads cascaded equipment filter buckets and maps them for desktop and mobile filters. */
export function useEquipmentFilterBuckets(
  params: UseEquipmentFilterBucketsParams
): UseEquipmentFilterBucketsReturn {
  const {
    shouldFetchData,
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

  const { data: filterBucketsData } = useQuery<EquipmentFilterBucketsResponse>({
    queryKey: [
      "equipment_filter_buckets",
      {
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
    ],
    queryFn: async ({ signal }) => {
      const result = await callRpc<EquipmentFilterBucketsResponse>({
        fn: "equipment_filter_buckets",
        args: {
          p_q: debouncedSearch || null,
          p_don_vi: effectiveSelectedDonVi,
          p_khoa_phong_array: selectedDepartments.length > 0 ? selectedDepartments : null,
          p_nguoi_su_dung_array: selectedUsers.length > 0 ? selectedUsers : null,
          p_vi_tri_lap_dat_array: selectedLocations.length > 0 ? selectedLocations : null,
          p_tinh_trang_array: selectedStatuses.length > 0 ? selectedStatuses : null,
          p_phan_loai_array: selectedClassifications.length > 0 ? selectedClassifications : null,
          p_nguon_kinh_phi_array: selectedFundingSources.length > 0 ? selectedFundingSources : null,
        },
        signal,
      })
      return result ?? {}
    },
    enabled: shouldFetchData,
    placeholderData: keepPreviousData,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })

  const departmentsData = normalizeBucket(filterBucketsData, "department")
  const usersData = normalizeBucket(filterBucketsData, "user")
  const locationsData = normalizeBucket(filterBucketsData, "location")
  const classificationsData = normalizeBucket(filterBucketsData, "classification")
  const statusesData = normalizeBucket(filterBucketsData, "status")
  const fundingSourcesData = normalizeBucket(filterBucketsData, "fundingSource")

  const selectedFilterOptions = React.useMemo<UseEquipmentFilterBucketsReturn>(() => {
    const mapNames = (items: FilterBucketItem[]) => items.map((x) => x.name).filter(Boolean)
    const mapOptions = (items: FilterBucketItem[]) =>
      items.map((x) => ({ id: x.name, label: x.name, count: x.count }))

    return {
      departments: mapNames(departmentsData),
      users: mapNames(usersData),
      locations: mapNames(locationsData),
      statuses: mapNames(statusesData),
      classifications: mapNames(classificationsData),
      fundingSources: mapNames(fundingSourcesData),
      filterData: filterBucketsData
        ? {
            status: mapOptions(statusesData),
            department: mapOptions(departmentsData),
            location: mapOptions(locationsData),
            user: mapOptions(usersData),
            classification: mapOptions(classificationsData),
            fundingSource: mapOptions(fundingSourcesData),
          }
        : EMPTY_FILTER_DATA,
    }
  }, [
    departmentsData,
    usersData,
    locationsData,
    statusesData,
    classificationsData,
    fundingSourcesData,
    filterBucketsData,
  ])

  return selectedFilterOptions
}
