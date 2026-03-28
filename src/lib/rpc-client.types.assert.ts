import { callRpc } from '@/lib/rpc-client'
import type { RpcOptions } from '@/lib/rpc-client'

void callRpc({ fn: 'ok' })
void callRpc({ fn: 'ok', args: { p_id: 1 } })

// @ts-expect-error args must be object-shaped
void callRpc({ fn: 'bad-number', args: 123 })

// @ts-expect-error args must be object-shaped
void callRpc({ fn: 'bad-array', args: ['x'] })

// @ts-expect-error generic args must satisfy RpcArgs
void callRpc<unknown, number>({ fn: 'bad-generic-number' })

// @ts-expect-error RpcOptions generic args must satisfy RpcArgs
const badOptions: RpcOptions<number> = { fn: 'bad-options' }
void badOptions

// @ts-expect-error args must reject Date objects
void callRpc({ fn: 'bad-date', args: new Date() })

// @ts-expect-error args must reject functions
void callRpc({ fn: 'bad-function', args: () => {} })
