# Tenant-Aware Print Locations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every known hardcoded print-form location with the printed tenant's curated `dia_ban.ten_dia_ban` value.

**Architecture:** Extend the existing `don_vi_branding_get(bigint)` RPC and `useTenantBranding` contract with nullable `print_location`. Each print flow must resolve branding from the owner tenant of the record being printed, then render the location as an editable value with a blank fallback.

**Tech Stack:** Next.js, React, TypeScript, Vitest, TanStack Query, Supabase Postgres.

---

## Scope

The comprehensive source scan found four hardcoded print locations:

| Print flow            | Production file                                                  | Tenant owner                                  |
| --------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| Equipment profile     | `src/components/equipment/equipment-print-utils.ts`              | Printed equipment `don_vi`                    |
| Maintenance plan      | `src/app/(app)/maintenance/_hooks/maintenance-print-template.ts` | `selectedPlan.don_vi`                         |
| Repair request sheet  | `src/app/(app)/repair-requests/request-sheet.ts`                 | `requestToPrint.thiet_bi.facility_id`         |
| Demo maintenance form | `src/components/maintenance-form.tsx`                            | Explicit `tenantId`, otherwise session tenant |

Required tenant-context corrections:

- Maintenance must call `don_vi_branding_get` with `selectedPlan.don_vi`, not `p_id: null`.
- Repair printing must call `useTenantBranding` with the printed equipment's `facility_id`.
- Equipment global/admin printing must leave location blank if equipment-tenant branding fails; it must not reuse another session tenant's location.

Explicit non-scope:

- No new database column.
- No data backfill or live `dia_ban` update.
- No `BTRIM`, prefix removal, province/city inference, or other string normalization.
- No cleanup of organization-name hardcodes in:
  - `src/app/(app)/repair-requests/_hooks/useRepairRequestUIHandlers.ts`
  - `src/app/(app)/transfers/_components/handover-preview-dialog.document.ts`
  - `src/app/(app)/forms/maintenance/page.tsx`
- No live database write without a separate, explicit user approval.

## Data Contract

`dia_ban.ten_dia_ban` is the source of truth and is returned unchanged:

```sql
db.ten_dia_ban AS print_location
```

Expected curated values include `An Giang`, `Cần Thơ`, and `Hà Nội`. A missing row or `NULL` value renders as an empty editable location. The UI must not infer a replacement.

## PR Strategy

Use one PR with eight GREEN feature commits. Each phase below must pass its focused tests before its commit.

| Phase | Review unit                                 | Commit                                                    |
| ----- | ------------------------------------------- | --------------------------------------------------------- |
| 0     | Baseline and reproducible blast-radius scan | No commit                                                 |
| 1     | RPC migration contract                      | `feat(db): expose tenant print location in branding`      |
| 2     | Shared branding mapping                     | `feat(branding): include tenant print location`           |
| 3     | Equipment profile                           | `fix(equipment): use tenant location in profile sheet`    |
| 4     | Maintenance owner-tenant resolution         | `fix(maintenance): resolve print branding by plan tenant` |
| 5     | Maintenance template                        | `fix(maintenance): use tenant location in plan sheet`     |
| 6     | Repair owner-tenant resolution              | `fix(repair): resolve print branding by equipment tenant` |
| 7     | Repair sheet contract and rendering         | `fix(repair): use tenant location in request sheet`       |
| 8     | Demo maintenance form                       | `fix(forms): remove hardcoded maintenance location`       |
| 9     | Integrated gates and PR review              | Fix-only commit if required                               |
| 10    | Permission-gated live deployment            | No planned repo commit                                    |

## Chunk 1: Phase 0 - Baseline And Scope Lock

### Task 0: Reproduce The Blast Radius

**Files:** No edits.

- [ ] Invoke `karpathy-coding-heuristics`, `superpowers:test-driven-development`, `code-deduplication`, `next-best-practices`, and `react-best-practices` before implementation.

- [ ] Confirm branch and worktree state:

```bash
git status --short --branch
git branch --show-current
```

- [ ] Run a broad, repository-wide print-location scan through `context-mode`, not only an exact `Cần Thơ, ngày` search:

```bash
rg -n --glob '*.{ts,tsx,js,jsx}' \
  '(Cần Thơ|Hà Nội|An Giang|,\s*ngày|ngày\s*(\$\{|[0-9])|tháng\s*(\$\{|[0-9]))' \
  src
```

Classify every hit as:

1. in-scope print location,
2. non-scope organization name,
3. test fixture/assertion,
4. unrelated date text.

