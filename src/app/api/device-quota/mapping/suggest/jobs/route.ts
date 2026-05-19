import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/auth/config"
import { createSuggestionJob } from "@/app/api/device-quota/mapping/suggest/suggestion-job-service"
import {
  assertSuggestionRouteUser,
  getErrorMessage,
  getErrorStatus,
} from "@/app/api/device-quota/mapping/suggest/suggestion-route-utils"
import type { SuggestionAccessUser } from "@/app/api/device-quota/mapping/suggest/suggestion-types"

export const runtime = "nodejs"

function createRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `job-${Date.now().toString(36)}`
}

function parseDonViId(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null
}

function parsePositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export async function POST(request: Request) {
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
    const parsedBody = (await request.json()) as unknown
    if (!isJsonRecord(parsedBody)) {
      return NextResponse.json({ error: "Invalid JSON body", requestId }, { status: 400 })
    }
    body = parsedBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", requestId }, { status: 400 })
  }

  const donViId = parseDonViId(body.donViId)
  if (donViId === null) {
    return NextResponse.json({ error: "donViId must be a positive integer", requestId }, { status: 400 })
  }

  try {
    const job = await createSuggestionJob({
      donViId,
      maxDeviceIdsPerChunk: parsePositiveInteger(body.maxDeviceIdsPerChunk),
      maxUniqueNamesPerChunk: parsePositiveInteger(body.maxUniqueNamesPerChunk),
      requestId,
      user,
    })
    const status = job.status === "succeeded" ? 200 : 202
    return NextResponse.json({ job, requestId }, { status })
  } catch (error) {
    const status = getErrorStatus(error)
    const message = getErrorMessage(error, status)
    return NextResponse.json({ error: message, requestId }, { status })
  }
}
