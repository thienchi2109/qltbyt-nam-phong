import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/auth/config"
import { processSuggestionJobChunksForJob } from "@/app/api/device-quota/mapping/suggest/suggestion-job-service"
import {
  assertSuggestionRouteUser,
  getErrorMessage,
  getErrorStatus,
} from "@/app/api/device-quota/mapping/suggest/suggestion-route-utils"
import type { SuggestionAccessUser } from "@/app/api/device-quota/mapping/suggest/suggestion-types"

export const runtime = "nodejs"

const DEFAULT_PROCESS_LIMIT = 1
const MAX_PROCESS_LIMIT = 5

function createRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `job-process-${Date.now().toString(36)}`
}

function clampProcessLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return DEFAULT_PROCESS_LIMIT
  }
  return Math.min(value, MAX_PROCESS_LIMIT)
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

async function readOptionalJsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (text.trim() === "") return {}

  const parsed = JSON.parse(text) as unknown
  if (!isJsonRecord(parsed)) {
    throw new Error("Invalid JSON body")
  }
  return parsed
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const requestId = createRequestId()
  const session = await getServerSession(authOptions)
  const user = session?.user as SuggestionAccessUser | undefined

  try {
    assertSuggestionRouteUser(user)
  } catch (error) {
    const status = getErrorStatus(error)
    const message = getErrorMessage(error, status)
    return NextResponse.json({ error: message, requestId }, { status })
  }

  let body: Record<string, unknown>
  try {
    body = await readOptionalJsonBody(request)
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", requestId }, { status: 400 })
  }

  try {
    const { jobId } = await params
    const result = await processSuggestionJobChunksForJob({
      jobId,
      limit: clampProcessLimit(body.limit),
      user,
    })
    const status = result.job.status === "queued" || result.job.status === "processing" ? 202 : 200
    return NextResponse.json({ ...result, requestId }, { status })
  } catch (error) {
    const status = getErrorStatus(error)
    if (status >= 500) {
      console.error("Suggestion job processing failed", error)
    }
    const message = getErrorMessage(error, status)
    return NextResponse.json({ error: message, requestId }, { status })
  }
}
