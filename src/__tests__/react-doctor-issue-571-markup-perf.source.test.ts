import { readFileSync } from "node:fs"
import { join } from "node:path"

const repoRoot = process.cwd()

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8")
}

describe("React Doctor Issue #571 semantic markup and perf source guards", () => {
  it.each([
    [
      "src/app/(app)/device-quota/categories/_components/CategoryGroup.tsx",
      /<div[\s\S]*?role="button"/,
    ],
    [
      "src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx",
      /role="(?:list|listitem)"/,
    ],
    [
      "src/app/(app)/device-quota/decisions/_components/__tests__/DeviceQuotaImportDialog.test.tsx",
      /role="status"/,
    ],
    ["src/components/__tests__/import-equipment-dialog.test.tsx", /role="status"/],
    ["src/components/bulk-import/BulkImportDialogParts.tsx", /role="status"/],
    [
      "src/components/equipment-linked-request/__tests__/LinkedRequestRowIndicator.test.tsx",
      /<div[\s\S]*?role="button"/,
    ],
    ["src/components/mobile-equipment-list-item.tsx", /role="group"/],
    ["src/components/transfers/TransfersSearchParamsBoundary.tsx", /role="status"/],
    [
      "src/components/shared/DataTablePagination/DataTablePaginationNavigation.tsx",
      /role="status"/,
    ],
    ["src/components/shared/mobile-bottom-sheet.tsx", /role="dialog"/],
    [
      "src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx",
      /role="dialog"/,
    ],
    ["src/components/transfers/TransferCard.tsx", /<div[\s\S]*?role="button"/],
    ["src/components/transfers/TransfersKanbanCard.tsx", /<div[\s\S]*?role="button"/],
  ])("uses native semantic elements instead of fallback roles in %s", (relativePath, forbidden) => {
    expect(readSource(relativePath)).not.toMatch(forbidden)
  })

  it.each([
    "src/app/(app)/device-quota/decisions/[id]/_components/DeviceQuotaChiTietToolbar.tsx",
    "src/app/(app)/device-quota/decisions/_components/DeviceQuotaDecisionsTable.tsx",
    "src/components/equipment/equipment-actions-menu.tsx",
    "src/components/mobile-equipment-list-item.tsx",
  ])("destructures router methods for React Compiler in %s", (relativePath) => {
    const source = readSource(relativePath)

    expect(source).not.toMatch(/const\s+router\s*=\s*useRouter\(\)/)
    expect(source).not.toMatch(/\brouter\.push\(/)
    expect(source).toMatch(/const\s+\{\s*push\s*\}\s*=\s*useRouter\(\)/)
  })

  it("does not initialize repair request date state from a mount-only effect", () => {
    const source = readSource(
      "src/app/(app)/repair-requests/_components/RepairRequestsCreateSheetForm.tsx",
    )

    expect(source).not.toContain("setMinimumSelectableDate")
    expect(source).toContain("React.useState<Date>(() => getTodayStart())")
  })

  it("schedules inventory report date refreshes without a mount-only initial set", () => {
    const source = readSource(
      "src/app/(app)/reports/components/inventory-report-filter-section.tsx",
    )

    expect(source).not.toMatch(/React\.useEffect\([\s\S]*setMaxReportDate\(now\)[\s\S]*\}, \[\]\)/)
    expect(source).toContain("React.useSyncExternalStore")
    expect(source).toMatch(/maxReportDateSnapshot\s*=\s*new Date\(\)[\s\S]*onStoreChange\(\)[\s\S]*scheduleNextReportDateRefresh\(\)/)
  })

  it("uses an external-store snapshot for mobile breakpoint state", () => {
    const source = readSource("src/hooks/use-mobile.tsx")

    expect(source).toContain("React.useSyncExternalStore")
    expect(source).not.toContain("React.useEffect")
    expect(source).not.toContain("setIsMobile")
    expect(source).toContain("mql.addListener")
    expect(source).toContain("mql.removeListener")
  })

  it("loads the language preference without mount-only state initialization", () => {
    const source = readSource("src/contexts/language-context.tsx")

    expect(source).not.toContain("setCurrentLanguage(parsed)")
    expect(source).toContain("React.useSyncExternalStore")
    expect(source).toContain("cachedLanguageStorageValue")
    expect(source).toContain("cachedLanguageSnapshot")
  })

  it("opens the mobile bottom sheet as a modal dialog", () => {
    const source = readSource("src/components/shared/mobile-bottom-sheet.tsx")

    expect(source).toContain(".showModal()")
    expect(source).not.toMatch(/<dialog[\s\S]{0,120}\sopen\b/)
  })

  it("keeps category select buttons free of block component children", () => {
    const source = readSource("src/app/(app)/device-quota/categories/_components/CategoryGroup.tsx")
    const buttonBlocks = source.match(/<button[\s\S]*?<\/button>/g) ?? []

    expect(buttonBlocks.some((block) => block.includes("<Badge"))).toBe(false)
    expect(buttonBlocks.some((block) => block.includes("<QuotaProgressBar"))).toBe(false)
  })

  it("memoizes constructed context provider values", () => {
    const formSource = readSource("src/components/ui/form.tsx")
    const tooltipSource = readSource("src/test-utils/tooltip-mock.tsx")

    expect(formSource).toContain("const fieldContextValue = React.useMemo")
    expect(formSource).toContain("const itemContextValue = React.useMemo")
    expect(tooltipSource).toContain("const tooltipContextValue = React.useMemo")
  })

  it.each([
    "src/app/(app)/equipment/_components/EquipmentColumnsDialog.tsx",
    "src/app/(app)/reports/components/inventory-charts.tsx",
    "src/components/transfer-dialog.form-sections.tsx",
  ])("avoids filter-map iteration chains in %s", (relativePath) => {
    expect(readSource(relativePath)).not.toMatch(/\.filter\([\s\S]*?\)\s*\.map\(/)
  })
})
