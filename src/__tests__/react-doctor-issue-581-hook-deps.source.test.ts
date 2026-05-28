import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const currentDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(currentDir, "../..")

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
        /React\.useEffect\(\(\) => \{\s*return \(\) => \{[\s\S]*?scanIntervalRef\.current[\s\S]*?streamRef\.current[\s\S]*?\}\s*\}, \[\]\)/,
      ],
      [
        "src/components/qr-scanner-camera.tsx",
        /const \[selectedCameraId, setSelectedCameraId\] = React\.useState/,
      ],
      [
        "src/components/qr-scanner-camera.tsx",
        /const initializeCamera = React\.useCallback\(async \(\) =>/,
      ],
      [
        "src/contexts/realtime-context.tsx",
        /new: newRecord, old: oldRecord/,
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

  it("keeps review follow-up guards for deterministic tests and reconnect stability", () => {
    const sourceGuard = readSource("src/__tests__/react-doctor-issue-581-hook-deps.source.test.ts")
    const qrCamera = readSource("src/components/qr-scanner-camera.tsx")
    const realtimeContext = readSource("src/contexts/realtime-context.tsx")

    expect(sourceGuard).not.toMatch(/const repoRoot = process\.cwd\(\)/)
    expect(qrCamera).toContain("cameraSessionRef")
    expect(qrCamera).toContain("selectedCameraIdRef.current = deviceId")
    expect(qrCamera).toContain("const stopIfStale = (lateStream: MediaStream)")
    expect(qrCamera).toContain("if (stopIfStale(stream)) return")
    expect(qrCamera).toMatch(/catch \(constraintError\) \{\s*if \(!isCurrentSession\(\)\) return/)
    expect(realtimeContext).toContain("clearReconnectTimeout")
    expect(realtimeContext).toContain("if (reconnectTimeoutRef.current) {")
  })
})
