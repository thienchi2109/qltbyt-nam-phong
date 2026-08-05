import * as React from "react"
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  GitCompareArrows,
  LibraryBig,
  ListChecks,
  PackageSearch,
} from "lucide-react"

import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { useTechnicalConfigurationGuardedNavigation } from "../_hooks/useTechnicalConfigurationGuardedNavigation"
import { TechnicalConfigurationBaselineTab } from "./TechnicalConfigurationBaselineTab"
import { TechnicalConfigurationBaselineEvidence } from "./TechnicalConfigurationBaselineEvidence"
import { TechnicalConfigurationComparisonTab } from "./comparison/TechnicalConfigurationComparisonTab"
import { TechnicalConfigurationReferenceProducts } from "./TechnicalConfigurationReferenceProducts"
import { TechnicalConfigurationSuppliers } from "./TechnicalConfigurationSuppliers"

type TechnicalConfigurationWorkspaceShellProps = {
  dossier: TechnicalConfigurationDossierWire
  onBack: () => void
}

type WorkspaceRevisionOverride = {
  dossierId: string
  revision: number
}

function shouldIgnoreFocusModeEscape(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('input, textarea, select, [role="dialog"], [role="alertdialog"]')) return true

  const editableHost = target.closest<HTMLElement>("[contenteditable]")
  return Boolean(
    editableHost && (editableHost.isContentEditable || editableHost.contentEditable !== "false")
  )
}

