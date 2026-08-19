"use client"

import { Archive, Copy, LoaderCircle, Search } from "lucide-react"

import type { UseTechnicalConfigurationBaselineCrossDossierCopyResult } from "../_hooks/useTechnicalConfigurationBaselineCrossDossierCopy"
import type {
  TechnicalConfigurationBaselineCrossDossierCopyCounts,
  TechnicalConfigurationBaselineCrossDossierCopyPreviewWire,
  TechnicalConfigurationBaselineCrossDossierDeleteCounts,
  TechnicalConfigurationBaselineCrossDossierPreservedCounts,
  TechnicalConfigurationBaselineCrossDossierSourceWire,
} from "../technical-configuration-baseline-cross-dossier-types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatVietnamDateTime } from "@/lib/date-utils"
import { cn } from "@/lib/utils"

function SourceOption({
  source,
  selected,
  disabled,
  onSelect,
}: {
  source: TechnicalConfigurationBaselineCrossDossierSourceWire
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "w-full border-b px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60 disabled:cursor-wait",
        selected && "bg-muted"
      )}
    >
      <span className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{source.dossier_name}</span>
          <span className="mt-1 block truncate text-sm text-muted-foreground">
            {source.device_type_name} · Phiên bản {source.version_number}
          </span>
        </span>
        {source.dossier_archived_at ? (
          <Badge variant="secondary" className="shrink-0 gap-1">
            <Archive className="size-3" aria-hidden="true" />
            Đã lưu trữ
          </Badge>
        ) : null}
      </span>
      <span className="mt-2 block text-xs text-muted-foreground">
        Khóa lúc {formatVietnamDateTime(source.locked_at)} · {source.main_section_count} mục chính ·{" "}
        {source.subgroup_count} nhóm con · {source.criterion_count} tiêu chí
      </span>
    </button>
  )
}

const countLabels = {
  main_sections: "Mục chính",
  subgroups: "Nhóm con",
  criteria: "Tiêu chí",
  reference_products: "Sản phẩm tham chiếu",
  reference_responses: "Phản hồi tham chiếu",
  baseline_documents: "Tài liệu cấu hình",
  baseline_citations: "Trích dẫn cấu hình",
  reference_documents: "Tài liệu tham chiếu",
  reference_citations: "Trích dẫn tham chiếu",
  option_responses: "Phản hồi phương án",
  option_citations: "Trích dẫn phương án",
  manual_assessments: "Đánh giá thủ công",
  suppliers: "Nhà cung cấp",
  options: "Phương án",
  option_documents: "Tài liệu phương án",
  comparison_sets: "Bộ so sánh",
} as const

