import type {
  PaginationState,
  SortingState,
  Updater,
  VisibilityState,
} from "@tanstack/react-table"

import type { AddTasksEquipmentFilters } from "@/hooks/useAddTasksEquipment"

export interface AddTasksTableState {
  filters: AddTasksEquipmentFilters
  columnVisibility: VisibilityState
  pagination: PaginationState
  searchTerm: string
  sorting: SortingState
}

export type AddTasksTableAction =
  | { type: "reset-dialog" }
  | { type: "set-column-visibility"; updater: Updater<VisibilityState> }
  | { type: "set-filter"; key: keyof AddTasksEquipmentFilters; values: string[] }
  | { type: "clear-filters" }
  | { type: "set-pagination"; updater: Updater<PaginationState> }
  | { type: "set-search-term"; value: string }
  | { type: "set-sorting"; updater: Updater<SortingState> }

/** Initial table state used when the add-tasks dialog opens or resets. */
export const initialAddTasksTableState: AddTasksTableState = {
  filters: {
    departments: [],
    users: [],
    locations: [],
  },
  columnVisibility: {
    "nguoi_dang_truc_tiep_quan_ly": false,
    "vi_tri_lap_dat": false,
  },
  pagination: { pageIndex: 0, pageSize: 10 },
  searchTerm: "",
  sorting: [],
}

const DEFAULT_ADD_TASKS_SORT = "id.asc"

/** Resolves TanStack updater callbacks against the current state value. */
export function resolveUpdater<T>(updater: Updater<T>, current: T): T {
  if (typeof updater !== "function") {
    return updater
  }

  return (updater as (old: T) => T)(current)
}

/** Applies filter, sorting, pagination, and visibility updates for the add-tasks table. */
export function addTasksTableReducer(
  state: AddTasksTableState,
  action: AddTasksTableAction,
): AddTasksTableState {
  switch (action.type) {
    case "reset-dialog":
      return {
        ...initialAddTasksTableState,
        filters: {
          departments: [],
          users: [],
          locations: [],
        },
        columnVisibility: { ...initialAddTasksTableState.columnVisibility },
        pagination: { ...initialAddTasksTableState.pagination },
        sorting: [...initialAddTasksTableState.sorting],
      }
    case "set-column-visibility":
      return { ...state, columnVisibility: resolveUpdater(action.updater, state.columnVisibility) }
    case "set-filter":
      return {
        ...state,
        filters: { ...state.filters, [action.key]: action.values },
        pagination: { ...state.pagination, pageIndex: 0 },
      }
    case "clear-filters":
      return {
        ...state,
        filters: {
          departments: [],
          users: [],
          locations: [],
        },
        pagination: { ...state.pagination, pageIndex: 0 },
      }
    case "set-pagination":
      return { ...state, pagination: resolveUpdater(action.updater, state.pagination) }
    case "set-search-term":
      return { ...state, searchTerm: action.value, pagination: { ...state.pagination, pageIndex: 0 } }
    case "set-sorting":
      return {
        ...state,
        sorting: resolveUpdater(action.updater, state.sorting),
        pagination: { ...state.pagination, pageIndex: 0 },
      }
  }
}

/** Converts the primary TanStack sorting rule into the RPC sort parameter. */
export function getAddTasksSortParam(sorting: SortingState): string {
  const [primarySort] = sorting
  if (!primarySort) return DEFAULT_ADD_TASKS_SORT
  return `${primarySort.id}.${primarySort.desc ? "desc" : "asc"}`
}
