# Implementation Tasks

## Execution Rules

- This change depends on `add-technical-configuration-comparison`; do not start a leaf
  until its required parent contracts are merged on `main`.
- Every leaf phase maps to one GitHub issue, one branch, one PR, and one primary
  implementation session.
- Target at most roughly 1,500 changed lines per PR. This is a reviewability target,
  not a hard limit. Any exception must separate hand-written from generated/migration/
  fixture lines and explain why a smaller split would be less deploy-safe.
- Before coding a leaf, its issue must estimate hand-written and generated/migration/
  fixture lines separately. Split the leaf again when the hand-written estimate would
  exceed the review target and a smaller deploy-safe boundary exists.
- Each leaf requires a TDD implementation plan grounded in current code, Code Review
  Graph, GitNexus impact, and read-only live Supabase inspection where relevant.
- Every merged leaf must be independently deployable. New UI remains hidden or absent
  until all server contracts it needs are already deployed.
- Any RPC or import path that can create subgroup data remains server-gated until
  baseline, comparison, evaluation, and export readers are all hierarchy-aware.
- Production controls that can create subgroup data remain unmounted until the
  server-side activation leaf is deployed.
- Every leaf commits and pushes through enabled Lefthook gates. Do not bypass staged
  Prettier, diff-aware verification, or pre-push typecheck.
- Database writes and migration application require explicit user authorization for
  that specific operation.
- Preserve criterion IDs and codes across every migration, move, import, copy, and
  locked snapshot.
- Do not copy the parent change's remaining release acceptance or real-world evaluation
  tasks into this roadmap.

## Phase P0 - Dependency And Delivery Baseline

Deploy boundary: documentation and issue planning only; no runtime change.

- [x] P0.1 Confirm `add-technical-configuration-comparison` is the landed mainline
      baseline and record requirement/code drift since this proposal.
- [x] P0.2 Inspect live hierarchy tables, functions, grants, policies, indexes, and
      representative counts through read-only Supabase MCP.
- [x] P0.3 Re-run Code Review Graph and GitNexus impact for baseline snapshot, copy,
      lock, import, comparison, evaluation, progress, and result export.
- [x] P0.4 Create one issue per leaf below with exact dependencies, estimated
      hand-written/generated diff sizes, test commands, deploy checks, and rollback notes.
- [x] P0.5 Lock explicit file-byte and meaningful-row limits before P3B, and split any
      leaf whose hand-written estimate exceeds the review target when a deploy-safe split
      exists.

## Phase P1A - Additive Subgroup Schema

Depends on: P0.

Deploy boundary: schema expands, but all existing RPC responses and application
behavior remain unchanged.

- [x] P1A.1 Write migration contract tests for an ordered subgroup entity and nullable
      criterion subgroup ownership.
- [x] P1A.2 Add subgroup storage, indexes, constraints, audit ownership, deny-by-default
      grants, and nullable criterion `subgroup_id`.
- [x] P1A.3 Keep every existing criterion as a direct main-section child with unchanged
      ID, code, order, citation, response, and assessment linkage.
- [x] P1A.4 Add rollback guidance that never drops populated hierarchy data.
- [x] P1A.5 After explicit authorization, apply and run security/performance advisors
      plus read-only smoke queries.

## Phase P1B - Backward-Compatible Client Domain Types

Depends on: P1A schema merged or represented in generated type fixtures.

Deploy boundary: clients accept both old responses without subgroup fields and future
responses with subgroup arrays; no producer or UI behavior changes.

- [x] P1B.1 Write failing decoder/editor-state tests for optional subgroup arrays,
      direct criteria, subgroup criteria, and invalid cross-scope ownership.
- [x] P1B.2 Extend wire types, decoders, query cache models, and generated Supabase
      types without requiring subgroup fields from old RPC responses.
- [x] P1B.3 Keep all current baseline, comparison, evaluation, and export tests green
      with legacy two-level fixtures.

## Phase P1C - Hierarchy-Aware Read Snapshots

