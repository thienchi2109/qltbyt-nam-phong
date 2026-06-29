"use client"

import * as React from "react"
import { ChevronRight, Search } from "lucide-react"

import { SearchInput } from "@/components/shared/SearchInput"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { isRegionalLeaderRole } from "@/lib/rbac"
import {
  canUseEquipmentAggregateSearch,
  normalizeEquipmentAggregateSearchError,
  useEquipmentAggregateSearch,
} from "../hooks/use-equipment-aggregate-search"
import { EquipmentSearchSkeleton } from "./equipment-search-report-tab-skeleton"
import {
  formatEquipmentSearchCount,
  getEquipmentSearchMaxCount,
  getEquipmentSearchFacilityText,
  getEquipmentSearchQuotaContext,
  normalizeEquipmentSearchRegionId,
  sortEquipmentSearchRows,
} from "./equipment-search-report-tab.utils"

interface EquipmentSearchReportTabProps {
  initialQuery: string
  onQueryCommit: (query: string) => void
  userRegionId?: number | string | null
  userRole: string | null | undefined
}

interface SelectedRegion {
  id: number
  name: string
}

interface EquipmentSearchState {
  draftQuery: string
  selectedRegion: SelectedRegion | null
  submittedQuery: string
}

type EquipmentSearchAction =
  | { type: "draft"; query: string }
  | { type: "select-region"; region: SelectedRegion | null }
  | { type: "submit"; query: string; selectedRegion: SelectedRegion | null }
  | { type: "sync-url"; state: EquipmentSearchState }

function createEquipmentSearchState(
  initialQuery: string,
  selectedRegion: SelectedRegion | null
): EquipmentSearchState {
  return {
    draftQuery: initialQuery,
    selectedRegion,
    submittedQuery: initialQuery.trim(),
  }
}

function equipmentSearchReducer(
  state: EquipmentSearchState,
  action: EquipmentSearchAction
): EquipmentSearchState {
  switch (action.type) {
    case "draft":
      return { ...state, draftQuery: action.query }
    case "select-region":
      return { ...state, selectedRegion: action.region }
    case "submit":
      return {
        draftQuery: action.query,
        selectedRegion: action.selectedRegion,
        submittedQuery: action.query,
      }
    case "sync-url":
      if (
        state.submittedQuery === action.state.submittedQuery &&
        state.selectedRegion?.id === action.state.selectedRegion?.id &&
        state.selectedRegion?.name === action.state.selectedRegion?.name
      ) {
        return state
      }

      return action.state
  }
}

function getDefaultSelectedRegion(
  startsAtFacility: boolean,
  normalizedUserRegionId: number | null
): SelectedRegion | null {
  return startsAtFacility && normalizedUserRegionId !== null
    ? { id: normalizedUserRegionId, name: "Cơ sở trong vùng phụ trách" }
    : null
}

/** Renders the Reports-owned aggregate equipment search workspace. */
export function EquipmentSearchReportTab({
  initialQuery,
  onQueryCommit,
  userRegionId,
  userRole,
}: EquipmentSearchReportTabProps) {
  const normalizedUserRegionId = normalizeEquipmentSearchRegionId(userRegionId)
  const startsAtFacility = isRegionalLeaderRole(userRole) && normalizedUserRegionId !== null

  if (!canUseEquipmentAggregateSearch(userRole)) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Bạn không có quyền sử dụng tìm kiếm tổng hợp thiết bị.
        </CardContent>
      </Card>
    )
  }

  return (
    <EquipmentSearchReportTabContent
      initialQuery={initialQuery}
      normalizedUserRegionId={normalizedUserRegionId}
      onQueryCommit={onQueryCommit}
      startsAtFacility={startsAtFacility}
      userRole={userRole}
    />
  )
}

interface EquipmentSearchReportTabContentProps {
  initialQuery: string
  normalizedUserRegionId: number | null
  onQueryCommit: (query: string) => void
  startsAtFacility: boolean
  userRole: string | null | undefined
}

