# P2A Hierarchical Import Validator And Preview TDD Plan

## Scope Boundary

Issue: `#881`

Depends on:

- P1E commit `41aca5a3`
- live Supabase migrations through `20260808145124`

In scope:

- a version-2 server validator for complete hierarchical import rows;
- a read-only authoritative preview RPC with normalized counts and
  create/update/move/delete effects by entity kind;
- hidden identity validation against the selected baseline version;
- RPC proxy allowlisting for the new preview contract;
- focused migration tests and a rollback-only SQL phase gate.

Out of scope:

- applying the P2A migrations to live Supabase;
- changing the legacy v1 preview or apply functions;
- wiring XLSX v2 into the production import hook or dialog;
- generating or downloading XLSX v2 workbooks;
- implementing hierarchical import apply.

## Contract Decisions

- Keep `technical_configuration_baseline_import_preview` and
  `technical_configuration_baseline_import_apply` byte-for-byte unchanged.
- Add `_technical_configuration_baseline_import_validate_v2(...)` as an internal
  `SECURITY DEFINER` helper with no client-role grant.
- Add `technical_configuration_baseline_import_preview_v2(...)` as the only new
  authenticated RPC in P2A.
- Keep metadata keys identical to v1, but require `template_version = 2`.
- Accept raw rows with exactly these keys:
  `row`, `stt`, `content`, `group_id`, `subgroup_id`, `criterion_id`,
  `criterion_code`.
- Infer row kind from trimmed `stt`: canonical Roman numeral for a main section,
  positive integer for a subgroup, and blank for a criterion. Ignore rows where
  all visible content and identity values are blank.
- Normalize order from row position. Direct criteria belong to the current main
  section until a subgroup row is encountered; later blank-STT rows belong to
  the nearest subgroup.
- Return row errors using the physical `row` value and stable error codes.
- Preserve existing criterion titles and codes for identity-matched criteria.
  Allocate provisional `TC-####` codes for new criteria without mutating
  `next_criterion_number`.
- Report counts and effects under `groups`, `subgroups`, and `criteria`.
- Treat identity by row kind:
  - a main-section row may carry only `group_id`;
  - a subgroup row may carry only `subgroup_id`;
  - a criterion row may carry only the complete `criterion_id` +
    `criterion_code` pair;
  - all other identity cells on that row must be null.
- An entirely absent row-kind identity means explicit create/delete fallback:
  the row is classified as create, and any unmatched existing entity is
  classified as delete. Partial, wrong-kind, duplicate, unknown, cross-version,
  or code-mismatched identity is an error and never falls back by content.
- Infer target parentage only from the preceding normalized main-section and
  subgroup rows. Load original parentage from the database for move detection;
  do not trust hidden parent lineage.
- An input with zero meaningful rows is a valid preview of replacing the draft
  with an empty tree. It must return zero normalized counts and explicit delete
  counts for every existing entity. P2A cannot apply that replacement.
- Keep v2 validation and preview read-only at the lock level as well as the DML
  level: do not call the existing editable-version guard because it uses
  `SELECT ... FOR UPDATE`, and do not add any row-locking clause.
- Declare both functions `STABLE` so every table read uses the calling
  statement's MVCC snapshot. Validate revision/state and load the full current
  hierarchy inside that same stable validator result.

## Task 1: Lock The P2A Contract RED

**Files:**

- Create:
  `src/app/api/rpc/__tests__/technical-configuration-baseline-hierarchy-preview-migration.test.ts`
- Create before implementation:
  `supabase/tests/technical_configuration_baseline_hierarchy_import_preview_phase_gate.sql`
- Create before implementation:
  `supabase/tests/technical_configuration_baseline_hierarchy_import_preview_security_phase_gate.sql`

- [ ] Assert exactly one v2 validation migration and one v2 preview migration
      sort after `20260808030200_technical_configuration_baseline_hierarchy_criterion_mutations.sql`.
- [ ] Assert the validator and preview signatures, `SECURITY DEFINER`,
      `search_path`, revokes, and least-privilege grants.
- [ ] Assert v2 metadata validation, strict raw-row shape, Roman/integer/blank
      inference, blank-row handling, normalized ordering, and physical-row
      errors.
- [ ] Assert foreign identity, duplicate identity, stale metadata, malformed row,
      unsupported marker, unsupported `1.1` depth, empty content, and content
      before a section fail closed.
- [ ] Assert partial identity, wrong-row-kind identity, unknown/cross-version
      identity, criterion ID/code mismatch, and duplicate identity fail closed,
      suppress effects for every invalid preview, while fully absent identity
      uses explicit create/delete fallback.
- [ ] Assert preview counts and create/update/move/delete effects by entity kind,
      provisional codes, valid empty-tree deletion preview, no mutation
      statements, no row-locking clauses, and `STABLE` volatility.
- [ ] Assert neither new migration replaces legacy preview/apply or adds a v2
      apply function.
- [ ] Assert the new preview name is in the shared RPC registry and the existing
      whitelist contract covers it.
- [ ] Write the rollback-only SQL phase gate first, including the complete
      behavioral cases below. The focused Vitest test statically verifies those
      assertions are present before production SQL exists.

