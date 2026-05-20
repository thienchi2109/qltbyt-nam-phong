import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/auth/config"
import {
  assertSuggestionAccess,
  runSuggestMapping,
  SuggestionRouteError,
} from "@/app/api/device-quota/mapping/suggest/suggestion-service"
import { selectSuggestionProvider } from "@/app/api/device-quota/mapping/suggest/suggestion-config"
import type { SuggestionAccessUser } from "@/app/api/device-quota/mapping/suggest/suggestion-types"

/** Runs suggestion preview on the Node.js runtime because it calls internal services. */
export const runtime = "nodejs"

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

function getErrorDetails(error: unknown): unknown {
  if (isRecord(error) && Object.prototype.hasOwnProperty.call(error, "details")) {
    return error.details
  }
  return undefined
}

function canExposeError(status: number): boolean {
  return status < 500 || status === 503
}

function getUserRole(user: SuggestionAccessUser | null): string | null {
  return typeof user?.role === "string" ? user.role.toLowerCase() : null
}

/** Handles a synchronous suggestion preview request through the VM-backed provider. */
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

    let body: { donViId?: unknown }
    try {
      body = (await request.json()) as { donViId?: unknown }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body", requestId }, { status: 400 })
    }

    donViId = parseDonViId(body.donViId)
    if (donViId === null) {
      return NextResponse.json(
        { error: "donViId must be a positive integer", requestId },
        { status: 400 },
      )
    }

    await assertSuggestionAccess(user, donViId)
    const providerSelection = selectSuggestionProvider(donViId)
    const providerResult = await runSuggestMapping({
      donViId,
      requestId,
      user,
    })
    const durationMs = Date.now() - startedAt

    console.info("[device-quota-suggest]", {
      requestId,
      donViId,
      role,
      provider: providerSelection.provider,
      providerPolicy: providerSelection.policy,
      status: "success",
      itemCounts: providerResult.itemCounts,
      durationMs,
    })

    return NextResponse.json({
      result: providerResult.result,
      meta: {
        requestId,
        provider: providerSelection.provider,
        providerPolicy: providerSelection.policy,
        itemCounts: providerResult.itemCounts,
        catalogSignature: providerResult.catalogSignature,
      },
    })
  } catch (error) {
    const status = getErrorStatus(error)
    const failureReason = getErrorMessage(error)
    const exposeError = canExposeError(status)
    const responseMessage = exposeError ? failureReason : "Internal server error"
    const details = exposeError ? getErrorDetails(error) : undefined
    const durationMs = Date.now() - startedAt

    console.error("[device-quota-suggest]", {
      requestId,
      donViId,
      role,
      provider: donViId === null ? "unknown" : selectSuggestionProvider(donViId).provider,
      status: "error",
      failureReason,
      durationMs,
    })

    return NextResponse.json(
      { error: responseMessage, requestId, ...(details !== undefined ? { details } : {}) },
      { status },
    )
  }
}
