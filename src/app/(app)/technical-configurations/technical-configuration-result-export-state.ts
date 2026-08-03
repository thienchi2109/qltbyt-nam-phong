import type {
  TechnicalConfigurationResultExportMode,
  TechnicalConfigurationResultExportRequest,
} from "./technical-configuration-result-export-types"

/** UI-owned export request before P14C2 adds orchestration concerns such as AbortSignal. */
export type TechnicalConfigurationResultExportDialogRequest = Omit<
  TechnicalConfigurationResultExportRequest,
  "signal"
>

/** Option scopes exposed by the result-export dialog. */
export type TechnicalConfigurationResultExportOptionScope = "all" | "current_page" | "selected"

/** Criterion scopes exposed by the result-export dialog. */
export type TechnicalConfigurationResultExportCriterionScope = "all" | "current_page"

type TechnicalConfigurationResultExportOptionContext = Readonly<{
  total: number
  page?: Readonly<{
    currentIds: readonly string[]
    selectedIds: readonly string[]
  }>
}>

type TechnicalConfigurationResultExportCriterionContext = Readonly<{
  total: number
  page?: Readonly<{
    currentIds: readonly string[]
  }>
}>

/** Immutable source identity and explicit paginated alternatives available to the dialog. */
export type TechnicalConfigurationResultExportContext = Readonly<{
  dossierId: string
  baselineVersionId: string
  options: TechnicalConfigurationResultExportOptionContext
  criteria: TechnicalConfigurationResultExportCriterionContext
}>

/** Pure P14C1 dialog state. */
export type TechnicalConfigurationResultExportState = Readonly<{
  open: boolean
  context: TechnicalConfigurationResultExportContext
  mode: TechnicalConfigurationResultExportMode
  optionScope: TechnicalConfigurationResultExportOptionScope
  criterionScope: TechnicalConfigurationResultExportCriterionScope
}>

/** Validation failures that prevent a result-export request from being emitted. */
export type TechnicalConfigurationResultExportValidationError =
  | "missing_identity"
  | "invalid_totals"
  | "unavailable_option_scope"
  | "empty_current_option_page"
  | "empty_selected_options"
  | "unavailable_criterion_scope"
  | "empty_current_criterion_page"

/** Events accepted by the pure P14C1 state machine. */
export type TechnicalConfigurationResultExportEvent =
  | Readonly<{ type: "open" }>
  | Readonly<{ type: "reset" }>
  | Readonly<{ type: "cancel" }>
  | Readonly<{ type: "confirm" }>
  | Readonly<{
      type: "mode_changed"
      mode: TechnicalConfigurationResultExportMode
    }>
  | Readonly<{
      type: "option_scope_changed"
      scope: TechnicalConfigurationResultExportOptionScope
    }>
  | Readonly<{
      type: "criterion_scope_changed"
      scope: TechnicalConfigurationResultExportCriterionScope
    }>
  | Readonly<{
      type: "context_changed"
      context: TechnicalConfigurationResultExportContext
    }>

/** Pure transition result with an optional validated request effect. */
export type TechnicalConfigurationResultExportTransition = Readonly<{
  state: TechnicalConfigurationResultExportState
  request: TechnicalConfigurationResultExportDialogRequest | null
}>

/** Counts rendered in the dialog summary for the current state. */
export type TechnicalConfigurationResultExportSelectionSummary = Readonly<{
  optionCount: number
  criterionCount: number
  visibleSheetCount: number
}>

function defaultState(
  context: TechnicalConfigurationResultExportContext,
  open: boolean
): TechnicalConfigurationResultExportState {
  return {
    open,
    context,
    mode: "full",
    optionScope: "all",
    criterionScope: "all",
  }
}

function sameIdentity(
  current: TechnicalConfigurationResultExportContext,
  next: TechnicalConfigurationResultExportContext
): boolean {
  return (
    current.dossierId === next.dossierId && current.baselineVersionId === next.baselineVersionId
  )
}

