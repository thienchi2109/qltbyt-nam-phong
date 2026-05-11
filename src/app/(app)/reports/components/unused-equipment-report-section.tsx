"use client"

import * as React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UnusedEquipmentCharts } from "./unused-equipment-report-charts"
import { UnusedEquipmentKpiCards } from "./unused-equipment-report-kpis"
import { UnusedEquipmentTable } from "./unused-equipment-report-table"
import { useUnusedEquipmentReport } from "../hooks/use-unused-equipment-report"

interface UnusedEquipmentReportSectionProps {
  selectedDonVi?: number | null
  isGlobalOrRegionalLeader?: boolean
}

const EMPTY_SUMMARY = {
  totalCount: 0,
  deviceTypeCount: 0,
  departmentCount: 0,
  totalOriginalValue: 0,
}

export function UnusedEquipmentReportSection({
  selectedDonVi,
  isGlobalOrRegionalLeader,
}: UnusedEquipmentReportSectionProps) {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedDepartment, setSelectedDepartment] = React.useState("all")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const enabled = !isGlobalOrRegionalLeader || selectedDonVi != null

  const report = useUnusedEquipmentReport({
    selectedDonVi,
    searchTerm,
    selectedDepartment,
    page,
    pageSize,
    sort: "ten_thiet_bi.asc",
    enabled,
  })

  const data = report.data
  const summary = data?.summary ?? EMPTY_SUMMARY
  const departments = data?.departments ?? []
  const items = data?.items ?? []
  const topDeviceGroups = data?.topDeviceGroups ?? []
  const totalCount = data?.totalCount ?? 0

  const handleSearchChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value)
    setPage(1)
  }, [])

  const handleDepartmentChange = React.useCallback((value: string) => {
    setSelectedDepartment(value)
    setPage(1)
  }, [])

  const handlePageSizeChange = React.useCallback((value: string) => {
    setPageSize(Number(value))
    setPage(1)
  }, [])

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Thiết bị chưa có nhu cầu sử dụng</CardTitle>
          <CardDescription>Chọn đơn vị để xem danh sách thiết bị chưa có nhu cầu sử dụng</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            Chọn đơn vị để xem danh sách thiết bị chưa có nhu cầu sử dụng
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <section className="space-y-4" aria-labelledby="unused-equipment-report-title">
      <div>
        <h3 id="unused-equipment-report-title" className="text-lg font-semibold">
          Thiết bị chưa có nhu cầu sử dụng
        </h3>
        <p className="text-sm text-muted-foreground">
          Theo dõi thiết bị chưa có nhu cầu sử dụng trong phạm vi đơn vị đang xem.
        </p>
      </div>

      <UnusedEquipmentKpiCards
        totalCount={summary.totalCount}
        deviceTypeCount={summary.deviceTypeCount}
        departmentCount={summary.departmentCount}
        totalOriginalValue={summary.totalOriginalValue}
        isLoading={report.isLoading}
      />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="unused-equipment-search" className="text-sm font-medium">
              Tìm kiếm
            </label>
            <Input
              id="unused-equipment-search"
              placeholder="Tên, mã, model hoặc serial thiết bị..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="unused-equipment-department" className="text-sm font-medium">
              Khoa/phòng quản lý
            </label>
            <Select value={selectedDepartment} onValueChange={handleDepartmentChange}>
              <SelectTrigger id="unused-equipment-department" className="w-full md:w-[220px]">
                <SelectValue placeholder="Khoa/phòng quản lý" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.departmentName} value={department.departmentName}>
                    {department.departmentName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="unused-equipment-page-size" className="text-sm font-medium">
              Số dòng/trang
            </label>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger id="unused-equipment-page-size" className="w-full md:w-[140px]">
                <SelectValue placeholder="Số dòng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <UnusedEquipmentCharts
        deviceGroups={topDeviceGroups}
        departments={departments}
        isLoading={report.isLoading}
      />

      <UnusedEquipmentTable
        items={items}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        isLoading={report.isLoading}
        onPageChange={setPage}
      />
    </section>
  )
}