Record the four in-scope files listed above. Do not silently ignore organization-name hits.

- [ ] Use Code Review Graph first, then GitNexus impact/context for:
  - `generateProfileSheet`
  - `resolveBranding`
  - `fetchTenantBranding`
  - `useMaintenancePrint`
  - `buildPrintTemplate`
  - `RepairRequestsPrintOptionsDialog`
  - `useRepairRequestUIHandlers`
  - `buildRepairRequestSheetHtml`
  - `MaintenanceForm`

- [ ] Calculate migration order recursively. Current verified latest local migration is `20260727090000_technical_configuration_comparison_reads.sql`; planned `20260728082127_don_vi_branding_print_location.sql` sorts after it. Recheck immediately before creating the file:

```bash
find supabase/migrations -type f -name '*.sql' -printf '%f\n' | sort | tail -1
```

- [ ] Run focused baseline tests for all affected flows and stop if failures are unrelated to this change.

## Chunk 2: Phase 1 - Branding RPC Migration

### Task 1: Add `print_location` With True RED-GREEN

**Files:**

- Create: `src/app/api/rpc/__tests__/don-vi-branding-print-location-migration.test.ts`
- Create: `supabase/migrations/20260728082127_don_vi_branding_print_location.sql`

- [ ] Write the migration contract test before the migration file exists.

The test must:

- recursively enumerate every `.sql` file under `supabase/migrations`,
- prove the planned filename sorts after all earlier local migrations,
- read the planned migration without swallowing `ENOENT`,
- require `DROP FUNCTION IF EXISTS public.don_vi_branding_get(bigint)`,
- require a `RETURNS TABLE` column `print_location text`,
- require `LEFT JOIN public.dia_ban db ON db.id = d.dia_ban_id`,
- require the exact projection `db.ten_dia_ban AS print_location`,
- reject `BTRIM`, `UPDATE`, and hardcoded geographic values,
- preserve the current JWT fallback, `missing_don_vi_claim`, and `tenant_mismatch` guards,
- preserve invoker security,
- verify grants with whitespace-tolerant regular expressions,
- require effective `EXECUTE` for `PUBLIC`, `anon`, `authenticated`, and `service_role`.

- [ ] Run the focused test and verify first RED:

```bash
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/don-vi-branding-print-location-migration.test.ts
```

Expected: FAIL because the migration file is missing.

- [ ] Create only a comment-only migration skeleton, rerun, and verify second RED.

Expected: file-order assertion passes; function, projection, guard, and grant assertions fail.

- [ ] Implement the minimal additive migration.

Required SQL shape:

```sql
-- Expose the tenant's curated dia_ban label as printable location.
-- This migration performs no normalization or data write.

DROP FUNCTION IF EXISTS public.don_vi_branding_get(bigint);

CREATE FUNCTION public.don_vi_branding_get(p_id bigint DEFAULT NULL)
RETURNS TABLE (
  id bigint,
  name text,
  logo_url text,
  print_location text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text;
  v_role_fallback text;
  v_claim_don_vi bigint;
  v_effective_id bigint;
BEGIN
  v_role := lower(coalesce(public._get_jwt_claim('app_role')::text, ''));
  v_role_fallback := lower(coalesce(public._get_jwt_claim('role')::text, ''));
  IF v_role = '' THEN
    v_role := v_role_fallback;
  END IF;

  v_claim_don_vi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;

  -- The RPC proxy normalizes admin to global before signing the JWT.
  IF v_role = 'global' THEN
    v_effective_id := COALESCE(p_id, v_claim_don_vi);
  ELSE
    v_effective_id := v_claim_don_vi;
    IF v_effective_id IS NULL THEN
      RAISE EXCEPTION 'Thiếu thông tin đơn vị trong phiên đăng nhập'
        USING HINT = 'missing_don_vi_claim';
    END IF;
    IF p_id IS NOT NULL AND p_id <> v_effective_id THEN
      RAISE EXCEPTION 'Forbidden'
        USING HINT = 'tenant_mismatch';
    END IF;
  END IF;

  IF v_effective_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.logo_url,
    db.ten_dia_ban AS print_location
  FROM public.don_vi d
  LEFT JOIN public.dia_ban db ON db.id = d.dia_ban_id
  WHERE d.id = v_effective_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.don_vi_branding_get(bigint) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.don_vi_branding_get(bigint)
  TO anon, authenticated, service_role;
```

Copy the current function's full role/tenant guard body unchanged around the new projection. Do not edit an older migration.

- [ ] Run the focused test and verify GREEN.

