"use client"

import * as React from "react"
import { FileText, Stethoscope, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { RepairRequestDraft } from "@/lib/ai/draft/repair-request-draft-schema"
import type { TroubleshootingDraft } from "@/lib/ai/draft/troubleshooting-schema"

type DraftPayload = RepairRequestDraft | TroubleshootingDraft

interface AssistantDraftCardProps {
    draft: DraftPayload
    onApplyDraft: (draft: DraftPayload) => void
}

/**
 * Renders a structured draft card for AI-generated draft artifacts.
 *
 * - repairRequestDraft: dashed orange border, "BẢN NHÁP" badge, CTA.
 * - troubleshootingDraft: blue advisory card, no CTA.
 * Design spec §4.5 + Phase 4 handoff contract.
 */
export function AssistantDraftCard({ draft, onApplyDraft }: AssistantDraftCardProps) {
    if (draft.kind === "repairRequestDraft") {
        return <RepairDraftCard draft={draft} onApplyDraft={onApplyDraft} />
    }
    return <TroubleshootingDraftCard draft={draft} />
}

// ---------------------
// Repair Request Draft
// ---------------------

function RepairDraftCard({
    draft,
    onApplyDraft,
}: {
    draft: RepairRequestDraft
    onApplyDraft: (draft: RepairRequestDraft) => void
}) {
    return (
        <div
            className={cn(
                "rounded-lg border-2 border-dashed border-orange-400",
                "bg-orange-50 p-3 my-2 space-y-2",
            )}
        >
            {/* Header */}
            <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-orange-600" />
                <span className="text-xs font-semibold text-orange-800">
                    📝 Bản nháp yêu cầu sửa chữa
                </span>
                <span className="ml-auto bg-orange-200 text-orange-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                    BẢN NHÁP
                </span>
            </div>

            {/* Structured form fields */}
            <div className="space-y-1.5 text-xs">
                {draft.equipment.ten_thiet_bi && (
                    <DraftField label="Thiết bị" value={draft.equipment.ten_thiet_bi} />
                )}
                <DraftField label="Mô tả sự cố" value={draft.formData.mo_ta_su_co} />
                <DraftField
                    label="Hạng mục sửa chữa"
                    value={draft.formData.hang_muc_sua_chua}
                />
                {draft.formData.ngay_mong_muon_hoan_thanh && (
                    <DraftField
                        label="Ngày mong muốn"
                        value={draft.formData.ngay_mong_muon_hoan_thanh}
                    />
                )}
                {draft.formData.don_vi_thuc_hien && (
                    <DraftField
                        label="Đơn vị thực hiện"
                        value={draft.formData.don_vi_thuc_hien === "noi_bo" ? "Nội bộ" : "Thuê ngoài"}
                    />
                )}
            </div>

            {/* Review notes */}
            {draft.reviewNotes && draft.reviewNotes.length > 0 && (
                <div className="flex items-start gap-1.5 text-[11px] text-orange-700 bg-orange-100 rounded px-2 py-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div>
                        {draft.reviewNotes.map((note, i) => (
                            <p key={i}>{note}</p>
                        ))}
                    </div>
                </div>
            )}

            {/* CTA + Disclaimer */}
            <div className="pt-1 space-y-1.5">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs border-orange-300 hover:bg-orange-100"
                    onClick={() => onApplyDraft(draft)}
                >
                    Dùng bản nháp này
                </Button>
                <p className="text-[11px] text-muted-foreground italic text-center">
                    Bản nháp này chưa được gửi. Vui lòng kiểm tra trước khi tạo yêu cầu.
                </p>
            </div>
        </div>
    )
}

// ---------------------
// Troubleshooting Draft
// ---------------------

function TroubleshootingDraftCard({ draft }: { draft: TroubleshootingDraft }) {
    return (
        <div
            className={cn(
                "rounded-lg border border-blue-200",
                "bg-blue-50 p-3 my-2 space-y-2",
            )}
        >
            {/* Header */}
            <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-800">
                    Khuyến nghị chẩn đoán
                </span>
            </div>

            {/* Probable causes */}
            <div className="space-y-1">
                <p className="text-[11px] font-medium text-blue-700">
                    Nguyên nhân có thể:
                </p>
                {draft.probable_causes.map((cause, i) => (
                    <div
                        key={i}
                        className="flex items-start gap-1.5 text-xs text-blue-900"
                    >
                        <span className="text-blue-500 mt-0.5">•</span>
                        <div>
                            <span className="font-medium">{cause.label}</span>
                            <span className="text-blue-600 ml-1">
                                ({cause.confidence})
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Remediation steps */}
            <div className="space-y-1">
                <p className="text-[11px] font-medium text-blue-700">
                    Bước xử lý đề xuất:
                </p>
                {draft.remediation_steps.map((step, i) => (
                    <div
                        key={i}
                        className="flex items-start gap-1.5 text-xs text-blue-900"
                    >
                        <span className="text-blue-500 font-mono text-[10px] mt-0.5">
                            {i + 1}.
                        </span>
                        <span>{step.step}</span>
                    </div>
                ))}
            </div>

            {/* Limitations disclaimer */}
            {draft.limitations && draft.limitations.length > 0 && (
                <p className="text-[11px] text-blue-600 italic">
                    Lưu ý: {draft.limitations.join("; ")}
                </p>
            )}

            <p className="text-[11px] text-muted-foreground italic">
                Kết quả mang tính tham khảo, dựa trên dữ liệu có sẵn.
            </p>
        </div>
    )
}

// ---------------------
// Shared field component
// ---------------------

function DraftField({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex gap-2">
            <span className="text-muted-foreground shrink-0 w-28">{label}:</span>
            <span className="text-foreground">{value}</span>
        </div>
    )
}
