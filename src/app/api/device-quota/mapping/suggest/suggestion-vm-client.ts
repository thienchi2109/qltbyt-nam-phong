import {
  getPayloadDetails,
  getPayloadMessage,
  SuggestionRouteError,
} from "@/app/api/device-quota/mapping/suggest/suggestion-errors"
import { getRequiredEnv } from "@/app/api/device-quota/mapping/suggest/suggestion-utils"

export type VmSuggestRequest = {
  requestId: string
  facilityId: number
  catalogSignature: string
  unassignedSignature: string
  deviceNames: { name: string; deviceIds: number[] }[]
  categories: { id: number; code: string | null; name: string; classification: string | null }[]
  options: {
    topK: number
    semanticWeight?: number
    lexicalWeight?: number
    minConfidence?: number
    minMargin?: number
  }
}

export type VmSuggestResponse = {
  requestId: string
  provider?: {
    name?: string
    version?: string
    model?: string
  }
  timings?: Record<string, unknown>
  metrics?: Record<string, unknown>
  cache?: Record<string, unknown>
  suggestions: {
    deviceName: string
    deviceIds: number[]
    candidates: {
      categoryId: number
      categoryCode: string | null
      categoryName: string
      classification: string | null
      score: number
    }[]
  }[]
}

type VmClientConfig = {
  baseUrl: string
  cfAccessClientId: string
  cfAccessClientSecret: string
  internalToken: string
  timeoutMs: number
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function stripTrailingSlashes(value: string): string {
  let end = value.length
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1
  }
  return value.slice(0, end)
}

function getVmClientConfig(): VmClientConfig {
  return {
    baseUrl: stripTrailingSlashes(getRequiredEnv("DEVICE_QUOTA_VM_BASE_URL")),
    cfAccessClientId: getRequiredEnv("DEVICE_QUOTA_VM_CF_ACCESS_CLIENT_ID"),
    cfAccessClientSecret: getRequiredEnv("DEVICE_QUOTA_VM_CF_ACCESS_CLIENT_SECRET"),
    internalToken: getRequiredEnv("DQSS_INTERNAL_TOKEN"),
    timeoutMs: parsePositiveInteger(process.env.DEVICE_QUOTA_VM_TIMEOUT_MS, 8000),
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

export async function callVmSuggest(request: VmSuggestRequest): Promise<VmSuggestResponse> {
  const config = getVmClientConfig()
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, config.timeoutMs)

  try {
    const response = await fetch(`${config.baseUrl}/suggest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Access-Client-Id": config.cfAccessClientId,
        "CF-Access-Client-Secret": config.cfAccessClientSecret,
        "X-Internal-Token": config.internalToken,
        "X-Request-Id": request.requestId,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })

    if (!response.ok) {
      let message = `VM suggestion provider failed (${response.status})`
      let details: unknown
      try {
        const payload = (await response.json()) as unknown
        if (response.status < 500) {
          message = getPayloadMessage(payload, message)
          details = getPayloadDetails(payload)
        } else {
          message = "VM suggestion provider failed"
        }
      } catch {}
      throw new SuggestionRouteError(message, response.status >= 500 ? 503 : response.status, details)
    }

    return (await response.json()) as VmSuggestResponse
  } catch (error) {
    if (error instanceof SuggestionRouteError) throw error
    if (timedOut || isAbortError(error)) {
      throw new SuggestionRouteError("VM suggestion provider timed out", 503)
    }
    throw new SuggestionRouteError("VM suggestion provider request failed", 503)
  } finally {
    clearTimeout(timeout)
  }
}