Depends on: P1A applied and phase-gated, plus P1B deployed.

Deploy boundary: read responses may include subgroup arrays; all deployed consumers
already tolerate both shapes. Existing writes and UI remain two-level.

- [x] P1C.1 Write SQL/RPC contract tests for canonical section/subgroup/criterion order
      and direct criteria.
- [x] P1C.2 Extend baseline snapshot, draft get, version list/detail, history, and
      evidence ownership reads to return the hierarchy.
- [x] P1C.3 Preserve bounded pagination and avoid N+1 subgroup/criterion reads.
- [x] P1C.4 Verify legacy drafts and locked versions return empty subgroup arrays
      without behavior regressions.

## Phase P1D - Hierarchy Copy And Lock Snapshots

Depends on: P1C.

Deploy boundary: copy and lock preserve hierarchy, but no subgroup mutation path or
production UI exists yet.

- [x] P1D.1 Write snapshot round-trip tests for draft retrieval, immutable locked
      versions, canonical mixed ordering, and subgroup identity.
- [x] P1D.2 Extend copy and lock snapshot operations to preserve subgroups and stable
      criterion identity.
- [x] P1D.3 Prove copied and locked snapshots preserve direct criteria before complete
      subgroup blocks without duplicating criterion IDs.

## Phase P1E - Draft Hierarchy Mutation Primitives

Depends on: P1D.

Deploy boundary: hierarchy mutation RPCs exist but remain ungranted or absent from the
RPC allowlist; legacy group/criterion operations remain valid.

- [x] P1E.1 Write failing tests for subgroup create/update/delete/reorder and criterion
      moves between direct and subgroup ownership.
- [x] P1E.2 Add guarded subgroup mutations and hierarchy-aware criterion mutation/
      reorder contracts with optimistic revision protection.
- [x] P1E.3 Preserve criterion IDs/codes and normalize direct criteria before subgroup
      blocks after every structural mutation.
- [x] P1E.4 Keep subgroup mutation functions ungranted/unallowlisted until P6A and prove
      locked versions, foreign-scope IDs, unsupported depth, and partial failures are
      rejected atomically.

## Phase P2A - Hierarchical Import Validator And Preview

Depends on: P1E.

Deploy boundary: new preview/version contracts are available but no production
download action emits the new workbook yet; legacy import remains unchanged.

- [x] P2A.1 Write validator tests for Roman sections, one positive-integer subgroup
      level, blank-STT criteria, direct criteria before subgroups, blank rows, normalized
      order, unsupported nonblank markers, and physical-row errors.
- [x] P2A.2 Add a versioned server validator that normalizes complete hierarchical rows
      and validates hidden identity as untrusted input.
- [x] P2A.3 Extend authoritative preview with section/subgroup/criterion counts and
      create/update/move/delete effects by entity kind.
- [x] P2A.4 Reject content before a section, unsupported `1.1` depth, empty content,
      foreign identity, stale metadata, and malformed rows without mutation.

## Phase P2B - Atomic Hierarchical Import Apply

Depends on: P2A.

Deploy boundary: server keeps legacy apply working and can validate the new payload,
but rejects XLSX v2 apply as not activated until P6A.

- [x] P2B.1 Write failing apply tests for complete create/update/move/delete/reorder
      reconciliation and exact preview/apply parity.
- [x] P2B.2 Extend atomic apply to reconcile sections, subgroups, direct criteria, and
      subgroup criteria in dependency-safe order.
- [x] P2B.3 Preserve compatible IDs/codes, advance `next_criterion_number` only for new
      criteria, and increment revision exactly once.
- [x] P2B.4 Prove stale conflicts, tampering, validation errors, and injected failures
      roll back the full transaction.
- [x] P2B.5 Prove legacy apply remains available while XLSX v2 apply fails closed with
      a stable not-activated error before P6A.

## Phase P3A - XLSX V2 Workbook Model And Export Codec

Depends on: P2B.

Deploy boundary: library/test capability only; production buttons still use the
existing workbook generator.

