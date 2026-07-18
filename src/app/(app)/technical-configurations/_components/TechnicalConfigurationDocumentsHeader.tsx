"use client"

import { Button, Chip } from "@heroui/react"

import type { TechnicalConfigurationDocumentWire } from "@/app/(app)/technical-configurations/document-types"

type TechnicalConfigurationDocumentsHeaderProps = {
  ownerType: TechnicalConfigurationDocumentWire["owner_type"]
  isReadOnly: boolean
  hasSelectedDocument: boolean
  isCreateDisabled: boolean
  onCreateNew: () => void
}

/** Renders the evidence-document section heading and owner-level actions. */
export function TechnicalConfigurationDocumentsHeader({
  ownerType,
  isReadOnly,
  hasSelectedDocument,
  isCreateDisabled,
  onCreateNew,
}: TechnicalConfigurationDocumentsHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold">Tài liệu và trích dẫn</h2>
        <p className="text-sm text-muted-foreground">
          {ownerType === "baseline"
            ? "Bằng chứng áp dụng cho cấu hình cơ sở."
            : "Bằng chứng của sản phẩm tham chiếu đang chọn."}
        </p>
      </div>
      {isReadOnly ? (
        <Chip color="warning" size="sm" variant="soft">
          Chỉ đọc
        </Chip>
      ) : hasSelectedDocument ? (
        <Button size="sm" variant="tertiary" isDisabled={isCreateDisabled} onPress={onCreateNew}>
          Tạo tài liệu mới
        </Button>
      ) : null}
    </div>
  )
}
