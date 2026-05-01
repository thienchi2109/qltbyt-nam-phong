import { describe, it, expect } from 'vitest'

import { POST } from '../[fn]/route'

async function invokeRpcProxy(fn: string) {
  const req = new Request(`http://localhost/api/rpc/${fn}`, { method: 'POST' })
  return POST(req as never, { params: Promise.resolve({ fn }) })
}

describe('RPC proxy whitelist', () => {
  it('rejects unknown RPC functions', async () => {
    const res = await invokeRpcProxy('unknown_rpc_fn')
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Function not allowed' })
  })

  it('allows equipment_bulk_delete through whitelist checks', async () => {
    const res = await invokeRpcProxy('equipment_bulk_delete')

    // Whitelist check passed; next guard is missing Content-Length.
    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: 'Content-Length header required' })
  })

  it('allows transfer_request_get through whitelist checks', async () => {
    const res = await invokeRpcProxy('transfer_request_get')

    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: 'Content-Length header required' })
  })

  it('allows repair_request_change_history_list through whitelist checks', async () => {
    const res = await invokeRpcProxy('repair_request_change_history_list')

    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: 'Content-Length header required' })
  })

  it('allows dashboard_recent_activities through whitelist checks', async () => {
    const res = await invokeRpcProxy('dashboard_recent_activities')

    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: 'Content-Length header required' })
  })

  it.each([
    'equipment_filter_buckets',
    'dashboard_kpi_summary',
  ])('allows performance RPC "%s" through whitelist checks', async (fn) => {
    const res = await invokeRpcProxy(fn)

    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: 'Content-Length header required' })
  })

  it.each([
    'ai_equipment_lookup',
    'ai_maintenance_summary',
    'ai_maintenance_plan_lookup',
    'ai_repair_summary',
    'ai_usage_summary',
    'ai_attachment_metadata',
    'ai_device_quota_lookup',
    'ai_quota_compliance_summary',
    'ai_category_suggestion',
    'ai_department_list',
  ])('allows AI RPC "%s" through whitelist checks', async (fn) => {
    const res = await invokeRpcProxy(fn)

    // Whitelist check passed; next guard is missing Content-Length.
    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: 'Content-Length header required' })
  })

  it('rejects non-existent AI RPC', async () => {
    const res = await invokeRpcProxy('ai_does_not_exist')
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Function not allowed' })
  })

  it('rejects ai_query_database before any SQL runtime path is introduced', async () => {
    const res = await invokeRpcProxy('ai_query_database')
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Function not allowed' })
  })

  it('allows assistant_query_database_audit_log through whitelist checks', async () => {
    const res = await invokeRpcProxy('assistant_query_database_audit_log')

    // Whitelist check passed; next guard is missing Content-Length.
    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: 'Content-Length header required' })
  })

  it('allows dinh_muc_unified_import through whitelist checks', async () => {
    const res = await invokeRpcProxy('dinh_muc_unified_import')

    // Whitelist check passed; next guard is missing Content-Length.
    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: 'Content-Length header required' })
  })

  it('allows hybrid_search_category_batch through whitelist checks', async () => {
    const res = await invokeRpcProxy('hybrid_search_category_batch')

    // Whitelist check passed; next guard is missing Content-Length.
    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: 'Content-Length header required' })
  })

  it('allows dinh_muc_thiet_bi_unassigned_names through whitelist checks', async () => {
    const res = await invokeRpcProxy('dinh_muc_thiet_bi_unassigned_names')

    // Whitelist check passed; next guard is missing Content-Length.
    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: 'Content-Length header required' })
  })
})
