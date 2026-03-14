import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

describe('equipmentLookup contract shape', () => {
  it('maps to ai_equipment_lookup RPC', async () => {
    const { getToolRpcMapping } = await import('@/lib/ai/tools/registry')
    const mapping = getToolRpcMapping()
    expect(mapping.equipmentLookup).toBe('ai_equipment_lookup')
  })

  it('input schema accepts structured filters and rejects unknown fields', async () => {
    const { READ_ONLY_TOOL_DEFINITIONS_FOR_TEST } = await import(
      '@/lib/ai/tools/registry'
    )
    const def = READ_ONLY_TOOL_DEFINITIONS_FOR_TEST.equipmentLookup
    expect(def).toBeDefined()

    const schema = def.inputSchema as import('zod').ZodObject<Record<string, unknown>>
    expect(Object.keys(schema.shape)).toEqual(['query', 'limit', 'status', 'filters'])

    expect(
      schema.safeParse({
        query: 'bơm tiêm điện',
        limit: 10,
        filters: {
          status: 'Ngưng sử dụng',
          department: 'ICU',
          location: 'Phòng mổ',
          classification: 'C',
          model: 'SP-200',
          serial: 'SN-001',
        },
      }).success,
    ).toBe(true)

    expect(
      schema.safeParse({
        filters: {
          status: 'Ngưng sử dụng',
          extra: true,
        },
        extra: true,
      }).success,
    ).toBe(false)
  })

  it('description mentions structured equipment filtering', async () => {
    const { READ_ONLY_TOOL_DEFINITIONS_FOR_TEST } = await import(
      '@/lib/ai/tools/registry'
    )
    const def = READ_ONLY_TOOL_DEFINITIONS_FOR_TEST.equipmentLookup

    expect(def.description).toMatch(/filters/i)
    expect(def.description).toMatch(/department/i)
    expect(def.description).toMatch(/location/i)
    expect(def.description).toMatch(/equipment/i)
  })

  it('has a patch migration that supports structured filters for ai_equipment_lookup', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20260314143000_fix_ai_equipment_lookup_status_filter.sql',
    )
    const migrationSource = readFileSync(migrationPath, 'utf8')

    expect(migrationSource).toContain('filters JSONB DEFAULT NULL')
    expect(migrationSource).toContain('status TEXT DEFAULT NULL')
    expect(migrationSource).toContain("v_filters JSONB := COALESCE(filters, '{}'::JSONB);")
    expect(migrationSource).toContain(
      "COALESCE(v_filters->>'status', status)"
    )
    expect(migrationSource).toContain("v_department_filter_raw TEXT := NULLIF(BTRIM(COALESCE(v_filters->>'department'")
    expect(migrationSource).toContain('tb.khoa_phong_quan_ly')
    expect(migrationSource).toContain('tb.vi_tri_lap_dat')
    expect(migrationSource).toContain('tb.phan_loai_theo_nd98')
    expect(migrationSource).toContain('tb.tinh_trang_hien_tai')
    expect(migrationSource).toContain('v_department_filter IS NULL')
    expect(migrationSource).toContain('v_location_filter IS NULL')
  })
})
