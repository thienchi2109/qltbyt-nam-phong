import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/auth/config"
import { retrySuggestionJob } from "@/app/api/device-quota/mapping/suggest/suggestion-job-service"
import {
  assertSuggestionRouteUser,
  getErrorMessage,
  getErrorStatus,
} from "@/app/api/device-quota/mapping/suggest/suggestion-route-utils"
import type { SuggestionAccessUser } from "@/app/api/device-quota/mapping/suggest/suggestion-types"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await getServerSession(authOptions)
  const user = session?.user as SuggestionAccessUser | undefined

  try {
    assertSuggestionRouteUser(user)
  } catch (error) {
    const status = getErrorStatus(error)
    const message = getErrorMessage(error, status)
    return NextResponse.json({ error: message }, { status })
  }

  try {
    const { jobId } = await params
    const job = await retrySuggestionJob({ jobId, user })
    return NextResponse.json({ job }, { status: 202 })
  } catch (error) {
    const status = getErrorStatus(error)
    if (status >= 500) {
      console.error("Suggestion job retry failed", error)
    }
    const message = getErrorMessage(error, status)
    return NextResponse.json({ error: message }, { status })
  }
}
