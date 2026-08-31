## Context

The regulatory source is the official
`757_Thong-tu-10-2026-TT-BYT_88e68354fb.pdf`, with the extracted
`thong-tu-10-2026-appendix.json` and Markdown representation used for
structured inspection. The appendix contains 42 structural rows: five section
rows and 37 equipment item rows. The quota text is frequently multiline and
contains conditional rules, so it must not be reduced to one inferred numeric
formula.

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
- Custom items, approval authority, publication, or electronic signatures.

## Domain Model

### Regulatory layer

- `regulatory_document`: the legal document identity, effective date, source
  file, and document version.
- `regulatory_catalog_version`: the imported appendix snapshot associated with
  one regulatory document.
- `regulatory_section`: a structural section row from the appendix.
- `regulatory_item`: one of the 37 equipment item rows, retaining its source
  identifier, original name, original unit, section, source pages, and source
  reference.
- `regulatory_rule`: one source-text rule belonging to a regulatory item.
  Structured interpretation may be stored later, but source text and source
  reference remain authoritative.

Regulatory entities are immutable to unit users. The imported version must be
identified explicitly when a draft is created.

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

`applied_quantity` is not the legal maximum and must not be named or displayed
as the regulatory quota. The UI must show the regulatory rule text separately
from the unit-applied value.

## State And Invariants

The MVP draft state is `draft`. Future states such as `submitted`, `approved`,
and `published` may be reserved in the model but are not reachable in this
change.

Required invariants:

- A draft belongs to exactly one unit and one regulatory catalog version.
- The effective unit comes from the authenticated session for non-global
  users; a missing session unit blocks creation and save.
- A unit has at most one editable draft in the MVP.
- A draft item references at most one regulatory item.
- A regulatory item cannot appear twice in the same draft.
- Removing an item changes draft state only; it does not delete regulatory data.
- Draft writes cannot modify active decision/category/equipment tables.
- Regulatory source fields cannot be written through draft mutation contracts.
- `applied_quantity` is either null for an incomplete draft or a non-negative
  integer. No legal maximum comparison is inferred by this MVP.

## UX And Data Flow

1. An authorized user opens the create action in `/device-quota/categories`.
2. The application resolves the current unit from the authenticated session.
3. The application creates or opens the unit's one editable draft, initialized
   with all 37 regulatory items under five read-only sections.
4. The editor presents regulatory columns and unit-specific columns with
   distinct visual treatment and source badges.
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
proxy.

Draft persistence should use new tables and RPCs rather than overloading active
`nhom_thiet_bi` or `quyet_dinh_dinh_muc` rows. The implementation must add
appropriate uniqueness, foreign-key, non-negative quantity, and tenant-scope
constraints, plus an audit trail for draft creation and mutation. Any SQL
change follows the repository migration source-order and database quality-gate
rules.

## Validation

Validation has four distinct layers:

- source validation: the regulatory snapshot is complete and traceable;
- draft-domain validation: duplicate items, tenant scope, field types, and
  quantity range;
- UI validation: editable controls, required input shape, and save-state
  feedback;
- future publication validation: intentionally deferred and not executed by
  this change.

Saving an incomplete draft is valid. Excluded rows may remain incomplete.
Publication-time completeness is outside the MVP.

## Compatibility And Risks

- Existing active quota reads must continue to use their current contracts.
- A future publish change will need an explicit mapping from draft items to
  active categories/decisions; this proposal does not define that mapping.
- The extracted JSON/Markdown is structural transcription, not a replacement
  for the official PDF. Source metadata must make that distinction visible.
- Reusing current category or decision tables would make draft data
  indistinguishable from active data and is therefore rejected.
