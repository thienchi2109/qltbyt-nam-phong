# Issue #957 Technical Configuration Copy Re-entrant Workspace Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents are available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Technical Configurations baseline and cross-dossier copy flows re-entrant for repeated calls, mixed call order, and rollback/retry within one PostgreSQL transaction.

**Architecture:** Keep the current baseline helper chain and public JSON, authorization, lock, lineage, and atomicity contracts. Reset baseline-owned temporary maps with explicit ownership-scoped drop/recreate, and rename cross-dossier maps into a separate namespace before applying the same reset pattern. Add a default-safe SQL regression gate that exercises the current nested call graph and both public cross-dossier entry points without requiring arbitrary recursive invocation support.

**Tech Stack:** PostgreSQL PL/pgSQL, Supabase append-only migrations, `psql` phase gates, the repository database quality-gate registry, Oracle disposable gate databases, Supabase MCP for live read-only inspection.

---

## Locked Decisions

- Issue scope is limited to the existing Technical Configurations copy surface:
  - `public.technical_configuration_baseline_copy(uuid, bigint)`;
  - `public.technical_configuration_baseline_cross_dossier_copy_preview(...)`;
  - `public.technical_configuration_baseline_cross_dossier_copy_apply(...)`;
  - `technical_configuration_internal.baseline_cross_dossier_copy_rows(...)` as the internal implementation boundary.
- The guarantee covers the current call graph:
  - repeated baseline calls in one transaction;
  - repeated cross-dossier calls in one transaction;
  - baseline followed by cross-dossier;
  - cross-dossier followed by baseline;
  - existing nested baseline helper ownership;
  - deterministic rollback followed by retry.
- The guarantee does not cover arbitrary future recursion, such as a baseline copy recursively invoking itself while an outer baseline copy still needs the same map names.
- Keep the baseline map names and schemas unchanged.
- Rename cross-dossier maps so their schemas cannot collide with baseline maps.
- Use explicit `DROP TABLE IF EXISTS pg_temp.<owned_map>` before each `CREATE TEMP TABLE ... ON COMMIT DROP`.
- Do not use `CREATE TEMP TABLE IF NOT EXISTS ...` plus `TRUNCATE`; the same names currently represent incompatible schemas across flows.
- Do not modify applied migration files or repair migration metadata.
- Do not change role checks, JWT claim validation, `SECURITY DEFINER`, `search_path`, ACLs, lock handling, lineage, JSON response shape, or copy semantics.
- Do not apply the migration to the live Supabase project as part of this implementation. Any live write remains a separate operation requiring explicit authorization through Supabase MCP.

## Evidence And Current Boundaries

The defect is caused by fixed-name temporary tables surviving until the outer transaction ends:

- Baseline hierarchy maps are created in `supabase/migrations/20260807195507_technical_configuration_baseline_hierarchy_snapshots.sql:112` and `:145`.
- The reference-product map is created in `supabase/migrations/20260717024746_technical_configuration_reference_products.sql:396`.
- Baseline and reference document maps are created in `supabase/migrations/20260718030000_technical_configuration_baseline_documents.sql:390` and `:410`.
- Cross-dossier creates six maps in `supabase/migrations/20260819031200_technical_configuration_baseline_cross_dossier_copy.sql:219`.
- Existing phase gates mask the issue with manual drops in:
  - `supabase/tests/technical_configuration_baseline_cross_dossier_copy_phase_gate.sql:331` and `:433`;
  - `supabase/tests/technical_configuration_baseline_hierarchy_snapshots_phase_gate.sql:416`.

The current baseline call chain is:

```text
public.technical_configuration_baseline_copy
  -> public._technical_configuration_baseline_copy_p7a1
  -> public._technical_configuration_baseline_copy_p4
```

The current cross-dossier apply chain is:

```text
public.technical_configuration_baseline_cross_dossier_copy_apply
  -> technical_configuration_internal.baseline_cross_dossier_copy_rows
```

Cross-dossier preview delegates to a read/preview helper and does not create copy maps, but it remains in regression coverage because it is a public entry point and must retain its existing contract.

## File Map

Create:

- `supabase/migrations/20260830090000_technical_configuration_copy_reentrant_workspace.sql`
  - Append-only redefinitions of the affected private/internal copy functions.
  - Re-establish the current function security, search path, owner/ACL expectations.
  - Add baseline workspace reset and cross-dossier namespace isolation.

