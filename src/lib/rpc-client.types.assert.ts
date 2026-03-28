import { callRpc } from '@/lib/rpc-client'

void callRpc({ fn: 'ok' })
void callRpc({ fn: 'ok', args: { p_id: 1 } })

// @ts-expect-error args must be object-shaped
void callRpc({ fn: 'bad-number', args: 123 })

// @ts-expect-error args must be object-shaped
void callRpc({ fn: 'bad-array', args: ['x'] })
