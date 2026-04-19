import type { UIMessage } from 'ai'
import { ASSISTANT_SQL_TOOL_NAME } from './sql/constants'
import { getLatestUserText } from './tools/equipment-lookup-identifiers'
import { hasRepairRequestDraftStartIntent } from './draft/repair-request-draft-session'
import {
  getQueryCatalogToolsByRoutingGroup,
  type QueryCatalogToolName,
} from './tools/query-catalog'

const EQUIPMENT_LOOKUP_TOOL: QueryCatalogToolName = 'equipmentLookup'
const REPAIR_SUMMARY_TOOL: QueryCatalogToolName = 'repairSummary'
const DEVICE_QUOTA_LOOKUP_TOOL: QueryCatalogToolName = 'deviceQuotaLookup'
const QUOTA_COMPLIANCE_SUMMARY_TOOL: QueryCatalogToolName =
  'quotaComplianceSummary'

const REPAIR_ROUTING_TOOLS = getQueryCatalogToolsByRoutingGroup('repair')
const QUOTA_ROUTING_TOOLS = getQueryCatalogToolsByRoutingGroup('quota')

const REPAIR_INTENT_CLARIFICATION =
  'Anh/chị muốn xem trạng thái thiết bị hay tình trạng các yêu cầu sửa chữa/phiếu sửa chữa?'

const QUOTA_INTENT_CLARIFICATION =
  'Anh/chị muốn kiểm tra định mức cho một thiết bị cụ thể hay xem tổng quan định mức của đơn vị?'

const EQUIPMENT_LOOKUP_CLARIFICATION =
  'Anh/chị muốn tra cứu thiết bị nào? Vui lòng cung cấp tên thiết bị cụ thể, mã thiết bị, model hoặc số serial trước khi tôi tra cứu.'

const MIXED_CURATED_INTENT_CLARIFICATION =
  'Anh/chị muốn ưu tiên ý chính nào: sửa chữa, định mức, hay tra cứu thiết bị? Vui lòng chọn một nội dung trước để tôi dùng đúng công cụ.'

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
  const nonSqlRequestedTools = holdBackQueryDatabase(requestedTools)
  const latestUserText = getLatestUserText(messages)
  if (!latestUserText) {
    return {
      kind: 'proceed',
      requestedTools: nonSqlRequestedTools,
    }
  }

  const repairDecision = classifyRepairIntent(latestUserText, nonSqlRequestedTools)
  if (hasRepairRequestDraftStartIntent(latestUserText) && repairDecision) {
    return repairDecision
  }

  const curatedDecisions = [
    buildCuratedDecision(repairDecision),
    buildCuratedDecision(classifyQuotaIntent(latestUserText, nonSqlRequestedTools)),
    buildCuratedDecision(
      classifyEquipmentLookupIntent(latestUserText, nonSqlRequestedTools),
    ),
  ].filter((decision): decision is CuratedRoutingDecision => decision !== null)

  if (curatedDecisions.length > 1) {
    return {
      kind: 'clarify',
      message: MIXED_CURATED_INTENT_CLARIFICATION,
    }
  }

  if (curatedDecisions.length === 1) {
    return curatedDecisions[0].result
  }

  const sqlReportingDecision = classifyAssistantSqlReportingIntent(
    latestUserText,
    requestedTools,
  )
  if (sqlReportingDecision) {
    return sqlReportingDecision
  }

  return {
    kind: 'proceed',
    requestedTools: holdBackQueryDatabase(requestedTools),
  }
}

interface CuratedRoutingDecision {
  result: ChatIntentRoutingResult
}

function buildCuratedDecision(
  result: ChatIntentRoutingResult | null,
): CuratedRoutingDecision | null {
  return result ? { result } : null
}

function classifyRepairIntent(
  text: string,
  requestedTools: string[],
): ChatIntentRoutingResult | null {
  if (!hasAllRequestedTools(requestedTools, REPAIR_ROUTING_TOOLS)) {
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
  if (!hasAllRequestedTools(requestedTools, QUOTA_ROUTING_TOOLS)) {
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

function classifyAssistantSqlReportingIntent(
  text: string,
  requestedTools: string[],
): ChatIntentRoutingResult | null {
  if (
    !requestedTools.includes(ASSISTANT_SQL_TOOL_NAME) ||
    requestedTools.every(toolName => toolName === ASSISTANT_SQL_TOOL_NAME)
  ) {
    return null
  }

  if (hasEquipmentIdentifier(text)) {
    return null
  }

  const normalized = normalizeIntentText(text)
  const mentionsReportingIntent =
    /\b(bao cao|thong ke|tong hop|phan bo|top|xep hang|xu huong|ty le)\b/.test(
      normalized,
    )
  const mentionsReportingSubject =
    /\b(thiet bi|bao tri|hieu chuan|kiem dinh|sua chua|su dung|dinh muc|trang thai|don vi|co so|khoa|phong)\b/.test(
      normalized,
    )
  const mentionsSpecificItem =
    /\b(ma thiet bi|serial|model|thiet bi nay|may nay|mot thiet bi cu the)\b/.test(
      normalized,
    )

  if (!mentionsReportingIntent || !mentionsReportingSubject || mentionsSpecificItem) {
    return null
  }

  return {
    kind: 'proceed',
    requestedTools: [ASSISTANT_SQL_TOOL_NAME],
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
  const mentionsReporting =
    /\b(bao cao|thong ke|tong hop|phan bo|top|xep hang|xu huong|ty le)\b/.test(
      normalizedText,
    )

  return (
    mentionsLookupIntent &&
    !mentionsMaintenance &&
    !mentionsRepair &&
    !mentionsUsage &&
    !mentionsAttachment &&
    !mentionsQuota &&
    !mentionsReporting
  )
}

function removeTool(requestedTools: string[], toolName: string): string[] {
  return requestedTools.filter(requestedTool => requestedTool !== toolName)
}

function hasAllRequestedTools(
  requestedTools: string[],
  requiredTools: readonly string[],
): boolean {
  return requiredTools.every(toolName => requestedTools.includes(toolName))
}

function keepOnlyTool(requestedTools: string[], toolName: string): string[] {
  return requestedTools.filter(requestedTool => requestedTool === toolName)
}

function holdBackQueryDatabase(requestedTools: string[]): string[] {
  if (
    !requestedTools.includes(ASSISTANT_SQL_TOOL_NAME) ||
    requestedTools.every(toolName => toolName === ASSISTANT_SQL_TOOL_NAME)
  ) {
    return requestedTools
  }

  return removeTool(requestedTools, ASSISTANT_SQL_TOOL_NAME)
}
