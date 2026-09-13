import { NextRequest } from "next/server"
import {
  callSessionRpc,
  errorResponse,
  jsonResponse,
  requireSession,
  WebPushApiError,
} from "@/lib/web-push/api"
import { parsePositiveBigint } from "@/lib/web-push/validation"
import { exactKeys, isRecord } from "@/lib/web-push/validation-common"

/** Runs the candidate endpoint on Node.js. */
export const runtime = "nodejs"

/** Returns a bounded page of recipients authorized by the database. */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const donViId = parsePositiveBigint(params.get("don_vi_id"))
    const limitText = params.get("limit") ?? "50"
    const limit = Number(limitText)
    const search = params.get("q") ?? ""
    const cursor = params.get("cursor")
    if (
      !donViId ||
      !/^[1-9][0-9]*$/.test(limitText) ||
      limit > 100 ||
      new TextEncoder().encode(search).byteLength > 256 ||
      (cursor !== null && !parsePositiveBigint(cursor)) ||
      [...params.keys()].some(
        (key) =>
          !["don_vi_id", "q", "limit", "cursor"].includes(key) || params.getAll(key).length !== 1
      )
    ) {
      throw new WebPushApiError(400, "invalid_request")
    }
    const { user } = await requireSession(req)
    const response = await callSessionRpc<unknown>(
      "web_push_recipient_candidates",
      {
        p_don_vi: donViId,
        p_search: search,
        p_limit: limit,
        p_cursor: cursor,
      },
      user
    )
    if (
      !isRecord(response) ||
      !exactKeys(response, ["version", "don_vi_id", "candidates", "next_cursor"]) ||
      response.version !== 1 ||
      response.don_vi_id !== donViId ||
      (response.next_cursor !== null && !parsePositiveBigint(response.next_cursor)) ||
      !Array.isArray(response.candidates) ||
      response.candidates.length > limit ||
      response.candidates.some(
        (item) =>
          !isRecord(item) ||
          !exactKeys(item, ["user_id", "username", "full_name"]) ||
          !parsePositiveBigint(item.user_id) ||
          typeof item.username !== "string" ||
          (item.full_name !== null && typeof item.full_name !== "string")
      )
    ) {
      throw new WebPushApiError(503, "unavailable", 60)
    }
    return jsonResponse(response)
  } catch (error) {
    return errorResponse(error)
  }
}
