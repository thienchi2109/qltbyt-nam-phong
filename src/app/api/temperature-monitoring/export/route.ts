import { createReadStream } from "node:fs"
import { Readable } from "node:stream"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/auth/config"
import { getSessionClaims, getSessionUser } from "@/app/api/rpc/[fn]/rpc-session-claims"
import { BoundedBodyTooLargeError, readBoundedBody } from "@/lib/ai/bff-broker/BoundedBody"
import { callServerRpc } from "@/lib/ai/server-rpc"
import { isGlobalRole } from "@/lib/rbac"
import { assertSameOriginRequest, SameOriginRequestError } from "@/lib/same-origin-request"
import {
  prepareTemperatureExport,
  type TemperatureExportPage,
} from "@/lib/temperature-monitoring-export"
import { temperatureExportSchema } from "@/lib/temperature-monitoring-export-contract"
import { acquireTemperatureExport } from "@/lib/temperature-monitoring-export-limiter"

/** Use Node.js for streaming ExcelJS output and private temporary files. */
export const runtime = "nodejs"
/** Allow response transfer after the independently enforced 60-second generation ceiling. */
export const maxDuration = 90

function failure(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } })
}

/** Generate a bounded XLSX with session-scoped authenticated RPCs. */
export async function POST(request: Request) {
  let release: (() => void) | null = null
  let cleanup: (() => Promise<void>) | undefined
  let generationTimer: ReturnType<typeof setTimeout> | undefined
  let transferring = false
  try {
    assertSameOriginRequest(request)
    const user = getSessionUser(await getServerSession(authOptions))
    if (!user) return failure(401, "Vui lòng đăng nhập để xuất dữ liệu.")
    const claims = getSessionClaims(user)
    if (
      !claims ||
      !(
        isGlobalRole(claims.appRole) ||
        ["to_qltb", "technician", "qltb_khoa", "user", "regional_leader"].includes(claims.appRole)
      )
    )
      return failure(403, "Bạn không có quyền xuất dữ liệu nhiệt độ.")
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return failure(415, "Yêu cầu xuất không hợp lệ.")
    let body: unknown
    try {
      body = JSON.parse(
        new TextDecoder().decode(await readBoundedBody(request.body, 4096, request.signal))
      )
    } catch (error) {
      if (error instanceof BoundedBodyTooLargeError) return failure(413, "Bộ lọc xuất quá lớn.")
      return failure(400, "Bộ lọc xuất không hợp lệ.")
    }
    const parsed = temperatureExportSchema.safeParse(body)
    if (!parsed.success)
      return failure(
        400,
        "Chọn ngày hợp lệ trong cùng một năm; chỉ xuất bản ghi đã nhập. Các năm khác xuất riêng."
      )
    release = acquireTemperatureExport(claims.userId)
    if (!release)
      return failure(429, "Đang có yêu cầu xuất hoặc đã đạt giới hạn. Vui lòng thử lại sau.")
    const deadline = new AbortController()
    generationTimer = setTimeout(() => deadline.abort(), 60_000)
    const signal = AbortSignal.any([request.signal, deadline.signal])
    const artifact = await prepareTemperatureExport(
      parsed.data,
      claims.userId,
      (args) =>
        callServerRpc<TemperatureExportPage>(
          "temperature_monitoring_export_page",
          args,
          {
            id: claims.userId,
            role: claims.role,
            don_vi: claims.donVi,
            current_don_vi: claims.currentDonVi,
            dia_ban_id: claims.diaBan,
            khoa_phong: claims.khoaPhong,
          },
          { signal, maxResponseBytes: 1024 * 1024 }
        ),
      signal
    )
    clearTimeout(generationTimer)
    cleanup = artifact.cleanup
    const input = createReadStream(artifact.path)
    const transferTimer = setTimeout(
      () => input.destroy(new Error("export transfer timeout")),
      25_000
    )
    const abortTransfer = () => input.destroy(new Error("export transfer cancelled"))
    request.signal.addEventListener("abort", abortTransfer, { once: true })
    const finish = () => {
      clearTimeout(transferTimer)
      request.signal.removeEventListener("abort", abortTransfer)
      void artifact
        .cleanup()
        .catch(() => console.error("Temperature export temporary-file cleanup failed"))
        .finally(() => release?.())
    }
    input.once("close", finish)
    cleanup = undefined
    const response = new Response(Readable.toWeb(input) as ReadableStream<Uint8Array>, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="temperature-${parsed.data.from}-${parsed.data.to}.xlsx"`,
        "Content-Length": String(artifact.bytes),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
    transferring = true
    return response
  } catch (error) {
    if (error instanceof SameOriginRequestError)
      return failure(403, "Yêu cầu khác nguồn không được phép.")
    return failure(
      500,
      "Không thể hoàn tất file Excel. Hãy thu hẹp thiết bị, trạng thái hoặc khoảng ngày rồi thử lại."
    )
  } finally {
    clearTimeout(generationTimer)
    try {
      if (cleanup) await cleanup()
    } finally {
      // A returned attachment holds its slot until file transfer closes.
      if (!transferring) release?.()
    }
  }
}
