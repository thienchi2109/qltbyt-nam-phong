import "server-only"

import { z } from "zod"

import { isPrivilegedRole } from "@/lib/rbac"
import { QUERY_CATALOG } from "@/lib/ai/tools/query-catalog"
import {
  verifyGoBffBrokerToken,
  type GoBffBrokerClaims,
} from "@/lib/ai/go-bff/GoBffBrokerCredential"
import type { SupabaseRpcUser } from "@/lib/ai/server-rpc"

/** Acceptable request-id format for broker correlation. */
export const BROKER_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/
/** Maximum request body size accepted by the broker. */
export const BROKER_MAX_BODY_BYTES = 64 * 1024
/** Maximum successful response size emitted by the broker. */
export const BROKER_MAX_RESPONSE_BYTES = 64 * 1024
/** Maximum error response size emitted by the broker. */
export const BROKER_MAX_ERROR_BYTES = 8 * 1024
/** Maximum time allowed for one upstream RPC call. */
export const BROKER_RPC_TIMEOUT_MS = 5_000

/** RPC names exposed through the internal broker boundary. */
export const BROKER_RPC_ALLOWLIST = [
  "ai_equipment_lookup",
  "ai_maintenance_summary",
  "ai_maintenance_plan_lookup",
  "ai_repair_summary",
  "ai_usage_summary",
  "ai_attachment_metadata",
  "ai_device_quota_lookup",
  "ai_quota_compliance_summary",
  "ai_category_suggestion",
  "ai_department_list",
  "assistant_query_database_audit_log",
  "ai_quota_reserve",
  "ai_quota_finalize",
  "ai_kill_switch_status",
] as const

export type BrokerRpc = (typeof BROKER_RPC_ALLOWLIST)[number]
export type BrokerOperation = "call" | "cleanup"

const auditInput = z
  .object({
    p_status: z.enum(["success", "failure"]),
    p_tool_path: z.literal("query_database"),
    p_sql_shape: z.string().trim().min(1).max(1000),
    p_latency_ms: z.number().int().nonnegative(),
    p_row_count: z.number().int().nonnegative().optional(),
    p_payload_bytes: z.number().int().nonnegative().optional(),
    p_error_class: z.string().trim().min(1).optional(),
  })
  .strict()

const reserveInput = z
  .object({
    p_rate_window_ms: z.number().int().positive(),
    p_rate_max: z.number().int().nonnegative(),
    p_user_daily_max: z.number().int().nonnegative(),
    p_tenant_daily_max: z.number().int().nonnegative(),
    p_global_daily_max: z.number().int().nonnegative(),
    p_ttl_ms: z.number().int().positive(),
  })
  .strict()

const finalizeInput = z
  .object({
    p_reservation_id: z.string().trim().min(1),
    p_status: z.enum(["success", "error_with_usage", "error_no_usage"]),
    p_tokens_in: z.number().int().nonnegative(),
    p_tokens_out: z.number().int().nonnegative(),
    p_cost_usd: z.number().nonnegative(),
  })
  .strict()

const emptyInput = z.object({}).strict()

/** Strict input schemas for every allowlisted broker RPC. */
export const BROKER_INPUT_SCHEMAS: Readonly<Record<BrokerRpc, z.ZodType<Record<string, unknown>>>> =
  {
    ai_equipment_lookup: QUERY_CATALOG.equipmentLookup.inputSchema,
    ai_maintenance_summary: QUERY_CATALOG.maintenanceSummary.inputSchema,
    ai_maintenance_plan_lookup: QUERY_CATALOG.maintenancePlanLookup.inputSchema,
    ai_repair_summary: QUERY_CATALOG.repairSummary.inputSchema,
    ai_usage_summary: QUERY_CATALOG.usageHistory.inputSchema,
    ai_attachment_metadata: QUERY_CATALOG.attachmentLookup.inputSchema,
    ai_device_quota_lookup: QUERY_CATALOG.deviceQuotaLookup.inputSchema,
    ai_quota_compliance_summary: QUERY_CATALOG.quotaComplianceSummary.inputSchema,
    ai_category_suggestion: QUERY_CATALOG.categorySuggestion.inputSchema,
    ai_department_list: QUERY_CATALOG.departmentList.inputSchema,
    assistant_query_database_audit_log: auditInput,
    ai_quota_reserve: reserveInput,
    ai_quota_finalize: finalizeInput,
    ai_kill_switch_status: emptyInput,
  }

