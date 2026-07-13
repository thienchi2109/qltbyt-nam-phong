import { AlertCircle, FileLock2, ListPlus, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import type { TechnicalConfigurationDossierWire } from "../types"
import { useTechnicalConfigurationBaselineEditor } from "../_hooks/useTechnicalConfigurationBaselineEditor"
import { TechnicalConfigurationBaselineEditor } from "./TechnicalConfigurationBaselineEditor"

type TechnicalConfigurationBaselineTabProps = {
  dossier: TechnicalConfigurationDossierWire
  onDirtyChange: (dirty: boolean) => void
}

/** Composes P3B baseline loading, empty, conflict, and editor states. */
export function TechnicalConfigurationBaselineTab({
  dossier,
  onDirtyChange,
}: Readonly<TechnicalConfigurationBaselineTabProps>) {
  const baseline = useTechnicalConfigurationBaselineEditor({ dossier, onDirtyChange })

  if (baseline.isLoading) {
    return (
      <section className="border-y py-12 text-center" aria-live="polite">
        <RefreshCw className="mx-auto size-8 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Đang tải cấu hình cơ sở...</p>
      </section>
    )
  }

  if (baseline.queryError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Không thể tải cấu hình cơ sở</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{baseline.queryError}</span>
          <Button type="button" variant="outline" size="sm" onClick={baseline.onRetryQuery}>
            <RefreshCw className="size-4" />
            Thử lại
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (baseline.isMissing) {
    return (
      <section className="border-y py-12 text-center">
        <ListPlus className="mx-auto size-9 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-4 text-base font-semibold">Chưa có bản nháp cấu hình</h2>
        {baseline.createError ? (
          <p className="mx-auto mt-2 max-w-xl text-sm text-destructive">{baseline.createError}</p>
        ) : null}
        <Button
          type="button"
          className="mt-5"
          disabled={baseline.isCreating}
          onClick={baseline.onCreate}
        >
          <ListPlus className="size-4" aria-hidden="true" />
          {baseline.isCreating ? "Đang khởi tạo..." : "Khởi tạo cấu hình cơ sở"}
        </Button>
      </section>
    )
  }

  if (baseline.editorDraft?.status === "locked") {
    return (
      <section className="border-y py-12 text-center">
        <FileLock2 className="mx-auto size-9 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-4 text-base font-semibold">Phiên bản đã khóa</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Nội dung đã khóa được giữ ở chế độ chỉ đọc.
        </p>
      </section>
    )
  }

  if (!baseline.editorDraft) return null

  return (
    <div className="space-y-4">
      {baseline.isConflict ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Xung đột dữ liệu</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Dữ liệu trên máy chủ đã thay đổi. Nội dung chưa lưu vẫn được giữ trong form.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const confirmed = window.confirm(
                  "Tải lại từ máy chủ sẽ thay thế các thay đổi chưa lưu. Tiếp tục?"
                )
                if (confirmed) void baseline.onReloadFromServer()
              }}
            >
              <RefreshCw className="size-4" />
              Tải lại từ máy chủ
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {baseline.saveError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Lưu không thành công</AlertTitle>
          <AlertDescription>{baseline.saveError}</AlertDescription>
        </Alert>
      ) : null}

      <TechnicalConfigurationBaselineEditor
        draft={baseline.editorDraft}
        validation={baseline.validation}
        isDirty={baseline.isDirty}
        isSaving={baseline.isSaving}
        isConflict={baseline.isConflict}
        saveStatus={baseline.saveStatus}
        onChange={baseline.onEditorChange}
        onSave={baseline.onSave}
      />
    </div>
  )
}
