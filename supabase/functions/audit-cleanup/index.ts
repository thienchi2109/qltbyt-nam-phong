import { createClient } from 'jsr:@supabase/supabase-js@2'

// Type definition for cleanup RPC response
interface CleanupResult {
  deleted_count: number
  oldest_remaining: string | null
  batches_executed: number
}

Deno.serve(async (req: Request) => {
  // 1. Validate required environment variables (inside handler for graceful errors)
  const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!CRON_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables', {
      hasCronSecret: !!CRON_SECRET,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY,
    })
    return new Response(
      JSON.stringify({
        error: 'Server configuration error: missing required environment variables',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // 2. Only allow POST method (check before auth for cleaner error semantics)
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Allow': 'POST' },
      }
    )
  }

  // 3. Validate cron secret (required)
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.error('Unauthorized cleanup attempt', {
      ip: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // 4. Create service role client (NOT anon key)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // 5. Execute cleanup (no parameters - uses hardcoded retention)
  const { data, error } = (await supabase.rpc('audit_logs_cleanup_scheduled')) as {
    data: CleanupResult[] | null
    error: { message: string } | null
  }

  if (error) {
    console.error('Cleanup failed:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 6. Log success
  console.log('Audit cleanup completed:', data)

  return new Response(JSON.stringify({ success: true, result: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