- [ ] Commit Phase 1:

```bash
git add \
  src/app/api/rpc/__tests__/don-vi-branding-print-location-migration.test.ts \
  supabase/migrations/20260728082127_don_vi_branding_print_location.sql
git commit -m "feat(db): expose tenant print location in branding"
```

## Chunk 3: Phase 2 - Shared Branding Mapping

### Task 2: Carry `print_location` Through `useTenantBranding`

**Files:**

- Modify: `src/hooks/use-tenant-branding.ts`
- Modify: `src/hooks/__tests__/use-tenant-branding.test.ts`
- Modify literal `TenantBranding` fixtures only if typecheck requires it.

- [ ] Add failing hook tests for:
  - RPC value `"An Giang"` maps unchanged,
  - missing/undefined `print_location` maps to `null`,
  - existing tenant-selection behavior remains unchanged.

- [ ] Run and verify RED:

```bash
node scripts/npm-run.js run test:run -- src/hooks/__tests__/use-tenant-branding.test.ts
```

- [ ] Add the minimal shared contract:

```typescript
export type TenantBranding = {
  id: number
  name: string | null
  logo_url: string | null
  print_location: string | null
}
```

Map only:

```typescript
print_location: row.print_location ?? null
```

- [ ] Run hook tests and typecheck; update only fixtures made invalid by the added required field.

- [ ] Commit Phase 2:

```bash
git add src/hooks/use-tenant-branding.ts src/hooks/__tests__/use-tenant-branding.test.ts
git commit -m "feat(branding): include tenant print location"
```

## Chunk 4: Phase 3 - Equipment Profile

### Task 3: Use Only Equipment-Owned Location

**Files:**

- Modify: `src/components/equipment/equipment-print-utils.ts`
- Modify: `src/components/__tests__/equipment-print-utils.test.ts`
- Verify: `src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts`

- [ ] Add failing tests for:
  - equipment tenant branding renders `An Giang`,
  - location is HTML escaped,
  - missing location renders an empty editable input,
  - global/admin equipment-tenant lookup failure does not render another session tenant's location.

Use both raw `global` and `admin` roles in the regression matrix because this code is outside the RPC proxy and must use `isGlobalRole()`.

- [ ] Run equipment print tests and verify RED.

- [ ] After the existing `brandingToUse` resolution, derive:

```typescript
const printLocation =
  isGlobalRole(context.userRole) && equipment.don_vi && brandingToUse?.id !== equipment.don_vi
    ? ""
    : (brandingToUse?.print_location ?? "")
```

Render the editable input with `formatValue(printLocation)`. Preserve existing organization-name and logo fallback behavior.

- [ ] Run focused print and export tests; verify GREEN.

- [ ] Commit Phase 3.

## Chunk 5: Phase 4 - Maintenance Owner Tenant

### Task 4: Fetch Branding For `selectedPlan.don_vi`

**Files:**

- Create: `src/app/(app)/maintenance/_hooks/__tests__/use-maintenance-print.test.tsx`
- Modify: `src/app/(app)/maintenance/_hooks/use-maintenance-print.ts`

- [ ] Add a failing hook test asserting:

```typescript
expect(callRpc).toHaveBeenCalledWith({
  fn: "don_vi_branding_get",
  args: { p_id: selectedPlan.don_vi },
})
```

Also assert that the current organization name and logo passed to `buildPrintTemplate` come from that RPC result.

- [ ] Run and verify RED because the hook currently sends `p_id: null`.

- [ ] Implement only owner-tenant branding resolution in this phase:

```typescript
const brandingResult = await callRpc<TenantBranding[]>({
  fn: "don_vi_branding_get",
  args: { p_id: selectedPlan.don_vi },
})
const tenantBranding = brandingResult?.[0] ?? null
```

Do not add `printLocation` to `buildPrintTemplate` yet; its contract changes in Phase 5 so this commit remains type-correct and GREEN.

- [ ] Run the hook test and typecheck; verify GREEN.

- [ ] Commit Phase 4.

## Chunk 6: Phase 5 - Maintenance Template

### Task 5: Render Tenant Location In The Plan Sheet

**Files:**

- Create: `src/app/(app)/maintenance/_hooks/__tests__/maintenance-print-template.test.ts`
- Modify: `src/app/(app)/maintenance/_hooks/maintenance-print-template.ts`
- Modify: `src/app/(app)/maintenance/_hooks/use-maintenance-print.ts`
- Modify: `src/app/(app)/maintenance/_hooks/__tests__/use-maintenance-print.test.tsx`

