import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth/config'
import { TransferCountsResponse } from '@/types/transfers-data-grid'
import {
  sanitizeTypes,
} from '@/app/api/transfers/legacy-adapter'

export const runtime = 'nodejs'

/**
 * GET /api/transfers/counts
 *
 * Get transfer counts by status for data grid status badges
 *
 * Query Parameters:
 * - q: search text (equipment name, transfer code, reason)
 * - facilityId: facility filter (global users only)
 * - dateFrom: date range start (YYYY-MM-DD)
 * - dateTo: date range end (YYYY-MM-DD)
 * - types: comma-separated types (noi_bo, ben_ngoai, thanh_ly)
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

    const facilityId = searchParams.get('facilityId')
      ? parseInt(searchParams.get('facilityId')!)
      : null

    const dateFrom = searchParams.get('dateFrom') || null
    const dateTo = searchParams.get('dateTo') || null

    const typesRaw = searchParams.get('types')
      ?.split(',')
      .map((t: string) => t.trim()) || null

    const types = sanitizeTypes(typesRaw)

    const assigneeIds = searchParams.get('assigneeIds')
      ?.split(',')
      .map((id: string) => parseInt(id.trim()))
      .filter((id: number) => !isNaN(id)) || null

    // Call RPC function via internal proxy using request origin
    const rpcUrl = new URL('/api/rpc/transfer_request_counts', request.nextUrl.origin)

    const rpcPayload = {
      p_q: q,
      p_don_vi: facilityId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_types: types,
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

    if (!rpcResponse.ok) {
      const errorPayload = await rpcResponse.json().catch(() => undefined)
      return NextResponse.json(
        { error: (errorPayload as any)?.error || 'Failed to fetch counts' },
        { status: rpcResponse.status }
      )
    }

    const data = await rpcResponse.json() as {
      cho_duyet: number
      da_duyet: number
      dang_luan_chuyen: number
      da_ban_giao: number
      hoan_thanh: number
    }

    const response: TransferCountsResponse = {
      totalCount:
        (data.cho_duyet || 0) +
        (data.da_duyet || 0) +
        (data.dang_luan_chuyen || 0) +
        (data.da_ban_giao || 0) +
        (data.hoan_thanh || 0),
      columnCounts: {
        cho_duyet: data.cho_duyet || 0,
        da_duyet: data.da_duyet || 0,
        dang_luan_chuyen: data.dang_luan_chuyen || 0,
        da_ban_giao: data.da_ban_giao || 0,
        hoan_thanh: data.hoan_thanh || 0,
      },
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Counts API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
