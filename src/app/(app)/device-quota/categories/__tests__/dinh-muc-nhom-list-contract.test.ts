import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

describe('dinh_muc_nhom_list contract', () => {
  it('has a migration that returns active quota min and max fields', () => {
    const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations')
    const migrationFile = readdirSync(migrationsDir).find((file: string) =>
      file.includes('add_quota_fields_to_dinh_muc_nhom_list'),
    )

    expect(migrationFile).toBeTruthy()

    const migrationSource = readFileSync(
      path.join(migrationsDir, migrationFile!),
      'utf8',
    )

    expect(migrationSource).toContain(
      'DROP FUNCTION IF EXISTS public.dinh_muc_nhom_list(BIGINT);',
    )
    expect(migrationSource).toContain('CREATE OR REPLACE FUNCTION public.dinh_muc_nhom_list')
    expect(migrationSource).toContain('SET search_path = public, pg_temp')
    expect(migrationSource).toContain('RAISE EXCEPTION \'Missing role claim\'')
    expect(migrationSource).toContain('RAISE EXCEPTION \'Missing user_id claim\'')
    expect(migrationSource).toContain('so_luong_hien_co BIGINT')
    expect(migrationSource).toContain('so_luong_toi_da INT')
    expect(migrationSource).toContain('so_luong_toi_thieu INT')
    expect(migrationSource).toContain('active_quotas AS')
    expect(migrationSource).toContain('FROM public.chi_tiet_dinh_muc cd')
    expect(migrationSource).toContain('INNER JOIN public.quyet_dinh_dinh_muc qd')
    expect(migrationSource).toContain("qd.trang_thai = 'active'")
    expect(migrationSource).toContain('aq.so_luong_toi_da')
    expect(migrationSource).toContain('aq.so_luong_toi_thieu')
    expect(migrationSource).toContain(
      'GRANT EXECUTE ON FUNCTION public.dinh_muc_nhom_list(BIGINT) TO authenticated;',
    )
  })
})
