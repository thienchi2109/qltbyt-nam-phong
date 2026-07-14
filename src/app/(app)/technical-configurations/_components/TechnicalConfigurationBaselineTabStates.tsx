import { AlertCircle, FileLock2, ListPlus, RefreshCw } from "lucide-react"

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
}: Readonly<{ error: string | null; isCreating: boolean; onCreate: () => void }>) {
  return (
    <section className="border-y py-12 text-center">
      <ListPlus className="mx-auto size-9 text-muted-foreground" aria-hidden="true" />
      <h2 className="mt-4 text-base font-semibold">Chưa có bản nháp cấu hình</h2>
      {error ? <p className="mx-auto mt-2 max-w-xl text-sm text-destructive">{error}</p> : null}
      <Button type="button" className="mt-5" disabled={isCreating} onClick={onCreate}>
        <ListPlus className="size-4" aria-hidden="true" />
        {isCreating ? "Đang khởi tạo..." : "Khởi tạo cấu hình cơ sở"}
      </Button>
    </section>
  )
}

/** Shows the read-only state for a locked baseline version. */
export function TechnicalConfigurationBaselineLockedState() {
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
