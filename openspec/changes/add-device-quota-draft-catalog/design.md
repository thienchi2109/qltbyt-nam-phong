## Context

The regulatory source is the official
`757_Thong-tu-10-2026-TT-BYT_88e68354fb.pdf`, with the extracted
`thong-tu-10-2026-appendix.json` and Markdown representation used for
structured inspection. The appendix contains 42 structural rows: five section
rows and 37 equipment item rows. Of the equipment rows, 16 have a
source-declared section parent and 21 are top-level rows. Rendering must
preserve that distinction and source order; it must not synthesize parents.
The quota text is frequently multiline and contains conditional rules, so it
must not be reduced to one inferred numeric formula.

The current application has separate concepts:

- `nhom_thiet_bi`: active unit equipment categories and hierarchy;
- `quyet_dinh_dinh_muc`: active/draft quota decisions;
- `chi_tiet_dinh_muc`: numeric quota values for a decision;
- `/device-quota/categories`: category and equipment-assignment workspace.

Those tables and contracts are used by active operations. A draft catalog must
not mutate them or become visible to active compliance/reporting reads before a
future publish change.

## Goals

- Provide a single editable draft representation of the Thông tư 10/2026
  equipment catalog for the current unit.
- Preserve the distinction between regulatory source data and unit-specific
  values.
- Keep source traceability for every regulatory section, item, and rule.
- Support save, reopen, and view without activation.
- Preserve the existing RPC-only, session-guarded multi-tenant architecture.

## Non-Goals

- Applying draft rows to `nhom_thiet_bi`, `quyet_dinh_dinh_muc`,
  `chi_tiet_dinh_muc`, or `thiet_bi`.
- Replacing the current active decision workflow.
- Machine evaluation of legal conditions.
- Non-appendix equipment, approval authority, publication, or electronic
  signatures.

## Domain Model

### Regulatory layer

- `regulatory_document`: the legal document identity, effective date, source
  file, and document version.
- `regulatory_catalog_version`: the imported appendix snapshot associated with
  one regulatory document.
- `regulatory_section`: a structural section row from the appendix.
- `regulatory_item`: one of the 37 equipment item rows, retaining its source
  identifier, original name, original unit, section, source pages, and source
  reference, and immutable source position.
- `regulatory_rule`: one source-text rule belonging to a regulatory item.
  Structured interpretation may be stored later, but source text and source
  reference remain authoritative.

Regulatory entities are immutable to unit users. MVP uses one system-selected
immutable catalog version for Thông tư 10/2026; users do not choose a version.
The version is reproducible from document identifier, effective date, source
PDF SHA-256, extraction revision, import status, and source-page references.
The source snapshot is repository-owned or migration-seeded so implementation
does not depend on an untracked workstation path. Creation fails closed when
the canonical snapshot is missing, duplicated, incomplete, or not marked ready.

### Unit draft layer

- `unit_catalog_draft`: one draft aggregate scoped to one unit, linked to one
  regulatory catalog version, with draft status and timestamps.
- `unit_catalog_draft_item`: one selected or excluded regulatory item in the
  draft. It references the regulatory item and stores only unit-specific
  overrides and draft state.

The draft item keeps regulatory values available for display through its
reference, while storing independent values for:

- display name override;
- applied unit;
- applied quantity, nullable while incomplete;
- notes;
- excluded/restored state;
- ordering within the regulatory section.

Every regulatory section and item stores an immutable `source_position` from
the 42-row source snapshot. This preserves the relative placement of section
rows, child items, and top-level items; it is distinct from any future
unit-editable display ordering.

`applied_quantity` is not the legal maximum and must not be named or displayed
as the regulatory quota. The UI must show the regulatory rule text separately
from the unit-applied value.

## State And Invariants

The MVP draft state is `draft`. Future states such as `submitted`, `approved`,
and `published` may be reserved in the model but are not reachable in this
change.

Required invariants:

- A draft belongs to exactly one unit and one regulatory catalog version.
- Every draft operation requires a non-empty, server-verified `don_vi` claim
  from the authenticated session. This applies to `global`/`admin` as well as
  `to_qltb`; missing session unit blocks creation, read, and save. No
  client-selected or caller-supplied unit can override the session unit.
- `global` and legacy `admin` (normalized through `isGlobalRole()`) may manage
  a draft only when the authenticated session has the current unit. `to_qltb`
  may manage only its session unit. Mapping-only users and `regional_leader`
  retain their existing read-only/non-category-management boundaries and
  cannot create or mutate this draft in the MVP.
- A unit has at most one editable draft in the MVP.
- Create-or-open is transactional and protected by a unique partial
  constraint for one editable draft per unit. It uses the same result for
  repeated or concurrent requests and establishes revision `1` for a newly
  created draft.
- Read operations require authentication, role, and session-unit checks but do
  not require an expected revision. Create-or-open requires those checks and
  the one-draft uniqueness invariant. Save, exclude, and restore require an
  `expected_revision`, atomically compare-and-swap the draft revision, and
  increment it on success. A stale mutation returns a conflict and cannot
  overwrite newer values.
- A draft item references at most one regulatory item.
- A regulatory item cannot appear twice in the same draft.
- Removing an item changes draft state only; it does not delete regulatory data.
- Draft writes cannot modify active decision/category/equipment tables.
- Regulatory source fields cannot be written through draft mutation contracts.
- `applied_quantity` is either null for an incomplete draft or a non-negative
  integer. It is a unit-proposed draft value, not a legal determination or
  approved quota. MVP does not compute, reject, or warn on regulatory maximum
  comparisons because the source rules are conditional and not uniformly
  machine-evaluable; the source rule remains visible beside the value.

