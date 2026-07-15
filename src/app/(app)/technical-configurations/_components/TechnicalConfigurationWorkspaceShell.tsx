import * as React from "react"
import { ArrowLeft, ClipboardList, GitCompareArrows, ListChecks, PackageSearch } from "lucide-react"

import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { TechnicalConfigurationBaselineTab } from "./TechnicalConfigurationBaselineTab"

type TechnicalConfigurationWorkspaceShellProps = {
  dossier: TechnicalConfigurationDossierWire
  onBack: () => void
}

/** Renders the dossier workspace tabs available in the current delivery phase. */
export function TechnicalConfigurationWorkspaceShell({
  dossier,
  onBack,
}: Readonly<TechnicalConfigurationWorkspaceShellProps>) {
  const [isBaselineDirty, setIsBaselineDirty] = React.useState(false)
  const [isBaselineNavigationBlocked, setIsBaselineNavigationBlocked] = React.useState(false)

  const handleBack = React.useCallback(() => {
    if (isBaselineNavigationBlocked) return
    if (
      isBaselineDirty &&
      !window.confirm("Bạn có thay đổi chưa lưu. Rời hồ sơ và bỏ các thay đổi?")
    ) {
      return
    }
    onBack()
  }, [isBaselineDirty, isBaselineNavigationBlocked, onBack])

  return (
    <div className="w-full">
      <header className="border-b pb-5">
        <Button
          type="button"
          variant="ghost"
          className="-ml-3"
          disabled={isBaselineNavigationBlocked}
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

      <Tabs defaultValue="baseline" className="mt-6">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
          <TabsTrigger value="baseline" className="min-h-10 gap-2">
            <ListChecks className="size-4" aria-hidden="true" />
            Cấu hình cơ sở
          </TabsTrigger>
          <TabsTrigger value="options" className="min-h-10 gap-2" disabled>
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
            dossier={dossier}
            onDirtyChange={setIsBaselineDirty}
            onNavigationBlockedChange={setIsBaselineNavigationBlocked}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
