# P1 Dossier Foundation And Authorization TDD Plan

> **Execution:** implement in the current session without subagents. Preserve RED-GREEN evidence for every production change.

**Goal:** Add the backend-only dossier foundation for TC-01, TC-02, TC-19 and TC-20, deferring live apply until explicit approval and then completing post-apply verification.

**Architecture:** One deny-by-default UUID dossier table is the configuration lineage root. Five `SECURITY DEFINER` RPCs provide bounded reads and revision-guarded writes; internal helpers centralize global-role authorization and the reusable archived-dossier guard. The RPC proxy receives only the five P1 names, and TypeScript types document snake_case wire contracts separately from future adapter/domain mapping.

**Tech stack:** PostgreSQL/Supabase migration SQL, Next.js RPC allowlist, TypeScript and Vitest.

---

## Chunk 1: Contract Backfill And RED Tests

### Task 1: Freeze exact P1 schema and RPC signatures

**Files:**

- Modify: `openspec/changes/add-technical-configuration-comparison/contracts.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/design.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/implementation-plan.md`

- [x] Record the approved dossier columns, required trimmed fields and five exact RPC signatures.
- [x] Run `openspec validate add-technical-configuration-comparison --strict`.
- [x] Commit the contract backfill with the implementation after RED-GREEN verification.

### Task 2: Add failing RPC whitelist coverage

**Files:**

- Create: `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`

- [x] Assert all five dossier RPC names exist in `ALLOWED_FUNCTIONS`.
- [x] Assert each name reaches the proxy guard after the whitelist instead of returning `403`.
- [x] Run:

```bash
node scripts/npm-run.js run test:run -- src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts
```

- [x] Verify RED because the five names are not allowlisted.

### Task 3: Add failing migration contract coverage

**Files:**

- Create: `src/app/api/rpc/__tests__/technical-configuration-dossier-migration.test.ts`

- [x] Assert exactly one P1 migration exists.
- [x] Assert the dossier schema, UUID identity, audit/archive columns, non-empty checks and no `thiet_bi` or lineage dependency.
- [x] Assert five exact RPC signatures, JSON wire shapes, bounded pagination and default archived filtering.
- [x] Assert global/admin authorization, missing-claim denial, `SECURITY DEFINER`, pinned `search_path`, RLS, explicit grants and no direct Data API access.
- [x] Assert create revision `0`, update/archive revision checks, `FOR UPDATE`, atomic increments and frozen errors.
- [x] Assert the reusable archive guard rejects archived dossier and descendant mutations.
- [x] Run:

```bash
node scripts/npm-run.js run test:run -- src/app/api/rpc/__tests__/technical-configuration-dossier-migration.test.ts
```

- [x] Verify RED because the migration does not exist.

## Chunk 2: GREEN Implementation

### Task 4: Add the minimal migration

**Files:**

- Create: `supabase/migrations/20260712112500_technical_configuration_dossier_foundation.sql`

- [x] Create `technical_configuration_dossiers` and only list-path indexes.
- [x] Enable RLS, add deny policies and revoke direct client table privileges.
- [x] Add internal global-role and editable-dossier helpers with client execution revoked.
- [x] Add list/get/create/update/archive RPCs with explicit selected columns and JSON envelopes.
- [x] Grant only the five public module RPCs to `authenticated`.
- [x] Rerun the migration contract test until GREEN.

### Task 5: Add allowlist entries and wire types

**Files:**

- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Create: `src/app/(app)/technical-configurations/types.ts`

- [x] Add only the five P1 RPC names to `ALLOWED_FUNCTIONS`.
- [x] Add dossier wire, list response and RPC argument types without adding an adapter or UI.
- [x] Rerun whitelist and migration tests until GREEN.

## Chunk 3: Verification And Delivery

### Task 6: Run focused and repository gates

- [x] Run:

```bash
openspec validate add-technical-configuration-comparison --strict
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-dossier-migration.test.ts \
  src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts \
  src/lib/__tests__/rbac.test.ts
```

- [x] Confirm `src/types/database.ts` remains unchanged because live types were not generated.
- [x] Self-review migration ordering, grants, RLS, claim guards, selected columns, pagination, locking and absence of N+1 paths.
- [x] Commit, push, open a PR linked to issue `#742`, and leave live apply explicitly pending user permission.

### Task 7: Complete the approved live DB phase gate

- [x] Apply `technical_configuration_dossier_foundation` through Supabase MCP after explicit user approval; registry version `20260712130332`.
- [x] Verify live columns, indexes, RLS policy, table privileges, function signatures, `SECURITY DEFINER`, `search_path` and RPC grants.
- [x] Verify global read behavior plus missing/invalid claims, pagination validation, not-found handling, direct-table denial and `service_role` RPC denial.
- [x] Run create/update/archive, stale-revision and archived-dossier mutation tests inside a transaction; roll back and confirm zero test rows remain.
- [x] Run security and performance advisors; no P1-specific deployment blocker remains.
