"use client"

import * as React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SearchInput } from "@/components/shared/SearchInput"
import { cn } from "@/lib/utils"

export interface ListFilterSearchCardProps {
  title?: React.ReactNode
  description?: React.ReactNode
  tenantControl?: React.ReactNode
  surface?: "card" | "plain"
  searchValue: string
  onSearchChange: (value: string) => void
  searchInputRef?: React.Ref<HTMLInputElement>
  searchPlaceholder: string
  searchEndAddon?: React.ReactNode
  showSearchIcon?: boolean
  filterControls?: React.ReactNode
  mobileFilterControl?: React.ReactNode
  compactFilters?: boolean
  selectionActions?: React.ReactNode
  actions?: React.ReactNode
  chips?: React.ReactNode
  className?: string
  searchClassName?: string
}

export function ListFilterSearchCard({
  title,
  description,
  tenantControl,
  surface = "card",
  searchValue,
  onSearchChange,
  searchInputRef,
  searchPlaceholder,
  searchEndAddon,
  showSearchIcon = true,
  filterControls,
  mobileFilterControl,
  compactFilters = false,
  selectionActions,
  actions,
  chips,
  className,
  searchClassName,
}: ListFilterSearchCardProps) {
  const visibleFilterControls = compactFilters ? mobileFilterControl : filterControls

  const header = !title && !description
    ? null
    : surface === "card"
      ? (
        <CardHeader className="space-y-1 pb-3">
          {title ? (
            <CardTitle className="heading-responsive-h2">{title}</CardTitle>
          ) : null}
          {description ? (
            <CardDescription className="body-responsive-sm">{description}</CardDescription>
          ) : null}
        </CardHeader>
      )
      : (
        <div className="space-y-1 pb-3">
          {title ? (
            <div className="heading-responsive-h2 font-semibold">{title}</div>
          ) : null}
          {description ? (
            <div className="body-responsive-sm text-muted-foreground">{description}</div>
          ) : null}
        </div>
      )

  const content = (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          {tenantControl ? (
            <div className="w-full md:w-auto md:min-w-[220px] xl:min-w-[260px]">
              {tenantControl}
            </div>
          ) : null}

          <div className={cn("w-full md:min-w-[280px] md:max-w-[460px] md:flex-1", searchClassName)}>
            <SearchInput
              ref={searchInputRef}
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={onSearchChange}
              showSearchIcon={showSearchIcon}
              className="h-9 w-full"
              endAddon={searchEndAddon}
              aria-label={searchPlaceholder}
            />
          </div>

          {visibleFilterControls ? (
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
              {visibleFilterControls}
            </div>
          ) : null}
        </div>

        {(selectionActions || actions) ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-2 xl:w-auto xl:justify-end">
            {selectionActions ? (
              <div className="min-w-0 shrink-0">{selectionActions}</div>
            ) : null}
            {actions ? (
              <div className="flex items-center gap-2">{actions}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      {chips ? <div>{chips}</div> : null}
    </div>
  )

  if (surface === "plain") {
    return (
      <div className={className}>
        {header}
        {content}
      </div>
    )
  }

  return (
    <Card className={className}>
      {header}
      <CardContent className="px-4 pb-4 md:px-6">
        {content}
      </CardContent>
    </Card>
  )
}
