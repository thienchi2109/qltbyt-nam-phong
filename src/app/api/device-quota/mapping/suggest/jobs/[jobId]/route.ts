import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/auth/config"
import { getSuggestionJob } from "@/app/api/device-quota/mapping/suggest/suggestion-job-service"
import {
  assertSuggestionRouteUser,
  getErrorMessage,
  getErrorStatus,
} from "@/app/api/device-quota/mapping/suggest/suggestion-route-utils"
import type { SuggestionAccessUser } from "@/app/api/device-quota/mapping/suggest/suggestion-types"

export const runtime = "nodejs"

export async function GET(
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
    const job = await getSuggestionJob({ jobId, user })
    return NextResponse.json({ job }, { status: 200 })
  } catch (error) {
    const status = getErrorStatus(error)
    const message = getErrorMessage(error, status)
    return NextResponse.json({ error: message }, { status })
  }
}
