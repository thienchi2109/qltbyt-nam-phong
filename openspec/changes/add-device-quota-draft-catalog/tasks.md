## 1. Regulatory Source Foundation

- [ ] 1.1 Confirm the Thông tư 10/2026 regulatory snapshot contract against the
      official PDF and extracted appendix files.
- [ ] 1.2 Create a repository-owned or migration-seeded immutable source
      artifact containing the 42 structural rows, document metadata, PDF hash,
      extraction revision, source pages, and source references.
- [ ] 1.3 Persist the regulatory document, catalog version, sections, items,
      rules, source pages, and source references without exposing unit write access.
- [ ] 1.4 Add source-traceability tests for all five sections and 37 equipment
      items, including the 16 source-declared child rows, 21 top-level rows,
      multiline rules, and footnote references.

## 2. Draft Persistence Contract

- [ ] 2.1 Add the unit draft and draft-item data model with one-editable-draft
      per unit, source-version integrity, duplicate-item protection, and
      monotonic revision handling.
- [ ] 2.2 Add RPCs for create-or-open, read, save, exclude, and restore draft
      operations with session-unit, role, source-readiness, and expected-
      revision guards.
- [ ] 2.3 Add mandatory audit records for successful draft creation and
      unit-specific mutations, coupled atomically to each write.
- [ ] 2.4 Add the RPC proxy allowlist entries and generated database contract
      updates required by the new RPCs.
- [ ] 2.5 Add explicit grants/revokes and SQL contract tests for RPC-only
      access, JWT claim guards, `search_path`, role normalization, and tenant
      isolation.

## 3. Draft Editor UX

- [ ] 3.1 Add a separate draft-catalog editor entry point in
      `/device-quota/categories`; preserve the current single-category active
      create/edit/delete flow.
- [ ] 3.2 Render all 42 source rows in source order: five structural sections,
      16 source-declared child items, and 21 top-level items. Visually
      distinguish regulatory fields from unit-specific fields.
- [ ] 3.3 Implement editable display name, applied unit, applied quantity,
      notes, exclude, restore, save, reopen, and view states.
- [ ] 3.4 Resolve the unit from the authenticated session for every role,
      prevent a user-controlled unit override, and preserve existing
      read-only boundaries for mapping-only and `regional_leader` users.
- [ ] 3.5 Preserve existing category, assignment, active-decision, compliance,
      report, and Excel import surfaces while a draft is being edited.
- [ ] 3.6 Add regression coverage proving the existing Excel import entry
      point, permissions, validation, data mapping, and active-category writes
      remain unchanged.

## 4. Validation And Regression Coverage

- [ ] 4.1 Add domain and RPC tests for role authorization, tenant isolation,
      duplicate rows, missing-session-unit failure, immutable source-version
      selection, non-negative integer quantities, stale revisions, and
      read-only regulatory fields.
- [ ] 4.2 Add UI tests for initialization, multiline rule rendering,
      edit/save/reopen, exclude/restore, incomplete draft save, and failure
      feedback, read-only view, and concurrent-save conflict feedback.
- [ ] 4.3 Add regression tests proving draft writes do not invalidate or
      mutate active decision, equipment-mapping, compliance, report, or Excel
      import behavior.
- [ ] 4.4 Run the repository TypeScript/React verification sequence and the
      applicable database quality gates before implementation completion.

## 5. Deferred Follow-Ups

- [ ] 5.1 Create a separate change for submit/review/approve/publish and active
      catalog activation.
- [ ] 5.2 Create a separate change for custom equipment items and their
      non-appendix legal basis, justification/source workflow, authority, and
      approval semantics.
- [ ] 5.3 Create a separate change for applying published drafts to the active
      quota decision and equipment-classification surfaces.
