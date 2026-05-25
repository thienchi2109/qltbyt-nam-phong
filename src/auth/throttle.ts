type RpcClient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{
    data: unknown
    error: unknown
  }>
}

export type AuthLoginThrottleScope = "username_ip" | "ip"

export type AuthLoginThrottleDecision = {
  allowed: boolean
  blocked_until: string | null
  retry_after_seconds: number
  blocked_scope: AuthLoginThrottleScope | null
}

const ALLOWED_THROTTLE_DECISION: AuthLoginThrottleDecision = {
  allowed: true,
  blocked_until: null,
  retry_after_seconds: 0,
  blocked_scope: null,
}

function hasThrottleContext(username: string | undefined, ipAddress: string | null): boolean {
  return Boolean(username && ipAddress)
}

function firstRecord(data: unknown): Record<string, unknown> | null {
  if (!Array.isArray(data)) {
    return null
  }

  const [candidate] = data
  return typeof candidate === "object" && candidate !== null
    ? candidate as Record<string, unknown>
    : null
}

function readThrottleScope(value: unknown): AuthLoginThrottleScope | null {
  return value === "username_ip" || value === "ip" ? value : null
}

function readRetryAfterSeconds(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.ceil(value))
    : 0
}

/** Checks whether a credentials login attempt is temporarily blocked. */
export async function checkAuthLoginThrottle(
  supabase: RpcClient,
  username: string | undefined,
  ipAddress: string | null,
): Promise<AuthLoginThrottleDecision> {
  if (!hasThrottleContext(username, ipAddress)) {
    return ALLOWED_THROTTLE_DECISION
  }

  const { data, error } = await supabase.rpc("auth_login_throttle_check", {
    p_username: username,
    p_ip_address: ipAddress,
  })

  if (error) {
    throw error
  }

  const record = firstRecord(data)
  if (!record) {
    return ALLOWED_THROTTLE_DECISION
  }

  return {
    allowed: record.allowed !== false,
    blocked_until: typeof record.blocked_until === "string" ? record.blocked_until : null,
    retry_after_seconds: readRetryAfterSeconds(record.retry_after_seconds),
    blocked_scope: readThrottleScope(record.blocked_scope),
  }
}

/** Records a failed credentials login attempt for username+IP and IP-only buckets. */
export async function recordAuthLoginThrottleFailure(
  supabase: RpcClient,
  username: string | undefined,
  ipAddress: string | null,
): Promise<void> {
  if (!hasThrottleContext(username, ipAddress)) {
    return
  }

  const { data, error } = await supabase.rpc("auth_login_throttle_record_failure", {
    p_username: username,
    p_ip_address: ipAddress,
  })

  if (error) {
    throw error
  }

  if (data !== true) {
    throw new Error("auth_login_throttle_record_failure returned false")
  }
}

/** Clears the username+IP throttle bucket after a successful credentials login. */
export async function recordAuthLoginThrottleSuccess(
  supabase: RpcClient,
  username: string | undefined,
  ipAddress: string | null,
): Promise<void> {
  if (!hasThrottleContext(username, ipAddress)) {
    return
  }

  const { data, error } = await supabase.rpc("auth_login_throttle_record_success", {
    p_username: username,
    p_ip_address: ipAddress,
  })

  if (error) {
    throw error
  }

  if (data !== true) {
    throw new Error("auth_login_throttle_record_success returned false")
  }
}