function CountGroup({
  title,
  counts,
  destructive = false,
}: {
  title: string
  counts:
    | TechnicalConfigurationBaselineCrossDossierCopyCounts
    | TechnicalConfigurationBaselineCrossDossierDeleteCounts
    | TechnicalConfigurationBaselineCrossDossierPreservedCounts
  destructive?: boolean
}) {
  const visibleCounts = (Object.entries(counts) as [string, number][]).filter(
    ([, count]) => count > 0
  )
  if (visibleCounts.length === 0) return null

  return (
    <section>
      <h3 className={cn("text-sm font-medium", destructive && "text-destructive")}>{title}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {visibleCounts.map(([key, count]) => (
          <div key={key} className="min-w-0">
            <dt className="truncate text-muted-foreground">
              {countLabels[key as keyof typeof countLabels] ?? key}
            </dt>
            <dd className="font-semibold tabular-nums">{count}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function PreviewSummary({
  preview,
}: {
  preview: TechnicalConfigurationBaselineCrossDossierCopyPreviewWire
}) {
  return (
    <div className="space-y-4 border-t pt-4">
      <Alert variant={preview.mode === "replace" ? "destructive" : "default"}>
        <Copy className="size-4" aria-hidden="true" />
        <AlertTitle>
          {preview.mode === "replace"
            ? "Thay thế toàn bộ bản nháp hiện tại"
            : "Tạo bản nháp từ cấu hình đã khóa"}
        </AlertTitle>
        <AlertDescription>
          Nguồn: {preview.source.device_type_name} · {preview.source.dossier_name} · Phiên bản{" "}
          {preview.source.version_number}
        </AlertDescription>
      </Alert>
      <CountGroup title="Dữ liệu sẽ sao chép" counts={preview.copy_counts} />
      <CountGroup title="Dữ liệu sẽ xóa" counts={preview.delete_counts} destructive />
      <CountGroup title="Dữ liệu hồ sơ đích được giữ nguyên" counts={preview.preserved_counts} />
    </div>
  )
}

/** Renders the source selection, preview, and confirmation workflow for cross-dossier copy. */
export function TechnicalConfigurationBaselineCrossDossierCopyDialog({
  workflow,
}: {
  workflow: UseTechnicalConfigurationBaselineCrossDossierCopyResult
}) {
  const isBusy = workflow.isPreviewing || workflow.isApplying

  return (
    <Dialog
      open={workflow.open}
      onOpenChange={(open) => {
        if (open) workflow.openDialog()
        else if (!isBusy) workflow.closeDialog()
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!isBusy}
        onEscapeKeyDown={(event) => {
          if (isBusy) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (isBusy) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Sao chép cấu hình từ hồ sơ khác</DialogTitle>
          <DialogDescription>
            Chọn một phiên bản đã khóa để tạo hoặc thay thế bản nháp của hồ sơ hiện tại.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Copy className="size-4" aria-hidden="true" />
          <AlertTitle>Chỉ sao chép phiên bản đã khóa</AlertTitle>
          <AlertDescription>
            Chỉ có thể sao chép phiên bản cấu hình đã khóa. Phiên bản đang ở trạng thái bản nháp
            không thể sao chép.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="technical-configuration-cross-dossier-search">Tìm hồ sơ nguồn</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="technical-configuration-cross-dossier-search"
              value={workflow.search}
              onChange={(event) => workflow.setSearch(event.target.value)}
              placeholder="Loại thiết bị hoặc tên hồ sơ"
              className="pl-9"
              disabled={isBusy}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-md border">
          <ScrollArea className="h-64">
            {workflow.isSourcesLoading ? (
              <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Đang tải hồ sơ nguồn...
              </div>
            ) : workflow.sourcesError ? (
              <p className="p-4 text-sm text-destructive">{workflow.sourcesError}</p>
            ) : workflow.sources.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Không có phiên bản đã khóa phù hợp.
              </p>
            ) : (
              workflow.sources.map((source) => (
                <SourceOption
                  key={source.baseline_version_id}
                  source={source}
                  selected={workflow.selectedSourceId === source.baseline_version_id}
                  disabled={isBusy}
                  onSelect={() => void workflow.selectSource(source.baseline_version_id)}
                />
              ))
            )}
          </ScrollArea>
          {workflow.hasMoreSources ? (
            <div className="border-t p-2 text-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={workflow.isLoadingMoreSources || isBusy}
                onClick={() => void workflow.loadMoreSources()}
              >
                {workflow.isLoadingMoreSources ? "Đang tải..." : "Tải thêm hồ sơ"}
              </Button>
            </div>
          ) : null}
        </div>

        {workflow.isPreviewing ? (
          <p className="text-sm text-muted-foreground">Đang tạo bản xem trước...</p>
        ) : null}
        {workflow.preview ? <PreviewSummary preview={workflow.preview} /> : null}

        {workflow.preview?.requires_replacement_confirmation ? (
          <div className="flex items-start gap-3 rounded-md border border-destructive/40 p-3">
            <Checkbox
              id="technical-configuration-cross-dossier-confirm"
              checked={workflow.replacementConfirmed}
              onCheckedChange={(checked) => workflow.setReplacementConfirmed(checked === true)}
            />
            <label
              htmlFor="technical-configuration-cross-dossier-confirm"
              className="text-sm leading-5"
            >
              Tôi hiểu bản nháp hiện tại sẽ bị thay thế và các phản hồi, trích dẫn phương án cùng
              đánh giá thủ công được liệt kê sẽ bị xóa.
            </label>
          </div>
        ) : null}

        {workflow.operationError ? (
          <p role="alert" className="text-sm text-destructive">
            {workflow.operationError}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={workflow.closeDialog} disabled={isBusy}>
            Hủy
          </Button>
          <Button
            type="button"
            onClick={() => void workflow.apply()}
            disabled={!workflow.canApply || isBusy}
          >
            {workflow.isApplying
              ? "Đang sao chép..."
              : workflow.preview?.mode === "replace"
                ? "Thay thế bản nháp"
                : "Tạo bản nháp từ cấu hình"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
