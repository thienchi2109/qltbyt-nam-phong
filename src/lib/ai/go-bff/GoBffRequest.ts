import { validateUIMessages, type UIMessage } from "ai"

import { chatRequestSchema } from "@/lib/ai/chat-request-schema"
import { resolveAssistantScope } from "@/lib/ai/sql/scope"
import { validateRequestedTools } from "@/lib/ai/tools/registry"

import { mintGoBffBrokerToken } from "./GoBffBrokerCredential"
import { buildGoBffCanonicalString, signGoBffCanonicalString } from "./GoBffCanonicalRequest"
import type { GoBffConfig } from "./GoBffConfig"

const ALLOWED_CHAT_ROLES = new Set([
  "global",
  "admin",
  "regional_leader",
  "to_qltb",
  "technician",
  "qltb_khoa",
  "user",
])

export interface GoBffRequestUser {
  id?: unknown
  role?: unknown
  don_vi?: unknown
  khoa_phong?: unknown
  dia_ban_id?: unknown
}

export interface GoBffRequestInput {
  config: GoBffConfig
  requestId: string
  nowSeconds?: number
  user: GoBffRequestUser
  payload: unknown
}

export interface GoBffSignedRequest {
  rawBody: string
  signature: string
  timestamp: string
  requestId: string
  keyId: string
}

function positiveInteger(value: unknown): number | undefined {
  const normalized =
    typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : undefined
}

function roleValue(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function canonicalPartText(part: Record<string, unknown>): string {
  if (typeof part.text === "string") {
    return part.text
  }
  const value = part.output ?? part.input ?? part.data
  if (value === undefined) {
    return ""
  }
  try {
    return JSON.stringify(value)
  } catch {
    return "[unavailable tool output]"
  }
}

function canonicalMessages(messages: UIMessage[]): Array<Record<string, unknown>> {
  return messages.map((message) => {
    const contentParts: string[] = []
    const toolCalls: Array<Record<string, string>> = []

    for (const rawPart of message.parts) {
      const part = rawPart as unknown as Record<string, unknown>
      if (part.type === "text") {
        const text = canonicalPartText(part)
        if (text) contentParts.push(text)
        continue
      }
      if (typeof part.type === "string" && part.type.startsWith("tool-")) {
        const toolName = typeof part.toolName === "string" ? part.toolName : part.type.slice(5)
        const toolCallId = typeof part.toolCallId === "string" ? part.toolCallId : toolName
        const input = part.input ?? part.output ?? {}
        let argumentsText = "{}"
        try {
          argumentsText = JSON.stringify(input)
        } catch {
          argumentsText = "{}"
        }
        toolCalls.push({ id: toolCallId, name: toolName, arguments: argumentsText })
        const partText = canonicalPartText(part)
        if (partText) contentParts.push(`[${toolName}] ${partText}`)
        continue
      }
      const partText = canonicalPartText(part)
      if (partText) contentParts.push(partText)
    }

    const content = contentParts.join("\n")
    const result: Record<string, unknown> = {
      role: message.role,
      content,
    }
    if (toolCalls.length > 0) {
      result.tool_calls = toolCalls
    }
    return result
  })
}

function numericUserId(value: unknown): number {
  const result = positiveInteger(value)
  if (result === undefined) {
    throw new Error("Authenticated session user id must be numeric.")
  }
  return result
}

function safeRequestId(value: string): string {
  return /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : ""
}

/** Validates the browser contract and builds the exact signed Go envelope. */
export async function buildGoBffRequest(
  input: GoBffRequestInput
): Promise<GoBffSignedRequest & { body: Record<string, unknown> }> {
  const requestId = safeRequestId(input.requestId)
  if (!requestId) {
    throw new Error("Dark chat request id is invalid.")
  }
  const role = roleValue(input.user.role)
  if (!ALLOWED_CHAT_ROLES.has(role)) {
    throw new Error("Authenticated session role is not allowed.")
  }
  if (!input.user.id) {
    throw new Error("Authenticated session user id is missing.")
  }

  const parsed = chatRequestSchema.safeParse(input.payload)
  if (!parsed.success) {
    throw new Error("Invalid request payload.")
  }
  const requestedToolsValidation = validateRequestedTools(parsed.data.requestedTools ?? [])
  if (!requestedToolsValidation.ok) {
    throw new Error(requestedToolsValidation.message)
  }
  const validatedMessages = await validateUIMessages({
    messages: parsed.data.messages as UIMessage[],
  })
  const requestedTools = requestedToolsValidation.requestedTools
  const user = input.user as Record<string, unknown>
  const scope = resolveAssistantScope({
    user,
    requestedFacilityId: parsed.data.selectedFacilityId,
    requireFacilityScope: requestedTools.length > 0,
  })
  if (!scope.ok) {
    throw new Error(scope.message)
  }

  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const userId = numericUserId(input.user.id)
  const sessionFacilityId = positiveInteger(input.user.don_vi)
  const requestedFacilityId = positiveInteger(parsed.data.selectedFacilityId)
  const brokerToken = mintGoBffBrokerToken({
    secret: input.config.brokerSecret,
    nowSeconds,
    userId,
    role,
    sessionFacilityId,
    requestedFacilityId,
  })
  const identity = {
    issuer: "nextjs-bff",
    audience: "ai-service-v1",
    subject: String(userId),
    tenant: "qltbyt",
    issued_at: nowSeconds,
    expires_at: nowSeconds + 120,
    trusted_app: { app_id: "qltbyt", capability_ids: ["assistant-chat"] },
    capability_claims: {
      broker_token: brokerToken,
      user_id: userId,
      role,
      session_facility_id: sessionFacilityId ?? null,
      requested_facility_id: requestedFacilityId ?? null,
    },
  }
  const body: Record<string, unknown> = {
    protocol_version: "v1",
    app_id: "qltbyt",
    capability_id: "assistant-chat",
    capability_version: "v1",
    request_id: requestId,
    identity,
    messages: canonicalMessages(validatedMessages),
    requested_tools: requestedTools,
    context: {
      selected_facility_id: scope.selectedFacilityId ?? null,
      selected_facility_name: parsed.data.selectedFacilityName ?? null,
      role,
      khoa_phong: typeof input.user.khoa_phong === "string" ? input.user.khoa_phong : null,
      dia_ban_id: positiveInteger(input.user.dia_ban_id) ?? null,
    },
  }
  const rawBody = JSON.stringify(body)
  const timestamp = String(nowSeconds)
  const canonical = buildGoBffCanonicalString({
    timestamp,
    requestId,
    keyId: input.config.hmacKeyId,
    rawBody,
  })
  return {
    body,
    rawBody,
    signature: signGoBffCanonicalString(input.config.hmacSecret, canonical),
    timestamp,
    requestId,
    keyId: input.config.hmacKeyId,
  }
}

/** Checks whether a session role may use the dark assistant path. */
export function isAllowedDarkChatRole(value: unknown): boolean {
  const role = roleValue(value)
  return ALLOWED_CHAT_ROLES.has(role)
}
