import { readFileSync } from "node:fs"
import { join } from "node:path"

const repoRoot = process.cwd()

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8")
}

describe("React Doctor Issue #581 hook dependency source guards", () => {
  it("keeps scoped exhaustive-deps fixes in place", () => {
    const targetPatterns: ReadonlyArray<readonly [string, RegExp]> = [
      [
        "src/app/(app)/maintenance/_components/maintenance-columns.tsx",
        /}, \[editingTaskId, isPlanApproved, isCompletingTask, completionStatus, isLoadingCompletion\]\)/,
      ],
      [
        "src/app/(app)/repair-requests/_components/RepairRequestsToolbar.tsx",
        /const dateRange = uiFilters\.dateRange && \(uiFilters\.dateRange\.from \|\| uiFilters\.dateRange\.to\)/,
      ],
      [
        "src/app/(app)/reports/components/maintenance-report-tab.tsx",
        /const repairFrequency = charts\?\.repairFrequency ?? \[\]/,
      ],
      [
        "src/components/add-tasks-dialog.tsx",
        /const departments = React\.useMemo\(\(\) => getUniqueTrimmedValues/,
      ],
      [
        "src/components/tenants-management.tsx",
        /const collator = new Intl\.Collator/,
      ],
      [
        "src/components/qr-scanner-camera.tsx",
        /React\.useEffect\(\(\) => \{\s*return \(\) => \{/,
      ],
      [
        "src/components/qr-scanner-camera.tsx",
        /const \[selectedCameraId, setSelectedCameraId\] = React\.useState/,
      ],
      [
        "src/components/ui/calendar-widget.tsx",
        /const events = data\?\.events ?? \[\]/,
      ],
      [
        "src/components/interactive-equipment-chart.tsx",
        /}, \[chartData\]\)/,
      ],
      [
        "src/contexts/realtime-context.tsx",
        /setupRealtimeSubscription\(\)[\s\S]*?return cleanup\s*\n\s*}, \[\]\)/,
      ],
    ]

    for (const [relativePath, stalePattern] of targetPatterns) {
      expect(readSource(relativePath), relativePath).not.toMatch(stalePattern)
    }
  })
})
