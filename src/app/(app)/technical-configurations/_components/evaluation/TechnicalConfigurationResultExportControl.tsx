"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Download, Loader2, RefreshCw } from "lucide-react"
import { useSession } from "next-auth/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import type { TechnicalConfigurationBaselineGroupWire } from "../../baseline-types"
import type { TechnicalConfigurationOptionWire } from "../../supplier-option-types"
import {
  useTechnicalConfigurationResultExport,
  type TechnicalConfigurationResultExportOrchestrationError,
} from "../../_hooks/useTechnicalConfigurationResultExport"
import type {
  TechnicalConfigurationResultExportContext,
  TechnicalConfigurationResultExportDialogRequest,
} from "../../technical-configuration-result-export-state"
import { flattenTechnicalConfigurationEvaluationLeaves } from "../../technical-configuration-evaluation-hierarchy"
import { TechnicalConfigurationResultExportDialog } from "./TechnicalConfigurationResultExportDialog"

type CurrentCriterion = Readonly<{
  criterion: Readonly<{ id: string }>
}>

type TechnicalConfigurationResultExportControlProps = Readonly<{
  dossierId: string
  baselineVersionId: string
  baselineRevision: number
  options: readonly TechnicalConfigurationOptionWire[]
  baselineGroups: readonly TechnicalConfigurationBaselineGroupWire[]
  activeOptionId: string
  currentCriteria: readonly CurrentCriterion[]
}>

function errorCopy(
  kind: TechnicalConfigurationResultExportOrchestrationError["kind"]
): Readonly<{ title: string; description: string }> {
  if (kind === "permission_denied") {
    return {
      title: "Không có quyền xuất kết quả",
      description: "Phiên đăng nhập hiện tại không được phép đọc dữ liệu xuất.",
    }
  }
  if (kind === "not_found") {
    return {
      title: "Không còn dữ liệu để xuất",
      description: "Hồ sơ hoặc phiên bản cấu hình không còn tồn tại.",
    }
  }
  if (kind === "conflict" || kind === "snapshot_changed") {
    return {
      title: "Dữ liệu đã thay đổi",
      description: "Không tạo tệp từ dữ liệu cũ. Hãy thử xuất lại snapshot mới nhất.",
    }
  }
  if (kind === "validation" || kind === "invalid_response") {
    return {
      title: "Dữ liệu xuất không hợp lệ",
      description: "Máy chủ trả về dữ liệu không khớp contract của tệp kết quả.",
    }
  }
  if (kind === "server" || kind === "transport") {
    return {
      title: "Không thể tải dữ liệu xuất",
      description: "Kết nối hoặc máy chủ đang gặp sự cố. Hãy thử lại.",
    }
  }
  return {
    title: "Không thể tạo tệp Excel",
    description: "Dữ liệu đã tải nhưng không thể tạo workbook hoàn chỉnh.",
  }
}

/** Mounts the P14C1 dialog beside the P12B2 state that defines its live scopes. */
export function TechnicalConfigurationResultExportControl({
  dossierId,
  baselineVersionId,
  baselineRevision,
  options,
  baselineGroups,
  activeOptionId,
  currentCriteria,
}: TechnicalConfigurationResultExportControlProps) {
  const { data: session } = useSession()
  const [open, setOpen] = React.useState(false)
  const context = React.useMemo<TechnicalConfigurationResultExportContext>(() => {
    const optionIds = options.map((option) => option.id)
    return {
      dossierId,
      baselineVersionId,
      options: {
        total: optionIds.length,
        page: {
          currentIds: optionIds,
          selectedIds: activeOptionId ? [activeOptionId] : [],
        },
      },
      criteria: {
        total: flattenTechnicalConfigurationEvaluationLeaves(baselineGroups).length,
        page: {
          currentIds: currentCriteria.map((item) => item.criterion.id),
        },
      },
    }
  }, [activeOptionId, baselineGroups, baselineVersionId, currentCriteria, dossierId, options])
  const generatedBy =
    session?.user.full_name?.trim() ||
    session?.user.name?.trim() ||
    session?.user.username?.trim() ||
    "Không xác định"
  const resultExport = useTechnicalConfigurationResultExport({
    dossierId,
    baselineVersionId,
    baselineRevision,
    baselineGroups,
    generatedBy,
  })
  const isLoading = resultExport.status === "loading"
  const copy = resultExport.error ? errorCopy(resultExport.error.kind) : null

  function handleOpen() {
    if (isLoading) return
    resultExport.reset()
    setOpen(true)
  }

  function handleConfirm(request: TechnicalConfigurationResultExportDialogRequest) {
    void resultExport.startExport(request)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={handleOpen}
          aria-busy={isLoading}
          aria-disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          {isLoading ? "Đang xuất kết quả..." : "Xuất kết quả Excel"}
        </Button>
        {isLoading ? (
          <span className="sr-only" role="status" aria-live="polite">
            Đang tạo tệp Excel
          </span>
        ) : null}
      </div>

      <TechnicalConfigurationResultExportDialog
        open={open}
        context={context}
        onOpenChange={setOpen}
        onConfirm={handleConfirm}
      />

      {copy ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>{copy.title}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{copy.description}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void resultExport.retry()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {resultExport.status === "success" ? (
        <Alert role="status">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          <AlertTitle>Đã tải tệp Excel</AlertTitle>
        </Alert>
      ) : null}
    </div>
  )
}