function normalizedIds(ids: readonly string[]): readonly string[] {
  const result: string[] = []
  const seen = new Set<string>()

  for (const id of ids) {
    const normalized = id.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

function selectedOptionIds(
  state: TechnicalConfigurationResultExportState
): readonly string[] | null {
  if (state.optionScope === "all") return null
  const page = state.context.options.page
  if (!page) return []
  return normalizedIds(state.optionScope === "current_page" ? page.currentIds : page.selectedIds)
}

function selectedCriterionIds(
  state: TechnicalConfigurationResultExportState
): readonly string[] | null {
  if (state.criterionScope === "all") return null
  return normalizedIds(state.context.criteria.page?.currentIds ?? [])
}

/** Creates a closed dialog state with the complete universe selected. */
export function createTechnicalConfigurationResultExportState(
  context: TechnicalConfigurationResultExportContext
): TechnicalConfigurationResultExportState {
  return defaultState(context, false)
}

/** Returns the first validation failure for the current state, or null when confirm is valid. */
export function getTechnicalConfigurationResultExportValidationError(
  state: TechnicalConfigurationResultExportState
): TechnicalConfigurationResultExportValidationError | null {
  if (!state.context.dossierId.trim() || !state.context.baselineVersionId.trim()) {
    return "missing_identity"
  }
  if (
    !Number.isSafeInteger(state.context.options.total) ||
    state.context.options.total < 0 ||
    !Number.isSafeInteger(state.context.criteria.total) ||
    state.context.criteria.total < 0
  ) {
    return "invalid_totals"
  }

  if (state.optionScope !== "all" && !state.context.options.page) {
    return "unavailable_option_scope"
  }
  if (state.optionScope === "current_page" && selectedOptionIds(state)?.length === 0) {
    return "empty_current_option_page"
  }
  if (state.optionScope === "selected" && selectedOptionIds(state)?.length === 0) {
    return "empty_selected_options"
  }

  if (state.criterionScope === "current_page" && !state.context.criteria.page) {
    return "unavailable_criterion_scope"
  }
  if (state.criterionScope === "current_page" && selectedCriterionIds(state)?.length === 0) {
    return "empty_current_criterion_page"
  }

  return null
}

/** Returns the selected row counts and visible sheet count for dialog presentation. */
export function getTechnicalConfigurationResultExportSelectionSummary(
  state: TechnicalConfigurationResultExportState
): TechnicalConfigurationResultExportSelectionSummary {
  return {
    optionCount:
      state.optionScope === "all"
        ? state.context.options.total
        : (selectedOptionIds(state)?.length ?? 0),
    criterionCount:
      state.criterionScope === "all"
        ? state.context.criteria.total
        : (selectedCriterionIds(state)?.length ?? 0),
    visibleSheetCount: state.mode === "full" ? 3 : 2,
  }
}

/** Applies one deterministic state transition and emits a request only on valid confirm. */
export function transitionTechnicalConfigurationResultExport(
  state: TechnicalConfigurationResultExportState,
  event: TechnicalConfigurationResultExportEvent
): TechnicalConfigurationResultExportTransition {
  if (event.type === "open") {
    return { state: defaultState(state.context, true), request: null }
  }
  if (event.type === "reset") {
    return { state: defaultState(state.context, state.open), request: null }
  }
  if (event.type === "cancel") {
    return { state: defaultState(state.context, false), request: null }
  }
  if (event.type === "mode_changed") {
    return { state: { ...state, mode: event.mode }, request: null }
  }
  if (event.type === "option_scope_changed") {
    return { state: { ...state, optionScope: event.scope }, request: null }
  }
  if (event.type === "criterion_scope_changed") {
    return { state: { ...state, criterionScope: event.scope }, request: null }
  }
  if (event.type === "context_changed") {
    return {
      state: sameIdentity(state.context, event.context)
        ? { ...state, context: event.context }
        : defaultState(event.context, state.open),
      request: null,
    }
  }

  if (!state.open) {
    return { state, request: null }
  }

  if (getTechnicalConfigurationResultExportValidationError(state)) {
    return { state, request: null }
  }

  return {
    state: defaultState(state.context, false),
    request: {
      mode: state.mode,
      dossierId: state.context.dossierId,
      baselineVersionId: state.context.baselineVersionId,
      optionIds: selectedOptionIds(state),
      criterionIds: selectedCriterionIds(state),
    },
  }
}
