import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/auth/config'

export const runtime = 'nodejs'

export async function POST(_request: Request) {
  const session: any = await getServerSession(authOptions as any)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
}
