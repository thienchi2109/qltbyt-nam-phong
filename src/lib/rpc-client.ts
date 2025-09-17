export type RpcOptions<TArgs> = {
  fn: string
  args?: TArgs
  headers?: Record<string, string>
  signal?: AbortSignal
}

export async function callRpc<TRes = unknown, TArgs = any>({ fn, args, headers, signal }: RpcOptions<TArgs>): Promise<TRes> {
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
      const err = (data && (data.error ?? data)) as any
      if (typeof err === 'string') {
        msg = err
      } else if (err && typeof err === 'object') {
        msg = err.message || err.hint || err.details || JSON.stringify(err)
      }
      try { console.error(`[rpc-client] ${fn} error ${res.status}:`, err) } catch {}
    } catch {}
    throw new Error(msg)
  }
  return (await res.json()) as TRes
}