- `supabase/tests/technical_configuration_copy_reentrant_workspace_phase_gate.sql`
  - Default-safe, isolated-fixture, rollback-required SQL regression gate for Issue #957.
  - Covers repeated calls, mixed order, failure/retry, mapping correctness, and rollback.

Modify:

- `supabase/tests/technical_configuration_baseline_cross_dossier_copy_phase_gate.sql`
  - Remove only the manual `copy_map` drops that exist to mask this defect.
  - Preserve all existing domain, stale-preview, replacement, and atomic rollback assertions.

- `supabase/tests/technical_configuration_baseline_hierarchy_snapshots_phase_gate.sql`
  - Remove the manual `copy_map` drop before the repeated baseline copy.
  - Preserve the existing lock and rollback assertions.

- `supabase/db-quality-gate-tests.json`
  - Register the new regression gate as `default-safe`, `isolated-fixture`, `rollback-required`.

Do not modify:

- Existing applied migration files.
- `src/` RPC adapters, hooks, dialogs, or query keys.
- Phase 11 role authorization migrations or tests.
- The opt-in multi-session cross-dossier concurrency gate, except where verification proves an assertion needs a name update.
- `openspec/**`; this issue is tracked only by this plan and GitHub Issue #957.

## Phase 1: Add The Regression Gate And Remove Masking Workarounds

**Boundary:** Tests only. The production migration remains unchanged and the new/updated gates must fail because the current fixed-name workspace is not re-entrant.

**Files:**

- Create: `supabase/tests/technical_configuration_copy_reentrant_workspace_phase_gate.sql`
- Modify: `supabase/tests/technical_configuration_baseline_cross_dossier_copy_phase_gate.sql`
- Modify: `supabase/tests/technical_configuration_baseline_hierarchy_snapshots_phase_gate.sql`

- [ ] **Step 1: Build the isolated fixture from the existing cross-dossier gate shape**

Use deterministic UUIDs or a run suffix, the existing `set_claims` pattern, and a fixture containing:

- an active authenticated/global test user;
- a locked source dossier and baseline version;
- at least one group, subgroup, and criterion;
- at least one reference product and reference document;
- a target dossier suitable for create and replacement cross-dossier apply;
- the minimum option/response/citation rows needed to preserve the existing aggregate assertions.

Keep all fixture writes inside one outer `BEGIN`/`ROLLBACK`. Do not call a live data-mutating function outside the disposable gate database.

- [ ] **Step 2: Add the repeated baseline-copy regression**

In the new gate:

1. Call `public.technical_configuration_baseline_copy(source_version, expected_revision)` successfully.
2. Lock the resulting draft using the existing fixture/helper pattern so the same source can be copied again.
3. Call the same public function again in the same outer transaction.
4. Assert that both calls succeed and that the copied group, subgroup, criterion, product, document, and lineage data are correct.
5. Do not manually drop any `copy_map` table between calls.

Expected RED result before the migration: `relation "technical_configuration_baseline_group_copy_map" already exists` or the next fixed baseline map collision.

- [ ] **Step 3: Add the repeated cross-dossier apply regression**

Exercise the public path in the same transaction:

1. Preview the source/target pair and retain the exact fingerprint.
2. Apply a create copy.
3. Preview the replacement state as required by the current public contract.
4. Apply a replacement copy.
5. Assert counts, target-owned root preservation, remapped baseline-owned rows, lineage, and revision changes.
6. Do not manually drop any map between calls.

Expected RED result before the migration: a collision on one of the six fixed cross-dossier map names.

- [ ] **Step 4: Add both mixed-order regressions**

Run each sequence without cleanup:

```text
baseline copy -> cross-dossier apply
cross-dossier apply -> baseline copy
```

Use separate valid target fixtures for the two operations. Keep both successful operations in the same outer transaction and do not use a rollback between them; rolling back would also remove the temporary workspace and could hide the original defect. Assert that the second flow succeeds and that its mapping schema is not affected by the first flow.

Expected RED result before the migration: collision or incompatible-column failure caused by the shared names.

- [ ] **Step 5: Add the re-entrancy failure-and-retry regression**

Keep this separate from the general rollback contract:

1. Complete one successful copy so its `ON COMMIT DROP` maps remain in the outer transaction.
2. For baseline copy, lock the first returned draft using the existing fixture/helper pattern before invoking the same copy path again; otherwise the domain's `draft_already_exists` guard would make the test invalid.
3. For cross-dossier apply, read the current target dossier and target baseline revisions after the first apply.
4. Run a fresh replacement preview with those current revisions and retain its new fingerprint.
5. Enter a nested exception block, invoke the second apply with the refreshed revisions and fingerprint, catch any error into a local status/message, and assert that no error occurred after the fix.
6. Continue in the same outer transaction and assert that the returned mappings are correct. Do not manually drop any map.

On the unchanged baseline, step 5 must capture a fixed-name relation error, rather than `stale_preview` or a revision error, and the explicit "no error" assertion must make the gate RED. After the migration, the same sequence must be GREEN. Do not make the test expect an error after the fix.

- [ ] **Step 6: Add a separate atomic rollback/retry smoke test**

For each mutating public path:

1. Enter a nested PL/pgSQL exception block.
2. Execute the copy successfully so the temporary workspace and target writes are initialized.
3. Raise a deliberate test-only exception immediately after the copy call.
4. Catch the exception.
5. Assert that target rows and revisions are unchanged by the rolled-back block.
6. Retry the same copy operation in the same outer transaction.
7. Assert that the retry succeeds.

This test proves transaction rollback and retry, not temporary-map re-entrancy; the repeated-call test above proves re-entrancy. Do not add a failure hook, debug parameter, or test-only branch to production functions. Use the existing nested exception pattern and a separate valid target fixture for the retry.

- [ ] **Step 7: Remove only the existing cleanup that masks the defect**

Delete the manual six-map drops at the known workaround locations. Search before editing:

```bash
rg -n "DROP TABLE.*copy_map" supabase/tests
```

Remove a drop only when it exists to permit another copy call in the same transaction. Preserve fixture cleanup that is unrelated to this workspace defect.

- [ ] **Step 8: Run the new gate against the unchanged baseline**

Run the gate in a disposable Oracle gate database using the command and connection setup from `/root/Oracle/supabase-test.md`.

Expected result: the new gate or the unmasked existing gate fails on a fixed-name temporary relation collision. Record the exact first failing map and statement location in the implementation notes.

## Phase 2: Add The Append-Only Workspace Fix

**Boundary:** One SQL migration only. No test registry or unrelated application changes in this phase.

Before creating the migration, re-check local migration ordering. The planned filename must sort after the current `20260826120436_technical_configuration_dossier_search.sql`; if another migration has landed, choose the next available timestamp instead of reusing this filename.

- [ ] **Step 1: Copy the latest function definitions into the append-only migration**

Redefine only these functions with `CREATE OR REPLACE FUNCTION`:

- `public._technical_configuration_baseline_copy_p4(...)`;
- `public._technical_configuration_baseline_copy_p7a1(...)`;
- `public.technical_configuration_baseline_copy(...)`;
- `technical_configuration_internal.baseline_cross_dossier_copy_rows(...)`.

Do not alter signatures or return types. Preserve each current body and change only temporary workspace initialization and the references required by the cross-dossier namespace rename.

Use these effective source definitions when assembling the append-only migration:

