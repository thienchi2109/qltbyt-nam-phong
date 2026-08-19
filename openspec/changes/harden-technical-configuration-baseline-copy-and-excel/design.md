## Context

The current baseline XLSX contract deliberately binds every generated workbook to one
dossier, baseline version, and revision. That boundary prevents a file downloaded from
machine A from silently overwriting machine B. The user need behind cross-machine reuse
is nevertheless valid, but it is better served by an authenticated server-side copy
than by weakening hidden workbook metadata or attempting to remap foreign identities
in the browser.

The existing `technical_configuration_baseline_copy` operation accepts a locked source
inside the same dossier and creates a new draft. Its lineage field
`source_baseline_version_id` is constrained to that dossier. The new workflow must
preserve the existing operation while adding an explicit cross-dossier contract.

The XLSX round-trip defect is independent but adjacent. The client parser currently
uses selected in-memory baseline identity as an authority before server preview. A
rejected main section then leaves no active parent, so later valid child rows emit
secondary `Mọi nội dung phải đứng sau một mục chính` errors. The exported filename also
does not identify its dossier.

## Goals / Non-Goals

### Goals

- Reuse a locked baseline from another dossier through an atomic server operation.
- Preserve the same baseline-owned aggregate semantics as the existing locked copy.
- Make replacement of an existing target draft explicit and previewable.
- Keep each of the two implementation PRs independently deployable.
- Make a generated current workbook uploadable to the same unchanged draft.
- Make validation errors identify the root failure without dependent error noise.
- Make generated workbook filenames identifiable before opening the file.

### Non-Goals

- Cross-dossier XLSX import or hidden-ID remapping in the browser.
- Copying an editable source draft.
- Copying suppliers, options, option responses, comparison state, or assessments.
- Merging the new workflow into the existing same-dossier copy RPC.
- Adding background jobs, bulk multi-target copy, or scheduled synchronization.

## Decisions

### 1. One OpenSpec change maps to two deploy phases and two PRs

Phase 1 / PR 1 owns the complete server contract. Phase 2 / PR 2 owns all user-visible
behavior and depends on Phase 1 being deployed. A task is not allowed to move between
phases merely because it is implemented in TypeScript: RPC proxy allowlisting and
server contract tests belong to Phase 1 because they are part of backend reachability.
The exact parameter, response, ordering, bound, and stable error contracts are frozen
in `contracts.md`.

The Phase 1 PR is additive and has no mounted UI. The Phase 2 PR branches from updated
main only after Phase 1 is merged. Production deployment order is:

1. merge Phase 1;
2. identify the landed main commit SHA and run both database gates against that exact
   commit;
3. obtain explicit live-write permission and apply the migration through Supabase MCP;
4. verify RPC availability and security advisors;
5. implement, merge, and deploy Phase 2.

### 2. Add dedicated cross-dossier RPCs

Do not overload `technical_configuration_baseline_copy`. Add:

- `technical_configuration_baseline_cross_dossier_sources_list`;
- `technical_configuration_baseline_cross_dossier_copy_preview`;
- `technical_configuration_baseline_cross_dossier_copy_apply`.

The source-list RPC is bounded and set-based. It returns locked versions from dossiers
other than the target dossier and includes enough display data for one selector:
device type, dossier name, dossier archive state, version number, lock timestamp, and
stable IDs. Search applies across device type and dossier name without per-dossier
version calls.

When the user opens the copy workflow, the source selector shows a persistent
informational warning:

`Chỉ có thể sao chép phiên bản cấu hình đã khóa. Phiên bản đang ở trạng thái bản nháp
không thể sao chép.`

Draft versions are not returned as selectable sources. The warning explains that
absence before the user searches, while the server still rejects stale or direct calls
that submit a source which is no longer locked.

Preview and apply accept the source baseline ID, target dossier ID, expected target
dossier revision, nullable expected target draft ID, and nullable expected target draft
revision. Preview performs no mutation. Apply revalidates the same facts while holding
target locks.

