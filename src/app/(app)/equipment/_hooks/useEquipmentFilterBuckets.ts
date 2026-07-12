"use client"

import * as React from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { ColumnFiltersState } from "@tanstack/react-table"

import { callRpc } from "@/lib/rpc-client"
import type { FilterBottomSheetData } from "../types"
import { buildEquipmentDataQueryParams } from "./EquipmentDataQueryParams"

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
): FilterBucketItem[] {
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

  const { queryKeyParams, rpcArgs } = buildEquipmentDataQueryParams({
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
  })

  const { data: filterBucketsData } = useQuery<EquipmentFilterBucketsResponse>({
    queryKey: [
      "equipment_filter_buckets",
      {
        ...queryKeyParams,
      },
    ],
    queryFn: async ({ signal }) => {
      const result = await callRpc<EquipmentFilterBucketsResponse>({
        fn: "equipment_filter_buckets",
        args: {
          ...rpcArgs,
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
