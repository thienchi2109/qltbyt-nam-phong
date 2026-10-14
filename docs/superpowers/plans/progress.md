# Equipment placed-dataset implementation progress

## Checkpoint: Phase 1 complete

- **Plan:** \`2026-10-14-equipment-placed-tab.md\`
- **Scope:** Chunk 1, Task 1–2 only
- **HEAD:** \`98338942\`
- **Push:** not pushed, per user instruction

### Delivered

- Added the \`regular\`/\`placed\` dataset contract, defaulting to \`regular\`.
- Added trim-normalized \`"Mượn"\` classification and query-key/RPC argument coverage through \`p_equipment_dataset\`.
- Added focused Vitest coverage for dataset normalization and query parameters.
- Added the read-only SQL smoke test and gate-registry entry for partition semantics, per-RPC overload coverage, and scoped pagination/aggregate source ordering.
- Fixed the Astra review finding by validating each scoped RPC definition independently; unscoped compatibility wrappers remain explicitly allowed.

### Verification

- \`git diff --check 90874bf1..HEAD\` — PASS
- Prettier diff check — PASS
- \`verify:no-explicit-any\` — PASS
- \`verify:dedupe\` — PASS
- \`typecheck\` — PASS
- Focused Vitest — **2 files, 8 tests passed**
- React Doctor — **100/100**, no issues
- Static DB Quality Gate — PASS, digest \`6ff485d73c29cff401e18fb1b501320fb41ca096a638839429042e306ca153df\`

### Gate boundary

- Runtime SQL execution and baseline-forward validation were not run because the planned migration \`20261014120000_equipment_dataset_scope.sql\` is not present until Phase 2 and the local environment lacks \`pg_isready\`.
- The static gate emitted 1,526 warnings; treat that gate as advisory per the project instruction and do not infer aggregate DB-gate PASS from it.
- No live database writes were performed.

### Next checkpoint

Begin Phase 2 only after this checkpoint is accepted: add the immutable migration and performance index, then verify the RPC signatures against the Phase 1 contract.

## Checkpoint: Phase 2 implementation complete, database validation incomplete

- **Scope:** Chunk 2, Task 3–4
- **Plan clarification:** commit 8607e915 requires TanStack Query cache reuse on tab changes; tab selection must not force a refetch, and mutations invalidate only affected dataset keys.
- **Implementation commits:** 502a50a0, 85b05680, 9e204188, 20783f65, 11c91ce7, 39eb2acc
- **Migration:** supabase/migrations/20261014120000_equipment_dataset_scope.sql
- Added 24 scoped RPC overloads with non-default p_equipment_dataset, preserved legacy signatures, applied trim-normalized predicates before derived metrics/pagination, and added the placed partial expression index.
- Added scope/default/overload contract coverage and guarded all four previously missing metric overloads; usage analytics security-definer functions now set an explicit public search path.

### Independent Phase 2 verification

- git diff --check 87d3dbd0..HEAD — PASS
- Structural migration audit — **24/24 overloads valid**, no scoped defaults, predicates and scope guards present, index present
- typecheck — PASS
- Focused Vitest — **2 files, 8 tests passed**
- No live database writes or push performed.

### Database gate boundary

- Static DB Quality Gate — **INCOMPLETE**, findings=1658, warnings=1543, dangerous=24, blocking=91, latest digest 65bf603fd12eb17b65e5698aad0af9c6ac037d3bddbb219231e543980d980e90. The project instruction says this gate has false positives; no bypass was authorized.
- Disposable Oracle baseline-forward — **INCOMPLETE / BLOCKING**, rule dynamic.preflight.stale-environment; evidence unavailable and no SQL tests executed. Oracle PostgreSQL itself was healthy, but the gate baseline metadata is stale.
- Do not treat Phase 2 as aggregate DB-gate PASS or authorize live apply until a fresh exact-commit static + baseline-forward result exists.

### Next checkpoint

Proceed to Phase 3 UI/data-flow work only with the database-gate boundary above carried forward. Implement the two Equipment tabs with dataset-specific TanStack Query keys and cache reuse.