### 3. The server remains authoritative for eligibility and concurrency

All three RPCs use the module's fail-closed `admin/global` JWT contract,
`SECURITY DEFINER`, fixed `search_path`, explicit execute grants, and bounded responses.

The source must:

- exist;
- be `locked`;
- belong to a dossier different from the target dossier.

The target must:

- exist and be active;
- match `p_expected_dossier_revision`;
- have zero or one editable draft;
- match the nullable expected draft identity and revision observed during preview.

A stale source/target selection, newly created draft, changed draft, archived target
dossier, or direct-call bypass is rejected before copying. The operation is atomic and
advances the owning target revisions according to existing baseline mutation
conventions.

### 4. Preview distinguishes draft creation from full replacement

Preview returns:

- source and target identity summaries;
- whether apply will create a draft or replace the existing draft;
- counts for main sections, subgroups, criteria, reference products/responses,
  baseline/reference documents, and citations;
- target deletion counts when a draft already exists;
- dependent working-data deletion counts for option responses, option citations, and
  manual assessments;
- preserved target counts for suppliers, options, option documents, and comparison-set
  roots;
- current expected dossier and draft revisions;
- `requires_replacement_confirmation`;
- `preview_fingerprint`, computed from the source/target identities and revisions plus
  deterministically ordered identity/revision tuples for every copied, deleted, and
  preserved row represented by the preview.

When no target draft exists, apply creates the next editable version. When a draft
exists, apply requires `p_confirm_replace = true`; otherwise it fails closed even if a
client bypasses the confirmation dialog.

Apply also requires the exact `p_preview_fingerprint` returned by preview. Under target
locks it recomputes the fingerprint from live rows before deleting anything. Apply
first locks the target dossier row through the existing revision guard, then acquires
`SHARE ROW EXCLUSIVE ... NOWAIT` locks in one documented canonical order on every
table represented by the target-side fingerprint. This lock mode conflicts with
ordinary `ROW EXCLUSIVE` DML locks, including inserts for rows that did not exist at
preview time. If an earlier writer already holds any conflicting table lock, apply
fails immediately with `concurrent_write_retry` before fingerprint validation or
mutation and releases all acquired locks when the transaction aborts. If apply obtains
all table locks first, a later writer waits until apply commits. Apply never waits for
a table lock, so it cannot form a deadlock wait-cycle with an existing multi-table
writer.

A new, updated, or deleted option response, option citation, manual assessment, copied
source row, preserved target root, or baseline-owned target row changes the fingerprint
and returns `stale_preview`. Counts alone are not the concurrency token. Locked source
baselines remain immutable and do not require the target-side table-lock protocol.

Replacing a target draft does not copy or delete dossier-scoped suppliers, options, or
option documents. Existing comparison-set roots remain because the target baseline
version identity is retained. However, every existing option response, option
citation, and manual assessment tied to a replaced criterion is deleted atomically
before the new criterion graph becomes visible. Preview and confirmation must state
those exact counts. Cancellation leaves all target data unchanged.

### 5. Copy the baseline aggregate with target-owned identity

Apply reuses the semantic boundary of the existing complete locked-baseline copy:

- copy main sections, subgroups, criteria, reference products/responses,
  baseline/reference documents, and their citations;
- preserve criterion codes, titles, requirement text, and canonical order;
- create new UUIDs for every target-owned copied entity;
- set target baseline and criterion lineage to the immutable source entities;
- set the target `next_criterion_number` above the copied criterion-code sequence so
  later target criteria cannot reuse a copied code;
- exclude suppliers, options, comparison sets, option responses, option documents and
  citations, and manual assessments.

If replacing a draft, retain the target draft version identity but replace its
baseline-owned descendants atomically and update its source lineage. This avoids
invalidating the selected target draft while ensuring copied children never retain
foreign ownership IDs.

