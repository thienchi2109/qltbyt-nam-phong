"use client"

import * as React from "react"

import type { TechnicalConfigurationComparisonEvidence } from "../../comparison-types"
import { SideSheetShell } from "@/components/shared/SideSheetShell"

export type TechnicalConfigurationCriterionDetail = {
  criterionCode: string
  criterionTitle: string | null
  optionLabel: string | null
  requirementText: string
  responseText: string | null
  supplementaryInformation: string | null
  evidence: TechnicalConfigurationComparisonEvidence
}

type TechnicalConfigurationCriterionPanelProps = {
  detail: TechnicalConfigurationCriterionDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef?: React.RefObject<HTMLElement | null>
}

function formatEvidenceSummary(evidence: TechnicalConfigurationComparisonEvidence) {
  if (!evidence.hasEvidence) return "Chưa có bằng chứng"
  return `${evidence.documentCount} tài liệu · ${evidence.citationCount} trích dẫn`
}

/** Renders full comparison text without loading evidence documents or assessment controls. */
export function TechnicalConfigurationCriterionPanel({
  detail,
  open,
  onOpenChange,
  returnFocusRef,
}: Readonly<TechnicalConfigurationCriterionPanelProps>) {
  return (
    <SideSheetShell
      open={open}
      onOpenChange={onOpenChange}
      closeLabel="Đóng chi tiết tiêu chí"
      title={
        detail
          ? `${detail.criterionCode} · ${detail.criterionTitle ?? "Chưa có tiêu đề"}`
          : "Chi tiết tiêu chí"
      }
      description={detail?.optionLabel ?? "Yêu cầu cấu hình cơ sở"}
      contentClassName="sm:max-w-xl lg:max-w-2xl"
      bodyClassName="overflow-y-auto"
      onCloseAutoFocus={(event) => {
        const returnFocusTarget = returnFocusRef?.current
        if (!returnFocusTarget) return
        event.preventDefault()
        returnFocusTarget.focus()
      }}
    >
      {detail ? (
        <div className="space-y-5 p-5 text-sm">
          <section className="space-y-2 border-b pb-5">
            <h3 className="font-semibold">Yêu cầu cơ sở</h3>
            <p className="whitespace-pre-wrap break-words leading-6">{detail.requirementText}</p>
          </section>

          <section className="space-y-2 border-b pb-5">
            <h3 className="font-semibold">Phản hồi phương án</h3>
            <p className="whitespace-pre-wrap break-words leading-6">
              {detail.responseText || "Chưa có phản hồi."}
            </p>
          </section>

          <section className="space-y-2 border-b pb-5">
            <h3 className="font-semibold">Thông tin bổ sung</h3>
            <p className="text-xs text-muted-foreground">
              Không dùng thông tin bổ sung để chấm điểm hoặc xác định mức đáp ứng.
            </p>
            <p className="whitespace-pre-wrap break-words leading-6">
              {detail.supplementaryInformation || "Không có thông tin bổ sung."}
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">Tóm tắt bằng chứng</h3>
            <p className="text-muted-foreground">{formatEvidenceSummary(detail.evidence)}</p>
          </section>
        </div>
      ) : null}
    </SideSheetShell>
  )
}
