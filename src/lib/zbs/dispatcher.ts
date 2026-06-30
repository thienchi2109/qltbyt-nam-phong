import { buildRepairRequestViewHref } from "@/lib/repair-request-deep-link"

/** Official ZBS phone-template endpoint used for dry-run request construction. */
export const ZALO_ZBS_PHONE_TEMPLATE_ENDPOINT = "https://business.openapi.zalo.me/message/template"
/** Placeholder used so dry-run payloads never expose the real Zalo access token. */
export const ZALO_ZBS_ACCESS_TOKEN_HEADER_PLACEHOLDER = "<ZALO_ZBS_ACCESS_TOKEN>"
/** Placeholder used until a pending outbox row carries the approved template id. */
export const ZALO_ZBS_REPAIR_TEMPLATE_ID_PLACEHOLDER = "<ZALO_ZBS_REPAIR_TEMPLATE_ID>"
/** Conservative cap for the approved `issue_summary` ZBS template field. */
export const ZBS_ISSUE_SUMMARY_MAX_LENGTH = 120

type JsonObject = Record<string, unknown>

export interface ZbsNotificationOutboxRow {
  id: string
  event_type: string
  source_type: string
  source_id: number
  don_vi_id: number
  recipient_config_id: string
  recipient_phone: string
  template_id: string | null
  template_data: JsonObject
  tracking_id: string
  status: string
  provider: string
  next_attempt_at?: string | null
}

export interface ZbsTemplateData {
  request_id: string
  equipment: string
  department: string
  requester: string
  issue_summary: string
  detail_url: string
}

export interface ZbsTemplateRequest {
  endpoint: typeof ZALO_ZBS_PHONE_TEMPLATE_ENDPOINT
  method: "POST"
  headers: {
    access_token: string
  }
  body: {
    phone: string
    template_id: string
    template_data: ZbsTemplateData
    tracking_id: string
  }
}

export interface ZbsDispatcherOptions {
  appBaseUrl?: string
  dispatchEnabled?: boolean
  accessTokenHeader?: string
  repairTemplateId?: string
}

export interface ZbsDryRunDispatch {
  outbox_id: string
  dispatch_state: "dry-run" | "disabled-dispatch"
  would_send_live_request: false
  reason: string
  request: ZbsTemplateRequest
}

/** Minimal column list needed to build inspectable pending ZBS dry-run payloads. */
export const ZBS_PENDING_OUTBOX_SELECT =
  "id,event_type,source_type,source_id,don_vi_id,recipient_config_id,recipient_phone,template_id,template_data,tracking_id,status,provider,next_attempt_at"

interface ZbsPendingOutboxQuery {
  eq(column: string, value: string): ZbsPendingOutboxQuery
  lte(column: string, value: string): ZbsPendingOutboxQuery
  order(column: string, options: { ascending: boolean }): ZbsPendingOutboxQuery
  limit(count: number): Promise<{
    data: ZbsNotificationOutboxRow[] | null
    error: { message?: string } | null
  }>
}

interface ZbsOutboxTableQuery {
  select(columns: string): ZbsPendingOutboxQuery
}

interface ZbsOutboxClient {
  from(table: "zbs_notification_outbox"): ZbsOutboxTableQuery
}

export interface ReadPendingZbsOutboxRowsOptions {
  now?: Date
  limit?: number
}

function compactPhone(value: string): string {
  return value.trim().replace(/[\s().-]/g, "")
}

/** Normalizes supported Vietnam phone inputs into ZBS country-code digits. */
export function normalizeZbsPhoneNumber(value: string): string {
  const compacted = compactPhone(value)
  const normalized = compacted.startsWith("+84")
    ? compacted.slice(1)
    : compacted.startsWith("0")
      ? `84${compacted.slice(1)}`
      : compacted

  if (!/^84[0-9]{8,13}$/.test(normalized)) {
    throw new Error("Invalid ZBS recipient phone")
  }

  return normalized
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function numberOrStringValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }

  return stringValue(value)
}

function firstPresent(...values: string[]): string {
  return values.find((value) => value.length > 0) ?? "Khong ro"
}

function truncateIssueSummary(value: string): string {
  const summary = firstPresent(value, "Yeu cau sua chua thiet bi moi")

  if (summary.length <= ZBS_ISSUE_SUMMARY_MAX_LENGTH) {
    return summary
  }

  return `${summary.slice(0, ZBS_ISSUE_SUMMARY_MAX_LENGTH - 3).trimEnd()}...`
}

