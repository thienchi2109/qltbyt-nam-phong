# Add Device Quota Draft Catalog Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED: Use `superpowers:subagent-driven-development` (if subagents are available) or `superpowers:executing-plans` to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 3 unit-scoped device-quota draft catalog editor, using the same desktop workspace language as `Technical Configurations > Cấu hình cơ sở`, while preserving the existing active category and Excel-import workflows.

**Architecture:** Extract only the stable hierarchical-editor presentation primitives from the Technical Configurations baseline editor into a shared component area. Keep Technical Configurations and Device Quota domain models, validation, persistence, and mutation handlers separate, with thin adapters into the shared workspace. Add a separate draft-catalog route entered from `/device-quota/categories`; the editor reads the immutable Phase 1 catalog and Phase 2 draft independently, then merges them by the immutable source item identifier.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Query, existing `callRpc`/RPC proxy, existing UI primitives and Lucide icons, Vitest + Testing Library, Prettier, repository verification scripts, React Doctor.

---

## Required Skills

- `@superpowers:brainstorming` and `@grilling` decisions are already completed; do not reopen the approved desktop-only design during implementation.
- `@superpowers:test-driven-development` is required before each implementation slice.
- `@superpowers:executing-plans` or `@superpowers:subagent-driven-development` is required to execute this plan.
- `@next-best-practices` must be used for the App Router route.
- `@vercel-react-best-practices` must be used for React/TanStack Query implementation.
- `@code-deduplication` must be used before finalizing shared primitives.
- `@react-doctor` must be used after React changes.

## Scope And Decisions

- Implement only OpenSpec Phase 3, continuing from `14440884669fab0e33ce8520c20fe03a4dd04efb`.
- The draft entry point is additive. Existing active category CRUD, category import, and quota-decision import remain available and unchanged in behavior.
- The editor is scoped to the authenticated session unit. There is no facility selector inside the editor.
- Render all 42 immutable source rows in source order: five structural sections and 37 regulatory items, including the 16 source-declared child items and 21 top-level items.
- Regulatory name, regulatory unit, rule text, source reference, source pages, parent, level, and source order are read-only.
- Editable unit fields are display name, applied unit, proposed quantity, and notes. The display-name field is optional and shows `Mặc định theo tên Thông tư` when empty.
- Exclude/restore, incomplete save, read-only view mode, and stale revision conflict are part of Phase 3.
- Read-only view mode is an editor mode for an authorized user viewing an existing draft; it does not introduce a new `Viewer` role.
- In this Phase 3 implementation, `global`, `admin`, and `to_qltb` are the only supported roles for catalog/draft access. `regional_leader`, mapping-only, and other roles fail closed because the catalog read RPC does not authorize them.
- Ordinary field edits are staged locally until `Lưu`. `Loại trừ` and `Khôi phục` are immediate CAS-protected mutations through their dedicated RPCs, each carrying `expected_revision`; a failed mutation leaves the prior state intact.
- The applied quantity label must communicate that it is a unit-proposed draft value, never an approved quota.
- The five sections use the same sidebar plus independently collapsible section pattern as Technical Configurations. The regulatory rule is collapsed behind `Xem quy tắc`.
- Desktop/tablet only. The product hides Device Quota on small screens, so Phase 3 does not add mobile layouts, mobile-specific states, or mobile viewport tests.
- No Phase 4 work: no publish, submit, approve, activate, compliance, mapping, reporting, or migration changes.
- No live database mutation is part of implementation or verification.

## File Map

Shared presentation primitives:

- Create `src/components/hierarchical-editor/HierarchicalEditorTypes.ts` for generic section, row, disclosure, and action contracts.
- Create `src/components/hierarchical-editor/HierarchicalEditorWorkspace.tsx` for the fixed-height workspace surface and independent scroll region.
- Create `src/components/hierarchical-editor/HierarchicalEditorStructureSidebar.tsx` for section navigation and active-section highlighting.
- Create `src/components/hierarchical-editor/HierarchicalEditorSection.tsx` for the collapsible section header and section body composition.
- Create `src/components/hierarchical-editor/HierarchicalEditorToolbar.tsx` for mode, save, loading, incomplete, and error affordances.
- Create `src/components/hierarchical-editor/__tests__/HierarchicalEditorWorkspace.test.tsx` for shared layout and interaction contracts.
- Modify `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor.tsx` to consume the shared primitives without changing its domain behavior.
- Modify the directly affected Technical Configurations component/type files only as required by the extraction.
- Create `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-shared-workspace.test.tsx` for extracted shared-workspace regression coverage; leave the existing baseline workspace test unchanged so no test file crosses the repository's 450-line hard ceiling.

