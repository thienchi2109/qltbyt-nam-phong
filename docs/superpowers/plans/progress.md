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

## Phase 2 migration review checkpoint

- **Reviewed range:** `87d3dbd0..5eb5dbc1`
- **Migration reviewer:** gpt-6-astra, medium, migration-only review
- **Verdict:** **APPROVE WITH CAVEATS** for migration logic.
- **Review fixes landed:** aggregate-search branches, unused-report paginated SQL, nested KPI metrics, PUBLIC ACL revokes, auth/admin compatibility, exact registry coverage, and source-contract assertions.

### Independent verification after review

- `git diff --check 87d3dbd0..HEAD` — PASS
- Structural audit — **26 scoped overload declarations / 24 unique RPCs**, registry covers all 24 names, search-path clauses present, ACL revoke/grant statements present.
- Focused dataset Vitest — **2 files, 8 tests passed**
- `typecheck` — PASS
- Static DB Quality Gate — **INCOMPLETE**, current run `findings=1639`, `warnings=1545`, `dangerous=26`, `blocking=68`, digest `97151285d2ca8ccfe9192e709d09502938a18845a2ba54faae3b1c1e9b744267`; treat as advisory per user instruction and do not bypass.
- Broader Equipment directory Vitest — **3 files / 5 tests failed**; this was not used as the focused dataset acceptance signal and needs separate baseline triage.

### Remaining caveats

- `unused_equipment_report_for_reports` accepts normalized dataset input in validation/summary, while its dynamic paginated-row branch compares the raw bind value. The current UI contract sends lowercase canonical values; whitespace/mixed-case direct RPC calls remain unverified.
- The partial index uses `coalesce(is_deleted, false)=false` while several queries use `is_deleted=false`; disposable `EXPLAIN`/catalog evidence is still needed to confirm planner usage.
- Oracle baseline-forward remains **INCOMPLETE / BLOCKING** with `dynamic.preflight.stale-environment`; no runtime SQL evidence exists, so aggregate DB-gate PASS must not be claimed and live apply remains out of scope.

No push or live database writes were performed.

## Checkpoint: Phase 3 implementation complete, isolated for review

- **Scope:** Chunk 3, Task 5–6 (Equipment tabs and active-dataset data flow)
- **Worker branch/worktree:** `feat/equipment-placed-phase3` / `.worktrees/equipment-placed-phase3`
- **Worker commit:** `0b30f49b` (`feat: add equipment dataset tabs and scoped queries`)
- **Main branch:** unchanged by Phase 3; no merge and no push performed.

### Delivered

- Added URL-persisted controlled tabs: **Thiết bị thường** (default `regular`) and **Thiết bị đặt** (`placed`), with invalid-tab fallback, browser history synchronization, URL replacement without scroll, and pagination reset.
- Kept tab state outside the existing filter context; shared toolbar, table/cards, summaries, pagination, actions, dialogs, mobile filters, and export remain single implementations.
- Threaded the active dataset through list, department distribution, filter buckets, and export RPC arguments/query keys using `p_equipment_dataset`.
- Locked the placed funding bucket to `Mượn`; removed list `keepPreviousData` so regular rows cannot flash under the placed tab.
- Added dataset-aware mutation invalidation with support for invalidating source and destination datasets when needed.

### Independent verification

- `git diff --check f8ac3786..0b30f49b` — PASS
- `format:check` — PASS
- `verify:no-explicit-any` — PASS
- `verify:dedupe` — PASS
- `typecheck` — PASS
- Focused Phase 3 suite — **8 files, 33 tests passed**
- React Doctor — **84/100, no issues found**
- Worker recorded RED evidence for missing tab hook, dataset RPC arguments, and dataset query keys before Green implementation.

### Boundaries carried forward

- Phase 2 DB Quality Gate remains **INCOMPLETE/BLOCKED** because static findings are advisory and Oracle baseline-forward is stale; Phase 3 made no SQL/live DB changes.
- Phase 2 migration caveats remain: normalize the dynamic report dataset bind value in a later SQL hardening pass, and verify partial-index planner use with disposable `EXPLAIN` after the baseline is refreshed.

Safe checkpoint reached. Await user direction before merging Phase 3 or starting the next phase.

## Checkpoint: Phase 2 caveats hardened

- **Worker branch/worktree:** `fix/equipment-phase2-caveats` / `.worktrees/equipment-phase2-caveats`
- **Worker commit:** `350aa32a` (`fix: harden phase 2 dataset caveats`)
- **Integrated main commit:** `934afcbb` (cherry-picked worker fix)
- **Push:** not pushed.

### Delivered

