import type { SuggestMappingResult } from "./useSuggestMapping"

export type SuggestionJobStatus = "queued" | "processing" | "succeeded" | "failed"

export interface SuggestionJob {
  id: string
  status: SuggestionJobStatus
  processedUniqueNames: number
  totalUniqueNames: number
  result: SuggestMappingResult | null
  error: string | null
}

const SUGGESTION_JOB_STATUSES = new Set<string>(["queued", "processing", "succeeded", "failed"])

function isSuggestionJobStatus(value: string): value is SuggestionJobStatus {
  return SUGGESTION_JOB_STATUSES.has(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getRouteErrorMessage(status: number, payload: unknown): string {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error) {
    return payload.error
  }
  return `Suggestion preview failed (${status})`
}

function getRouteResult(payload: unknown): SuggestMappingResult {
  if (isRecord(payload) && isRecord(payload.result)) {
    return payload.result as unknown as SuggestMappingResult
  }
  throw new Error("Invalid suggestion preview response")
}

function getRouteJob(payload: unknown): SuggestionJob {
  if (!isRecord(payload) || !isRecord(payload.job)) {
    throw new Error("Invalid suggestion job response")
  }

  const job = payload.job
  if (
    typeof job.id !== "string" ||
    typeof job.status !== "string" ||
    !isSuggestionJobStatus(job.status) ||
    typeof job.processedUniqueNames !== "number" ||
    typeof job.totalUniqueNames !== "number"
  ) {
    throw new Error("Invalid suggestion job response")
  }

  return {
    error: typeof job.error === "string" ? job.error : null,
    id: job.id,
    processedUniqueNames: job.processedUniqueNames,
    result: isRecord(job.result) ? (job.result as unknown as SuggestMappingResult) : null,
    status: job.status,
    totalUniqueNames: job.totalUniqueNames,
  }
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {}

  if (!response.ok) {
    throw new Error(getRouteErrorMessage(response.status, payload))
  }

  return payload
}

export function isAsyncSuggestionJobEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEVICE_QUOTA_SUGGESTION_ASYNC_JOBS !== "false"
}

export function getProgressPercent(job: SuggestionJob): number {
  if (job.status === "succeeded") return 100
  if (job.totalUniqueNames <= 0) return 0
  return Math.min(99, Math.round((job.processedUniqueNames / job.totalUniqueNames) * 100))
}

export function getJobResult(job: SuggestionJob): SuggestMappingResult {
  if (job.result) return job.result
  throw new Error("Suggestion job completed without a result")
}

export function getJobFailureMessage(job: SuggestionJob): string {
  return job.error ?? "Không thể tạo gợi ý phân loại. Vui lòng thử lại."
}

export function waitForNextJobTick(signal: AbortSignal): Promise<void> {
  const delayMs = process.env.NODE_ENV === "test" ? 0 : 800
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"))
      return
    }

    const timer = setTimeout(resolve, delayMs)
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        reject(new DOMException("Aborted", "AbortError"))
      },
      { once: true },
    )
  })
}

export async function fetchSuggestedMapping(
  donViId: number,
  signal: AbortSignal,
): Promise<SuggestMappingResult> {
  const response = await fetch("/api/device-quota/mapping/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ donViId }),
    signal,
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {}

  if (!response.ok) {
    throw new Error(getRouteErrorMessage(response.status, payload))
  }

  return getRouteResult(payload)
}

export async function createSuggestionJobRequest(
  donViId: number,
  signal: AbortSignal,
): Promise<SuggestionJob> {
  const payload = await postJson("/api/device-quota/mapping/suggest/jobs", { donViId }, signal)
  return getRouteJob(payload)
}

export async function processSuggestionJobRequest(
  jobId: string,
  signal: AbortSignal,
): Promise<SuggestionJob> {
  const payload = await postJson(
    `/api/device-quota/mapping/suggest/jobs/${encodeURIComponent(jobId)}/process`,
    { limit: 2 },
    signal,
  )
  return getRouteJob(payload)
}

export async function retrySuggestionJobRequest(
  jobId: string,
  signal: AbortSignal,
): Promise<SuggestionJob> {
  const payload = await postJson(
    `/api/device-quota/mapping/suggest/jobs/${encodeURIComponent(jobId)}/retry`,
    {},
    signal,
  )
  return getRouteJob(payload)
}