- [x] P3A.1 Write workbook tests for `Nhập cấu hình`, `Hướng dẫn & Ví dụ`, `_meta`,
      two visible editable columns, hidden identity, Unicode, multiline text, styles, and
      frozen header.
- [x] P3A.2 Generate current-data and blank-template workbook models without browser
      download integration.
- [x] P3A.3 Prove generated visible content maps structural names or criterion
      `requirement_text` while carrying stable identity and existing title data only in
      hidden round-trip fields.

## Phase P3B - XLSX V2 Parser And Legacy Compatibility

Depends on: P3A.

Deploy boundary: compatible parser capability exists in libraries/tests; production
download and import paths remain unchanged.

- [x] P3B.1 Parse XLSX only, infer row kind from `STT`, normalize canonical order, and
      reject unsupported markers with physical-row errors.
- [x] P3B.2 Preserve the title of identity-matched criteria, assign no title to new
      XLSX v2 criteria, and validate hidden identity as untrusted input.
- [x] P3B.3 Enforce the P0 file-byte and meaningful-row limits without truncation.
- [x] P3B.4 Keep the legacy canonical workbook parser read-compatible and cover
      round-trip, missing identity, reordered, inserted, deleted, and moved rows.

## Phase P3C - Download Actions

Depends on: P3A.

Deploy boundary: both download actions are wired and tested but are not mounted on the
production baseline screen.

- [x] P3C.1 Add `Tải cấu hình hiện tại` using complete hierarchy and stable hidden
      identity.
- [x] P3C.2 Add `Tải mẫu trống` with an empty input sheet and examples only on the
      instruction sheet.
- [x] P3C.3 Keep actions draft-only, preserve conflict/dirty guards, and provide
      deterministic filenames.
- [x] P3C.4 Add user-event and generated-workbook delegation tests, including proof
      that the new actions remain unreachable on the production screen.

## Phase P3D - Hierarchical Import UX

Depends on: P3B, P3C, and P2B.

Deploy boundary: the dormant XLSX v2 preview and client apply contract are wired and
tested, while production apply remains unreachable and fail-closed on the baseline
screen.

- [x] P3D.1 Restrict file selection to `.xlsx` and route both legacy and v2 workbooks
      through the compatible parser boundary.
- [x] P3D.2 Render authoritative hierarchy and create/update/move/delete preview counts
      with actionable physical-row errors.
- [x] P3D.3 Replace row-count-only confirmation with explicit full-replacement and
      deletion wording.
- [x] P3D.4 Preserve file, normalized rows, and preview across revision conflicts until
      reset or successful re-preview.
- [x] P3D.5 Add no-persistence-before-confirm, destructive-preview, success/cache,
      locked-target, stale-conflict, and large-preview tests.

## Phase P4A - Hierarchical Editor State

Depends on: P1E.

Deploy boundary: pure state/model support only; current production editor rendering
remains unchanged.

- [x] P4A.1 Write pure failing tests for section/subgroup/direct-criterion/
      subgroup-criterion creation, move, reorder, delete, validation, clone, and dirty
      comparison.
- [x] P4A.2 Extend editor state and save mappers while preserving legacy two-level
      drafts.
- [x] P4A.3 Keep criterion identity stable when moving between direct and subgroup
      ownership.
- [x] P4A.4 Normalize direct criteria before subgroup blocks and preserve complete
      subgroup blocks during moves and reorder.

## Phase P4B - Subgroup Presentation

Depends on: P4A.

Deploy boundary: hierarchy is readable and collapsible; structural creation/reorder
controls remain absent; P4C wires them without mounting them on the production screen.

- [x] P4B.1 Render sections, subgroups, direct criteria, and subgroup criteria in one
      canonical hierarchy.
- [x] P4B.2 Make structural rows independently collapsible and accessible without
      response or assessment controls.
- [x] P4B.3 Preserve existing definite-height scrolling, focus, pending multiline
      buffers, validation association, and file-size ceilings.
- [x] P4B.4 Add hierarchy rendering, collapse, keyboard, focus, and responsive tests.

