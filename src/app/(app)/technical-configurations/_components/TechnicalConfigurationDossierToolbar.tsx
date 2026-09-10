"use client"

import { Filter, Loader2 } from "lucide-react"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import { FacetedMultiSelectFilter } from "@/components/shared/table-filters/FacetedMultiSelectFilter"
import { Button } from "@/components/ui/button"
import type { useTechnicalConfigurationDossierList } from "../_hooks/useTechnicalConfigurationDossierList"
import type { useTechnicalConfigurationDossierSpecialties } from "../_hooks/useTechnicalConfigurationDossierSpecialties"
import { TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_MAX_LENGTH } from "../technical-configuration-dossier-search"

type DossierToolbarProps = {
  list: ReturnType<typeof useTechnicalConfigurationDossierList>
  specialties: ReturnType<typeof useTechnicalConfigurationDossierSpecialties>
  specialty: string | null | undefined
  onSpecialtyChange: (value: string | null | undefined) => void
}

/** Connects the shared Equipments filter to the dossier RPC's single-specialty contract. */
export function TechnicalConfigurationDossierToolbar({
  list,
  specialties,
  specialty,
  onSpecialtyChange,
}: DossierToolbarProps) {
  // Prefixes keep actual labels distinct from the synthetic all/null choices.
  const selected =
    specialty === undefined ? [] : [specialty === null ? "null" : `label:${specialty}`]
  const options = [
    { label: "Tất cả", value: "all" },
    { label: "Chưa phân loại", value: "null" },
    ...(specialties.data?.data ?? []).map((label) => ({
      label: label === "Tất cả" || label === "Chưa phân loại" ? `${label} (nhãn)` : label,
      value: `label:${label}`,
    })),
  ]

  return (
    <>
      <ListFilterSearchCard
        surface="plain"
        searchValue={list.searchText}
        onSearchChange={list.handleSearchTextChange}
        searchPlaceholder="Tìm theo loại thiết bị hoặc tên hồ sơ..."
        searchMaxLength={TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_MAX_LENGTH}
        searchEndAddon={
          list.isSearchPending ? (
            <span className="flex items-center" role="status" aria-label="Đang tìm kiếm hồ sơ">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            </span>
          ) : undefined
        }
        filterControls={
          <FacetedMultiSelectFilter
            title="Chuyên khoa"
            triggerVariant="command"
            triggerIcon={<Filter className="size-3.5" aria-hidden="true" />}
            options={options}
            value={selected}
            onChange={(values) => {
              const next = values.find((value) => !selected.includes(value))
              onSpecialtyChange(
                next === undefined || next === "all"
                  ? undefined
                  : next === "null"
                    ? null
                    : next.slice(6)
              )
            }}
          />
        }
      />
      {specialties.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          Không thể tải gợi ý chuyên khoa.
          <Button variant="outline" size="sm" onClick={() => void specialties.refetch()}>
            Thử lại chuyên khoa
          </Button>
        </div>
      ) : null}
    </>
  )
}