function equipmentLabel(templateData: JsonObject): string {
  const equipmentName = stringValue(templateData.equipment_name)
  const equipmentCode = stringValue(templateData.equipment_code)

  if (equipmentName && equipmentCode) {
    return `${equipmentName} (${equipmentCode})`
  }

  return firstPresent(equipmentName, equipmentCode)
}

function joinBaseUrl(appBaseUrl: string, href: string): string {
  return `${appBaseUrl.replace(/\/+$/, "")}${href}`
}

function buildDetailUrl(row: ZbsNotificationOutboxRow, appBaseUrl?: string) {
  const requestId = Number(row.source_id)
  const href = buildRepairRequestViewHref(requestId)

  return appBaseUrl ? joinBaseUrl(appBaseUrl, href) : href
}

/** Maps Phase 1 internal repair outbox snapshots to approved ZBS template fields. */
export function mapRepairRequestTemplateData(
  row: ZbsNotificationOutboxRow,
  options: Pick<ZbsDispatcherOptions, "appBaseUrl"> = {}
): ZbsTemplateData {
  const templateData = row.template_data
  const requestId = numberOrStringValue(templateData.repair_request_id) || String(row.source_id)

  return {
    request_id: requestId,
    equipment: equipmentLabel(templateData),
    department: firstPresent(
      stringValue(templateData.department),
      stringValue(templateData.ten_don_vi_thue),
      stringValue(templateData.don_vi_thuc_hien)
    ),
    requester: firstPresent(stringValue(templateData.requester)),
    issue_summary: truncateIssueSummary(stringValue(templateData.issue_description)),
    detail_url: buildDetailUrl(row, options.appBaseUrl),
  }
}

/** Builds the exact inspectable ZBS phone-template request without sending it. */
export function buildZbsTemplateRequest(
  row: ZbsNotificationOutboxRow,
  options: ZbsDispatcherOptions = {}
): ZbsTemplateRequest {
  return {
    endpoint: ZALO_ZBS_PHONE_TEMPLATE_ENDPOINT,
    method: "POST",
    headers: {
      access_token: options.accessTokenHeader ?? ZALO_ZBS_ACCESS_TOKEN_HEADER_PLACEHOLDER,
    },
    body: {
      phone: normalizeZbsPhoneNumber(row.recipient_phone),
      template_id:
        row.template_id ?? options.repairTemplateId ?? ZALO_ZBS_REPAIR_TEMPLATE_ID_PLACEHOLDER,
      template_data: mapRepairRequestTemplateData(row, options),
      tracking_id: row.tracking_id,
    },
  }
}

function isPendingRepairRequestNotification(row: ZbsNotificationOutboxRow) {
  return (
    row.status === "pending" &&
    row.provider === "zalo_zbs" &&
    row.event_type === "repair_request_created" &&
    row.source_type === "repair_request"
  )
}

/** Builds dry-run dispatch records for pending repair-request ZBS outbox rows. */
export function buildZbsDryRunDispatches(
  rows: readonly ZbsNotificationOutboxRow[],
  options: ZbsDispatcherOptions = {}
): ZbsDryRunDispatch[] {
  const dispatchState = options.dispatchEnabled ? "dry-run" : "disabled-dispatch"
  const reason = options.dispatchEnabled
    ? "Dry-run request construction only"
    : "ZALO_ZBS_DISPATCH_ENABLED is not true"

  return rows.filter(isPendingRepairRequestNotification).map((row) => ({
    outbox_id: row.id,
    dispatch_state: dispatchState,
    would_send_live_request: false,
    reason,
    request: buildZbsTemplateRequest(row, options),
  }))
}

/** Reads pending repair-request ZBS outbox rows from a service-role Supabase client. */
export async function readPendingZbsOutboxRows(
  client: ZbsOutboxClient,
  options: ReadPendingZbsOutboxRowsOptions = {}
): Promise<ZbsNotificationOutboxRow[]> {
  const limit = options.limit ?? 25
  const now = options.now ?? new Date()
  const result = await client
    .from("zbs_notification_outbox")
    .select(ZBS_PENDING_OUTBOX_SELECT)
    .eq("status", "pending")
    .eq("provider", "zalo_zbs")
    .eq("event_type", "repair_request_created")
    .eq("source_type", "repair_request")
    .lte("next_attempt_at", now.toISOString())
    .order("created_at", { ascending: true })
    .limit(limit)

  if (result.error) {
    throw new Error(
      `Failed to read pending ZBS outbox rows: ${result.error.message ?? "unknown error"}`
    )
  }

  return result.data ?? []
}