| Function                                                                 | Effective current definition                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public._technical_configuration_baseline_copy_p4(...)`                  | `supabase/migrations/20260807195507_technical_configuration_baseline_hierarchy_snapshots.sql`                                                                                                                        |
| `public._technical_configuration_baseline_copy_p7a1(...)`                | Wrapper body produced by the rename in `supabase/migrations/20260718030000_technical_configuration_baseline_documents.sql`, originally introduced in `20260717024746_technical_configuration_reference_products.sql` |
| `public.technical_configuration_baseline_copy(...)`                      | `supabase/migrations/20260718030000_technical_configuration_baseline_documents.sql`                                                                                                                                  |
| `technical_configuration_internal.baseline_cross_dossier_copy_rows(...)` | `supabase/migrations/20260819031200_technical_configuration_baseline_cross_dossier_copy.sql`                                                                                                                         |

- [ ] **Step 2: Make baseline map initialization ownership-scoped and repeatable**

Immediately before each baseline map creation, add the matching drop:

```sql
DROP TABLE IF EXISTS pg_temp.technical_configuration_baseline_group_copy_map;
CREATE TEMP TABLE technical_configuration_baseline_group_copy_map (...);
```

Apply this to the existing baseline-owned maps:

- `technical_configuration_baseline_group_copy_map`;
- `technical_configuration_baseline_subgroup_copy_map`;
- `technical_configuration_reference_product_copy_map`;
- `technical_configuration_baseline_document_copy_map`;
- `technical_configuration_reference_document_copy_map`.

Keep the existing column definitions, keys, and `ON COMMIT DROP`. Keep the current nested ownership order:

```text
_p4 owns group/subgroup maps
_p7a1 owns the reference-product map while consuming the _p4 result
the public wrapper owns baseline/reference-document maps while consuming _p7a1 output
```

- [ ] **Step 3: Rename cross-dossier maps into a separate namespace**

Use these exact canonical names; each is below PostgreSQL's 63-byte identifier limit:

```text
technical_configuration_xd_group_copy_map
technical_configuration_xd_subgroup_copy_map
technical_configuration_xd_criterion_copy_map
technical_configuration_xd_reference_product_copy_map
technical_configuration_xd_baseline_document_copy_map
technical_configuration_xd_reference_document_copy_map
```

For each map in `technical_configuration_internal.baseline_cross_dossier_copy_rows(...)`:

1. Add `DROP TABLE IF EXISTS pg_temp.<new_name>`.
2. Create the new temporary table with the current cross-dossier `source_id`/`target_id` schema.
3. Rename every `INSERT`, `JOIN`, and read reference in the same function.
4. Keep `ON COMMIT DROP`.

Do not reuse the baseline map names because the baseline and cross-dossier schemas are incompatible.

- [ ] **Step 4: Preserve function security and authorization contracts**

For every redefined function, verify the migration preserves:

- `SECURITY DEFINER` where currently present;
- `SET search_path = public, pg_temp`;
- current owner;
- exact current `authenticated`/`anon`/`public`/`service_role` ACL behavior;
- JWT claim guards;
- global/admin normalization through the existing helper;
- lock and stale-revision behavior;
- atomic replacement and rollback behavior.

The internal cross-dossier helper remains an internal function. Do not grant it as a new public API.

- [ ] **Step 5: Add concrete migration-local structural assertions**

Use the nearby migration/static contract-test style to assert that:

- all six cross-dossier maps use the new names;
- no cross-dossier function body creates the old shared names;
- no baseline function body was changed to the cross-dossier `source_id`/`target_id` schema;
- all affected temporary maps retain `ON COMMIT DROP`.

Do not add a broad full-history migration test. Keep these assertions scoped to Issue #957 and the four redefined functions.

## Phase 3: Register The Gate And Complete Contract Coverage

**Boundary:** Test metadata and focused assertions only. No new production behavior beyond the Phase 2 migration.

- [ ] **Step 1: Register the new gate**

Add one entry to `supabase/db-quality-gate-tests.json` with:

```json
{
  "evidence": ["GitHub Issue #957"],
  "fixtureContract": "isolated-fixture",
  "path": "supabase/tests/technical_configuration_copy_reentrant_workspace_phase_gate.sql",
  "purpose": "phase-gate",
  "runnerRequirements": ["psql"],
  "safety": "default-safe",
  "timeoutSeconds": 120,
  "transactionContract": "rollback-required"
}
```

Use the repository's exact ordering and formatting convention. Do not reclassify the existing multi-session concurrency gate.

- [ ] **Step 2: Remove obsolete map-name assumptions from existing gates**

Search all SQL tests and registry metadata:

```bash
rg -n "technical_configuration_(baseline_group|baseline_subgroup|baseline_criterion|reference_product|baseline_document|reference_document)_copy_map" supabase
```

Update only references that describe the cross-dossier workspace. Baseline assertions should retain baseline names. Existing tests must not manually drop the new cross-dossier names.

- [ ] **Step 3: Ensure the public preview path remains covered**

The new gate must call `technical_configuration_baseline_cross_dossier_copy_preview(...)` at least twice in one transaction and assert that:

- the result remains stable for the same source/target/revision inputs;
- the exact fingerprint contract remains unchanged;
- preview does not create a copy workspace that interferes with a later apply;
- stale preview still fails with the existing error contract.

- [ ] **Step 4: Keep concurrency assertions unchanged**

Run the existing opt-in cross-dossier concurrency gate after the migration. The namespace rename must not change lock acquisition order, fail-fast `concurrent_write_retry`, or no-partial-mutation assertions.

## Phase 4: Verification And Landing Requirements

**Boundary:** Verification only. No live write is included.

- [ ] **Step 1: Inspect the complete diff and migration order**

Run:

```bash
git status --short --branch
git add -N \
  supabase/migrations/20260830090000_technical_configuration_copy_reentrant_workspace.sql \
  supabase/tests/technical_configuration_copy_reentrant_workspace_phase_gate.sql