## UX And Data Flow

1. An authorized user opens the create action in `/device-quota/categories`.
2. The application resolves the current unit from the authenticated session.
3. The application creates or opens the unit's one editable draft, initialized
   with the 42 source rows: five structural sections and 37 regulatory items,
   retaining source order and source-declared parent relationships.
4. The editor presents regulatory columns and unit-specific columns with
   distinct visual treatment and source badges. It shows five section rows,
   16 child items, and 21 top-level items according to the source structure.
5. The user edits unit-specific fields, excludes or restores rows, and saves.
6. The application persists the draft and returns the saved draft state.
7. Reopening the draft reads the same regulatory basis and unit-specific
   values; it does not read or alter the active decision as a substitute.

For a 37-row multiline table, the editor should be a full workspace surface
rather than a compact single-row CRUD dialog. The exact route composition may
reuse the existing Categories shell, but draft editing must not be constrained
by the current category-dialog form contract.

## Authorization And Persistence

All reads and writes use the existing `/api/rpc/[fn]` proxy and RPC allowlist.
RPCs must validate the authenticated user, role, and effective unit, and must
fail closed when the session unit is absent or mismatched. The implementation
must use `isGlobalRole()` in any server-side TypeScript role branch outside the
proxy. The draft capability is limited to the existing category-management
roles; mapping-only and `regional_leader` users cannot mutate drafts.

Draft persistence should use new tables and RPCs rather than overloading active
`nhom_thiet_bi` or `quyet_dinh_dinh_muc` rows. The implementation must add
appropriate uniqueness, foreign-key, non-negative quantity, and tenant-scope
constraints. New source, draft, and audit tables must revoke direct
`anon`/`authenticated`/`public` table access and be reachable only through
explicitly granted RPCs. Each RPC must use authenticated/app-role/user/unit
claim guards, `SECURITY DEFINER SET search_path = public, pg_temp`, and the
repository's role normalization rules.

Audit persistence is mandatory but not user-visible in this MVP. Each
successful create, save, exclude, and restore event records the actor from
JWT claims, unit, draft, event type, timestamp, and before/after item or
aggregate state. Audit insertion is in the same transaction as the mutation;
failed mutations do not create a successful-change event. Any SQL change
follows the repository migration source-order and database quality-gate rules.

## Validation

Validation has four distinct layers:

- source validation: the regulatory snapshot is complete and traceable;
- draft-domain validation: duplicate items, tenant scope, field types, and
  quantity range, expected revision, and one-draft invariant;
- UI validation: editable controls, required input shape, and save-state
  feedback;
- future publication validation: intentionally deferred and not executed by
  this change.

Saving an incomplete draft is valid. Excluded rows may remain incomplete.
Publication-time completeness is outside the MVP.

## Phase 4 Delivery Decomposition

Phase 4 is intentionally split into four sub-phases so each compatibility and
release concern has a focused test boundary:

### Phase 4.1: Page-Level Coexistence And Manager Gating

The page-level suite proves that the existing category-management controls,
both Excel import entry points, and their manager gating remain available before
and after draft initialization, save, and reopen. The draft editor remains a
separate entry point and can be disabled without changing the active page.

### Phase 4.2: Active-Surface Isolation And Regression

Regression coverage proves that draft reads and writes do not mutate active
category, decision, equipment-mapping, compliance, report, or Excel-import
state or invalidate their query contracts. This sub-phase is behavior-only;
it does not introduce a new shared data layer.

### Phase 4.3: Direct-RPC Negative Security Contract

The database phase gate exercises cross-tenant access, missing session units,
unsupported roles, caller-supplied unit overrides, direct table access,
source-version mismatches, stale revisions, and malformed payloads. The gate
must remain fail-closed and must not weaken the existing SECURITY DEFINER,
JWT-claim, or explicit-grant boundaries.

### Phase 4.4: Release Verification And Rollback Readiness

Verification runs formatting, OpenSpec validation, the applicable static and
Oracle baseline-forward database lanes, typecheck, focused tests, and the
repository React gate. Static and baseline-forward results are recorded
separately; aggregate PASS is allowed only when both lanes pass for the same
exact commit. Deployment remains additive (migrations, then RPC contracts,
then UI enablement), and rollback must leave active contracts and both Excel
flows intact.

## Compatibility And Risks

- Existing active quota reads must continue to use their current contracts.
- The existing active category create/edit/delete flow remains available. The
  draft catalog gets a separate entry point and does not replace active
  category creation.
- The existing Excel import flow remains available with its current entry
  point, permissions, validation, API/RPC contract, imported data mapping, and
  active-category effects. This includes category import through
  `dinh_muc_nhom_bulk_import` and the separate quota-decision import path
  through `dinh_muc_chi_tiet_bulk_import`; where the current category flow
  includes optional quota columns, its `dinh_muc_unified_import` invocation,
  automatic decision creation, and partial-success behavior remain unchanged.
  Draft initialization and draft mutations must not route through, alter, or
  disable either Excel flow.
- A future publish change will need an explicit mapping from draft items to
  active categories/decisions; this proposal does not define that mapping.
- The extracted JSON/Markdown is structural transcription, not a replacement
  for the official PDF. Source metadata must make that distinction visible.
- Reusing current category or decision tables would make draft data
  indistinguishable from active data and is therefore rejected.
