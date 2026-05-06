import { createClient } from '@supabase/supabase-js'

const AUTH_AUDIT_CLEANUP_RPC = 'auth_audit_log_cleanup_scheduled'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status })
}

function readRequiredEnv(): {
  cronSecret: string
  supabaseUrl: string
  serviceRoleKey: string
} | null {
  const cronSecret = process.env.CRON_SECRET
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!cronSecret || !supabaseUrl || !serviceRoleKey) {
    return null
  }

  return { cronSecret, supabaseUrl, serviceRoleKey }
}

export async function GET(request: Request): Promise<Response> {
  const env = readRequiredEnv()

  if (!env) {
    console.error('Missing auth audit cleanup cron environment variables')
    return jsonResponse(
      { error: 'Server configuration error: missing required environment variables' },
      500
    )
  }

  if (request.headers.get('Authorization') !== `Bearer ${env.cronSecret}`) {
    console.error('Unauthorized auth audit cleanup cron attempt', {
      userAgent: request.headers.get('user-agent'),
    })
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false },
  })
  const { data, error } = await supabase.rpc(AUTH_AUDIT_CLEANUP_RPC)

  if (error) {
    console.error('Auth audit cleanup cron failed')
    return jsonResponse({ error: 'Cleanup failed' }, 500)
  }

  console.log('Auth audit cleanup cron completed', { result: data })

  return jsonResponse({ success: true, result: data }, 200)
}
