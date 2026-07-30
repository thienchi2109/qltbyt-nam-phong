/** Shared request and view limits for the comparison matrix. */
export const COMPARISON_MATRIX_LIMITS = {
  selectedOptions: 8,
  pinnedOptions: 2,
} as const

/** Keeps criterion paging identical across comparison and evaluation workspaces. */
export const TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE = 50

/** Stable desktop column geometry shared by matrix headers and body rows. */
export const COMPARISON_MATRIX_LAYOUT = {
  criterionWidth: 220,
  baselineWidth: 360,
  optionWidth: 320,
  criterionWidthClass: "w-[220px] min-w-[220px] max-w-[220px]",
  baselineWidthClass: "w-[360px] min-w-[360px] max-w-[360px]",
  optionWidthClass: "w-[320px] min-w-[320px] max-w-[320px]",
  baselineStickyLeftClass: "left-[220px]",
} as const

/** Returns the sticky left offset for a pinned option column. */
export function getPinnedComparisonOptionLeft(pinnedIndex: number): string {
  const fixedColumnWidth =
    COMPARISON_MATRIX_LAYOUT.criterionWidth + COMPARISON_MATRIX_LAYOUT.baselineWidth
  return `${fixedColumnWidth + pinnedIndex * COMPARISON_MATRIX_LAYOUT.optionWidth}px`
}
