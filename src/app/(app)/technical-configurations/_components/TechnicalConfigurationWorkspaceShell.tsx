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
      requestNavigation(() => setActiveTab(nextTab))
    },
    [activeTab, requestNavigation]
  )

  return (
    <div
      data-testid="technical-configuration-workspace"
      className="flex min-h-0 w-full flex-1 flex-col"
    >
      <header className="shrink-0 border-b pb-5">
        <Button
          type="button"
          variant="ghost"
          className="-ml-3"
          disabled={isNavigationBlocked}
          onClick={handleBack}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Danh sách hồ sơ
        </Button>

        <div className="mt-4 flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
            <ClipboardList className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold">{dossier.name}</h1>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {dossier.device_type_name}
              {dossier.description ? ` · ${dossier.description}` : ""}
            </p>
          </div>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="mt-6 flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="grid h-auto w-full shrink-0 grid-cols-1 gap-1 sm:grid-cols-5">
          <TabsTrigger
            value="baseline"
            className="min-h-10 gap-2"
            disabled={isNavigationBlocked && activeTab !== "baseline"}
          >
            <ListChecks className="size-4" aria-hidden="true" />
            Cấu hình cơ sở
          </TabsTrigger>
          <TabsTrigger
            value="evidence"
            className="min-h-10 gap-2"
            disabled={isNavigationBlocked && activeTab !== "evidence"}
          >
            <FileText className="size-4" aria-hidden="true" />
            Tài liệu &amp; trích dẫn
          </TabsTrigger>
          <TabsTrigger
            value="references"
            className="min-h-10 gap-2"
            disabled={isNavigationBlocked && activeTab !== "references"}
          >
            <LibraryBig className="size-4" aria-hidden="true" />
            Sản phẩm tham chiếu
          </TabsTrigger>
          <TabsTrigger
            value="options"
            className="min-h-10 gap-2"
            disabled={isNavigationBlocked && activeTab !== "options"}
          >
            <PackageSearch className="size-4" aria-hidden="true" />
            Phương án
          </TabsTrigger>
          <TabsTrigger
            value="comparison"
            className="min-h-10 gap-2"
            disabled={isNavigationBlocked && activeTab !== "comparison"}
          >
            <GitCompareArrows className="size-4" aria-hidden="true" />
            So sánh &amp; đánh giá
          </TabsTrigger>
        </TabsList>

        <TabsContent value="baseline" className="mt-6 flex min-h-0 flex-1 overflow-hidden">
          <TechnicalConfigurationBaselineTab
            dossier={workspaceDossier}
            onDirtyChange={setIsBaselineDirty}
            onNavigationBlockedChange={setIsBaselineNavigationBlocked}
          />
        </TabsContent>
        <TabsContent value="evidence" className="mt-6">
          <TechnicalConfigurationBaselineEvidence
            dossier={workspaceDossier}
            onDirtyChange={setIsEvidenceDirty}
            onNavigationBlockedChange={setIsEvidenceNavigationBlocked}
          />
        </TabsContent>
        <TabsContent value="references" className="mt-6">
          <TechnicalConfigurationReferenceProducts
            dossier={workspaceDossier}
            onDirtyChange={setIsReferenceDirty}
            onNavigationBlockedChange={setIsReferenceNavigationBlocked}
          />
        </TabsContent>
        <TabsContent value="options" className="mt-6">
          <TechnicalConfigurationSuppliers
            dossier={workspaceDossier}
            onDirtyChange={setIsOptionDirty}
            onNavigationBlockedChange={setIsOptionNavigationBlocked}
            onRevisionChange={handleRevisionChange}
          />
        </TabsContent>
        <TabsContent value="comparison" className="mt-6">
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