- `unused_equipment_report_for_reports` now normalizes `p_equipment_dataset` once with `lower(btrim(...))` and uses that value for both summary and dynamic paginated rows.
- The placed partial index now uses `is_deleted = false`, matching the query predicates and existing `NOT NULL` schema semantics.
- The same report’s summary and paginated-row predicates use `is_deleted = false`; the smoke contract rejects the old `coalesce` form for this target.
- Extended the read-only smoke contract to verify normalized binding, raw-bind removal, index predicate, `pg_attribute.attnotnull`, and `pg_index` evidence.

### Independent verification

- Worktree clean at `350aa32a`
- `git diff --check 38e27b79..350aa32a` — PASS
- Independent source assertions — all PASS (normalization, summary/page bind, no target `coalesce`, index predicate, NOT NULL/index evidence)
- Static DB Quality Gate — **INCOMPLETE**, `findings=1639`, `warnings=1545`, `dangerous=26`, `blocking=68`; advisory only, no bypass and no disposable DB run.

Both Phase 2 caveats are now addressed in source and contract checks. Runtime EXPLAIN/baseline-forward evidence remains future validation when the Oracle environment is refreshed.

## Checkpoint: Phase 3 complete and merged locally

- **Worker branch/worktree:** `feat/equipment-placed-phase3` / `.worktrees/equipment-placed-phase3`
- **Base:** `0b30f49b`
- **Latest worker commit:** `059e3d9d` (`fix: close phase 3 dataset invalidation caveats`), on top of `76f9a596`
- **Merge commit on `main`:** `ce12d384` (`merge: integrate equipment placed phase 3`)
- **Cleanup:** Phase 3 worktree and local branch removed; no push or live DB write performed.

### Delivered

- Wired dialog mutations through the page-level dataset-aware TanStack Query invalidator.
- Invalidates only affected regular/placed dataset list, distribution, and filter-bucket caches; mixed imports and funding moves invalidate both source and destination datasets.
- Preserved the current dataset across repeated saves in one detail dialog after a funding-source move.
- Routed successful Start Usage and End Usage mutations through the same equipment cache invalidation path.
- Preserved `?tab=placed` deep-link behavior, including the `Nguồn kinh phí = Mượn` filter initialization.

### Verification

- Reviewer: **APPROVE**, no actionable findings on `0b30f49b..059e3d9d`.
- Focused Phase 3 review suite: 5 files / 36 tests — PASS.
- Full Equipment suite: 52 files / 417 tests — PASS.
- `format:check`, `verify:no-explicit-any`, `verify:dedupe`, `typecheck`, React Doctor, and `git diff --check` — PASS.
- React Doctor score: 84/100, no issues reported.
- Database Quality Gate remains advisory/`INCOMPLETE`; Phase 3 has no SQL or live DB changes.

Safe checkpoint reached. `main` is clean and ready for Phase 4.

## Checkpoint: Phase 4 implementation complete, reviewed, and ready for handoff

- **Scope:** Chunk 4–5, Tasks 7–9 (import classification, shared invalidation, KPI/Reports exclusion)
- **Main commits:** `6da74cb0`, `16cf0772`, `2418eaee`, `906e8fbc`, `815ca233`
- **Push:** not pushed, per user instruction; `main` remains clean and ahead of `origin/main` locally.

### Delivered

- Mixed imports classify each row using trimmed `Nguồn kinh phí`; any normalized `Mượn` row switches to **Thiết bị đặt** while ordinary rows remain in **Thiết bị thường**.
- Dashboard/KPI, Device Quota, Reports, maintenance/utilization aggregates, report exports, usage logs, and facility-count callers use the fixed `regular` dataset where required.
- Equipment detail usage history, load-more, and active-session paths carry the active dataset; an open detail dialog follows the saved funding source after regular↔placed edits.
- Import and mutation success invalidate equipment list/buckets/distribution plus dashboard, Reports, maintenance-report, usage-analytics, and active usage-log query families; import query caches are invalidated after success.
- TanStack Query keys remain dataset-specific, so switching tabs reuses each dataset cache instead of refetching the other dataset.
- Hard file-size violations were resolved; no optional extraction was added solely for the 350-line advisory threshold.

### Independent verification

- Focused import/invalidation tests — **9/9 passed**
- Detail-dialog dataset regression — **7/7 passed**
- Reviewer changed-test set — **12 files / 62 tests passed**
- `format:check`, `verify:no-explicit-any`, `verify:dedupe`, `typecheck`, and `git diff --check` — PASS
- React Doctor — **84/100**, no issues reported
- Astra reviewer (gpt-6-astra, medium) — **APPROVE**, no actionable findings

### Database and rollout boundary

- No live Supabase writes and no push were performed.
- Database Quality Gate remains **INCOMPLETE/advisory** because the repository gate has known false positives and the Oracle baseline-forward environment is stale; no bypass was authorized. This does not authorize migration apply or deployment.

Safe checkpoint reached. Await user direction before any push, live migration, or deployment.