git diff --check
git diff --stat
git diff -- \
  supabase/migrations/20260830090000_technical_configuration_copy_reentrant_workspace.sql \
  supabase/tests/technical_configuration_copy_reentrant_workspace_phase_gate.sql \
  supabase/tests/technical_configuration_baseline_cross_dossier_copy_phase_gate.sql \
  supabase/tests/technical_configuration_baseline_hierarchy_snapshots_phase_gate.sql \
  supabase/db-quality-gate-tests.json
```

Confirm every changed line belongs to Issue #957 and the migration sorts after the latest local migration.

- [ ] **Step 2: Run the repository static database lane**

Run:

```bash
node scripts/npm-run.js run db:quality-gate:local
```

Record the static result and digest separately. A static pass alone is not an aggregate database quality-gate pass.

- [ ] **Step 3: Run the focused Oracle baseline-forward lane**

Using the exact landed commit and the runbook at `/root/Oracle/supabase-test.md`:

1. Clone the restored baseline into a disposable gate database.
2. Apply only the pending migration set for the exact commit.
3. Run the new re-entrant workspace gate.
4. Run the unmasked baseline hierarchy and cross-dossier phase gates.
5. Run the existing opt-in cross-dossier concurrency gate.
6. Remove the disposable gate database.

Record baseline-forward result, exact commit, migration digest, test names, and any warnings separately from static.

Aggregate PASS is valid only when static and baseline-forward both pass for the same exact commit.

- [ ] **Step 4: Run required repository checks**

Because the implementation is SQL-only, TypeScript gates are not required unless the diff unexpectedly touches `.ts`/`.tsx`. If any TypeScript file changes, run in repository order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
```

For SQL-only changes, still run `format:check` if the migration/test files are covered by the repository formatter.

- [ ] **Step 5: Perform read-only live drift review**

Before any live apply, inspect through Supabase MCP only:

- migration high-water and exact pending migration identity;
- definitions of all four redefined functions;
- `SECURITY DEFINER`, `search_path`, owner, and ACLs;
- absence of the old cross-dossier map names in the deployed internal helper;
- expected security and performance advisors.

Do not use Supabase CLI for this inspection.

- [ ] **Step 6: Stop before live apply unless explicitly authorized**

The implementation is ready for a separate live-apply decision only after:

- static PASS;
- baseline-forward PASS for the same exact commit;
- focused gates PASS;
- no new blocking advisor or drift finding;
- migration review confirms append-only ordering.

Applying the migration to live requires a new explicit user authorization for that specific write through Supabase MCP.

## Acceptance Criteria

- A second successful baseline copy in the same transaction no longer raises a fixed-name relation error.
- A second successful cross-dossier apply in the same transaction no longer raises a fixed-name relation error.
- Baseline then cross-dossier succeeds without manual cleanup.
- Cross-dossier then baseline succeeds without manual cleanup.
- A forced rollback after workspace initialization leaves no target mutation and allows a retry in the same outer transaction.
- Baseline-owned and cross-dossier-owned map schemas cannot be confused.
- Existing copy mappings, lineage, criterion codes, ordering, target-owned roots, revisions, locks, stale-preview errors, and concurrency behavior remain unchanged.
- Existing workaround drops are removed from the affected phase gates.
- The new gate is default-safe, isolated-fixture, and rollback-required.
- Static and baseline-forward database lanes both pass for the exact same commit before any live apply.

## Review Notes And Non-Goals

- No application/UI changes are expected because normal PostgREST calls already use one RPC transaction and the defect is in database workspace lifecycle.
- No ADR is required for this issue. The plan intentionally chooses a scope-limited ownership namespace rather than establishing an arbitrary-recursion policy for every future temporary workspace.
- If implementation discovers a real recursive call in the current graph, stop and revise the plan before editing production SQL; do not silently expand the guarantee.