## Phase P4C - Hierarchical Authoring Controls

Depends on: P4B and P1E.

Deploy boundary: complete subgroup authoring is wired against already-deployed
mutation paths but remains hidden on the production baseline screen until P6A.

- [x] P4C.1 Add subgroup create/rename/delete/reorder and criterion move controls.
- [x] P4C.2 Support direct and subgroup-scoped single-row and multiline criterion entry.
- [x] P4C.3 Normalize Roman and decimal display ordinals after every structural edit.
- [x] P4C.4 Preserve explicit Save, dirty navigation, conflict recovery, lock blocking,
      and reload semantics.
- [x] P4C.5 Add user-event workflow and save-resume regression tests.

## Phase P5A - Aggregate Status Model

Depends on: the parent change's canonical derived criterion status contract.

Deploy boundary: pure model and tests only; no production surface changes.

- [x] P5A.1 Write exhaustive tests for fail-fast `failed`, incomplete
      `not_evaluated`, review-required statuses, zero descendants, all-not-applicable,
      pass, and exact descendant counts.
- [x] P5A.2 Implement subgroup and section rollups over unique leaf criterion IDs.
- [x] P5A.3 Prove structural rows never change progress denominators, filter totals,
      ranking inputs, or score.

## Phase P5B - Comparison Hierarchy

Depends on: P1C and P5A.

Deploy boundary: comparison becomes hierarchy-aware; evaluation and result export are
unchanged until their own leaves.

- [x] P5B.1 Extend comparison row models with section and subgroup heading rows.
- [x] P5B.2 Keep option cells, evidence inspection, paging, pinning, focus mode, and
      detail actions criterion-only.
- [x] P5B.3 Add direct/subgroup criteria, many-option, pagination, and evidence
      regression tests.

## Phase P5C - Evaluation Hierarchy And Progress

Depends on: P1C, P5A, and the parent evaluation workflow being stable on `main`.

Deploy boundary: P5C.0 is a read-only RPC replacement that is safe before subgroup
data or UI activation. The P5C UI leaf depends on that contract being represented
locally and applied in each target environment as appropriate. Criterion assessment
persistence, comparison, and result export remain unchanged.

- [x] P5C.0 Replace `technical_configuration_evaluation_criteria_list` without changing
      its signature, response shape, filters, grants, auth guards, assessment
      persistence, comparison, or result export. Compute the canonical leaf tuple as
      section `sort_order`, section ID, direct-before-subgroup discriminator, subgroup
      `sort_order`, subgroup ID, criterion `sort_order`, criterion ID; compute
      `canonical_index` across the complete leaf universe before filtering, derive
      `canonical_page` with comparison page size `50`, order filtered pages and JSON
      aggregation by `canonical_index`, and keep transport page size bounded at `100`.
- [x] P5C.1 Add one evaluation-specific canonical leaf flattener reused by projection,
      legacy fallback, hierarchy rows, progress, and aggregate inputs so subgroup leaves
      cannot be dropped by independent loops.
- [x] P5C.2 Show authoritative aggregate status/counts for sections and subgroups over
      the complete baseline descendant universe, independent of active filter/page.
      Include empty structures in the full progress/summary surface.
- [x] P5C.3 Construct the current filtered presentation page's hierarchy row union once
      at the navigator/presentation boundary, pass the readonly rows through the
      navigator pane, and render them directly in the criterion list without rebuilding
      hierarchy from a leaf projection. Show only ancestor section/subgroup headings,
      keep structural rows non-selectable and assessment-free, and preserve legacy
      two-level fixtures.
- [x] P5C.4 Default structural rows to expanded. Keep collapse/expand as local
      presentation state only, auto-expand ancestors when navigation selects a hidden
      leaf, and prove collapse cannot change totals, filters, pagination, selection,
      save/save-next, dirty guards, denominator, ranking, or score.
