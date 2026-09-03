## Phase 0: Contract Baseline And Source Freeze

Boundary: documentation, source-artifact, and test-fixture work only. No
runtime route, active data contract, or live database behavior changes.

- [x] 0.1 Record the current category Excel import contract, including
      `dinh_muc_nhom_bulk_import`, optional quota-column handling through
      `dinh_muc_unified_import`, automatic decision creation, and
      partial-success behavior.
- [x] 0.2 Record the separate quota-decision Excel import contract, including
      its validation, payload mapping, and
      `dinh_muc_chi_tiet_bulk_import` behavior.
- [x] 0.3 Freeze a repository-owned source artifact for the official
      Thông tư 10/2026 snapshot: 42 structural rows, five sections, 37 items,
      16 source-declared child rows, 21 top-level rows, source positions,
      multiline rules, footnotes, document metadata, PDF SHA-256, extraction
      revision, effective date, and ready status.
- [x] 0.4 Add source-only traceability fixtures/tests proving the artifact is
      reproducible and complete. Do not expose it through the application yet.

Exit criteria: the source snapshot and existing import contracts are reviewable
in isolation; no application user flow changes.

## Phase 1: Additive Regulatory Catalog Foundation

Boundary: additive database/source persistence and read-only server contracts.
No draft mutation, no active-table writes, and no UI cutover.

- [x] 1.1 Add the immutable regulatory document, catalog version, structural
      rows, items, rules, source positions, source pages, and references.
- [x] 1.2 Enforce one canonical ready snapshot for Thông tư 10/2026 with
      identity/hash/effective-date/extraction metadata and source completeness
      constraints.
- [x] 1.3 Add read-only RPC access for the regulatory snapshot with explicit
      grants, JWT/auth-role guards, tenant-safe behavior, and
      `SECURITY DEFINER SET search_path = public, pg_temp`.
- [x] 1.4 Add database/source contract tests. Do not alter existing category,
      decision, assignment, compliance, report, or Excel-import contracts.

Deploy boundary: additive migration and dormant/read-only RPCs can deploy
without changing current screens or active data.

## Phase 2: Draft Persistence And Guarded Mutation

Boundary: new draft tables, RPCs, audit records, and generated contracts only.
The editor remains feature-flagged or unreachable until Phase 3; existing
category and import flows remain untouched.

- [x] 2.1 Add `unit_catalog_draft` and `unit_catalog_draft_item` with source
      version integrity, one editable draft per unit, duplicate protection,
      non-negative quantity constraint, and monotonic revision.
- [x] 2.2 Implement transactional create-or-open at revision `1`; repeated or
      concurrent requests return the same draft.
- [x] 2.3 Implement read RPCs with auth, role, and session-unit guards only.
      Implement save, exclude, and restore RPCs with mandatory
      `expected_revision`, atomic compare-and-swap, and standard stale-conflict
      response.
- [x] 2.4 Enforce the role matrix: `global`/`admin` and `to_qltb` require a
      server-verified session unit; mapping-only and `regional_leader` cannot
      create or mutate drafts.
- [x] 2.5 Add mandatory atomic audit events for successful create, save,
      exclude, and restore, deriving actor and unit from JWT claims.
- [x] 2.6 Add explicit table revokes, RPC grants, proxy allowlist entries, and
      generated database contracts. Add SQL contract tests for tenant isolation,
      role normalization, immutable source access, and audit coupling.

Deploy boundary: additive schema/RPC deployment is safe while the new editor is
not enabled; rollback does not touch active tables.

## Phase 3: Draft Editor And Read/Write Workflow

Boundary: `/device-quota/categories` draft entry point and editor UI only,
using Phase 1-2 contracts. Existing active category CRUD and both Excel import
flows remain available as separate actions.

Presentation source of truth: the canonical `device-quota-category-workspace`
specification now defines the appendix-aligned semantic table delivered by the
archived follow-up change. Phase 4 must not reintroduce the superseded sidebar,
compact item-card, or single-expanded-item requirements.

- [x] 3.1 Add a separate draft-catalog entry point without replacing the
      current single-category active create/edit/delete flow or import controls.
- [x] 3.2 Implement create-or-open and read-only view mode for the current
      session unit, including clear source-version metadata and unavailable-
      snapshot feedback.
- [x] 3.3 Render all 42 source rows in immutable source order: five structural
      sections, 16 source-declared child items, and 21 top-level items.
- [x] 3.4 Implement unit-specific display name, applied unit, applied quantity,
      notes, exclude, restore, incomplete-save, and stale-conflict states.
- [x] 3.5 Distinguish regulatory fields from editable unit fields and label
      applied quantity as a unit-proposed draft value, not an approved quota.
- [x] 3.6 Add UI integration coverage for authorized/unauthorized roles,
      session-unit enforcement, create/open/view/edit/save, exclusion/restore,
      incomplete drafts, read-only regulatory fields, and stale conflicts.

Deploy boundary: the existing workspace remains functional if the draft entry
point is disabled; the new editor writes only draft contracts.

## Phase 4.1: Page-Level Coexistence And Manager Gating

Boundary: prove that the existing categories page remains operational while
the separate draft entry point is present. No active-category or import
behavior is changed in this sub-phase.

- [ ] 4.1.1 Add page-level integration coverage proving category-management
      controls, both Excel import entry points, and their manager gating remain
      available before and after draft initialization, save, and reopen.

## Phase 4.2: Active-Surface Isolation And Regression

Boundary: prove that draft reads and writes remain isolated from active
category, decision, equipment-mapping, compliance, report, and Excel-import
contracts.

- [ ] 4.2.1 Add regression tests proving draft writes do not mutate or
      invalidate active category, decision, equipment-mapping, compliance,
      report, or Excel-import behavior.

## Phase 4.3: Direct-RPC Negative Security Contract

Boundary: exercise the draft RPC security and payload guards directly without
changing the RPC contract or granting direct table access.

- [ ] 4.3.1 Add direct-RPC negative tests for cross-tenant access, missing
      session unit, unauthorized roles, caller-supplied unit overrides,
      direct table access, source-version mismatch, stale revisions, and
      malformed payloads.

## Phase 4.4: Release Verification And Rollback Readiness

Boundary: establish exact-commit verification and an additive deployment /
rollback sequence. No new product scope or legal workflow is introduced.

- [ ] 4.4.1 Run formatting, OpenSpec strict validation, applicable database
      static and baseline-forward gates, typecheck, focused tests, and the
      repository React verification sequence. Static and baseline-forward
      results must be reported separately; aggregate PASS requires both lanes
      to pass for the same exact commit.
- [ ] 4.4.2 Verify deployment and rollback runbooks: additive migrations first,
      RPC contracts second, UI enablement last; rollback leaves active
      contracts and both Excel flows intact.

Exit criteria: all phases are independently reviewable, the draft feature can
be disabled without affecting existing operations, and no publish/activation
behavior exists.

## Deferred Follow-Ups

- [ ] D1 Create a separate change for submit/review/approve/publish and active
      catalog activation.
- [ ] D2 Create a separate change for non-appendix equipment, including its
      legal basis, justification/source workflow, authority, and approval
      semantics.
- [ ] D3 Create a separate change for applying published drafts to the active
      quota decision and equipment-classification surfaces.