Run:

```bash
node scripts/npm-run.js exec vitest run \
  src/app/api/rpc/__tests__/technical-configuration-baseline-hierarchy-preview-migration.test.ts
```

Expected: FAIL because the P2A migrations and v2 RPC registry entry do not exist.
The phase gate itself would also fail against the current P1E schema because the
v2 functions are undefined, but it is not executed against live Supabase without
explicit write authorization.

## Task 2: Implement The Versioned Validator

**Files:**

- Create:
  `supabase/migrations/20260809001200_technical_configuration_baseline_hierarchy_import_metadata.sql`
- Create:
  `supabase/migrations/20260809001237_technical_configuration_baseline_hierarchy_import_validation.sql`

- [ ] Add a closed internal v2 metadata helper that validates JWT/global access,
      the selected baseline version, dossier
      ownership metadata, draft/archived state, expected revision, and
      `template_version = 2` using plain `SELECT` statements without row locks.
- [ ] Validate every raw row without trusting hidden identity.
- [ ] Normalize main sections, subgroups, direct criteria, and subgroup criteria
      into canonical flat rows.
- [ ] Preserve compatible IDs, criterion codes, and existing criterion titles.
- [ ] Allocate provisional codes in memory only.
- [ ] Return normalized rows plus row errors and target metadata.
- [ ] Load current groups, subgroups, and criteria set-wise. Do not issue
      per-row identity queries.
- [ ] Return the validated revision and all current hierarchy-derived effects
      from the same `STABLE` validator call; do not re-read mutable baseline
      tables later in preview.

## Task 3: Implement Read-Only Authoritative Preview

**Files:**

- Create:
  `supabase/migrations/20260809001300_technical_configuration_baseline_hierarchy_import_preview.sql`
- Modify:
  `src/lib/technical-configuration-baseline-rpcs.ts`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/baseline-contract.test.ts`

- [ ] Call the v2 validator directly; the validator performs the read-only
      access, draft-state, metadata, and revision checks.
- [ ] Return normalized entity counts and create/update/move/delete effects.
- [ ] Count moves from parent or canonical-order changes and updates from content
      changes.
- [ ] Count omitted current entities as deletes.
- [ ] Keep the preview function free of `INSERT`, `UPDATE`, `DELETE`, `MERGE`,
      and DDL.
- [ ] Keep both validator and preview free of `FOR UPDATE`,
      `FOR NO KEY UPDATE`, `FOR SHARE`, and `FOR KEY SHARE`.
- [ ] Declare preview `STABLE` and build the response only from the validator
      result so metadata, normalized rows, and effects cannot mix snapshots.
- [ ] Grant only the v2 preview RPC to `authenticated`.
- [ ] Add only the v2 preview function to the shared RPC allowlist registry.
- [ ] Do not add a client hook, production control, download action, or v2 apply.

## Task 4: Complete The Rollback-Only SQL Phase Gate

**Files:**

- Complete:
  `supabase/tests/technical_configuration_baseline_hierarchy_import_preview_phase_gate.sql`
- Complete:
  `supabase/tests/technical_configuration_baseline_hierarchy_import_preview_security_phase_gate.sql`

- [ ] Cover Roman sections, non-contiguous numbering, subgroups, direct criteria,
      subgroup criteria, blank rows, and normalized order.
- [ ] Cover create/update/move/delete counts and provisional codes.
- [ ] Cover content-before-section, `1.1`, empty content, malformed rows,
      partial/wrong-kind/duplicate/foreign identity, criterion ID/code mismatch,
      stale metadata, and null effects whenever row errors exist.
- [ ] Cover identity-loss create/delete fallback and an empty-tree preview with
      explicit deletion counts.
- [ ] Snapshot fixture-scoped baseline tree contents and assert preview leaves them unchanged.
- [ ] Prove missing/non-global claims fail closed, raw `admin` remains accepted,
      and only the authenticated preview RPC is executable.
- [ ] Wrap all fixtures in `BEGIN`/`ROLLBACK`.

The phase gate is committed for authorized post-apply execution. It is not run
against live Supabase in P2A without explicit write permission.

## Task 5: Prove Legacy Compatibility And Repository Gates

- [ ] Run the focused P2A test.
- [ ] Run existing baseline import migration, parser, hook, dialog, and RPC
      whitelist regressions.
- [ ] Run the full technical-configuration test suite.
- [ ] Run:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run react-doctor
openspec validate revise-technical-configuration-baseline-hierarchy --strict
```

- [ ] Use Code Review Graph and GitNexus on the final diff.
- [ ] Run independent subagent review until zero findings.
- [ ] Mark only P2A tasks complete in `tasks.md`.
- [ ] Commit and push the feature branch. The user explicitly overrode the
      default one-leaf/one-PR rule for this session: do not open a PR or close
      Issue `#881`; report the pushed branch for the next-step decision.

## Completion Criteria

P2A is ready for the user's next-step decision when the branch is pushed, all
local gates are green, the independent review has zero findings, legacy import
contracts remain unchanged, and live Supabase has not been modified.