- [x] P5C.5 Preserve authoritative complete-cache adoption before aggregate refresh:
      merge into a known-complete cache, seed a known-empty newly created comparison
      set, and never mark an unavailable or failed existing cache as authoritative from
      one saved row. Keep filtered-navigation refresh failures fail fast and actionable
      without corrupting the aggregate.
- [x] P5C.6 Add dedicated mixed-status, empty-aggregate, filtered navigation,
      collapse/auto-expand, dirty-cancel, save-next, cache-refetch-failure, legacy,
      and >100-criterion regressions. The large fixture MUST cross canonical
      boundaries `50/51` and `100/101`; the existing large workspace suite's 21
      cases MUST pass unchanged and its file MUST NOT be enlarged.
- [x] P5C.7 Run migration source-contract tests against the superseding migration,
      both new P5C executable phase gates, required repository gates, focused and broad
      regressions, and OpenSpec strict. Inspect `EXPLAIN` before adding any index,
      enforce changed-file scope guards, and repeat review to zero actionable findings.
      Keep the two stale phase-gate tests tracked by Issue #903 outside P5C:
      `technical-configuration-baseline-hierarchy-apply-migration.test.ts` and
      `technical-configuration-baseline-subgroup-mutations-migration.test.ts`.

P5C.7 status: complete. The migration was applied to the target environment, both
rollback-only executable SQL phase gates passed, and post-gate verification found no
P5C0 fixture residue. Local source-contract, repository, regression, scope, graph,
review, and OpenSpec strict gates are complete.

## Phase P5D - Hierarchy-Aware Result Export

Depends on: P5B, P5C, and the parent result-export contract.

Deploy boundary: result workbooks add hierarchy while preserving existing snapshot,
scope, partitioning, and read-only contracts.

- [x] P5D.1 Extend result dataset and workbook contracts with structural rows and
      aggregate summaries.
- [x] P5D.2 Render sections, subgroups, and criteria in canonical order without
      synthetic response or assessment cells.
- [x] P5D.3 Preserve snapshot identity, matrix partitioning, ranking semantics, missing
      data, and no-write behavior.
- [x] P5D.4 Add renderer, contract, large-matrix, and legacy no-subgroup regressions.

Verification evidence (2026-08-13): focused P5D `69/69`, P5A aggregate `27/27`,
P5C hierarchy/progress/workspace `63/63`, result-export RPC/migration source contracts
`34/34`, and broad technical-configuration regressions `1006/1006` all pass. React
Doctor reports `100/100`; OpenSpec strict validation passes; final review reports zero
actionable findings. The two unchanged stale phase-gate failures tracked by Issue #903
reproduce separately and remain outside P5D.

## Phase P6A - Cross-Surface Regression And Server Activation

Depends on: P3D, P4C, P5B, P5C, P5D.

Deploy boundary: subgroup mutation RPCs and XLSX v2 apply become callable only after
all readers are hierarchy-aware; production UI controls remain unmounted.

- [x] P6A.1 Run strict OpenSpec validation, formatting, `verify:no-explicit-any`,
      `verify:dedupe`, typecheck, focused tests, full technical-configuration regressions,
      and React Doctor.
- [ ] P6A.2 Browser-test both downloads, round-trip import, invalid hierarchy,
      destructive replacement, hierarchy authoring, aggregate evaluation, comparison, and
      result export while activation remains off.
- [x] P6A.3 Exercise representative small, example-sized, and safety-bound XLSX files
      without hard-coded business row counts.
- [x] P6A.4 After explicit authorization, grant/allowlist subgroup mutations and enable
      XLSX v2 apply, then prove no production reader can observe unsupported hierarchy.
- [ ] P6A.5 Verify accessibility, narrow/wide layouts, long Vietnamese text, console
      errors, and non-overlapping controls.

Browser execution note (2026-08-13): P6A.2 and the browser-dependent portions of P6A.5
were explicitly skipped by user instruction. Production-isolation component tests still
prove the two XLSX v2 downloads and hierarchy import remain unmounted.

