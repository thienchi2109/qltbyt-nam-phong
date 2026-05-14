import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const unusedExportSurface = [
  {
    file: "src/app/(app)/device-quota/categories/_components/category-tree-utils.ts",
    exports: ["CATEGORY_ENTITY"],
  },
  {
    file: "src/app/(app)/maintenance/_components/maintenance-task-row-id.ts",
    exports: ["MAINTENANCE_TASK_ROW_ID_PREFIX"],
  },
  {
    file: "src/app/(app)/maintenance/_components/MaintenanceContext.tsx",
    exports: ["getNextMaintenanceTempTaskId"],
  },
  {
    file: "src/app/(app)/maintenance/_hooks/maintenance-print-template.ts",
    exports: ["formatValue"],
  },
  {
    file: "src/app/(app)/repair-requests/_components/RepairRequestsApproveDialog.tsx",
    exports: ["ApproveRequestDialog"],
  },
  {
    file: "src/app/(app)/repair-requests/_components/RepairRequestsCreateSheet.tsx",
    exports: ["CreateRequestSheet"],
  },
  {
    file: "src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLinkView.ts",
    exports: ["buildRepairRequestViewCleanupPath","parseRepairRequestIdParam","resolveRepairRequestView"],
  },
  {
    file: "src/app/(app)/reports/hooks/use-inventory-data.ts",
    exports: ["reportsKeys"],
  },
  {
    file: "src/app/(app)/reports/hooks/use-maintenance-data.ts",
    exports: ["defaultMaintenanceReportData","maintenanceReportKeys"],
  },
  {
    file: "src/app/(app)/reports/hooks/use-unused-equipment-report.ts",
    exports: ["unusedEquipmentReportKeys"],
  },
  {
    file: "src/app/(app)/users/_components/usersColumns.tsx",
    exports: ["getRoleVariant"],
  },
  {
    file: "src/app/api/transfers/legacy-adapter.ts",
    exports: ["applyLegacyFilters","buildCountsFromItems","isMissingFunctionError","paginate","transformLegacyItem"],
  },
  {
    file: "src/components/dashboard/kpi-cards.tsx",
    exports: ["MaintenanceCountCard","MaintenancePlansCard","RepairRequestsCard","TotalEquipmentCard"],
  },
  {
    file: "src/components/dynamic-chart.tsx",
    exports: ["DynamicChart"],
  },
  {
    file: "src/components/equipment-decommission-form.ts",
    exports: ["DECOMMISSIONED_STATUS","getTodayDateForDecommissionField"],
  },
  {
    file: "src/components/equipment-linked-request/index.ts",
    exports: ["LinkedRequestSheetShell"],
  },
  {
    file: "src/components/equipment/equipment-table-columns.tsx",
    exports: ["filterableColumns"],
  },
  {
    file: "src/components/error-boundary.tsx",
    exports: ["withErrorBoundary"],
  },
  {
    file: "src/components/onboarding/tour-configs.ts",
    exports: ["dashboardWelcomeTour","sidebarNavigationTour"],
  },
  {
    file: "src/components/realtime-status.tsx",
    exports: ["useRealtimeStatus"],
  },
  {
    file: "src/components/transfer-dialog.data.ts",
    exports: ["transferDialogQueryKeys"],
  },
  {
    file: "src/components/transfer-dialog.shared.ts",
    exports: ["createTransferDialogFormDataFromTransfer","getSelectedEquipmentFromTransfer"],
  },
  {
    file: "src/components/transfers/columnDefinitions.tsx",
    exports: ["buildTransferColumns"],
  },
  {
    file: "src/components/ui/alert-dialog.tsx",
    exports: ["AlertDialogOverlay","AlertDialogPortal"],
  },
  {
    file: "src/components/ui/avatar.tsx",
    exports: ["AvatarImage"],
  },
  {
    file: "src/components/ui/badge.tsx",
    exports: ["badgeVariants"],
  },
  {
    file: "src/components/ui/calendar-widget/CalendarWidgetShared.tsx",
    exports: ["getEventTypeColor","getEventTypeIcon"],
  },
  {
    file: "src/components/ui/dialog.tsx",
    exports: ["DialogClose","DialogOverlay","DialogPortal"],
  },
  {
    file: "src/components/ui/dropdown-menu.tsx",
    exports: ["DropdownMenuGroup","DropdownMenuPortal","DropdownMenuRadioGroup","DropdownMenuRadioItem","DropdownMenuShortcut","DropdownMenuSub","DropdownMenuSubContent","DropdownMenuSubTrigger"],
  },
  {
    file: "src/components/ui/form.tsx",
    exports: ["useFormField"],
  },
  {
    file: "src/components/ui/scroll-area.tsx",
    exports: ["ScrollBar"],
  },
  {
    file: "src/components/ui/select.tsx",
    exports: ["SelectGroup","SelectLabel","SelectScrollDownButton","SelectScrollUpButton","SelectSeparator"],
  },
  {
    file: "src/components/ui/sheet.tsx",
    exports: ["SheetClose","SheetFooter","SheetOverlay","SheetPortal"],
  },
  {
    file: "src/components/ui/table.tsx",
    exports: ["TableCaption","TableFooter"],
  },
  {
    file: "src/components/ui/toast.tsx",
    exports: ["ToastAction"],
  },
  {
    file: "src/hooks/use-cached-equipment.ts",
    exports: ["useCreateEquipment","useEquipmentDetail"],
  },
  {
    file: "src/hooks/use-cached-maintenance.ts",
    exports: ["useUpdateMaintenancePlan"],
  },
  {
    file: "src/hooks/use-dashboard-stats.ts",
    exports: ["useDashboardKpiSummary"],
  },
  {
    file: "src/hooks/use-equipment-distribution.ts",
    exports: ["equipmentDistributionKeys"],
  },
  {
    file: "src/hooks/use-page-transitions.ts",
    exports: ["useManualTransition"],
  },
  {
    file: "src/hooks/use-toast.ts",
    exports: ["reducer"],
  },
  {
    file: "src/hooks/use-usage-analytics.ts",
    exports: ["usageAnalyticsKeys"],
  },
  {
    file: "src/hooks/use-usage-logs.ts",
    exports: ["usageLogKeys"],
  },
  {
    file: "src/hooks/useTransferDataGrid.ts",
    exports: ["getTransferListData","transferKanbanKeys","useInvalidateTransfersKanban","usePrefetchTransferCounts","usePrefetchTransferList","useTransferCounts","useTransferList"],
  },
  {
    file: "src/hooks/useTransfersKanban.ts",
    exports: ["useInvalidateTransfersKanban"],
  },
  {
    file: "src/lib/advanced-cache-manager.ts",
    exports: ["CachePerformanceMonitor","InvalidationPatterns","createAdvancedCacheManager"],
  },
  {
    file: "src/lib/ai/draft/repair-request-draft-extraction.ts",
    exports: ["repairRequestDraftExtractionSchema"],
  },
  {
    file: "src/lib/ai/draft/repair-request-draft-session.ts",
    exports: ["REPAIR_REQUEST_DRAFT_CANCEL_PHRASES","REPAIR_REQUEST_DRAFT_START_PHRASES","hasRepairRequestDraftCancelIntent"],
  },
  {
    file: "src/lib/ai/errors.ts",
    exports: ["MODEL_PROVIDER_QUOTA_MESSAGE","extractErrorMessage"],
  },
  {
    file: "src/lib/ai/sql/audited-executor.ts",
    exports: ["writeAssistantSqlAudit"],
  },
  {
    file: "src/lib/ai/tools/registry.ts",
    exports: ["hasWriteIntentToolName"],
  },
  {
    file: "src/lib/ai/usage-metering.ts",
    exports: ["__resetUsageMeteringForTests","getLatestUsage"],
  },
  {
    file: "src/lib/category-import-validation.ts",
    exports: ["HEADER_TO_DB_MAP","normalizeVietnamese"],
  },
  {
    file: "src/lib/chart-utils.ts",
    exports: ["CHART_COLORS","DEFAULT_CHART_CONFIG","RESPONSIVE_CONTAINER_PROPS","formatChartNumber","formatChartPercentage","processChartData"],
  },
  {
    file: "src/lib/date-utils.ts",
    exports: ["SUSPICIOUS_YEAR_THRESHOLD","parsePartialDateToISO"],
  },
  {
    file: "src/lib/department-utils.ts",
    exports: ["getUserEffectiveDepartments","normalizeDepartmentName","validateEquipmentAccess"],
  },
  {
    file: "src/lib/excel-utils.ts",
    exports: ["exportArrayToExcel"],
  },
  {
    file: "src/lib/feature-flags.ts",
    exports: ["getFeatureFlag"],
  },
  {
    file: "src/lib/rbac.ts",
    exports: ["DEPT_SCOPED_ROLES","EQUIPMENT_MANAGER_ROLES","GLOBAL_ROLES","PRIVILEGED_ROLES"],
  },
  {
    file: "src/lib/rpc-normalize.ts",
    exports: ["getDateOnly"],
  },
  {
    file: "src/lib/supabase.ts",
    exports: ["supabaseError"],
  },
  {
    file: "src/types/transfers-data-grid.ts",
    exports: ["TransferCountsResponseSchema","TransferEquipmentInfoSchema","TransferKanbanColumnDataSchema","TransferListItemSchema","TransferOverdueSummaryItemSchema","TransferOverdueSummarySchema"],
  },
] as const

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const exportDeclarationPattern = (name: string) =>
  new RegExp(
    `\\bexport\\s+(?:declare\\s+)?(?:async\\s+)?(?:const|let|var|function|class|interface|type|enum)\\s+${escapeRegExp(name)}\\b`,
  )

const namedExportPattern = (name: string) =>
  new RegExp(`\\bexport\\s*\\{[^}]*\\b${escapeRegExp(name)}\\b[^}]*\\}`, "s")

describe("React Doctor P4 knip/exports cleanup", () => {
  it("removes the current unused named export surface", () => {
    for (const entry of unusedExportSurface) {
      const source = readFileSync(join(process.cwd(), entry.file), "utf8")

      for (const exportName of entry.exports) {
        expect(source, `${entry.file} still exports ${exportName}`).not.toMatch(
          exportDeclarationPattern(exportName),
        )
        expect(source, `${entry.file} still re-exports ${exportName}`).not.toMatch(
          namedExportPattern(exportName),
        )
      }
    }
  })
})
