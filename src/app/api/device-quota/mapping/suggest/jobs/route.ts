import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/auth/config"
import { SuggestionRouteError } from "@/app/api/device-quota/mapping/suggest/suggestion-errors"
import { createSuggestionJob } from "@/app/api/device-quota/mapping/suggest/suggestion-job-service"
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

function getErrorStatus(error: unknown): number {
  if (error instanceof SuggestionRouteError) return error.status
  return 500
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "Internal server error"
}

export async function POST(request: Request) {
  const requestId = createRequestId()
  const session = await getServerSession(authOptions)
  const user = session?.user as SuggestionAccessUser | undefined

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 })
  }

  let body: {
    donViId?: unknown
    maxDeviceIdsPerChunk?: unknown
    maxUniqueNamesPerChunk?: unknown
  }
  try {
    body = (await request.json()) as {
      donViId?: unknown
      maxDeviceIdsPerChunk?: unknown
      maxUniqueNamesPerChunk?: unknown
    }
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
    const message = status < 500 ? getErrorMessage(error) : "Internal server error"
    return NextResponse.json({ error: message, requestId }, { status })
  }
}
