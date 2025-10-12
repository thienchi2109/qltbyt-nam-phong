import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth/config'
import { TransferCountsResponse } from '@/types/transfer-kanban'

export const runtime = 'nodejs'

/**
 * GET /api/transfers/counts
 * 
 * Get transfer counts by status for Kanban column headers
 * 
 * Query Parameters:
 * - facilityIds: comma-separated facility IDs (optional)
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

    // Call RPC function via internal proxy with absolute URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const rpcUrl = new URL('/api/rpc/get_transfer_counts', baseUrl)
    
    const rpcPayload = {
      p_facility_ids: facilityIds,
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
        { error: error.error || 'Failed to fetch counts' },
        { status: rpcResponse.status }
      )
    }

    const data = await rpcResponse.json() as Array<{
      total_count: number
      cho_duyet_count: number
      da_duyet_count: number
      dang_luan_chuyen_count: number
      da_ban_giao_count: number
      hoan_thanh_count: number
    }>

    // RPC returns array with single row
    const row = data[0]

    // Build response
    const response: TransferCountsResponse = {
      totalCount: row?.total_count || 0,
      columnCounts: {
        cho_duyet: row?.cho_duyet_count || 0,
        da_duyet: row?.da_duyet_count || 0,
        dang_luan_chuyen: row?.dang_luan_chuyen_count || 0,
        da_ban_giao: row?.da_ban_giao_count || 0,
        hoan_thanh: row?.hoan_thanh_count || 0,
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