Device Quota draft domain and data:

- Create `src/app/(app)/device-quota/categories/draft-catalog/device-quota-draft-catalog-types.ts` only for regulatory catalog rows, merged rows, editor modes, and UI status types not already covered by the Phase 2 contract.
- Create `src/app/(app)/device-quota/categories/draft-catalog/device-quota-draft-catalog-mappers.ts` for catalog/draft merge, source-order hierarchy construction, fallback display name, and completeness derivation.
- Create `src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-mappers.test.ts` for pure merge and validation-state tests.
- Create `src/app/(app)/device-quota/categories/_queries/deviceQuotaRegulatoryCatalogQuery.ts` for the Phase 1 catalog read.
- Create `src/app/(app)/device-quota/categories/_queries/deviceQuotaDraftCatalogQuery.ts` for Phase 2 draft get/create-or-open reads.
- Create `src/app/(app)/device-quota/categories/_components/DeviceQuotaDraftCatalogMutations.ts` for save, exclude, and restore mutations with expected revision.
- Create `src/app/(app)/device-quota/categories/_hooks/useDeviceQuotaDraftCatalog.ts` for query orchestration, session-unit enforcement, edit/view mode, local draft edits, and mutation invalidation.
- Create `src/app/(app)/device-quota/categories/_hooks/__tests__/useDeviceQuotaDraftCatalog.test.tsx` for query/mutation state transitions, exact role behavior, session-unit isolation, and stale-conflict handling.
- Create `src/app/(app)/device-quota/categories/_hooks/__tests__/useDeviceQuotaDraftCatalog.validation.test.tsx` for invalid quantity and field-level validation behavior.
- Reuse `src/lib/device-quota-draft-contract.ts` for Phase 2 draft, item, save, exclude, and restore payload types; do not duplicate those contracts.

Device Quota draft UI and route:

- Create `src/app/(app)/device-quota/categories/draft-catalog/page.tsx` as the separate draft editor route.
- Create `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogPageClient.tsx` as the client composition boundary.
- Create `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogEditor.tsx` as the domain adapter over shared workspace primitives.
- Create `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogSection.tsx` for one source section and its ordered item rows.
- Create `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogItemRow.tsx` for immutable regulatory fields, editable unit fields, exclude/restore, and read-only rendering.
- Create `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogRuleDisclosure.tsx` for the inline `Xem quy tắc` disclosure.
- Create `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogStates.tsx` for loading, missing unit, unavailable snapshot, unauthorized, conflict, and empty/error states.
- Create `src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogEditor.test.tsx` for the editor behavior.
- Modify `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryToolbar.tsx` to add the additive draft-catalog entry action.
- Modify `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryToolbar.test.tsx` to verify the new entry action is additive; do not extend the already-large page test.
- Modify `src/app/api/rpc/[fn]/allowed-functions.ts` to allow `device_quota_regulatory_catalog_get` through the existing RPC proxy.
- Modify `src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts` or add a focused sibling test if needed to prove the catalog RPC is reachable while unsupported RPCs remain rejected.

No migration, generated database contract, active category RPC, or live database file is planned for modification because Phase 1 and Phase 2 contracts already exist. The RPC proxy allowlist is a required Phase 3 application change because the Phase 1 catalog function is not currently reachable through the proxy.

All new and modified source/test files must remain below the repository's 450-line hard ceiling. Extract additional helpers or tests before crossing roughly 350 lines.

## Chunk 1: Extract Shared Desktop Workspace Primitives

### Task 1: Capture the shared workspace contract with failing tests

**Files:**

- Create: `src/components/hierarchical-editor/__tests__/HierarchicalEditorWorkspace.test.tsx`
- Read/modify as needed: `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx`

- [x] **Step 1: Write failing tests for the shared contract**
  - Assert a fixed-height workspace surface exposes an independently scrollable editor body.
  - Assert the structure sidebar renders the ordered sections and clicking a section scrolls its target into view.
  - Assert the section header toggles disclosure without changing row order.
  - Assert toolbar save is disabled while saving or while a pending input guard is active.
  - Assert the new Technical Configurations shared-workspace regression file covers the extracted save, disclosure, structure, and scrolling behavior without growing `technical-configuration-baseline-workspace.test.tsx` past the extraction threshold.

