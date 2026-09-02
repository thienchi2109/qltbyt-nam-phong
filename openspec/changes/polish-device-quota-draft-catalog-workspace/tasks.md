## Phase 0: Baseline And Change Coordination

Boundary: characterization and coordination only. No runtime presentation
changes.

- [x] 0.1 Re-read the resolved Wayfinder decision, this OpenSpec change, and
      the active `add-device-quota-draft-catalog` change before implementation.
- [x] 0.2 Confirm the implementation branch starts from an exact commit that
      contains the parent draft-catalog editor behavior and record that baseline
      commit in the implementation handoff.
- [x] 0.3 Coordinate the shared-file boundary with issue `#982`; record the
      landing order and exact rebase point without absorbing its
      React-complexity acceptance criteria.
- [x] 0.4 Characterize the current editor behavior with focused tests covering
      save, pending locks, validation, read-only mode, section navigation,
      source/rule disclosure, exclusion, restoration, and stale conflicts.
      Drive UI interactions with `@testing-library/user-event`; do not add a
      browser or Playwright test.
- [x] 0.5 Confirm snapshot and revision values remain available to internal
      save, mutation, and stale-conflict logic after their dedicated
      user-facing metadata row is removed.
- [x] 0.6 Record the visual baseline/evidence status for `1024px`, `1280x720`,
      `1366x768`, and `1440x900`. Browser-driven capture is intentionally not
      performed; automated interaction coverage is provided by
      `@testing-library/user-event`.

Exit criteria: existing behavior and visual defects are reproducible; the
shared-file ordering with issue `#982` is explicit; no production source has
changed.

## Phase 1: Workspace Shell And Save Header

Boundary: workspace-level presentation only. Existing full-height item rows
remain in place and continue using their current callbacks.

- [x] 1.1 Remove the dedicated user-facing technical metadata row containing
      snapshot, revision, raw draft status, save timestamp, and mode.
- [x] 1.2 Consolidate the page title, document/unit context, completion state,
      and concise saved/unsaved/saving feedback into the existing sticky top
      toolbar, which remains visible outside the item scroll region.
- [x] 1.3 Preserve the current save callback, disabled conditions, validation
      guard, pending state, and independent item scroll region.
- [x] 1.4 Add focused `user-event` tests for technical metadata removal and the
      toolbar save states without changing item-editing semantics.

Exit criteria: the header is compact and deployable with the existing item
layout; save and conflict behavior are unchanged; focused shell tests pass.

## Phase 2: Collapsible Structure Navigation

Boundary: shared hierarchical workspace and structure navigation only. Item
record markup and edit behavior remain unchanged.

- [x] 2.1 Add the expanded approximately `176px` structure panel and collapsed
      `48px` rail to the draft editor using existing hierarchical-editor
      primitives.
- [x] 2.2 At constrained widths from `1024px` upward, default to the rail and
      allow the expanded panel to overlay without resizing the item grid or
      creating unintended horizontal overflow.
- [x] 2.3 Preserve section ordering, active-section highlighting,
      `scrollIntoView`, keyboard operation, and Technical Configurations
      behavior when shared primitives are adjusted.
- [x] 2.4 Add focused `user-event` tests for expanded, collapsed,
      constrained-width, and section-selection states.

Exit criteria: structure navigation can ship independently; existing rows
remain fully usable at every supported desktop/tablet target; shared-consumer
tests pass.

## Phase 3: Compact Record Interaction

Boundary: item expansion and compact-summary behavior only. Editable field
content and visual grid remain functionally equivalent to the current form.

- [x] 3.1 Introduce compact item summaries and workspace-level expanded-item
      state with at most one full item editor open at a time.
- [x] 3.2 Ensure opening another item collapses the previous item without
      discarding staged values, validation errors, or pending state.
- [x] 3.3 Preserve independent section collapse, source order, completeness
      counts, excluded-row position, read-only mode, and existing item
      callbacks.
- [x] 3.4 Add focused `user-event` tests for initial expansion, item switching,
      staged-value preservation, section collapse, excluded items, and
      read-only summaries.

Exit criteria: the compact interaction model is behaviorally complete and
deployable before field-density styling; all existing mutation and draft-state
tests pass.

## Phase 4: Shared Field Grid And Content Density

Boundary: expanded-item information hierarchy, alignment, and density. No new
data operations or toolbar functionality.

- [ ] 4.1 Replace repeated object-specific labels with `Tên hiển thị`,
      `Đơn vị áp dụng`, `Số lượng đề xuất`, and `Ghi chú`, while retaining
      item-specific accessible names where needed.
- [ ] 4.2 Implement one stable shared CSS Grid template for every expanded
      item so field boundaries, label baselines, input heights, and spacing
      remain identical across records.
- [ ] 4.3 Define the intentional `1024-1199px` field arrangement and the
      `>=1200px` field arrangement without browser-driven arbitrary wrapping
      or horizontal page overflow.
- [ ] 4.4 Reduce item padding and visible source metadata, and keep complete
      source references and multiline rules available through progressive
      disclosure.
- [ ] 4.5 Shorten visible exclusion/restoration and rule actions without
      changing confirmation, mutation, disabled, pending, or destructive-action
      semantics.
- [ ] 4.6 Add focused `user-event` accessibility and structural tests for
      labels, field-grid alignment hooks, disclosure controls, and item
      actions.

Exit criteria: compact and expanded records share a stable information
hierarchy; all supported widths are usable; behavior and accessibility tests
pass.

## Phase 5: Cross-State Regression Hardening

Boundary: integration coverage and defect correction only. No new layout
features.

- [ ] 5.1 Verify editable, incomplete, complete, excluded, read-only, saving,
      excluding, restoring, recovering, validation-error, and stale-conflict
      states in the polished workspace.
- [ ] 5.2 Verify section navigation, item expansion, source/rule disclosure,
      and save availability remain coherent after long-list scrolling.
- [ ] 5.3 Verify active category CRUD, both Excel import entry points, mapping,
      reporting, compliance, and unrelated Device Quota routes are unaffected.
- [ ] 5.4 Resolve only regressions attributable to this change; file follow-up
      issues for unrelated findings instead of widening scope.

Exit criteria: all existing draft behavior is preserved across user-visible
states, and no adjacent Device Quota workflow regresses.

## Phase 6: Visual QA And Release Evidence

Boundary: verification, evidence, and release readiness only.

- [ ] 6.1 Run the repository TypeScript/React quality gates in the required
      order, including focused draft-catalog and shared hierarchical-editor
      tests plus React Doctor.
- [ ] 6.2 Perform visual QA at `1024px`, `1280x720`, `1366x768`, and
      `1440x900`; manually or through equivalent visual evidence verify field
      alignment, record density, sidebar behavior, save accessibility, scroll
      boundaries, and absence of unintended horizontal overflow. Do not add a
      browser-driven test.
- [ ] 6.3 Confirm the final diff contains no API, database, migration,
      permission, validation, business-rule, mobile, active-category/import, or
      issue `#982` scope changes.
- [ ] 6.4 Record reviewable manual/equivalent visual evidence and the exact
      `user-event` and verification results for the landed commit.

Exit criteria: functional gates pass, visual evidence matches the same landed
commit, and the UI-only change is ready for approval and deployment.
