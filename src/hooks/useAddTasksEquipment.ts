/**
 * useAddTasksEquipment.ts
 *
 * TanStack Query hook for the add-tasks dialog equipment picker.
 * Uses server-side pagination/search/filtering to avoid Supabase REST row caps.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import type { Equipment } from '@/lib/data'

export interface AddTasksEquipmentFilters {
  departments: string[]
  users: string[]
  locations: string[]
}

export interface UseAddTasksEquipmentParams {
  open: boolean
  planDonVi: number | null | undefined
  search: string
  pagination: { pageIndex: number; pageSize: number }
  sort: string
  filters: AddTasksEquipmentFilters
}

interface EquipmentListResponse {
  data?: Equipment[] | null
  total?: number | null
  page?: number | null
  pageSize?: number | null
}

interface EquipmentFilterBucket {
  name?: string | null
  count?: number | null
}

type EquipmentFilterBucketsResponse = Partial<{
  department: EquipmentFilterBucket[]
  user: EquipmentFilterBucket[]
  location: EquipmentFilterBucket[]
}>

interface AddTasksFilterOption {
  label: string
  value: string
}

interface AddTasksFilterOptions {
  departments: AddTasksFilterOption[]
  users: AddTasksFilterOption[]
  locations: AddTasksFilterOption[]
}

const EMPTY_EQUIPMENT: Equipment[] = []
const EMPTY_FILTER_OPTIONS: AddTasksFilterOptions = {
  departments: [],
  users: [],
  locations: [],
}

function bucketToOptions(bucket: EquipmentFilterBucket[] | undefined): AddTasksFilterOption[] {
  if (!bucket) return []
  return bucket.flatMap((item) => {
    const name = (item.name ?? '').trim()
    return name ? [{ label: name, value: name }] : []
  })
}

/** Fetches paginated equipment and filter buckets for the maintenance add-tasks dialog. */
export function useAddTasksEquipment({
  open,
  planDonVi,
  search,
  pagination,
  sort,
  filters,
}: UseAddTasksEquipmentParams) {
  const canFetch = open && typeof planDonVi === 'number' && Number.isFinite(planDonVi)
  const page = pagination.pageIndex + 1

  const equipmentQuery = useQuery<EquipmentListResponse, Error>({
    queryKey: [
      'equipment_list_enhanced',
      'add-tasks',
      {
        planDonVi,
        search: search || null,
        page,
        pageSize: pagination.pageSize,
        sort,
        filters,
      },
    ],
    queryFn: async ({ signal }) => {
      const result = await callRpc<EquipmentListResponse | null>({
        fn: 'equipment_list_enhanced',
        args: {
          p_q: search || null,
          p_sort: sort,
          p_page: page,
          p_page_size: pagination.pageSize,
          p_don_vi: planDonVi,
          p_khoa_phong_array: filters.departments.length > 0 ? filters.departments : null,
          p_nguoi_su_dung_array: filters.users.length > 0 ? filters.users : null,
          p_vi_tri_lap_dat_array: filters.locations.length > 0 ? filters.locations : null,
        },
        signal,
      })

      return result ?? { data: EMPTY_EQUIPMENT, total: 0, page, pageSize: pagination.pageSize }
    },
    enabled: canFetch,
    placeholderData: keepPreviousData,
  })

  const filterBucketsQuery = useQuery<EquipmentFilterBucketsResponse, Error>({
    queryKey: ['equipment_filter_buckets', 'add-tasks', { planDonVi }],
    queryFn: async ({ signal }) => {
      const result = await callRpc<EquipmentFilterBucketsResponse | null>({
        fn: 'equipment_filter_buckets',
        args: { p_don_vi: planDonVi },
        signal,
      })
      return result ?? {}
    },
    enabled: canFetch,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
  })

  const buckets = filterBucketsQuery.data
  const filterOptions = buckets
    ? {
        departments: bucketToOptions(buckets.department),
        users: bucketToOptions(buckets.user),
        locations: bucketToOptions(buckets.location),
      }
    : EMPTY_FILTER_OPTIONS

  return {
    equipment: equipmentQuery.data?.data ?? EMPTY_EQUIPMENT,
    total: equipmentQuery.data?.total ?? 0,
    isLoading: equipmentQuery.isLoading,
    isFetching: equipmentQuery.isFetching,
    isError: equipmentQuery.isError,
    error: equipmentQuery.error,
    filterOptions,
  }
}