- [x] **Step 2: Run only the new focused test**

Run:

```bash
node scripts/npm-run.js run test:run -- src/components/hierarchical-editor/__tests__/HierarchicalEditorWorkspace.test.tsx
```

Expected: FAIL because the shared component contracts do not exist yet.

### Task 2: Extract presentation-only primitives

**Files:**

- Create: `src/components/hierarchical-editor/HierarchicalEditorTypes.ts`
- Create: `src/components/hierarchical-editor/HierarchicalEditorWorkspace.tsx`
- Create: `src/components/hierarchical-editor/HierarchicalEditorStructureSidebar.tsx`
- Create: `src/components/hierarchical-editor/HierarchicalEditorSection.tsx`
- Create: `src/components/hierarchical-editor/HierarchicalEditorToolbar.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor.tsx`
- Modify: directly affected Technical Configurations baseline component/type files only

- [x] **Step 1: Implement the smallest generic contracts**
  - Keep all domain-specific values in render-prop or adapter callbacks.
  - Support section keys, labels, collapsed state, pending/error summary, section refs, and row content.
  - Put the definite height and inner scrolling in `HierarchicalEditorWorkspace`; use the approved desktop dimensions `h-[70dvh]`, `min-h-[28rem]`, and `max-h-[52rem]`.
  - Keep page-level overflow out of the editor body; only the inner body scrolls.
  - Use existing UI primitives and icons. Do not add a new design system or mobile branches.
  - Keep shared primitives presentational: they do not own DnD, focus recovery, domain disclosure, persistence, validation, or query state.
  - Sidebar click-to-scroll is a controlled shared capability. Technical Configurations may opt into it only if its existing structure adapter can provide stable section refs without changing domain behavior.

- [x] **Step 2: Migrate Technical Configurations to the primitives**
  - Preserve existing keyboard behavior, focus fallback, bulk-entry behavior, drag/drop behavior, validation, and save guards.
  - Keep DnD, focus recovery, domain disclosure, and persistence in the Technical Configurations adapter/composition layer.
  - Keep `TechnicalConfigurationBaselineEditor` as the composition boundary.
  - Do not change baseline domain types or persistence contracts.

- [x] **Step 3: Run the shared and Technical Configurations focused tests**

Run:

```bash
node scripts/npm-run.js run test:run -- src/components/hierarchical-editor/__tests__/HierarchicalEditorWorkspace.test.tsx 'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx'
```

Expected: PASS, with the existing Technical Configurations behavior preserved.

- [x] **Step 4: Commit the extraction**

```bash
git add src/components/hierarchical-editor 'src/app/(app)/technical-configurations'
git commit -m "refactor: share hierarchical editor workspace primitives"
```

## Chunk 2: Model And Wire The Phase 1/2 Draft Data

### Task 3: Define the merged draft model and pure mapper tests

**Files:**

- Create: `src/app/(app)/device-quota/categories/draft-catalog/device-quota-draft-catalog-types.ts`
- Create: `src/app/(app)/device-quota/categories/draft-catalog/device-quota-draft-catalog-mappers.ts`
- Create: `src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-mappers.test.ts`

- [x] **Step 1: Write failing mapper tests**
  - Merge an immutable catalog snapshot with draft item values by the Phase 1/2 source item identifier.
  - Preserve five section rows, 37 item rows, source order, parent, and level.
  - Preserve 16 child items under their source-declared parents and 21 top-level items.
  - Preserve each row's source reference, source pages, source position, and every line of a multiline regulatory rule.
  - Treat empty display name as a fallback to the regulatory name without persisting the fallback.
  - Derive incomplete status from the draft contract's required editable values without treating an excluded item as an invalid active row.
  - Mark all regulatory fields read-only and all four unit fields editable only when the mode is editable.

- [x] **Step 2: Run the mapper tests**

```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-mappers.test.ts'
```

Expected: FAIL because the merged model and mapper do not exist.

