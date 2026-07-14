import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog"

type TechnicalConfigurationLockDialogProps = {
  version: TechnicalConfigurationBaselineDraftWire
  open: boolean
  isPending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/** Confirms the irreversible transition from editable draft to locked history. */
export function TechnicalConfigurationLockDialog({
  version,
  open,
  isPending,
  onOpenChange,
  onConfirm,
}: Readonly<TechnicalConfigurationLockDialogProps>) {
  return (
    <DestructiveConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Khóa phiên bản ${version.version_number}?`}
      description="Sau khi khóa, phiên bản này không thể chỉnh sửa hoặc mở khóa. Mọi thay đổi tiếp theo phải tạo một bản nháp mới."
      confirmLabel="Khóa vĩnh viễn"
      isPending={isPending}
      onConfirm={onConfirm}
    />
  )
}
