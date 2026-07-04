"use client"

import * as React from "react"
import type { Table } from "@tanstack/react-table"
import { Building2, Filter, Tags, UserRound, WalletCards, X } from "lucide-react"

import type { Equipment } from "@/types/database"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SearchInput } from "@/components/shared/SearchInput"
import { FacetedMultiSelectFilter } from "@/components/shared/table-filters/FacetedMultiSelectFilter"

interface EquipmentFilterFieldProps {
  label: string
  children: React.ReactNode
}

interface EquipmentToolbarDesktopFiltersProps {
  table: Table<Equipment>
  tenantControl?: React.ReactNode
  statuses: string[]
  departments: string[]
  users: string[]
  classifications: string[]
  fundingSources: string[]
  isFiltered: boolean
  activeFilterCount: number
}

interface EquipmentToolbarDesktopLayoutProps {
  title?: React.ReactNode
  description?: React.ReactNode
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  searchEndAddon?: React.ReactNode
  selectionActions?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
}

/** Wraps an equipment toolbar filter with its desktop row label. */
function EquipmentFilterField({ label, children }: EquipmentFilterFieldProps) {
  return (
    <div data-testid={`equipment-reference-filter-${label}`} className="min-w-0 space-y-1.5">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

/** Renders the desktop equipment filter controls in the reference grid structure. */
export function EquipmentToolbarDesktopFilters({
  table,
  tenantControl,
  statuses,
  departments,
  users,
  classifications,
  fundingSources,
  isFiltered,
  activeFilterCount,
}: EquipmentToolbarDesktopFiltersProps) {
  return (
    <div
      data-testid="equipment-command-filter-row"
      data-layout="equipment-reference"
      className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7"
    >
      {tenantControl ? (
        <EquipmentFilterField label="Cơ sở">{tenantControl}</EquipmentFilterField>
      ) : null}
      <EquipmentFilterField label="Tình trạng">
        <FacetedMultiSelectFilter
          column={table.getColumn("tinh_trang_hien_tai")}
          title="Tình trạng"
          options={statuses.map((s) => ({ label: s, value: s }))}
          triggerVariant="command"
          triggerIcon={<Filter className="size-3.5" aria-hidden="true" />}
        />
      </EquipmentFilterField>
      <EquipmentFilterField label="Khoa/Phòng">
        <FacetedMultiSelectFilter
          column={table.getColumn("khoa_phong_quan_ly")}
          title="Khoa/Phòng"
          options={departments.map((d) => ({ label: d, value: d }))}
          triggerVariant="command"
          triggerIcon={<Building2 className="size-3.5" aria-hidden="true" />}
        />
      </EquipmentFilterField>
      <EquipmentFilterField label="Người sử dụng">
        <FacetedMultiSelectFilter
          column={table.getColumn("nguoi_dang_truc_tiep_quan_ly")}
          title="Người sử dụng"
          options={users.map((u) => ({ label: u, value: u }))}
          triggerVariant="command"
          triggerIcon={<UserRound className="size-3.5" aria-hidden="true" />}
        />
      </EquipmentFilterField>
      <EquipmentFilterField label="Phân loại">
        <FacetedMultiSelectFilter
          column={table.getColumn("phan_loai_theo_nd98")}
          title="Phân loại"
          options={classifications.map((c) => ({ label: c, value: c }))}
          triggerVariant="command"
          triggerIcon={<Tags className="size-3.5" aria-hidden="true" />}
        />
      </EquipmentFilterField>
      <EquipmentFilterField label="Nguồn kinh phí">
        <FacetedMultiSelectFilter
          column={table.getColumn("nguon_kinh_phi")}
          title="Nguồn kinh phí"
          options={fundingSources.map((f) => ({ label: f, value: f }))}
          triggerVariant="command"
          triggerIcon={<WalletCards className="size-3.5" aria-hidden="true" />}
        />
      </EquipmentFilterField>
      {isFiltered && (
        <div
          data-testid="equipment-clear-filters-control"
          className="inline-flex h-9 min-w-[132px] self-end overflow-hidden rounded-lg border border-primary/50 bg-primary/10 shadow-none"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
            <Filter className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate text-sm font-medium">Bộ lọc</span>
            {activeFilterCount > 0 ? (
              <Badge
                variant="secondary"
                className="h-5 min-w-[20px] rounded-full bg-primary px-1.5 text-xs font-semibold text-white"
              >
                {activeFilterCount}
              </Badge>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Xóa bộ lọc"
            onClick={() => table.resetColumnFilters()}
            className="h-full w-8 rounded-none border-l border-slate-200 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}

/** Renders the desktop equipment toolbar as separate search and filter rows. */
export function EquipmentToolbarDesktopLayout({
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchEndAddon,
  selectionActions,
  actions,
  children,
}: EquipmentToolbarDesktopLayoutProps) {
  return (
    <Card>
      {title || description ? (
        <CardHeader className="gap-y-1 pb-3">
          {title ? <CardTitle className="heading-responsive-h2">{title}</CardTitle> : null}
          {description ? (
            <CardDescription className="body-responsive-sm">{description}</CardDescription>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent className="px-4 pb-4 md:px-6">
        <div data-testid="equipment-reference-filter-layout" className="space-y-3">
          <SearchInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={onSearchChange}
            showSearchIcon={false}
            className="h-9 w-full"
            endAddon={searchEndAddon}
            aria-label={searchPlaceholder}
          />

          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">{children}</div>

            {selectionActions || actions ? (
              <div className="flex w-full flex-wrap items-center justify-between gap-2 xl:w-auto xl:justify-end">
                {selectionActions ? (
                  <div className="min-w-0 shrink-0">{selectionActions}</div>
                ) : null}
                {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
