"use client"

import { useQuery } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"

export interface UnusedEquipmentReportSummary {
  totalCount: number
  deviceTypeCount: number
  departmentCount: number
  totalOriginalValue: number
}

export interface UnusedEquipmentReportGroup {
  deviceName: string
  equipmentCount: number
  totalOriginalValue: number
}

export interface UnusedEquipmentReportDepartment {
  departmentName: string
  equipmentCount: number
  totalOriginalValue: number
}

export interface UnusedEquipmentReportItem {
  id: number
  maThietBi: string | null
  tenThietBi: string | null
  model: string | null
  serial: string | null
  khoaPhongQuanLy: string | null
  ngayNhap: string | null
  createdAt: string
  giaGoc: number | null
  donVi: number
}

export interface UnusedEquipmentReportData {
  summary: UnusedEquipmentReportSummary
  topDeviceGroups: UnusedEquipmentReportGroup[]
  departments: UnusedEquipmentReportDepartment[]
  departmentOptions?: UnusedEquipmentReportDepartment[]
  items: UnusedEquipmentReportItem[]
  totalCount: number
  page: number
  pageSize: number
}

export interface UseUnusedEquipmentReportParams {
  selectedDonVi?: number | null
  searchTerm: string
  selectedDepartment: string
  page: number
  pageSize: number
  sort: string
  enabled: boolean
}

const unusedEquipmentReportKeys = {
  data: (params: UseUnusedEquipmentReportParams) => [
    "reports",
    "unused-equipment",
    {
      selectedDonVi: params.selectedDonVi ?? null,
      searchTerm: params.searchTerm,
      selectedDepartment: params.selectedDepartment,
      page: params.page,
      pageSize: params.pageSize,
      sort: params.sort,
      enabled: params.enabled,
    },
  ] as const,
}

const EMPTY_UNUSED_EQUIPMENT_REPORT: UnusedEquipmentReportData = {
  summary: {
    totalCount: 0,
    deviceTypeCount: 0,
    departmentCount: 0,
    totalOriginalValue: 0,
  },
  topDeviceGroups: [],
  departments: [],
  departmentOptions: [],
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 10,
}

export function useUnusedEquipmentReport(params: UseUnusedEquipmentReportParams) {
  return useQuery({
    queryKey: unusedEquipmentReportKeys.data(params),
    queryFn: async ({ signal }) => {
      return callRpc<UnusedEquipmentReportData>({
        fn: "unused_equipment_report_for_reports",
        args: {
          p_don_vi: params.selectedDonVi ?? null,
          p_q: params.searchTerm || null,
          p_khoa_phong: params.selectedDepartment === "all" ? null : params.selectedDepartment,
          p_page: params.page,
          p_page_size: params.pageSize,
          p_sort: params.sort,
        },
        signal,
      })
    },
    enabled: params.enabled,
    placeholderData: (previousData) => previousData ?? EMPTY_UNUSED_EQUIPMENT_REPORT,
    staleTime: 60_000,
  })
}
