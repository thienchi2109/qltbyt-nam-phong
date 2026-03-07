// Protected API route: refresh category embeddings after category mutations
// Uses service role key server-side to update embeddings
// Called fire-and-forget from client after create/update/import

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth/config'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const BATCH_SIZE = 50
const WRITE_ROLES = ['global', 'admin', 'to_qltb']

/**
 * POST /api/embeddings/refresh-categories
 *
 * Refresh embeddings for specified category IDs.
 * Reads latest category names from DB, generates embeddings via Edge Function,
 * and updates nhom_thiet_bi.embedding column.
 *
 * Security:
 * - Auth: requires valid session
 * - Role: only global/admin/to_qltb (write-capable roles)
 * - Tenant isolation: non-global users can only refresh their own tenant's categories
 *
 * Body: { category_ids: number[] }
 * Returns: { refreshed: number, failed: number }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Role guard: only write-capable roles can refresh embeddings
    const user = session.user as { id: string; role?: string; don_vi?: string | null }
    const role = (user.role || '').toLowerCase()

    if (!WRITE_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Forbidden: insufficient role' },
        { status: 403 }
      )
    }

    const { category_ids } = await request.json()

    if (!Array.isArray(category_ids) || category_ids.length === 0) {
      return NextResponse.json(
        { error: 'category_ids must be a non-empty array' },
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

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Read latest category names from DB (include don_vi_id for tenant check)
    const { data: categories, error: fetchError } = await supabase
      .from('nhom_thiet_bi')
      .select('id, ten_nhom, don_vi_id')
      .in('id', category_ids)

    if (fetchError) {
      console.error('Failed to fetch categories:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      )
    }

    if (!categories || categories.length === 0) {
      return NextResponse.json({ refreshed: 0, failed: 0 })
    }

    // Tenant isolation: non-global users can only refresh their own tenant's categories
    const userDonVi = user.don_vi ? parseInt(user.don_vi, 10) : null
    const filteredCategories = role === 'global'
      ? categories
      : categories.filter(c => c.don_vi_id === userDonVi)

    if (filteredCategories.length === 0) {
      return NextResponse.json({ refreshed: 0, failed: 0 })
    }

    let refreshed = 0
    let failed = 0

    // Process in batches of BATCH_SIZE
    for (let i = 0; i < filteredCategories.length; i += BATCH_SIZE) {
      const batch = filteredCategories.slice(i, i + BATCH_SIZE)
      const texts = batch.map(c => c.ten_nhom || '')

      try {
        // Call embed-device-name Edge Function
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
          console.error(`Embedding batch ${i / BATCH_SIZE + 1} failed:`, errorBody)
          failed += batch.length
          continue
        }

        const { embeddings } = await embedResponse.json()

        // Validate embedding payload shape matches batch
        if (!Array.isArray(embeddings) || embeddings.length !== batch.length) {
          console.error(
            `Embedding batch ${i / BATCH_SIZE + 1} shape mismatch: expected ${batch.length}, got ${Array.isArray(embeddings) ? embeddings.length : 'non-array'}`
          )
          failed += batch.length
          continue
        }

        // Update each category embedding
        for (let j = 0; j < batch.length; j++) {
          const { error: updateError } = await supabase
            .from('nhom_thiet_bi')
            .update({ embedding: JSON.stringify(embeddings[j]) })
            .eq('id', batch[j].id)

          if (updateError) {
            console.error(`Failed to update category ${batch[j].id}:`, updateError)
            failed++
          } else {
            refreshed++
          }
        }
      } catch (batchError) {
        console.error(`Batch ${i / BATCH_SIZE + 1} error:`, batchError)
        failed += batch.length
      }
    }

    return NextResponse.json({ refreshed, failed })
  } catch (error) {
    console.error('Refresh categories error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
