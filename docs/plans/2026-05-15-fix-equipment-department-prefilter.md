# TDD Plan: Fix Role User Equipment Department Pre-filter

## Summary

Fix the server-side department pre-filter used by `equipment_list_enhanced` for role `user`. Root cause is `public._normalize_department_scope(text)` only does whitespace, dash, and lowercase normalization, so it fails on Vietnamese Unicode composition and known department abbreviations.

Live evidence from unit `17`:

- `Ngoại Lồng Ngực` user value uses decomposed Vietnamese marks; equipment has `Ngoại Lồng Ngực`; current normalizer says not equal, NFC normalization makes them equal.
- `Ngoại Chấn Thương-Bỏng` user value does not match equipment `Ngoại CT-Bỏng`; accepted fix is scoped alias `CT` -> `Chấn Thương`.

## Key Changes

- Add a new Supabase migration after the latest local migration touching `_normalize_department_scope`, for example `supabase/migrations/20260515110000_fix_department_scope_unicode_aliases.sql`.
- Redefine only `public._normalize_department_scope(text)`:
  - Use Postgres `normalize(p_value, NFC)` before lower/trim.
  - Preserve current behavior for NBSP, CR/LF/tab, repeated whitespace, and dash variants.
  - Treat `aa-bb`, `aa- bb`, `aa -bb`, and `aa - bb` identically as `aa bb`.
  - Add token-boundary scoped alias replacement for department scope, at minimum `ct` -> `chấn thương`.
  - Keep `IMMUTABLE` and `SET search_path TO 'public', 'pg_temp'`.
- Do not change frontend filtering or `useEquipmentData`; the access filter is correctly enforced in RPC SQL.
- Do not change user/equipment data values; fix comparison semantics centrally.

## TDD Steps

1. Add failing SQL smoke coverage in `supabase/tests/equipment_department_scope_reads_smoke.sql` or a new focused smoke file:
   - Assert `_normalize_department_scope('Ngoại Lồng Ngực') = _normalize_department_scope('Ngoại Lồng Ngực')`.
   - Assert `_normalize_department_scope('Ngoại CT-Bỏng') = _normalize_department_scope('Ngoại Chấn Thương-Bỏng')`.
   - Assert all dash spacing forms normalize equally: `aa-bb`, `aa- bb`, `aa -bb`, `aa - bb`.
   - Assert empty/null behavior remains unchanged.
2. Run the focused SQL test against live DB or a transaction-wrapped smoke query before implementation; it must fail on the Unicode/alias cases.
3. Implement the migration with the smallest helper-only function change.
4. Apply via Supabase MCP `apply_migration`, not Supabase CLI.
5. Re-run focused SQL smoke:
   - Helper assertions pass.
   - Unit 17 user `92004-14` can match `Ngoại Lồng Ngực` equipment.
   - Unit 17 user `92004-13` can match `Ngoại CT-Bỏng` equipment.
6. Run existing affected smoke coverage:
   - `supabase/tests/equipment_department_scope_reads_smoke.sql`
   - `supabase/tests/equipment_list_enhanced_active_repair_smoke.sql`
   - Any existing report/read-scope smoke that uses `_normalize_department_scope`.
7. Run Supabase MCP `get_advisors(security)` after applying migration.

## Verification

- TypeScript gates are not required unless `.ts`/`.tsx` files are touched.
- If any TS/React files are touched unexpectedly, run:
  - `node scripts/npm-run.js run verify:no-explicit-any`
  - `node scripts/npm-run.js run typecheck`
  - focused Vitest
  - React Doctor diff against `main`
- Validate no broad fuzzy matching:
  - `Khoa Nội` must not match `Khoa Ngoại`.
  - Alias `ct` must be token-boundary based, not substring based.

## Assumptions

- `CT` in department scope means `Chấn Thương` for this system.
- The fix belongs in SQL helper normalization because `equipment_list_enhanced`, detail reads, report reads, repair reads, and transfer reads already share `_normalize_department_scope`.
- Data cleanup is out of scope; existing raw labels stay unchanged.
