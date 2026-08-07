## Why

The shipped technical-configuration baseline editor and canonical Excel import use a
two-level `group -> criterion` model with seven machine-oriented workbook columns.
That contract is safe for round-tripping but does not match the procurement documents
users actually prepare, where Roman-numbered sections contain optional
decimal-numbered subgroups and detailed criteria.

This is a follow-up to `add-technical-configuration-comparison`. It must remain a
separate change so the nearly completed parent change can finish its evaluation and
real-world acceptance work without reopening its original delivery scope.

## What Changes

- **BREAKING** Extend baseline structure from two levels to exactly three supported
  levels:
  - Roman-numbered main section;
  - one decimal-numbered subgroup level;
  - assessable criterion.
- Keep criteria directly under a main section valid. When a main section also contains
  subgroups, canonical order places all direct criteria before subgroup blocks so the
  two-column workbook remains unambiguous.
- Make main sections and subgroups visible, collapsible, non-assessable structural
  rows with aggregate status derived from descendant criteria.
- Mark a structural row `Không đạt` immediately when any descendant criterion is
  `failed`; show transparent descendant-status counts instead of adding structural
  rows to scoring or progress denominators.
- Replace the default baseline workbook download with a versioned XLSX contract that
  exposes only `STT` and `NỘI DUNG YÊU CẦU` as editable columns.
- Infer row type from `STT`: Roman numeral for a main section, positive integer for a
  subgroup, and blank for a criterion. Normalize displayed numbering from row order
  instead of preserving user-entered ordinal values; reject every other nonblank
  marker with a physical-row error.
- Provide separate `Tải cấu hình hiện tại` and `Tải mẫu trống` actions.
- Put blank-template instructions and examples on a separate visible sheet and keep
  the actual input sheet empty.
- Preserve hidden workbook ownership metadata and stable existing entity identity for
  safe round-tripping.
- Accept XLSX only. Continue accepting the existing canonical baseline workbook
  version during a compatibility window, but generate only the new user-facing
  version.
- Keep import as an authoritative, atomic full-tree replacement after a server preview
  reports sections, subgroups, criteria, creates, updates, deletes, and row errors.
- Render the three-level hierarchy consistently in baseline authoring, comparison,
  evaluation navigation, progress summaries, and final result export.
- Deliver the change through small, dependency-ordered, deploy-safe leaf phases. Each
  leaf targets one reviewable PR and normally stays at or below roughly 1,500 changed
  lines, with documented exceptions for generated types, migrations, and fixtures.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `technical-configuration-comparison`
  - baseline hierarchy and ordering;
  - baseline XLSX download/import;
  - hierarchical comparison and evaluation presentation;
  - aggregate structural-row status;
  - hierarchy-aware result export.

## Dependency And Scope Boundary

- This change depends on `add-technical-configuration-comparison` landing as the
  implementation baseline.
- The parent change remains responsible for completing its existing manual-evaluation
  workflow, release acceptance, and real-world verification.
- This change does not redefine supplier-option import, evidence ownership, manual
  criterion assessment axes, ranking semantics, AI scope, or dossier lifecycle.
- Implementation must start from the current mainline behavior at that time and must
  not replay completed phases from the parent change.

## Impact

- Affected specs:
  - `technical-configuration-comparison`
- Expected database impact:
  - one ordered subgroup entity beneath a baseline main section;
  - nullable subgroup ownership on baseline criteria;
  - snapshot, copy, lock, import, comparison, evaluation, and export read paths updated
    to preserve the hierarchy.
- Expected application impact:
  - baseline editor and import workflow;
  - comparison matrix row model;
  - evaluation navigator and progress summaries;
  - final result workbook model and renderer.
- Compatibility:
  - existing baseline groups become main sections;
  - existing criteria remain direct children of their current section;
  - criterion IDs, criterion codes, citations, option responses, and assessments remain
    stable;
  - legacy baseline workbook import remains read-compatible during rollout.
- Live database changes require a separate implementation plan and explicit user
  authorization before any Supabase MCP write.
- Delivery impact:
  - additive schema lands before any producer emits subgroup data;
  - backward-compatible consumers land before response shapes expand;
  - subgroup-producing RPCs and XLSX v2 apply remain server-gated until the compatible
    parser, editor, comparison, evaluation, and export readers are all deployed;
  - production import and authoring controls mount only after that server gate is
    enabled;
  - each leaf phase must be independently deployable and reversible without requiring
    an unmerged follow-up PR.
