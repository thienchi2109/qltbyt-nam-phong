import type { UIMessage } from 'ai'

export const REPAIR_REQUEST_DRAFT_START_PHRASES = [
  'tạo phiếu sửa chữa',
  'tạo phiếu yêu cầu sửa chữa thiết bị',
  'lập yêu cầu sửa chữa',
  'soạn yêu cầu sửa chữa',
  'điền trước form sửa chữa',
] as const

export const REPAIR_REQUEST_DRAFT_CANCEL_PHRASES = [
  'thôi không tạo nữa',
  'hủy tạo phiếu',
  'không cần tạo phiếu',
] as const

export interface RepairRequestDraftSessionState {
  status: 'inactive' | 'active'
  startMessageIndex?: number
}

function normalizeDraftText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[đĐ]/gu, 'd')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function readMessageText(message: UIMessage): string {
  if (!Array.isArray(message.parts)) {
    return ''
  }

  return message.parts
    .map(part => {
      if (
        part &&
        typeof part === 'object' &&
        'type' in part &&
        part.type === 'text' &&
        'text' in part &&
        typeof part.text === 'string'
      ) {
        return part.text
      }

      return ''
    })
    .filter(Boolean)
    .join(' ')
    .trim()
}

function messageHasCompletedRepairDraft(message: UIMessage): boolean {
  if (message.role !== 'assistant' || !Array.isArray(message.parts)) {
    return false
  }

  return message.parts.some(part => {
    if (!part || typeof part !== 'object') {
      return false
    }

    const record = part as Record<string, unknown>
    return (
      record.type === 'tool-generateRepairRequestDraft' &&
      record.state === 'output-available' &&
      typeof record.output === 'object' &&
      record.output !== null &&
      'kind' in record.output &&
      (record.output as Record<string, unknown>).kind === 'repairRequestDraft'
    )
  })
}

export function hasRepairRequestDraftStartIntent(text: string): boolean {
  const normalized = normalizeDraftText(text)
  return REPAIR_REQUEST_DRAFT_START_PHRASES.some(phrase =>
    normalized.includes(normalizeDraftText(phrase)),
  )
}

export function hasRepairRequestDraftCancelIntent(text: string): boolean {
  const normalized = normalizeDraftText(text)
  return REPAIR_REQUEST_DRAFT_CANCEL_PHRASES.some(phrase =>
    normalized.includes(normalizeDraftText(phrase)),
  )
}

export function getRepairRequestDraftSessionState(
  messages: UIMessage[],
): RepairRequestDraftSessionState {
  let activeStartMessageIndex: number | undefined

  for (const [index, message] of messages.entries()) {
    if (message.role === 'user') {
      const text = readMessageText(message)
      if (!text) {
        continue
      }

      if (
        activeStartMessageIndex !== undefined &&
        hasRepairRequestDraftCancelIntent(text)
      ) {
        activeStartMessageIndex = undefined
        continue
      }

      if (hasRepairRequestDraftStartIntent(text)) {
        activeStartMessageIndex = index
      }

      continue
    }

    if (
      activeStartMessageIndex !== undefined &&
      messageHasCompletedRepairDraft(message)
    ) {
      activeStartMessageIndex = undefined
    }
  }

  return activeStartMessageIndex === undefined
    ? { status: 'inactive' }
    : { status: 'active', startMessageIndex: activeStartMessageIndex }
}

