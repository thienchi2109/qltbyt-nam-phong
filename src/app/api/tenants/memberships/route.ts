import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth/config"

export async function GET() {
  const session: any = await getServerSession(authOptions as any)
  if (!session?.user?.id) return NextResponse.json({ memberships: [] })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const role = String(session.user.role || '')
  const appRole = role === 'admin' ? 'global' : role

  // Global/admin: return all active tenants
  if (appRole === 'global') {
    const { data: all, error: derr } = await supabase
      .from('don_vi')
      .select('id, name, code, active')
      .or('active.is.null,active.eq.true')
      .order('name', { ascending: true })
    if (derr) return NextResponse.json({ memberships: [] })
    const memberships = (all || []).map((row: any) => ({
      don_vi: row.id,
      name: row.name || '',
      code: row.code || ''
    }))
    return NextResponse.json({ memberships })
  }

  // Non-global: return only memberships
  const { data, error } = await supabase
    .from('user_don_vi_memberships')
    .select('don_vi, don_vi:don_vi(id, name, code)')
    .eq('user_id', session.user.id)

  if (error) return NextResponse.json({ memberships: [] })

  const memberships = (data || []).map((row: any) => ({
    don_vi: row.don_vi?.id || row.don_vi,
    name: row.don_vi?.name || '',
    code: row.don_vi?.code || ''
  }))
  return NextResponse.json({ memberships })
}
