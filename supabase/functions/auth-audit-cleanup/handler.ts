export const AUTH_AUDIT_CLEANUP_RPC = 'auth_audit_log_cleanup_scheduled'

export interface AuthAuditCleanupEnv {
  cronSecret: string
  supabaseUrl: string
  serviceRoleKey: string
}

export interface CleanupResult {
  deleted_count: number
  oldest_remaining: string | null
  batches_executed: number
  cutoff_date: string
}

export interface RpcError {
  message: string
}

export interface RpcClient {
  rpc: (
    functionName: typeof AUTH_AUDIT_CLEANUP_RPC
  ) => Promise<{ data: CleanupResult[] | null; error: RpcError | null }>
}

export interface AuthAuditCleanupDeps {
  env: AuthAuditCleanupEnv
  createRpcClient: (env: AuthAuditCleanupEnv) => RpcClient
  logger?: Pick<Console, 'error' | 'log'>
}

function jsonResponse(body: unknown, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

function hasRequiredEnv(env: AuthAuditCleanupEnv): boolean {
  return Boolean(env.cronSecret && env.supabaseUrl && env.serviceRoleKey)
}

export async function handleAuthAuditCleanupRequest(
  req: Request,
  deps: AuthAuditCleanupDeps
): Promise<Response> {
  const logger = deps.logger ?? console

  if (!hasRequiredEnv(deps.env)) {
    logger.error('Missing auth audit cleanup environment variables', {
      hasCronSecret: Boolean(deps.env.cronSecret),
      hasSupabaseUrl: Boolean(deps.env.supabaseUrl),
      hasServiceRoleKey: Boolean(deps.env.serviceRoleKey),
    })
    return jsonResponse(
      { error: 'Server configuration error: missing required environment variables' },
      500
    )
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: 'POST' })
  }

  if (req.headers.get('Authorization') !== `Bearer ${deps.env.cronSecret}`) {
    logger.error('Unauthorized auth audit cleanup attempt', {
      ip: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const supabase = deps.createRpcClient(deps.env)
  const { data, error } = await supabase.rpc(AUTH_AUDIT_CLEANUP_RPC)

  if (error) {
    logger.error('Auth audit cleanup failed')
    return jsonResponse({ error: 'Cleanup failed' }, 500)
  }

  logger.log('Auth audit cleanup completed', { result: data })

  return jsonResponse({ success: true, result: data }, 200)
}
