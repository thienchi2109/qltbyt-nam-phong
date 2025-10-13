import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth/config'
import { TransferKanbanItem, TransferKanbanResponse } from '@/types/transfer-kanban'

export const runtime = 'nodejs'

/**
 * GET /api/transfers/kanban
 * 
 * Server-side Kanban data fetching with filtering and pagination
 * 
 * Query Parameters:
 * - facilityIds: comma-separated facility IDs
 * - assigneeIds: comma-separated assignee IDs
 * - types: comma-separated types (noi_bo, ben_ngoai)
 * - statuses: comma-separated statuses (cho_duyet, da_duyet, etc.)
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 * - searchText: full-text search query
 * - limit: max items per request (default: 100)
 * - cursor: last item ID for pagination
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
    
    const facilityIds = searchParams.get('facilityIds')
      ?.split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id)) || null

    const assigneeIds = searchParams.get('assigneeIds')
      ?.split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id)) || null

    const types = searchParams.get('types')
      ?.split(',')
      .map(t => t.trim())
      .filter(t => ['noi_bo', 'ben_ngoai'].includes(t)) || null

    const statuses = searchParams.get('statuses')
      ?.split(',')
      .map(s => s.trim())
      .filter(s => ['cho_duyet', 'da_duyet', 'dang_luan_chuyen', 'da_ban_giao', 'hoan_thanh'].includes(s)) || null

    const dateFrom = searchParams.get('dateFrom') || null
    const dateTo = searchParams.get('dateTo') || null
    const searchText = searchParams.get('searchText') || null
    
    const limit = parseInt(searchParams.get('limit') || '100')
    const cursor = searchParams.get('cursor') 
      ? parseInt(searchParams.get('cursor')!) 
      : null

    // Validate limit
    if (limit < 1 || limit > 500) {
      return NextResponse.json(
        { error: 'Invalid limit: must be between 1 and 500' },
        { status: 400 }
      )
    }

    // Call RPC function via internal proxy using request origin
    const rpcUrl = new URL('/api/rpc/get_transfers_kanban', request.nextUrl.origin)
    
    const rpcPayload = {
      p_facility_ids: facilityIds,
      p_assignee_ids: assigneeIds,
      p_types: types,
      p_statuses: statuses,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_search_text: searchText,
      p_limit: limit,
      p_cursor: cursor,
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
      const error = await rpcResponse.json()
      return NextResponse.json(
        { error: error.error || 'Failed to fetch kanban data' },
        { status: rpcResponse.status }
      )
    }

    const data = await rpcResponse.json() as TransferKanbanItem[]
  
    if (!data) {
      return NextResponse.json(
        { error: 'No data returned from RPC' },
        { status: 500 }
      )
    }

    // Group by status for Kanban columns
    const grouped: TransferKanbanResponse['transfers'] = {
      cho_duyet: [],
      da_duyet: [],
      dang_luan_chuyen: [],
      da_ban_giao: [],
      hoan_thanh: [],
    }

    for (const transfer of data) {
      if (grouped[transfer.trang_thai]) {
        grouped[transfer.trang_thai].push(transfer)
      }
    }

    // Build response
    const response: TransferKanbanResponse = {
      transfers: grouped,
      totalCount: data[0]?.total_count || 0,
      cursor: data.length > 0 ? data[data.length - 1].id : null,
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Kanban API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