P6A.4 status: complete. Local migration `20260813105912` was applied through Supabase
MCP as live migration `20260813132516`; the P6A activation gate and both pending P5C
rollback-only gates passed. Live inspection confirmed authenticated-only execution for
the public apply wrapper and seven hierarchy authoring RPCs, no direct execution for the
internal apply worker, hardened search paths, and reviewed advisor output. The activation
gate also exercised all seven authoring RPCs as database role `authenticated`: missing
claims and non-global claims returned `42501`, while raw `admin` claims reached the
target `PT404` guard. The activation-related authenticated `SECURITY DEFINER` warnings
are expected for guarded RPCs; the remaining notices are existing baseline items outside
P6A scope.

## Phase P6B - Production UI Activation

Depends on: P6A.

Deploy boundary: UI-only activation mounts both XLSX v2 download/import and subgroup
authoring after the server activation is already deployed.

- [x] P6B.1 Mount `Tải cấu hình hiện tại`, `Tải mẫu trống`, XLSX v2 import, and subgroup
      authoring controls in the production baseline screen.
- [ ] P6B.2 Browser-test the complete production route with direct-only, subgroup-only,
      and mixed sections plus failure rollback and stale-revision recovery.
- [x] P6B.3 Retire the legacy workbook download/import production actions after user
      acceptance, place the three XLSX v2 actions in the version bar, and retain only
      shared parser/server compatibility contracts.

Browser execution note (2026-08-13): P6B.2 remains incomplete because browser testing
was explicitly skipped due to unavailable production credentials. Production component
integration coverage and the complete technical-configuration regression suite passed.

## Phase P6C - Authorized Live Acceptance And Closeout

Depends on: P6B.

Deploy boundary: controlled acceptance and closeout only.

- [x] P6C.1 With explicit authorization, run post-migration live smoke checks,
      security advisors, performance advisors, and representative draft import/copy/lock
      verification.
- [x] P6C.2 Confirm XLSX v2 production acceptance and document rollback plus recovery
      steps for the retired legacy UI path.
- [ ] P6C.3 Require independent specification review approval and user acceptance,
      close completed issues, merge verified PRs, and archive the OpenSpec change only
      after deployment.
- [ ] P6C.4 Run `git pull --rebase`, push any remaining closeout commit, confirm status
      is up to date with origin, clear stale stashes, prune remote branches, and record
      the final handoff.

P6C execution note (2026-08-14): the TDD plan, rollback-only Supabase MCP smoke
script, acceptance/recovery report, focused and broad regressions, repository
gates, and lifecycle-corrected independent zero-finding review are prepared. Three
authorized diagnostics rolled back safely and proved the original fixture failed
at the copy RPC because it attempted to copy a draft. The corrected authorized
smoke applied and locked the source before copying, passed import/copy/lock
assertions at `2026-08-14T05:46:47.762817Z`, forced rollback, and internally
confirmed exact source-snapshot restoration plus zero copied-version residue. A
separate read-only query at `2026-08-14T05:47:00.193085Z` independently confirmed
the aggregate preflight counts and absence of P6C subgroup/criterion markers.
Security and performance advisors were rerun and reported only pre-existing
findings; P6C made no persistent schema change. P6C.1 and P6C.2 are complete.
Browser credentials remain unavailable. After final zero-finding review and user
acceptance, PR #913 squash-merged into `main` as `f8fe17f2` at
`2026-08-14T06:17:21Z`, and its Vercel deployment completed at
`2026-08-14T06:18:29Z`. The hierarchy delta was transferred exactly into active
parent change `add-technical-configuration-comparison` before this follow-up was
archived with `--skip-specs`, preventing both spec loss and double application.
P6C.3/P6C.4 remain unchecked until the archive PR merges, closes Issue #896, and
the final `main` synchronization and handoff complete.

P1A.1-P1A.5 were reconciled as complete from merged PR #897, closed Issue #876,
and the committed migration/test/plan artifacts. P6A.2, P6A.5, and P6B.2 remain
intentionally unchecked because browser credentials were unavailable; the P6C
acceptance report records the compensating coverage.
