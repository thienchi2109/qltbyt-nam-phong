import type { UIMessage } from 'ai'

const EQUIPMENT_LOOKUP_TOOL = 'equipmentLookup'
const REPAIR_SUMMARY_TOOL = 'repairSummary'
const DEVICE_QUOTA_LOOKUP_TOOL = 'deviceQuotaLookup'
const QUOTA_COMPLIANCE_SUMMARY_TOOL = 'quotaComplianceSummary'

const REPAIR_INTENT_CLARIFICATION =
  'Anh/chị muốn xem trạng thái thiết bị hay tình trạng các yêu cầu sửa chữa/phiếu sửa chữa?'

const QUOTA_INTENT_CLARIFICATION =
  'Anh/chị muốn kiểm tra định mức cho một thiết bị cụ thể hay xem tổng quan định mức của đơn vị?'

export type ChatIntentRoutingResult =
  | {
      kind: 'proceed'
      requestedTools: string[]
    }
  | {
      kind: 'clarify'
      message: string
    }

export function routeChatIntent({
  messages,
  requestedTools,
}: {
  messages: UIMessage[]
  requestedTools: string[]
}): ChatIntentRoutingResult {
  const latestUserText = getLatestUserText(messages)
  if (!latestUserText) {
    return { kind: 'proceed', requestedTools }
  }

  const repairDecision = classifyRepairIntent(latestUserText, requestedTools)
  if (repairDecision) {
    return repairDecision
  }

  const quotaDecision = classifyQuotaIntent(latestUserText, requestedTools)
  if (quotaDecision) {
    return quotaDecision
  }

  return { kind: 'proceed', requestedTools }
}

function classifyRepairIntent(
  text: string,
  requestedTools: string[],
): ChatIntentRoutingResult | null {
  if (
    !requestedTools.includes(EQUIPMENT_LOOKUP_TOOL) ||
    !requestedTools.includes(REPAIR_SUMMARY_TOOL)
  ) {
    return null
  }

  const normalized = normalizeIntentText(text)
  if (!/\bsua chua\b/.test(normalized)) {
    return null
  }

  const mentionsRepairRequest = /\b(phieu|yeu cau|don|ticket)\b/.test(normalized)
  const mentionsRepairWorkflow =
    /\b(xu ly|tiep nhan|ton dong|dang mo|da dong|hoan thanh)\b/.test(normalized)
  const mentionsEquipment = /\b(thiet bi|may)\b/.test(normalized)
  const mentionsEquipmentStatus =
    /\b(trang thai|tinh trang|cho sua chua|dang sua chua|hong)\b/.test(normalized) ||
    /\bbao nhieu thiet bi\b/.test(normalized)

  if (mentionsRepairRequest || (mentionsRepairWorkflow && !mentionsEquipmentStatus)) {
    return {
      kind: 'proceed',
      requestedTools: removeTool(requestedTools, EQUIPMENT_LOOKUP_TOOL),
    }
  }

  if (mentionsEquipmentStatus || mentionsEquipment) {
    return {
      kind: 'proceed',
      requestedTools: removeTool(requestedTools, REPAIR_SUMMARY_TOOL),
    }
  }

  return {
    kind: 'clarify',
    message: REPAIR_INTENT_CLARIFICATION,
  }
}

function classifyQuotaIntent(
  text: string,
  requestedTools: string[],
): ChatIntentRoutingResult | null {
  if (
    !requestedTools.includes(DEVICE_QUOTA_LOOKUP_TOOL) ||
    !requestedTools.includes(QUOTA_COMPLIANCE_SUMMARY_TOOL)
  ) {
    return null
  }

  const normalized = normalizeIntentText(text)
  if (!/\b(dinh muc|quota)\b/.test(normalized)) {
    return null
  }

  const mentionsSpecificEquipment =
    hasEquipmentIdentifier(text) ||
    /\b(thiet bi nay|may nay|ma thiet bi|ma may|serial|model|mot thiet bi cu the)\b/.test(
      normalized,
    )
  const mentionsFacilitySummary =
    /\b(don vi|co so|benh vien|trung tam|tong quan|tong hop|bao nhieu thiet bi|vuot dinh muc|thieu dinh muc|chua gan)\b/.test(
      normalized,
    )

  if (mentionsSpecificEquipment && !mentionsFacilitySummary) {
    return {
      kind: 'proceed',
      requestedTools: removeTool(requestedTools, QUOTA_COMPLIANCE_SUMMARY_TOOL),
    }
  }

  if (mentionsFacilitySummary && !mentionsSpecificEquipment) {
    return {
      kind: 'proceed',
      requestedTools: removeTool(requestedTools, DEVICE_QUOTA_LOOKUP_TOOL),
    }
  }

  return {
    kind: 'clarify',
    message: QUOTA_INTENT_CLARIFICATION,
  }
}

function getLatestUserText(messages: UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'user') {
      continue
    }

    const text = message.parts
      .filter(
        (
          part,
        ): part is Extract<(typeof message.parts)[number], { type: 'text'; text: string }> =>
          part.type === 'text' && typeof part.text === 'string',
      )
      .map(part => part.text.trim())
      .filter(Boolean)
      .join(' ')

    if (text) {
      return text
    }
  }

  return ''
}

function normalizeIntentText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[đĐ]/gu, 'd')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function hasEquipmentIdentifier(text: string): boolean {
  return /\b[A-Za-z]{1,8}(?:[._-][A-Za-z0-9]{2,}){2,}\b/.test(text)
}

function removeTool(requestedTools: string[], toolName: string): string[] {
  return requestedTools.filter(requestedTool => requestedTool !== toolName)
}
