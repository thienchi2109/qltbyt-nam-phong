import type { UIMessage } from 'ai'
import { getLatestUserText } from './tools/equipment-lookup-identifiers'
import { hasRepairRequestDraftStartIntent } from './draft/repair-request-draft-session'

const EQUIPMENT_LOOKUP_TOOL = 'equipmentLookup'
const REPAIR_SUMMARY_TOOL = 'repairSummary'
const DEVICE_QUOTA_LOOKUP_TOOL = 'deviceQuotaLookup'
const QUOTA_COMPLIANCE_SUMMARY_TOOL = 'quotaComplianceSummary'

const REPAIR_INTENT_CLARIFICATION =
  'Anh/chị muốn xem trạng thái thiết bị hay tình trạng các yêu cầu sửa chữa/phiếu sửa chữa?'

const QUOTA_INTENT_CLARIFICATION =
  'Anh/chị muốn kiểm tra định mức cho một thiết bị cụ thể hay xem tổng quan định mức của đơn vị?'

const EQUIPMENT_LOOKUP_CLARIFICATION =
  'Anh/chị muốn tra cứu thiết bị nào? Vui lòng cung cấp tên thiết bị cụ thể, mã thiết bị, model hoặc số serial trước khi tôi tra cứu.'

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

  const equipmentLookupDecision = classifyEquipmentLookupIntent(latestUserText, requestedTools)
  if (equipmentLookupDecision) {
    return equipmentLookupDecision
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

  if (hasRepairRequestDraftStartIntent(text)) {
    return {
      kind: 'proceed',
      requestedTools,
    }
  }

  const mentionsRepairRequest = /\b(phieu|yeu cau|don|ticket)\b/.test(normalized)
  const mentionsRepairWorkflow =
    /\b(xu ly|tiep nhan|ton dong|dang mo|da dong|hoan thanh)\b/.test(normalized)
  const mentionsEquipmentStatus =
    /\b(trang thai|tinh trang|cho sua chua|dang sua chua|hong)\b/.test(normalized) ||
    /\bbao nhieu thiet bi\b/.test(normalized)

  if (mentionsRepairRequest || (mentionsRepairWorkflow && !mentionsEquipmentStatus)) {
    return {
      kind: 'proceed',
      requestedTools: removeTool(requestedTools, EQUIPMENT_LOOKUP_TOOL),
    }
  }

  if (mentionsEquipmentStatus) {
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

function classifyEquipmentLookupIntent(
  text: string,
  requestedTools: string[],
): ChatIntentRoutingResult | null {
  if (!requestedTools.includes(EQUIPMENT_LOOKUP_TOOL)) {
    return null
  }

  const normalized = normalizeIntentText(text)
  const mentionsLookupIntent =
    /\b(tra cuu|tim|xem|kiem tra|thong tin|chi tiet|ho so)\b/.test(normalized)
  const mentionsEquipment = /\b(thiet bi|may)\b/.test(normalized)

  if (!mentionsLookupIntent || !mentionsEquipment) {
    return null
  }

  if (hasEquipmentIdentifier(text) || hasSpecificEquipmentDescriptor(normalized)) {
    if (shouldNarrowToEquipmentLookup(normalized, requestedTools)) {
      return {
        kind: 'proceed',
        requestedTools: keepOnlyTool(requestedTools, EQUIPMENT_LOOKUP_TOOL),
      }
    }
    return null
  }

  return {
    kind: 'clarify',
    message: EQUIPMENT_LOOKUP_CLARIFICATION,
  }
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

const EQUIPMENT_IDENTIFIER_RE = /\b[A-Za-z]{1,8}(?:[._-][A-Za-z0-9]{2,}){1,}\b/g
const GENERIC_EQUIPMENT_LOOKUP_TOKENS = new Set([
  'tra',
  'cuu',
  'thong',
  'tin',
  'xem',
  'tim',
  'kiem',
  'tra',
  'chi',
  'tiet',
  'ho',
  'so',
  'thiet',
  'bi',
  'may',
  'toi',
  'giup',
  'cho',
  'voi',
  'mot',
  'moi',
  'nay',
  'kia',
  'do',
  'nao',
  'can',
  'muon',
  'x',
  'xxx',
])

function hasEquipmentIdentifier(text: string): boolean {
  for (const [token] of text.matchAll(EQUIPMENT_IDENTIFIER_RE)) {
    if (/\d/.test(token)) {
      return true
    }
  }
  return false
}

function hasSpecificEquipmentDescriptor(normalizedText: string): boolean {
  const meaningfulTokens = normalizedText
    .split(/\s+/)
    .filter(token => token.length > 1 && !GENERIC_EQUIPMENT_LOOKUP_TOKENS.has(token))

  return meaningfulTokens.length > 0
}

function shouldNarrowToEquipmentLookup(
  normalizedText: string,
  requestedTools: string[],
): boolean {
  if (!requestedTools.includes(EQUIPMENT_LOOKUP_TOOL)) {
    return false
  }

  const mentionsLookupIntent =
    /\b(tra cuu|tim|xem|kiem tra|thong tin|chi tiet|ho so)\b/.test(normalizedText)
  const mentionsMaintenance =
    /\b(bao tri|hieu chuan|ke hoach bao tri|den han)\b/.test(normalizedText)
  const mentionsRepair =
    /\b(sua chua|phieu sua chua|yeu cau sua chua|hong|su co)\b/.test(normalizedText)
  const mentionsUsage = /\b(lich su su dung|su dung)\b/.test(normalizedText)
  const mentionsAttachment = /\b(tai lieu|dinh kem|file|huong dan)\b/.test(normalizedText)
  const mentionsQuota = /\b(dinh muc|quota)\b/.test(normalizedText)

  return (
    mentionsLookupIntent &&
    !mentionsMaintenance &&
    !mentionsRepair &&
    !mentionsUsage &&
    !mentionsAttachment &&
    !mentionsQuota
  )
}

function removeTool(requestedTools: string[], toolName: string): string[] {
  return requestedTools.filter(requestedTool => requestedTool !== toolName)
}

function keepOnlyTool(requestedTools: string[], toolName: string): string[] {
  return requestedTools.filter(requestedTool => requestedTool === toolName)
}
