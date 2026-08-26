import { AlertCircle, Copy, ListPlus, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

/** Shows the loading state while the baseline query is pending. */
export function TechnicalConfigurationBaselineLoadingState() {
  return (
    <section className="border-y py-12 text-center" aria-live="polite">
      <RefreshCw className="mx-auto size-8 animate-spin text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">Đang tải cấu hình cơ sở...</p>
    </section>
  )
}

/** Shows a retryable baseline query error. */
export function TechnicalConfigurationBaselineQueryError({
  message,
  onRetry,
}: Readonly<{ message: string; onRetry: () => Promise<void> }>) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>Không thể tải cấu hình cơ sở</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" />
          Thử lại
        </Button>
      </AlertDescription>
    </Alert>
  )
}

/** Shows the empty state used to create the first baseline draft. */
export function TechnicalConfigurationBaselineMissingState({
  error,
  isCreating,
  onCreate,
  onCopyFromDossier,
}: Readonly<{
  error: string | null
  isCreating: boolean
  onCreate: () => void
  onCopyFromDossier: () => void
}>) {
  return (
    <section className="border-y py-12 text-center">
      <ListPlus className="mx-auto size-9 text-muted-foreground" aria-hidden="true" />
      <h2 className="mt-4 text-base font-semibold">Chưa có bản nháp cấu hình</h2>
      {error ? <p className="mx-auto mt-2 max-w-xl text-sm text-destructive">{error}</p> : null}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button type="button" disabled={isCreating} onClick={onCreate}>
          <ListPlus className="size-4" aria-hidden="true" />
          {isCreating ? "Đang khởi tạo..." : "Khởi tạo cấu hình cơ sở"}
        </Button>
        <Button type="button" variant="outline" disabled={isCreating} onClick={onCopyFromDossier}>
          <Copy className="size-4" aria-hidden="true" />
          Sao chép từ hồ sơ khác
        </Button>
      </div>
    </section>
  )
}