The existing lineage constraint is superseded so a source baseline may belong to
another dossier only when it is locked. Same-dossier copy behavior remains valid.

### 6. Keep XLSX ownership strict and move membership authority to the server

The workbook remains bound to its exact dossier, baseline version, and revision.
Client parsing validates file type, workbook shape, metadata syntax, row types,
duplicate hidden IDs, and hierarchy shape, but it does not treat the selected
in-memory hierarchy as authoritative membership.

The server preview independently validates metadata, ownership, identity, hierarchy,
and expected revision against live data. Therefore:

- an unchanged workbook downloaded from the current draft can round-trip;
- a workbook from another dossier is rejected with the ownership mismatch;
- a workbook from an older revision is rejected as stale;
- foreign or malformed hidden identity is still rejected.

When a structural row fails, dependent rows do not emit repeated missing-parent
messages caused solely by that root failure. Validation resumes at the next
independently valid structural boundary and preserves physical row references.

### 7. Generate identifiable, bounded filenames

Current configuration:

`{Loai_Thiet_Bi}_{Ten_Ho_So}_Phien_Ban_{N}.xlsx`

Empty template:

`Mau_{Loai_Thiet_Bi}_{Ten_Ho_So}_Phien_Ban_{N}.xlsx`

Each dynamic text component is Unicode-normalized, transliterated to ASCII where
supported, stripped of filesystem-invalid characters, converted to `_`-separated
segments, and collapsed deterministically. Empty normalized components use a stable
fallback. The final name is deterministically truncated while retaining the version
suffix and `.xlsx` extension.

## Risks / Trade-offs

- Relaxing same-dossier lineage broadens a historical invariant.
  - Mitigation: only locked sources are accepted; target ownership remains local; the
    migration and phase gate prove same-dossier behavior still works.
- Replacing an existing draft is destructive.
  - Mitigation: authoritative preview includes baseline-owned and criterion-dependent
    working-data deletion counts; apply is bound to the exact preview fingerprint;
    explicit UI confirmation and a server-required flag are mandatory.
- Copying the full baseline aggregate can be larger than copying hierarchy alone.
  - Mitigation: perform one set-based transaction with copy maps; add representative
    volume validation and avoid row-by-row RPCs.
- The target-side table locks temporarily serialize writes to technical-configuration
  tables across dossiers.
  - Mitigation: cross-dossier copy is rare, locks are transaction-scoped and acquired
    only during apply with `NOWAIT`; contention returns a retryable conflict, and a
    concurrency phase gate verifies fail-fast, blocking, and fingerprint behavior.
- Phase 2 can fail if deployed before the migration.
  - Mitigation: hard dependency gate in `tasks.md`; do not mount a capability fallback
    that would hide a deployment sequencing error.
- Client validation becomes less authoritative.
  - Mitigation: retain syntax/shape checks client-side and require server preview for
    all identity and ownership decisions.

## Migration Plan

1. Inspect current live function definitions, grants, lineage constraints, and
   representative aggregate sizes read-only through Supabase MCP.
2. Add one append-only migration for lineage enforcement and the three RPCs.
3. Add migration-source and SQL phase-gate coverage before implementation.
4. Run candidate-commit database `static` and `baseline-forward` gates before review.
5. Merge Phase 1 with no user-visible frontend dependency.
6. Rerun both database lanes against the exact landed main commit and retain
   digest-bearing evidence.
7. After explicit approval, apply the migration through Supabase MCP and run security
   advisors plus focused read-only verification.
8. Start Phase 2 from updated main and mount the frontend workflow.

If Phase 1 must be disabled before Phase 2, leave the unused additive contract in
place or supersede execute grants in a new migration. Do not edit an applied migration.
If Phase 2 must be rolled back, revert the frontend deployment; the additive RPCs
remain backward-compatible and unused.

## Open Questions

None. The implementation frontier is closed by the decisions recorded above.
