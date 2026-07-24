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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { TechnicalConfigurationBaselineTab } from "./TechnicalConfigurationBaselineTab"
import { TechnicalConfigurationBaselineEvidence } from "./TechnicalConfigurationBaselineEvidence"
import { TechnicalConfigurationReferenceProducts } from "./TechnicalConfigurationReferenceProducts"
import { TechnicalConfigurationSuppliers } from "./TechnicalConfigurationSuppliers"

type TechnicalConfigurationWorkspaceShellProps = {
  dossier: TechnicalConfigurationDossierWire
  onBack: () => void
}

type PendingWorkspaceNavigation =
  | { kind: "back" }
  | {
      kind: "tab"
      value: string
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
  const [pendingNavigation, setPendingNavigation] =
    React.useState<PendingWorkspaceNavigation | null>(null)
  const [isBaselineDirty, setIsBaselineDirty] = React.useState(false)
  const [isBaselineNavigationBlocked, setIsBaselineNavigationBlocked] = React.useState(false)
  const [isEvidenceDirty, setIsEvidenceDirty] = React.useState(false)
  const [isEvidenceNavigationBlocked, setIsEvidenceNavigationBlocked] = React.useState(false)
  const [isReferenceDirty, setIsReferenceDirty] = React.useState(false)
  const [isReferenceNavigationBlocked, setIsReferenceNavigationBlocked] = React.useState(false)
  const [isOptionDirty, setIsOptionDirty] = React.useState(false)
  const [isOptionNavigationBlocked, setIsOptionNavigationBlocked] = React.useState(false)
  const isDirty = isBaselineDirty || isEvidenceDirty || isReferenceDirty || isOptionDirty
  const isNavigationBlocked =
    isBaselineNavigationBlocked ||
    isEvidenceNavigationBlocked ||
    isReferenceNavigationBlocked ||
    isOptionNavigationBlocked
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
    if (isNavigationBlocked) return
    if (isDirty) {
      setPendingNavigation({ kind: "back" })
      return
    }
    onBack()
  }, [isDirty, isNavigationBlocked, onBack])

  const handleTabChange = React.useCallback(
    (nextTab: string) => {
      if (nextTab === activeTab) return
      const isCurrentTabDirty =
        (activeTab === "baseline" && isBaselineDirty) ||
        (activeTab === "evidence" && isEvidenceDirty) ||
        (activeTab === "references" && isReferenceDirty) ||
        (activeTab === "options" && isOptionDirty)
      const isCurrentTabBlocked =
        (activeTab === "baseline" && isBaselineNavigationBlocked) ||
        (activeTab === "evidence" && isEvidenceNavigationBlocked) ||
        (activeTab === "references" && isReferenceNavigationBlocked) ||
        (activeTab === "options" && isOptionNavigationBlocked)
      if (isCurrentTabBlocked) return
      if (isCurrentTabDirty) {
        setPendingNavigation({ kind: "tab", value: nextTab })
        return
      }
      setActiveTab(nextTab)
    },
    [
      activeTab,
      isBaselineDirty,
      isBaselineNavigationBlocked,
      isEvidenceDirty,
      isEvidenceNavigationBlocked,
      isOptionDirty,
      isOptionNavigationBlocked,
      isReferenceDirty,
      isReferenceNavigationBlocked,
    ]
  )

  const dismissPendingNavigation = React.useCallback(() => {
    setPendingNavigation(null)
  }, [])

  const confirmPendingNavigation = React.useCallback(() => {
    if (!pendingNavigation) return
    setPendingNavigation(null)
    if (pendingNavigation.kind === "back") {
      onBack()
      return
    }
    setActiveTab(pendingNavigation.value)
  }, [onBack, pendingNavigation])

  return (
    <div className="w-full">
      <header className="border-b pb-5">
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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-5">
          <TabsTrigger value="baseline" className="min-h-10 gap-2">
            <ListChecks className="size-4" aria-hidden="true" />
            Cấu hình cơ sở
          </TabsTrigger>
          <TabsTrigger value="evidence" className="min-h-10 gap-2">
            <FileText className="size-4" aria-hidden="true" />
            Tài liệu &amp; trích dẫn
          </TabsTrigger>
          <TabsTrigger value="references" className="min-h-10 gap-2">
            <LibraryBig className="size-4" aria-hidden="true" />
            Sản phẩm tham chiếu
          </TabsTrigger>
          <TabsTrigger value="options" className="min-h-10 gap-2">
            <PackageSearch className="size-4" aria-hidden="true" />
            Phương án
          </TabsTrigger>
          <TabsTrigger value="comparison" className="min-h-10 gap-2" disabled>
            <GitCompareArrows className="size-4" aria-hidden="true" />
            So sánh &amp; đánh giá
          </TabsTrigger>
        </TabsList>

        <TabsContent value="baseline" className="mt-6">
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
      </Tabs>

      <AlertDialog
        open={pendingNavigation !== null}
        onOpenChange={(open) => {
          if (!open) dismissPendingNavigation()
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Bỏ thay đổi chưa lưu?</AlertDialogTitle>
            <AlertDialogDescription>
              Các thay đổi chưa lưu sẽ bị mất nếu bạn tiếp tục. Hãy tiếp tục chỉnh sửa để lưu hoặc
              xác nhận bỏ thay đổi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tiếp tục chỉnh sửa</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmPendingNavigation}
            >
              Bỏ thay đổi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
