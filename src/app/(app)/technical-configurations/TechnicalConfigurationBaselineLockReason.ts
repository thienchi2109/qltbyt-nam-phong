import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "./technical-configuration-baseline-editor"

type TechnicalConfigurationBaselineLockReasonOptions = Readonly<{
  draft: TechnicalConfigurationBaselineEditorDraft | null
  isSelectedDraft: boolean
  isConflict: boolean
  isDirty: boolean
  hasPendingBulkInput: boolean
  hasUnresolvedImportState: boolean
  validation: TechnicalConfigurationBaselineEditorValidation
}>

/** Returns the highest-priority reason the selected baseline cannot be locked. */
export function getTechnicalConfigurationBaselineLockBlockedReason({
  draft,
  isSelectedDraft,
  isConflict,
  isDirty,
  hasPendingBulkInput,
  hasUnresolvedImportState,
  validation,
}: TechnicalConfigurationBaselineLockReasonOptions): string | null {
  if (!draft || !isSelectedDraft) return null
  if (isConflict) return "Tải lại dữ liệu từ máy chủ trước khi khóa phiên bản."
  if (isDirty) return "Lưu thay đổi trước khi khóa phiên bản."
  if (hasPendingBulkInput) return "Hoàn tất hoặc hủy nội dung nhập nhanh trước khi khóa."
  if (hasUnresolvedImportState) return "Hoàn tất hoặc hủy nhập Excel trước khi khóa phiên bản."
  if (
    Object.keys(validation.groupErrors).length > 0 ||
    Object.keys(validation.subgroupErrors ?? {}).length > 0 ||
    Object.keys(validation.criterionErrors).length > 0
  ) {
    return "Sửa các lỗi nội dung trước khi khóa phiên bản."
  }
  if (draft.groups.length < 1) return "Cần ít nhất một nhóm trước khi khóa phiên bản."
  if (
    !draft.groups.some(
      (group) =>
        group.criteria.length > 0 ||
        group.subgroups.some((subgroup) => subgroup.criteria.length > 0)
    )
  ) {
    return "Cần ít nhất một tiêu chí có nội dung trước khi khóa phiên bản."
  }
  return null
}
