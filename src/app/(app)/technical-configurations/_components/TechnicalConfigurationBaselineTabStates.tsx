import { AlertCircle, FileLock2, ListPlus, RefreshCw } from "lucide-react"

import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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

/** Shows the complete read-only content for a locked baseline version. */
export function TechnicalConfigurationBaselineLockedState({
  version,
}: Readonly<{ version: TechnicalConfigurationBaselineDraftWire }>) {
  return (
    <section aria-label="Nội dung phiên bản đã khóa">
      <div className="flex items-start gap-3 border-b pb-4">
        <FileLock2 className="mt-0.5 size-5 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold">Nội dung chỉ đọc</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Phiên bản đã khóa được giữ nguyên trong lịch sử.
          </p>
        </div>
      </div>

      {version.groups.map((group) => (
        <section key={group.id} className="border-b py-5">
          <h3 className="text-sm font-semibold">{group.name}</h3>
          <div className="mt-3 divide-y">
            {group.criteria.map((criterion) => (
              <article key={criterion.id} className="grid gap-2 py-4 sm:grid-cols-[110px_1fr]">
                <Badge variant="outline" className="w-fit">
                  {criterion.criterion_code}
                </Badge>
                <div className="min-w-0">
                  {criterion.title ? (
                    <h4 className="text-sm font-medium">{criterion.title}</h4>
                  ) : null}
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                    {criterion.requirement_text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </section>
  )
}