- [x] **Step 3: Implement pure types and mappers**
  - Use explicit TypeScript types; do not introduce `any`.
  - Reuse `src/lib/device-quota-draft-contract.ts` for Phase 2 draft contracts and define only catalog/merged-view adapter types locally.
  - Keep source values immutable by returning a new merged view model.
  - Keep completeness and display-name fallback deterministic and independently testable.

- [x] **Step 4: Run the mapper tests again**

Expected: PASS.

### Task 4: Add read/query and mutation orchestration

**Files:**

- Create: `src/app/(app)/device-quota/categories/_queries/deviceQuotaRegulatoryCatalogQuery.ts`
- Create: `src/app/(app)/device-quota/categories/_queries/deviceQuotaDraftCatalogQuery.ts`
- Create: `src/app/(app)/device-quota/categories/_components/DeviceQuotaDraftCatalogMutations.ts`
- Create: `src/app/(app)/device-quota/categories/_hooks/useDeviceQuotaDraftCatalog.ts`
- Create: `src/app/(app)/device-quota/categories/_hooks/__tests__/useDeviceQuotaDraftCatalog.test.tsx`
- Create: `src/app/(app)/device-quota/categories/_hooks/__tests__/useDeviceQuotaDraftCatalog.validation.test.tsx`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`

- [x] **Step 1: Write failing hook tests**
  - `global`, `admin`, and `to_qltb` users with a server-verified session unit call create-or-open and then read the draft/catalog.
  - Missing session unit fails closed without a mutation.
  - There is no invented `Viewer` role in the client contract.
  - `mapping-only` and `regional_leader` roles are rejected for this Phase 3 workspace because the catalog read RPC currently does not authorize them.
  - Save sends `expected_revision`, updates local revision on success, and invalidates both draft and catalog-derived queries.
  - A stale-conflict response changes the hook to conflict state and does not overwrite newer local/server values.
  - Exclude and restore call their dedicated RPCs immediately, each with `expected_revision`, advance the revision on success, and refresh the merged view.
  - A failed exclude/restore preserves the previous local/server row state and exposes retry.
  - Session unit A remains the only unit used when selected facility B is present in the tenant UI; no caller-provided facility override reaches draft RPCs.

- [x] **Step 2: Run the hook tests**

```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/device-quota/categories/_hooks/__tests__/useDeviceQuotaDraftCatalog.test.tsx'
```

Expected: FAIL because the query and mutation orchestration does not exist.

- [x] **Step 3: Write failing quantity validation tests**
  - Negative and fractional quantities produce field-level feedback.
  - Invalid quantity prevents the save RPC from being called.
  - The last saved server value remains intact after invalid local input.

- [x] **Step 4: Run the quantity validation tests**

```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/device-quota/categories/_hooks/__tests__/useDeviceQuotaDraftCatalog.validation.test.tsx'
```

Expected: FAIL because the field-level quantity validation does not exist.

- [x] **Step 5: Implement the orchestration**
  - Fetch the catalog snapshot and draft through separate existing RPC contracts.
  - Resolve the current unit from the authenticated session; never add a facility selector or client-provided unit override.
  - Keep the draft hook on a session-authoritative unit accessor; do not reuse `useDeviceQuotaCategoryAccess` when it can resolve `selectedFacilityId`.
  - Keep query keys scoped to the current tenant/unit and catalog version.
  - Keep mutation payloads limited to Phase 2 fields and always include the expected revision.
  - Normalize stale conflict and unavailable snapshot errors into user-visible states without exposing raw database errors.
  - Add `device_quota_regulatory_catalog_get` to the RPC proxy allowlist and cover that reachability with a focused assertion.

- [x] **Step 6: Run both hook test files again**

Expected: PASS.

- [x] **Step 7: Commit the data layer**

```bash
git add 'src/app/(app)/device-quota/categories/draft-catalog' 'src/app/(app)/device-quota/categories/_queries' 'src/app/(app)/device-quota/categories/_components/DeviceQuotaDraftCatalogMutations.ts' 'src/app/(app)/device-quota/categories/_hooks'
git commit -m "feat: wire device quota draft catalog data flow"
```

## Chunk 3: Build The Desktop Draft Editor And Entry Point

### Task 5: Add the editor UI with failing interaction tests

**Files:**

- Create: `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogPageClient.tsx`
- Create: `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogEditor.tsx`
- Create: `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogSection.tsx`
- Create: `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogItemRow.tsx`
- Create: `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogRuleDisclosure.tsx`
- Create: `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogStates.tsx`
- Create: `src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogEditor.test.tsx`

- [x] **Step 1: Write failing UI integration tests**
  - `global`, `admin`, and `to_qltb` users can open the workspace from the entry action and see source metadata.
  - `regional_leader` and mapping-only roles cannot open this Phase 3 workspace.
  - The editor renders all 42 rows in immutable source order with five section headers.
  - Each row preserves source reference, source pages, source order, parent, level, and every line of a multiline regulatory rule.
  - Sidebar navigation scrolls to the selected section and section collapse preserves the hierarchy.
  - Regulatory fields render read-only and cannot be edited.
  - Display name, applied unit, proposed quantity, and notes render as editable in edit mode.
  - The quantity label explicitly says it is a proposed draft value.
  - Empty display name shows `Mặc định theo tên Thông tư` without changing the persisted value.
  - `Xem quy tắc` reveals the rule inline.
  - Exclude changes the row to excluded presentation; restore returns it to editable presentation.
  - Exclude and restore persist immediately through their dedicated RPCs using the current expected revision; ordinary field edits remain staged until Save.
  - Save permits incomplete drafts and shows incomplete status rather than blocking the save.
  - View mode renders all fields read-only and hides mutation controls.
  - Missing unit, unauthorized access, unavailable snapshot, loading, and stale conflict render clear states.
  - Negative and fractional quantities show field-level feedback and do not trigger Save.
  - No mobile-specific assertions are added.

- [x] **Step 2: Run the editor tests**

```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogEditor.test.tsx'
```

Expected: FAIL because the route and editor components do not exist.

### Task 6: Implement the desktop editor composition

**Files:**

- Modify the files from Task 5.
- Reuse: `src/components/hierarchical-editor/*`

- [x] **Step 1: Implement the page/client composition**
  - Keep the route server entry small.
  - Render compact metadata: unit, draft status, source document/version, snapshot hash or version marker, last saved timestamp, and current mode.
  - Keep toolbar outside the independently scrollable editor body.

- [x] **Step 2: Implement section and row adapters**
  - Use the shared section/sidebar/workspace primitives.
  - Render the source name and regulatory metadata with muted read-only styling.
  - Keep `Tên hiển thị tại đơn vị` as a normal-width input with the agreed fallback placeholder.
  - Use controlled local edits and defer ordinary field persistence to explicit Save.
  - Place exclude/restore action at row level; those two actions persist immediately through their dedicated CAS-protected RPCs.
  - Keep rule disclosure inline and collapsed by default.
  - Ensure section/item DOM identifiers are stable for sidebar scrolling and tests.

- [x] **Step 3: Implement all state surfaces**
  - Loading and unavailable snapshot states fail closed.
  - Missing session unit and unsupported roles do not render the workspace or mutation controls.
  - Save failure preserves unsaved edits and exposes retry.
  - Stale conflict preserves the user’s current edits, tells the user to reload, and does not silently merge over a newer revision.
  - Excluded rows remain visible for restore and do not disturb source order.

- [x] **Step 4: Run the editor tests again**

Expected: PASS.

### Task 7: Add the route and additive category entry action

**Files:**

- Create: `src/app/(app)/device-quota/categories/draft-catalog/page.tsx`
- Modify: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryToolbar.tsx`
- Modify: `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryToolbar.test.tsx`

- [x] **Step 1: Write the failing entry-point regression test**
  - Assert the toolbar exposes a clearly named draft-catalog action for `global`, `admin`, and `to_qltb`.
  - Assert the existing create, edit, delete, category import, and quota-decision import actions remain available.
  - Assert `regional_leader`, mapping-only, and other unsupported roles do not receive the draft action.
  - Keep these assertions in the focused toolbar test so no test file exceeds the 450-line ceiling.

- [x] **Step 2: Run the category page test**

```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryToolbar.test.tsx'
```

Expected: FAIL on the missing draft action.

- [x] **Step 3: Implement the additive route link**
  - Navigate to `/device-quota/categories/draft-catalog`.
  - Keep existing category toolbar actions and import flows untouched.
  - Use role normalization conventions and a session-authoritative draft access path; do not route draft unit resolution through a client-selected facility.

- [x] **Step 4: Run the category and editor tests**

Expected: PASS.

- [x] **Step 5: Commit the Phase 3 UI**

```bash
git add 'src/app/(app)/device-quota/categories'
git commit -m "feat: add device quota draft catalog editor"
```

## Chunk 4: Regression, Quality Gates, And Handoff

### Task 8: Run the focused and existing regression suite

**Files:**

- No planned source changes. Fix only failures caused by the Phase 3 implementation.

- [x] **Step 1: Run all focused tests together**

```bash
  node scripts/npm-run.js run test:run -- \
  src/components/hierarchical-editor/__tests__/HierarchicalEditorWorkspace.test.tsx \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-shared-workspace.test.tsx' \
  'src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-mappers.test.ts' \
  'src/app/(app)/device-quota/categories/_hooks/__tests__/useDeviceQuotaDraftCatalog.test.tsx' \
  'src/app/(app)/device-quota/categories/_hooks/__tests__/useDeviceQuotaDraftCatalog.validation.test.tsx' \
  'src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogEditor.test.tsx' \
  'src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryToolbar.test.tsx'
```

Expected: PASS.

- [x] **Step 2: Run the existing category and Technical Configurations suites**

```bash
node scripts/npm-run.js run test:run -- \
  'src/app/(app)/device-quota/categories/__tests__' \
  'src/app/(app)/technical-configurations/__tests__'
```

Expected: PASS, or any pre-existing unrelated failures are documented with exact test names.

### Task 9: Run repository verification in the required order

- [x] **Step 1: Format check**

```bash
node scripts/npm-run.js run format:check
```

Expected: PASS.

- [x] **Step 2: Type-safety and duplicate gates**

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
```

Expected: PASS. Invoke `code-deduplication` to verify the shared primitive extraction against unchanged repository capabilities.

- [x] **Step 3: Typecheck**

```bash
node scripts/npm-run.js run typecheck
```

Expected: PASS.

- [x] **Step 4: React Doctor**

```bash
node scripts/npm-run.js run react-doctor
```

Expected: PASS or documented findings limited to pre-existing baseline issues. Do not run a mobile/full visual requirement for this feature.

### Task 10: Review impact and finish the handoff

- [x] **Step 1: Run Code Review Graph impact analysis for all changed files**
  - Confirm the shared extraction affects only Technical Configurations baseline and the new Device Quota draft route.
  - Check that active category CRUD/import and Phase 4 surfaces are not in the changed execution paths.

- [x] **Step 2: Dispatch `post_implementation_reviewer`** _(Skipped per explicit user instruction; final diff review performed directly.)_
  - Review against the fixed base `14440884669fab0e33ce8520c20fe03a4dd04efb`.
  - Review against `openspec/changes/add-device-quota-draft-catalog/specs/device-quota-category-workspace/spec.md`.
  - Require findings first, with file/line references and explicit Phase 4 scope checks.

- [x] **Step 3: Inspect the final diff**

```bash
git diff --stat 14440884669fab0e33ce8520c20fe03a4dd04efb
git status --short
```

Expected: only the planned shared primitives, Technical Configurations adapter changes, Phase 3 Device Quota files, tests, and plan/doc updates are present.

- [x] **Step 4: Create issues for any deferred work**
  - Examples: mobile enablement, publish/approval flow, compliance integration, mapping integration, or broader workspace reuse that is not required for Phase 3.

- [x] **Step 5: Commit and push only after explicit implementation approval and all gates pass**
  - Do not apply migrations or write to live Supabase.
  - Follow the repository landing workflow: pull with rebase, push, verify status is up to date, and report exact verification results.

## Review Checkpoints

- After Chunk 1: review whether extraction is presentation-only and whether Technical Configurations behavior is unchanged.
- After Chunk 2: review RPC payloads, session-unit enforcement, revision handling, and source/draft merge keys.
- After Chunk 3: review the UI against the approved Technical Configurations pattern and confirm the existing categories/import workflow is additive.
- Before completion: run `post_implementation_reviewer`, Code Review Graph impact analysis, and the required verification sequence.

## Explicit Non-Goals

- No mobile responsive design or mobile tests.
- No changes to Phase 0, Phase 1, or Phase 2 SQL artifacts.
- No active quota decision replacement, publish, approval, activation, compliance, mapping, reporting, or export.
- No facility picker or multi-facility editor.
- No new regulatory catalog administration UI.
- No broad rewrite of Technical Configurations beyond the smallest extraction needed for shared presentation primitives.