const protectedPayloadKeys = new Set([
  "p_user_id",
  "p_tenant_id",
  "p_don_vi",
  "p_requested_facility_id",
  "p_session_facility_id",
  "p_effective_facility_id",
  "p_raw_role",
  "p_facility_source",
  "role",
  "tenant",
  "facility",
  "signing_secret",
  "supabase_jwt_secret",
])

/** Typed HTTP error returned for invalid or rejected broker requests. */
export class BrokerRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly retryable: boolean

  constructor(status: number, code: string, retryable = false) {
    super(code)
    this.name = "BrokerRequestError"
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

export interface BrokerRequestBody {
  protocol_version: "v1"
  request_id: string
  operation: BrokerOperation
  rpc: BrokerRpc
  payload: Record<string, unknown>
}

export interface BrokerScope {
  claims: GoBffBrokerClaims
  user: SupabaseRpcUser
  effectiveFacilityId?: number
  facilitySource?: "selected" | "session"
}

/** Returns whether a header value is a valid broker request id. */
export function isBrokerRequestId(value: string | null): value is string {
  return value !== null && BROKER_REQUEST_ID_PATTERN.test(value)
}

/** Narrows unknown values to plain object-like records. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Validates and normalizes the broker envelope and RPC payload. */
export function parseBrokerRequestBody(value: unknown): BrokerRequestBody {
  if (!isRecord(value)) throw new BrokerRequestError(400, "invalid_request")
  if (typeof value.rpc !== "string" || !BROKER_RPC_ALLOWLIST.includes(value.rpc as BrokerRpc)) {
    throw new BrokerRequestError(403, "forbidden")
  }
  const parsedEnvelope = z
    .object({
      protocol_version: z.literal("v1"),
      request_id: z.string().regex(BROKER_REQUEST_ID_PATTERN),
      operation: z.enum(["call", "cleanup"]),
      rpc: z.literal(value.rpc as BrokerRpc),
      payload: z.record(z.unknown()).refine(isRecord),
    })
    .strict()
    .safeParse(value)
  if (!parsedEnvelope.success) throw new BrokerRequestError(400, "invalid_request")

  const body = parsedEnvelope.data as BrokerRequestBody
  if (body.operation === "cleanup" && !isCleanupRpc(body.rpc)) {
    throw new BrokerRequestError(403, "forbidden")
  }
  if (body.operation === "call" && body.rpc === "ai_quota_finalize") {
    throw new BrokerRequestError(403, "forbidden")
  }
  if (
    Object.keys(body.payload).some((key) => {
      const normalized = key.toLowerCase()
      return protectedPayloadKeys.has(normalized) || normalized.includes("supabase_jwt_secret")
    })
  ) {
    throw new BrokerRequestError(403, "forbidden")
  }
  const parsedPayload = BROKER_INPUT_SCHEMAS[body.rpc].safeParse(body.payload)
  if (!parsedPayload.success) throw new BrokerRequestError(400, "invalid_request")
  if (
    body.rpc === "assistant_query_database_audit_log" &&
    ((parsedPayload.data.p_status === "failure" && !parsedPayload.data.p_error_class) ||
      (parsedPayload.data.p_status === "success" && parsedPayload.data.p_error_class !== undefined))
  ) {
    throw new BrokerRequestError(400, "invalid_request")
  }
  return { ...body, payload: parsedPayload.data }
}

/** Returns whether an RPC is reserved for cleanup operations. */
export function isCleanupRpc(rpc: BrokerRpc): boolean {
  return rpc === "assistant_query_database_audit_log" || rpc === "ai_quota_finalize"
}

/** Derives the effective user and facility scope from broker claims. */
export function deriveBrokerScope(claims: GoBffBrokerClaims): BrokerScope {
  if (!claims.role?.trim()) throw new BrokerRequestError(401, "unauthorized")
  const role = claims.role.trim()
  const effectiveFacilityId =
    isPrivilegedRole(role) && claims.requested_facility_id !== undefined
      ? claims.requested_facility_id
      : claims.session_facility_id
  const facilitySource =
    isPrivilegedRole(role) && claims.requested_facility_id !== undefined
      ? "selected"
      : claims.session_facility_id === undefined
        ? undefined
        : "session"

  return {
    claims,
    effectiveFacilityId,
    facilitySource,
    user: {
      id: String(claims.user_id),
      role,
      ...(effectiveFacilityId === undefined ? {} : { don_vi: effectiveFacilityId }),
      ...(claims.session_facility_id === undefined
        ? {}
        : { current_don_vi: claims.session_facility_id }),
    },
  }
}

function requiresFacilityScope(rpc: BrokerRpc): boolean {
  return !["ai_quota_reserve", "ai_quota_finalize", "ai_kill_switch_status"].includes(rpc)
}

/** Builds the server-RPC arguments for a validated broker request. */
export function buildBrokerRpcCall(
  body: BrokerRequestBody,
  scope: BrokerScope
): Record<string, unknown> {
  if (requiresFacilityScope(body.rpc) && scope.effectiveFacilityId === undefined) {
    throw new BrokerRequestError(403, "forbidden")
  }
  const payload = body.payload
  const base = { ...payload }
  switch (body.rpc) {
    case "ai_equipment_lookup":
    case "ai_maintenance_summary":
    case "ai_repair_summary":
    case "ai_maintenance_plan_lookup":
    case "ai_usage_summary":
    case "ai_attachment_metadata":
    case "ai_device_quota_lookup":
      return {
        ...base,
        p_don_vi: scope.effectiveFacilityId,
        p_user_id: String(scope.claims.user_id),
      }
    case "ai_quota_compliance_summary":
    case "ai_department_list":
      return {
        p_don_vi: scope.effectiveFacilityId,
        p_user_id: String(scope.claims.user_id),
      }
    case "ai_category_suggestion":
      return {
        p_device_name: payload.device_name,
        p_don_vi: scope.effectiveFacilityId,
        p_user_id: String(scope.claims.user_id),
        p_top_k: 10,
      }
    case "assistant_query_database_audit_log":
      return {
        ...base,
        p_effective_facility_id: scope.effectiveFacilityId,
        p_facility_source: scope.facilitySource,
        p_requested_facility_id: scope.claims.requested_facility_id ?? null,
        p_session_facility_id: scope.claims.session_facility_id ?? null,
        p_raw_role: scope.claims.role,
      }
    case "ai_quota_reserve":
      return {
        ...base,
        p_user_id: String(scope.claims.user_id),
        p_tenant_id: scope.effectiveFacilityId ?? null,
      }
    case "ai_quota_finalize":
    case "ai_kill_switch_status":
      return base
  }
}

/** Verifies the broker HMAC token and derives its request scope. */
export function verifyBrokerToken(token: string, nowSeconds?: number): BrokerScope {
  const secret = process.env.AI_SERVICE_BFF_BROKER_SECRET
  if (!secret?.trim()) throw new BrokerRequestError(503, "unavailable", true)
  try {
    return deriveBrokerScope(verifyGoBffBrokerToken(token, secret, nowSeconds))
  } catch {
    throw new BrokerRequestError(401, "unauthorized")
  }
}