function EquipmentSearchReportTabContent({
  initialQuery,
  normalizedUserRegionId,
  onQueryCommit,
  startsAtFacility,
  userRole,
}: EquipmentSearchReportTabContentProps) {
  const defaultSelectedRegion = React.useMemo(
    () => getDefaultSelectedRegion(startsAtFacility, normalizedUserRegionId),
    [normalizedUserRegionId, startsAtFacility]
  )
  const [state, dispatch] = React.useReducer(
    equipmentSearchReducer,
    { initialQuery, selectedRegion: defaultSelectedRegion },
    ({ initialQuery: query, selectedRegion }) => createEquipmentSearchState(query, selectedRegion)
  )

  React.useEffect(() => {
    dispatch({
      type: "sync-url",
      state: createEquipmentSearchState(initialQuery, defaultSelectedRegion),
    })
  }, [defaultSelectedRegion, initialQuery])

  const { draftQuery, selectedRegion, submittedQuery } = state

  const groupBy = selectedRegion ? "facility" : "region"
  const searchQuery = useEquipmentAggregateSearch({
    query: submittedQuery,
    groupBy,
    regionId: selectedRegion?.id ?? null,
    role: userRole,
    limit: 50,
  })

  const rows = React.useMemo(
    () => sortEquipmentSearchRows(searchQuery.data?.rows ?? []),
    [searchQuery.data?.rows]
  )
  const maxCount = getEquipmentSearchMaxCount(rows)
  const summary = searchQuery.data?.summary
  const trimmedDraft = draftQuery.trim()
  const isInitialEmpty = submittedQuery.length === 0
  const isWaitingForCurrentResult =
    searchQuery.isLoading ||
    searchQuery.isPlaceholderData === true ||
    (searchQuery.isFetching && rows.length === 0)

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      dispatch({
        type: "submit",
        query: trimmedDraft,
        selectedRegion: defaultSelectedRegion,
      })
      onQueryCommit(trimmedDraft)
    },
    [defaultSelectedRegion, onQueryCommit, trimmedDraft]
  )

  return (
    <div data-testid="equipment-search-report-tab" className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Tìm kiếm thiết bị</CardTitle>
            <Badge variant="outline">
              {selectedRegion?.name ?? summary?.scopeLabel ?? "Toàn hệ thống"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form
            role="search"
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={handleSubmit}
          >
            <label htmlFor="reports-equipment-search-query" className="space-y-1.5">
              <span className="text-sm font-medium">Từ khóa thiết bị</span>
              <SearchInput
                id="reports-equipment-search-query"
                aria-label="Từ khóa thiết bị"
                value={draftQuery}
                onChange={(query) => dispatch({ type: "draft", query })}
                placeholder="Tên thiết bị, model, serial hoặc nhóm thiết bị"
              />
            </label>
            <Button type="submit" className="self-end">
              <Search aria-hidden="true" />
              Tìm kiếm
            </Button>
          </form>
        </CardContent>
      </Card>

      {isInitialEmpty ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Nhập từ khóa để xem thiết bị phù hợp theo khu vực hoặc cơ sở.
          </CardContent>
        </Card>
      ) : null}

      {searchQuery.isError ? (
        <Card className="border-destructive/40">
          <CardContent className="py-6 text-sm text-destructive">
            {normalizeEquipmentAggregateSearchError(searchQuery.error)}
          </CardContent>
        </Card>
      ) : null}

      {!isInitialEmpty && !searchQuery.isError && isWaitingForCurrentResult ? (
        <EquipmentSearchSkeleton />
      ) : null}

      {!isInitialEmpty && !searchQuery.isError && !isWaitingForCurrentResult && rows.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="py-4">
                <div className="text-2xl font-semibold tabular-nums">
                  {formatEquipmentSearchCount(summary?.totalEquipmentCount ?? 0)} phù hợp
                </div>
                <p className="text-sm text-muted-foreground">với từ khóa</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-2xl font-semibold tabular-nums">
                  {(summary?.regionCount ?? 0).toLocaleString("vi-VN")}
                </div>
                <p className="text-sm text-muted-foreground">khu vực có kết quả</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-2xl font-semibold tabular-nums">
                  {(summary?.facilityCount ?? 0).toLocaleString("vi-VN")}
                </div>
                <p className="text-sm text-muted-foreground">cơ sở có kết quả</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              className="font-medium text-foreground hover:underline disabled:pointer-events-none disabled:text-muted-foreground"
              disabled={!selectedRegion || startsAtFacility}
              onClick={() => dispatch({ type: "select-region", region: null })}
            >
              Tất cả khu vực
            </button>
            {selectedRegion ? (
              <>
                <ChevronRight className="size-4" aria-hidden="true" />
                <span>{selectedRegion.name}</span>
              </>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Phân bố theo số thiết bị</CardTitle>
              </CardHeader>
              <CardContent>
                <ul
                  data-testid="equipment-search-chart"
                  aria-label="Biểu đồ kết quả tìm kiếm thiết bị"
                  className="space-y-3"
                >
                  {rows.map((row) => {
                    const width = `${Math.max(8, (row.equipmentCount / maxCount) * 100)}%`
                    return (
                      <li
                        key={`${row.groupType}-${row.groupId ?? row.groupName}`}
                        className="space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-medium">{row.groupName}</span>
                          <span className="font-semibold tabular-nums">{row.equipmentCount}</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded bg-muted">
                          <div className="h-full rounded bg-primary" style={{ width }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bảng kết quả tìm kiếm</CardTitle>
              </CardHeader>
              <CardContent>
                <Table aria-label="Bảng kết quả tìm kiếm thiết bị">
                  <TableHeader>
                    {groupBy === "facility" ? (
                      <TableRow>
                        <TableHead>Cơ sở</TableHead>
                        <TableHead className="text-right">Số lượng hiện có</TableHead>
                        <TableHead>Định mức</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Ghi chú</TableHead>
                      </TableRow>
                    ) : (
                      <TableRow>
                        <TableHead>Nhóm</TableHead>
                        <TableHead className="text-right">Số thiết bị</TableHead>
                        <TableHead>Ngữ cảnh</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </TableRow>
                    )}
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const facilityText = getEquipmentSearchFacilityText(row)
                      const canDrillDown = row.groupType === "region" && row.groupId !== null
                      const quotaContext =
                        row.groupType === "facility" ? getEquipmentSearchQuotaContext(row) : null

                      if (quotaContext) {
                        return (
                          <TableRow
                            key={`${row.groupType}-${row.groupId ?? row.groupName}`}
                            aria-label={`${row.groupName} ${formatEquipmentSearchCount(row.equipmentCount)} ${quotaContext.quotaDisplay} ${quotaContext.statusLabel} ${quotaContext.notesText}`}
                          >
                            <TableCell className="font-medium">{row.groupName}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {formatEquipmentSearchCount(row.equipmentCount)}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {quotaContext.quotaDisplay}
                            </TableCell>
                            <TableCell>{quotaContext.statusLabel}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {quotaContext.notesText}
                            </TableCell>
                          </TableRow>
                        )
                      }

                      return (
                        <TableRow
                          key={`${row.groupType}-${row.groupId ?? row.groupName}`}
                          aria-label={`${row.groupName} ${formatEquipmentSearchCount(row.equipmentCount)} ${facilityText}`}
                        >
                          <TableCell className="font-medium">{row.groupName}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatEquipmentSearchCount(row.equipmentCount)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{facilityText}</TableCell>
                          <TableCell className="text-right">
                            {canDrillDown ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  dispatch({
                                    type: "select-region",
                                    region: { id: row.groupId!, name: row.groupName },
                                  })
                                }
                              >
                                Xem cơ sở {row.groupName}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Tổng hợp</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {!isInitialEmpty &&
      !searchQuery.isError &&
      !isWaitingForCurrentResult &&
      rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Không tìm thấy thiết bị phù hợp trong phạm vi hiện tại.
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
