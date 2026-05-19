import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/auth/config"
import { SuggestionRouteError } from "@/app/api/device-quota/mapping/suggest/suggestion-errors"
import { getSuggestionJob } from "@/app/api/device-quota/mapping/suggest/suggestion-job-service"
import type { SuggestionAccessUser } from "@/app/api/device-quota/mapping/suggest/suggestion-types"

export const runtime = "nodejs"

function getErrorStatus(error: unknown): number {
  if (error instanceof SuggestionRouteError) return error.status
  return 500
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "Internal server error"
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await getServerSession(authOptions)
  const user = session?.user as SuggestionAccessUser | undefined

  if (!user?.id || !user.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { jobId } = await params
    const job = await getSuggestionJob({ jobId, user })
    return NextResponse.json({ job }, { status: 200 })
  } catch (error) {
    const status = getErrorStatus(error)
    const message = status < 500 ? getErrorMessage(error) : "Internal server error"
    return NextResponse.json({ error: message }, { status })
  }
}
