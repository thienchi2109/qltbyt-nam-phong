import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth/config"

export async function POST(request: Request) {
  const session: any = await getServerSession(authOptions as any)
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const don_vi = Number(body?.don_vi)
  if (!don_vi) return NextResponse.json({ ok: false, error: 'Invalid don_vi' }, { status: 400 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Verify membership exists for this user and don_vi
  const { data: m, error: mErr } = await supabase
    .from('user_don_vi_memberships')
    .select('user_id')
    .eq('user_id', session.user.id)
    .eq('don_vi', don_vi)
    .single()
  if (mErr || !m) return NextResponse.json({ ok: false, error: 'Not a member of tenant' }, { status: 403 })

  const { error } = await supabase
    .from('nhan_vien')
    .update({ current_don_vi: don_vi })
    .eq('id', session.user.id)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