- [ ] First add failing template tests for:
  - `An Giang, ngày ...`,
  - blank location renders `ngày ...` without a leading comma,
  - location is HTML escaped,
  - the location remains an editable input.

Assert the generated location control has `type="text"`, the escaped `value`, and neither `readonly` nor `disabled`. Assert the separator is adjacent to the input: a populated value is followed by `, ngày`, while an empty value is followed by `ngày` without a comma.

- [ ] Add a failing hook forwarding test expecting:

```typescript
expect(buildPrintTemplate).toHaveBeenCalledWith(
  expect.objectContaining({ printLocation: "An Giang" })
)
```

Add an RPC failure case expecting `printLocation: ""` while preserving the current organization-name/logo fallbacks.

- [ ] Run both focused test files and verify RED before production edits.

- [ ] Extend `buildPrintTemplate` with `printLocation: string`, replace the literal `Cần Thơ`, and render the same editable control shape as the existing date inputs:

```typescript
const locationSeparator = printLocation ? ", " : ""
```

```html
<input
  type="text"
  class="form-input-line w-24"
  value="${formatValue(printLocation)}"
/>${locationSeparator}ngày
```

- [ ] Forward:

```typescript
printLocation: tenantBranding?.print_location ?? ""
```

from `useMaintenancePrint`.

- [ ] Run both focused tests and typecheck; verify GREEN.

- [ ] Commit Phase 5.

## Chunk 7: Phase 6 - Repair Owner Tenant

### Task 6: Resolve Branding From Printed Equipment

**Files:**

- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsPrintOptionsDialog.tsx`
- Modify: `src/app/(app)/repair-requests/__tests__/RepairRequestsPrintOptionsDialog.test.tsx`

- [ ] Make `useTenantBranding` observable in the dialog test.

- [ ] Add failing assertions for:

```typescript
useTenantBranding({
  formTenantId: requestToPrint?.thiet_bi?.facility_id ?? null,
  useFormContext: true,
})
```

Cover both a populated request and `requestToPrint = null`.

- [ ] Run the dialog test and verify RED.

- [ ] Move `requestToPrint` lookup before the branding hook and implement only the tenant-selection change above.

Do not change the handler's branding type or forward `printLocation` in this phase.

- [ ] Run the dialog test and typecheck; verify GREEN.

- [ ] Commit Phase 6.

## Chunk 8: Phase 7 - Repair Sheet

### Task 7: Extend The Contract Before Forwarding Location

**Files:**

- Modify: `src/app/(app)/repair-requests/_hooks/useRepairRequestUIHandlers.ts`
- Modify: `src/app/(app)/repair-requests/__tests__/useRepairRequestUIHandlers.test.ts`
- Modify: `src/app/(app)/repair-requests/request-sheet.ts`
- Modify: `src/app/(app)/repair-requests/__tests__/request-sheet.test.ts`

- [ ] Before production edits, add failing handler tests that expect `printLocation: "An Giang"` to be forwarded from `TenantBranding`.

- [ ] Before production edits, add failing sheet tests for:
  - `An Giang, ngày 01 tháng 05 năm 2026`,
  - blank location produces `ngày 01 tháng 05 năm 2026`,
  - HTML escaping,
  - no hardcoded `Cần Thơ, ngày`.

- [ ] Run handler and sheet tests together and verify RED.

- [ ] Change the handler's local branding input to `TenantBranding | null | undefined` and forward:

```typescript
printLocation: branding?.print_location ?? ""
```

- [ ] Extend the sheet contract:

```typescript
export type RepairRequestSheetBranding = {
  organizationName: string
  logoUrl: string
  printLocation: string
}
```

Build the date line with an escaped optional prefix:

```typescript
const locationPrefix = branding.printLocation ? `${formatValue(branding.printLocation)}, ` : ""
```

Reuse or minimally strengthen the file-local HTML escaping. Do not create a shared print utility in this PR.

- [ ] Run both focused tests and typecheck; verify GREEN.

- [ ] Commit Phase 7.

## Chunk 9: Phase 8 - Demo Maintenance Form

### Task 8: Remove The Final Location Literal

**Files:**

- Create: `src/components/__tests__/maintenance-form.location.test.tsx`
- Modify: `src/components/maintenance-form.tsx`
- Verify existing source-guard tests under `src/__tests__`.

- [ ] Add failing tests for:
  - `tenantId={7}` uses form tenant branding,
  - missing `print_location` produces an empty editable input,
  - omitting `tenantId` uses session-tenant mode,
  - no hardcoded `Cần Thơ, ngày` remains.

The no-`tenantId` test must assert:

```typescript
useTenantBranding({
  formTenantId: null,
  useFormContext: false,
})
```

- [ ] Run and verify RED.

- [ ] Implement:

```typescript
const normalizedTenantId = tenantId ?? null
const { data: branding } = useTenantBranding({
  formTenantId: normalizedTenantId,
  useFormContext: tenantId != null,
})
```

Render `branding?.print_location ?? ""` as the editable location before `", ngày "`.

- [ ] Run the new component test, existing source guards, and typecheck; verify GREEN.

- [ ] Commit Phase 8.

## Chunk 10: Phase 9 - Integrated Verification

### Task 9: Run Gates And Reproduce The Final Scan

**Files:** No planned source changes.

- [ ] Run the required TypeScript/React verification chain in one sequential `ctx_batch_execute`:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/don-vi-branding-print-location-migration.test.ts \
  src/hooks/__tests__/use-tenant-branding.test.ts \
  src/components/__tests__/equipment-print-utils.test.ts \
  "src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts" \
  "src/app/(app)/maintenance/_hooks/__tests__/use-maintenance-print.test.tsx" \
  "src/app/(app)/maintenance/_hooks/__tests__/maintenance-print-template.test.ts" \
  "src/app/(app)/repair-requests/__tests__/RepairRequestsPrintOptionsDialog.test.tsx" \
  "src/app/(app)/repair-requests/__tests__/useRepairRequestUIHandlers.test.ts" \
  "src/app/(app)/repair-requests/__tests__/request-sheet.test.ts" \
  src/components/__tests__/maintenance-form.location.test.tsx
node scripts/npm-run.js run react-doctor
```

