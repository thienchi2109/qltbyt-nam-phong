export interface RpcToolExecutionParams {
  request: Request
  rpcFunction: string
  args: Record<string, unknown>
}

function buildRpcUrl(request: Request, rpcFunction: string): string {
  const origin = new URL(request.url).origin
  return new URL(`/api/rpc/${encodeURIComponent(rpcFunction)}`, origin).toString()
}

export async function executeRpcTool({
  request,
  rpcFunction,
  args,
}: RpcToolExecutionParams): Promise<unknown> {
  const headers = new Headers({ 'content-type': 'application/json' })
  const cookie = request.headers.get('cookie')
  if (cookie) {
    headers.set('cookie', cookie)
  }

  const response = await fetch(buildRpcUrl(request, rpcFunction), {
    method: 'POST',
    headers,
    cache: 'no-store',
    body: JSON.stringify(args),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`RPC tool "${rpcFunction}" failed`)
  }

  return payload
}
