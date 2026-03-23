/**
 * Starter prompt suggestions for the AI assistant chat panel.
 * Organized by tool/feature group for UI rendering.
 * Each group has a label and an array of suggestion strings.
 */

export type StarterPromptGroup = {
  readonly groupKey: string
  readonly label: string
  readonly suggestions: readonly string[]
}

/**
 * Prompts that always appear at the top of the suggestion list.
 * These are never shuffled and always shown first.
 */
export const PINNED_PROMPTS: readonly string[] = [
  'Gợi ý gán thiết bị vào danh mục định mức của đơn vị',
  'Tạo phiếu yêu cầu sửa chữa thiết bị',
] as const

export const STARTER_PROMPT_GROUPS: readonly StarterPromptGroup[] = [
  {
    groupKey: 'equipment',
    label: 'Thiết bị',
    suggestions: [
      'Tra cứu thông tin thiết bị X',
      'Thiết bị nào sắp đến hạn bảo trì?',
      'Tình trạng sửa chữa thiết bị gần đây',
    ],
  },
  {
    groupKey: 'quota',
    label: 'Định mức',
    suggestions: [
      'Thiết bị này có nằm trong định mức hiện hành không?',
      'Định mức còn lại của thiết bị này là bao nhiêu?',
      'Thiết bị này đã được gán vào danh mục định mức chưa?',
      'Tổng quan định mức của đơn vị tôi như thế nào?',
    ],
  },
  {
    groupKey: 'maintenance',
    label: 'Bảo trì & Sử dụng',
    suggestions: [
      'Lịch bảo trì, hiệu chuẩn năm nay của thiết bị X',
      'Lịch sử sử dụng thiết bị X',
      'Tài liệu đính kèm của thiết bị X',
    ],
  },
] as const