- [ ] Repeat the broad scan independently:

```bash
rg -n --glob '*.{ts,tsx,js,jsx}' \
  '(Cần Thơ|Hà Nội|An Giang|,\s*ngày|ngày\s*(\$\{|[0-9])|tháng\s*(\$\{|[0-9]))' \
  src
```

Compare categories, not only exact string counts:

- four in-scope production location literals are gone,
- dynamic date-line builders remain expected,
- organization-name hardcodes remain explicitly non-scope,
- test fixtures/assertions remain understandable,
- no new geographic literal was introduced.

- [ ] Run Code Review Graph change detection and GitNexus change impact for the changed files.

- [ ] Inspect:

```bash
git diff origin/main...HEAD --check
git log --oneline origin/main..HEAD
```

Expected: eight small GREEN feature commits, no backfill, no organization-name cleanup, and no unrelated refactor.

- [ ] Request code review and fix every valid Critical/Important finding before opening or updating the PR.

## Chunk 11: Phase 10 - Permission-Gated Live Deployment

### Task 10: Apply Only After Separate Approval

**Files:** No planned repo changes.

- [ ] Ask exactly for permission to apply the prepared migration to live Supabase through MCP. Plan approval is not live-write approval.

- [ ] If explicitly approved, apply only with Supabase MCP project `cdthersvldpnlbvpufrr`. Never use Supabase CLI or `db:*` scripts.

- [ ] Verify the exact function signature and effective privileges read-only:

```sql
WITH target AS (
  SELECT 'public.don_vi_branding_get(bigint)'::regprocedure AS oid
)
SELECT
  pg_get_function_result(p.oid) AS result_type,
  p.prosecdef,
  pg_get_functiondef(p.oid) AS function_definition,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
    WHERE acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) AS public_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AS authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE')
    AS service_role_can_execute
FROM target
JOIN pg_proc p ON p.oid = target.oid;
```

Verify:

- result contains `print_location text`,
- `prosecdef = false`,
- `PUBLIC`, `anon`, `authenticated`, and `service_role` can execute,
- definition contains `db.ten_dia_ban AS print_location`,
- current role fallback and tenant guards remain,
- no `UPDATE`, `BTRIM`, normalization, or hardcoded location exists.

- [ ] Query `don_vi` joined to `dia_ban` read-only and report blank/unexpected `ten_dia_ban` values. Do not correct data without another explicit write approval.

- [ ] Run Supabase security advisors after migration.

## Completion Criteria

- All four hardcoded print locations are replaced.
- Every print uses the owner tenant's branding context.
- Global/admin equipment fallback cannot leak another tenant's location.
- `dia_ban.ten_dia_ban` is used unchanged.
- Blank location remains editable and does not produce a leading comma.
- All focused tests and repository gates pass.
- No live DB write occurs without explicit approval.