/** Renders the dossier workspace tabs available in the current delivery phase. */
export function TechnicalConfigurationWorkspaceShell({
  dossier,
  onBack,
}: Readonly<TechnicalConfigurationWorkspaceShellProps>) {
  const [activeTab, setActiveTab] = React.useState("baseline")
  const [revisionOverride, setRevisionOverride] = React.useState<WorkspaceRevisionOverride | null>(
    null
  )
  const [isBaselineDirty, setIsBaselineDirty] = React.useState(false)
  const [isBaselineNavigationBlocked, setIsBaselineNavigationBlocked] = React.useState(false)
  const [isEvidenceDirty, setIsEvidenceDirty] = React.useState(false)
  const [isEvidenceNavigationBlocked, setIsEvidenceNavigationBlocked] = React.useState(false)
  const [isReferenceDirty, setIsReferenceDirty] = React.useState(false)
  const [isReferenceNavigationBlocked, setIsReferenceNavigationBlocked] = React.useState(false)
  const [isOptionDirty, setIsOptionDirty] = React.useState(false)
  const [isOptionNavigationBlocked, setIsOptionNavigationBlocked] = React.useState(false)
  const [isComparisonDirty, setIsComparisonDirty] = React.useState(false)
  const [isComparisonNavigationBlocked, setIsComparisonNavigationBlocked] = React.useState(false)
  const [focusedBaselineDossierId, setFocusedBaselineDossierId] = React.useState<string | null>(
    null
  )
  const isBaselineFocusMode = activeTab === "baseline" && focusedBaselineDossierId === dossier.id
  const isDirty =
    isBaselineDirty || isEvidenceDirty || isReferenceDirty || isOptionDirty || isComparisonDirty
  const isNavigationBlocked =
    isBaselineNavigationBlocked ||
    isEvidenceNavigationBlocked ||
    isReferenceNavigationBlocked ||
    isOptionNavigationBlocked ||
    isComparisonNavigationBlocked
  const { requestNavigation, discardConfirmationDialog } =
    useTechnicalConfigurationGuardedNavigation({
      isDirty,
      isBlocked: isNavigationBlocked,
      cancelLabel: "Tiếp tục chỉnh sửa",
      description:
        "Các thay đổi chưa lưu sẽ bị mất nếu bạn tiếp tục. Hãy tiếp tục chỉnh sửa để lưu hoặc xác nhận bỏ thay đổi.",
    })
  const workspaceRevision =
    revisionOverride?.dossierId === dossier.id
      ? Math.max(dossier.revision, revisionOverride.revision)
      : dossier.revision
  const workspaceDossier = React.useMemo(
    () =>
      workspaceRevision === dossier.revision
        ? dossier
        : { ...dossier, revision: workspaceRevision },
    [dossier, workspaceRevision]
  )
  const handleRevisionChange = React.useCallback(
    (revision: number) => {
      setRevisionOverride((current) => ({
        dossierId: dossier.id,
        revision: Math.max(
          dossier.revision,
          current?.dossierId === dossier.id ? current.revision : 0,
          revision
        ),
      }))
    },
    [dossier.id, dossier.revision]
  )

  const handleBack = React.useCallback(() => {
    requestNavigation(onBack)
  }, [onBack, requestNavigation])

  const handleTabChange = React.useCallback(
    (nextTab: string) => {
      if (nextTab === activeTab) return
      requestNavigation(() => {
        setFocusedBaselineDossierId(null)
        setActiveTab(nextTab)
      })
    },
    [activeTab, requestNavigation]
  )

  const handleToggleBaselineFocusMode = React.useCallback(() => {
    setFocusedBaselineDossierId((current) => (current === dossier.id ? null : dossier.id))
  }, [dossier.id])

  React.useEffect(() => {
    if (!isBaselineFocusMode) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        shouldIgnoreFocusModeEscape(event.target)
      ) {
        return
      }
      setFocusedBaselineDossierId(null)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isBaselineFocusMode])

  return (
    <div
      data-testid="technical-configuration-workspace"
      className="flex min-h-0 w-full flex-1 flex-col overflow-hidden"
    >
      <header
        hidden={isBaselineFocusMode}
        aria-hidden={isBaselineFocusMode || undefined}
        className="shrink-0 border-b pb-3"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2"
          disabled={isNavigationBlocked}
          onClick={handleBack}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Danh sách hồ sơ
        </Button>

        <div className="mt-2 flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted">
            <ClipboardList className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold">{dossier.name}</h1>
            <p className="break-words text-sm text-muted-foreground">
              {dossier.device_type_name}
              {dossier.description ? ` · ${dossier.description}` : ""}
            </p>
          </div>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className={cn("flex min-h-0 flex-1 flex-col", isBaselineFocusMode ? "mt-0" : "mt-3")}
      >
        <TabsList
          hidden={isBaselineFocusMode}
          aria-hidden={isBaselineFocusMode || undefined}
          className="grid h-auto w-full shrink-0 grid-cols-1 gap-1 sm:grid-cols-5"
        >
          <TabsTrigger
            value="baseline"
            className="min-h-9 gap-2"
            disabled={isNavigationBlocked && activeTab !== "baseline"}
          >
            <ListChecks className="size-4" aria-hidden="true" />
            Cấu hình cơ sở
          </TabsTrigger>
          <TabsTrigger
            value="evidence"
            className="min-h-9 gap-2"
            disabled={isNavigationBlocked && activeTab !== "evidence"}
          >
            <FileText className="size-4" aria-hidden="true" />
            Tài liệu &amp; trích dẫn
          </TabsTrigger>
          <TabsTrigger
            value="references"
            className="min-h-9 gap-2"
            disabled={isNavigationBlocked && activeTab !== "references"}
          >
            <LibraryBig className="size-4" aria-hidden="true" />
            Sản phẩm tham chiếu
          </TabsTrigger>
          <TabsTrigger
            value="options"
            className="min-h-9 gap-2"
            disabled={isNavigationBlocked && activeTab !== "options"}
          >
            <PackageSearch className="size-4" aria-hidden="true" />
            Phương án
          </TabsTrigger>
          <TabsTrigger
            value="comparison"
            className="min-h-9 gap-2"
            disabled={isNavigationBlocked && activeTab !== "comparison"}
          >
            <GitCompareArrows className="size-4" aria-hidden="true" />
            So sánh &amp; đánh giá
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="baseline"
          className={cn(
            "flex min-h-0 flex-1 overflow-hidden",
            isBaselineFocusMode ? "mt-0" : "mt-3"
          )}
        >
          <TechnicalConfigurationBaselineTab
            dossier={workspaceDossier}
            isFocusMode={isBaselineFocusMode}
            onDirtyChange={setIsBaselineDirty}
            onNavigationBlockedChange={setIsBaselineNavigationBlocked}
            onToggleFocusMode={handleToggleBaselineFocusMode}
          />
        </TabsContent>
        <TabsContent value="evidence" className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <TechnicalConfigurationBaselineEvidence
            dossier={workspaceDossier}
            onDirtyChange={setIsEvidenceDirty}
            onNavigationBlockedChange={setIsEvidenceNavigationBlocked}
          />
        </TabsContent>
        <TabsContent value="references" className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <TechnicalConfigurationReferenceProducts
            dossier={workspaceDossier}
            onDirtyChange={setIsReferenceDirty}
            onNavigationBlockedChange={setIsReferenceNavigationBlocked}
          />
        </TabsContent>
        <TabsContent value="options" className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <TechnicalConfigurationSuppliers
            dossier={workspaceDossier}
            onDirtyChange={setIsOptionDirty}
            onNavigationBlockedChange={setIsOptionNavigationBlocked}
            onRevisionChange={handleRevisionChange}
          />
        </TabsContent>
        <TabsContent value="comparison" className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <TechnicalConfigurationComparisonTab
            dossier={workspaceDossier}
            onDirtyChange={setIsComparisonDirty}
            onNavigationBlockedChange={setIsComparisonNavigationBlocked}
            onRevisionChange={handleRevisionChange}
          />
        </TabsContent>
      </Tabs>

      {discardConfirmationDialog}
    </div>
  )
}
