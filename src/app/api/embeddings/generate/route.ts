// Protected API route: generate text embeddings via Edge Function proxy
// Purpose: client calls this instead of directly calling Edge Function,
// keeping Supabase URL and service role key server-side only
// Roles: global, admin, to_qltb, regional_leader (preview-only)
// Input: { texts: string[] } (max 50)
// Output: { embeddings: number[][] }

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth/config'

export const runtime = 'nodejs'

const MAX_BATCH_SIZE = 10
const ALLOWED_ROLES = ['global', 'admin', 'to_qltb', 'regional_leader']

/**
 * POST /api/embeddings/generate
 *
 * Proxy to the embed-device-name Edge Function.
 * Requires authenticated session. Uses service role key server-side.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Role guard: only mapping-capable roles can generate embeddings
    const user = session.user as { id: string; role?: string }
    const role = (user.role || '').toLowerCase()

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Forbidden: insufficient role' },
        { status: 403 }
      )
    }

    const { texts } = await request.json()

    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: 'texts must be a non-empty array' },
        { status: 400 }
      )
    }

    if (texts.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Max batch size is ${MAX_BATCH_SIZE}` },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const embedResponse = await fetch(
      `${supabaseUrl}/functions/v1/embed-device-name`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ texts }),
      }
    )

    if (!embedResponse.ok) {
      const errorBody = await embedResponse.text()
      console.error('Edge Function embed-device-name failed:', errorBody)
      return NextResponse.json(
        { error: 'Edge Function failed to generate embeddings' },
        { status: 502 }
      )
    }

    const { embeddings } = await embedResponse.json()
    return NextResponse.json({ embeddings })
  } catch (error) {
    console.error('Generate embeddings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
