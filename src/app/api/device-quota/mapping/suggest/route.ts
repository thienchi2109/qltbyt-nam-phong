import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/auth/config"
import {
  assertSuggestionAccess,
  runSuggestMapping,
  SuggestionRouteError,
} from "@/app/api/device-quota/mapping/suggest/suggestion-service"
import type { SuggestionAccessUser } from "@/app/api/device-quota/mapping/suggest/suggestion-types"

export const runtime = "nodejs"

const PROVIDER = "supabase"

function createRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `req-${Date.now().toString(36)}`
}

function parseDonViId(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getErrorStatus(error: unknown): number {
  if (error instanceof SuggestionRouteError) return error.status
  if (isRecord(error) && typeof error.status === "number") return error.status
  return 500
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (isRecord(error) && typeof error.message === "string") return error.message
  return "Internal server error"
}

function getUserRole(user: SuggestionAccessUser | null): string | null {
  return typeof user?.role === "string" ? user.role.toLowerCase() : null
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId()
  const startedAt = Date.now()
  let donViId: number | null = null
  let role: string | null = null

  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as SuggestionAccessUser | undefined
    role = getUserRole(user ?? null)

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 })
    }

    const body = (await request.json()) as { donViId?: unknown }
    donViId = parseDonViId(body.donViId)
    if (donViId === null) {
      return NextResponse.json(
        { error: "donViId must be a positive integer", requestId },
        { status: 400 },
      )
    }

    await assertSuggestionAccess(user, donViId)
    const providerResult = await runSuggestMapping({ donViId, provider: PROVIDER, user })
    const durationMs = Date.now() - startedAt

    console.info("[device-quota-suggest]", {
      requestId,
      donViId,
      role,
      provider: PROVIDER,
      status: "success",
      itemCounts: providerResult.itemCounts,
      durationMs,
    })

    return NextResponse.json({
      result: providerResult.result,
      meta: {
        requestId,
        provider: PROVIDER,
        itemCounts: providerResult.itemCounts,
        catalogSignature: providerResult.catalogSignature,
      },
    })
  } catch (error) {
    const status = getErrorStatus(error)
    const message = getErrorMessage(error)
    const durationMs = Date.now() - startedAt

    console.error("[device-quota-suggest]", {
      requestId,
      donViId,
      role,
      provider: PROVIDER,
      status: "error",
      failureReason: message,
      durationMs,
    })

    return NextResponse.json({ error: message, requestId }, { status })
  }
}
