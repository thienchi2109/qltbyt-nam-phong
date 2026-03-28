type RpcArgs = Record<string, unknown> | undefined

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getRpcErrorPayload(data: unknown): unknown {
  if (!isRecord(data)) {
    return data
  }
  return data.error ?? data
}

function getRpcErrorMessage(fn: string, status: number, payload: unknown): string {
  const fallback = `RPC ${fn} failed (${status})`

  if (typeof payload === 'string') {
    return payload
  }

  if (isRecord(payload)) {
    const message = payload.message
    if (typeof message === 'string' && message) {
      return message
    }

    const hint = payload.hint
    if (typeof hint === 'string' && hint) {
      return hint
    }

    const details = payload.details
    if (typeof details === 'string' && details) {
      return details
    }
  }

  try {
    const serialized = JSON.stringify(payload)
    return serialized || fallback
  } catch {
    return fallback
  }
}

export type RpcOptions<TArgs extends RpcArgs = RpcArgs> = {
  fn: string
  args?: TArgs
  headers?: Record<string, string>
  signal?: AbortSignal
}

export async function callRpc<TRes = unknown, TArgs extends RpcArgs = RpcArgs>({
  fn,
  args,
  headers,
  signal,
}: RpcOptions<TArgs>): Promise<TRes> {
  const res = await fetch(`/api/rpc/${encodeURIComponent(fn)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: JSON.stringify(args ?? {}),
    signal,
  })
  if (!res.ok) {
    let msg = `RPC ${fn} failed (${res.status})`
    try {
      const data = await res.json()
      const err = getRpcErrorPayload(data)
      msg = getRpcErrorMessage(fn, res.status, err)
      try { console.error(`[rpc-client] ${fn} error ${res.status}:`, err) } catch {}
    } catch {}
    throw new Error(msg)
  }
  return (await res.json()) as TRes
}
