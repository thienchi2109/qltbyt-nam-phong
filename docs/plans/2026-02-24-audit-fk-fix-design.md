# Audit FK Fix for Device Quota Delete

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans after this design is approved.

**Goal:** Ensure `dinh_muc_quyet_dinh_delete` works for draft decisions with line items by eliminating all FK-driven mutations on `lich_su_dinh_muc` while preserving insert-time validation.

**Architecture Overview:**
- Remove the mutating FK `lich_su_dinh_muc.chi_tiet_id REFERENCES chi_tiet_dinh_muc(id) ON DELETE SET NULL`.
- Add a trigger + validator function similar to the existing decision validator so audit rows still check line-item existence at insert time.
- Confirm both `quyet_dinh_id` and `chi_tiet_id` use the same “validate on insert, never mutate later” pattern.
- Update regression SQL to cover decisions with line items.

## Constraints & Context
- Audit table is append-only via immutable trigger (update/delete prohibited).
- Line items (`chi_tiet_dinh_muc`) are cascade-deleted when decision is deleted; audit rows should simply retain snapshots without mutating references.
- We must keep validation semantics (user requested): insert-time check to ensure referenced decision/line item exists.

## Approach Options

1. **Drop FK and add trigger** *(Recommended)*
   - Mirror existing `validate_decision_audit_reference` for `chi_tiet_id`.
   - Ensures validation but avoids FK’s ON DELETE side effects.
   - Clean, consistent with previous fix.

2. **Allow ON DELETE SET NULL but disable immutable trigger for FK updates**
   - Would require special-case logic in immutable trigger to allow FK-driven updates.
   - Risky: weakens audit guarantees and complicates reasoning.

3. **Materialize snapshots only (no IDs)**
   - Remove both references entirely; rely solely on JSON snapshots.
   - Loses convenient joins / analytics.

**Chosen:** Option 1 (trigger validation), per user preference.

## High-Level Design

### 1. Migration
- New migration (e.g., `20260224_drop_chi_tiet_audit_fk.sql`).
- Steps:
  1. `LOCK TABLE public.lich_su_dinh_muc IN SHARE ROW EXCLUSIVE MODE;`
  2. Drop FK `lich_su_dinh_muc_chi_tiet_id_fkey`.
  3. Create validator function `validate_chi_tiet_audit_reference()` similar to decision validator.
  4. Create trigger `trg_validate_chi_tiet_audit_reference` BEFORE INSERT when `NEW.chi_tiet_id IS NOT NULL`.
- Reuse best practices: `schema-immutability`, `lock-ddl-safe-migration`.

### 2. Regression Test Enhancements
- Update `supabase/tests/device_quota/dinh_muc_quyet_dinh_delete.sql` to:
  - Create a draft decision and at least one line item (call appropriate RPC or insert directly).
  - Attempt delete, expecting failure pre-fix and success post-fix.
- Use Supabase MCP to execute tests (since `psql` absent).

### 3. Documentation
- Update `docs/device-quota/PLAN.md` to note both references use insert-time triggers.
- Append verification notes to the existing plan/design doc for traceability.

### 4. Risk Mitigation
- Ensure validator functions are SECURITY DEFINER with strict search_path.
- Consider adding unit tests for validator (via SQL DO blocks) verifying invalid `chi_tiet_id` raises exception.

### 5. Open Questions
- None (user confirmed we should keep insert-time validation).

Please review this design. If it looks good, I’ll proceed to implementation planning via `superpowers:writing-plans`.
