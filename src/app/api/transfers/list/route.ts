import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth/config'
import {
  applyLegacyFilters,
  isMissingFunctionError,
  paginate,
  sanitizeStatuses,
  sanitizeTypes,
  transformLegacyItem,
  type LegacyTransferItem,
} from '@/app/api/transfers/legacy-adapter'

export const runtime = 'nodejs'

/**
 * GET /api/transfers/list
 *
 * Get paginated transfer requests with server-side filtering
 *
 * Query Parameters:
 * - q: search text (equipment name, transfer code, reason)
 * - statuses: comma-separated status values
 * - types: comma-separated types (noi_bo, ben_ngoai, thanh_ly)
 * - page: page number (1-indexed)
 * - pageSize: items per page
 * - facilityId: facility filter (global users only)
 * - dateFrom: date range start (YYYY-MM-DD)
 * - dateTo: date range end (YYYY-MM-DD)
 * - assigneeIds: comma-separated assignee IDs
 */

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams

    const q = searchParams.get('q') || null

    const statusesRaw = searchParams.get('statuses')
      ?.split(',')
      .map((s: string) => s.trim()) || null

    const typesRaw = searchParams.get('types')
      ?.split(',')
      .map((t: string) => t.trim()) || null

    const statuses = sanitizeStatuses(statusesRaw)
    const types = sanitizeTypes(typesRaw)

    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    const facilityId = searchParams.get('facilityId')
      ? parseInt(searchParams.get('facilityId')!)
      : null

    const dateFrom = searchParams.get('dateFrom') || null
    const dateTo = searchParams.get('dateTo') || null

    const assigneeIds = searchParams.get('assigneeIds')
      ?.split(',')
      .map((id: string) => parseInt(id.trim()))
      .filter((id: number) => !isNaN(id)) || null

    // Call RPC function via internal proxy using request origin
    const rpcUrl = new URL('/api/rpc/transfer_request_list', request.nextUrl.origin)

    const rpcPayload = {
      p_q: q,
      p_statuses: statuses,
      p_types: types,
      p_page: page,
      p_page_size: pageSize,
      p_don_vi: facilityId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_assignee_ids: assigneeIds,
    }

    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pass session cookies to internal API route
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify(rpcPayload),
    })

    if (rpcResponse.ok) {
      const data = await rpcResponse.json()
      return NextResponse.json(data)
    }

    const fallbackPayload = await rpcResponse.json().catch(() => undefined)
    if (!isMissingFunctionError(rpcResponse.status, fallbackPayload)) {
      return NextResponse.json(
        { error: (fallbackPayload as any)?.error || 'Failed to fetch transfer list' },
        { status: rpcResponse.status }
      )
    }

    const legacyResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        p_q: q,
        p_status: statuses && statuses.length === 1 ? statuses[0] : null,
        p_page: 1,
        p_page_size: 5000,
      }),
    })

    if (!legacyResponse.ok) {
      const legacyError = await legacyResponse.json().catch(() => undefined)
      return NextResponse.json(
        { error: (legacyError as any)?.error || 'Failed to fetch transfer list' },
        { status: legacyResponse.status }
      )
    }

    const legacyData = ((await legacyResponse.json()) || []) as LegacyTransferItem[]
    const filtered = applyLegacyFilters(legacyData.map(transformLegacyItem), {
      q,
      statuses,
      types,
      facilityId,
      dateFrom,
      dateTo,
      assigneeIds,
    })

    const paginated = paginate(filtered, page, pageSize)

    return NextResponse.json({
      data: paginated.data,
      total: paginated.total,
      page: paginated.page,
      pageSize: paginated.pageSize,
    })

  } catch (error) {
    console.error('Transfer list API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
