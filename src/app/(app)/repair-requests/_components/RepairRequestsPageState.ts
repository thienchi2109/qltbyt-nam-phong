import type {
  ColumnFiltersState,
  SortingState,
  Updater,
  VisibilityState,
} from "@tanstack/react-table"
import type {
  ColumnVisibility as ColumnVisibilityPrefs,
  UiFilters as UiFiltersPrefs,
} from "@/lib/rr-prefs"

const INITIAL_SORTING: SortingState = [{ id: "ngay_yeu_cau", desc: true }]

export interface RepairRequestsPageState {
  readonly sorting: SortingState
  readonly columnFilters: ColumnFiltersState
  readonly searchTerm: string
  readonly uiFilters: UiFiltersPrefs
  readonly isFilterModalOpen: boolean
  readonly columnVisibility: ColumnVisibilityPrefs
}

export type RepairRequestsPageAction =
  | { type: "set-sorting"; updater: Updater<SortingState> }
  | { type: "set-column-filters"; updater: Updater<ColumnFiltersState> }
  | { type: "set-search-term"; value: string }
  | { type: "set-ui-filters"; value: UiFiltersPrefs }
  | { type: "set-filter-modal-open"; value: boolean }
  | { type: "set-column-visibility"; updater: Updater<VisibilityState> }

/** Resolves a TanStack updater against the current page state value. */
export function resolveRepairRequestsPageUpdater<T>(
  updater: Updater<T>,
  current: T,
): T {
  if (typeof updater !== "function") {
    return updater
  }

  return (updater as (old: T) => T)(current)
}

/** Creates the initial repair-requests page UI/table state from persisted preferences. */
export function createRepairRequestsPageState({
  uiFilters,
  columnVisibility,
}: {
  readonly uiFilters: UiFiltersPrefs
  readonly columnVisibility: ColumnVisibilityPrefs | null
}): RepairRequestsPageState {
  return {
    sorting: [...INITIAL_SORTING],
    columnFilters: [],
    searchTerm: "",
    uiFilters,
    isFilterModalOpen: false,
    columnVisibility: columnVisibility ?? {},
  }
}

/** Applies repair-requests page UI/table state updates. */
export function repairRequestsPageStateReducer(
  state: RepairRequestsPageState,
  action: RepairRequestsPageAction,
): RepairRequestsPageState {
  switch (action.type) {
    case "set-sorting":
      return {
        ...state,
        sorting: resolveRepairRequestsPageUpdater(action.updater, state.sorting),
      }
    case "set-column-filters":
      return {
        ...state,
        columnFilters: resolveRepairRequestsPageUpdater(
          action.updater,
          state.columnFilters,
        ),
      }
    case "set-search-term":
      return { ...state, searchTerm: action.value }
    case "set-ui-filters":
      return { ...state, uiFilters: action.value }
    case "set-filter-modal-open":
      return { ...state, isFilterModalOpen: action.value }
    case "set-column-visibility":
      return {
        ...state,
        columnVisibility: resolveRepairRequestsPageUpdater(
          action.updater,
          state.columnVisibility,
        ),
      }
  }
}
