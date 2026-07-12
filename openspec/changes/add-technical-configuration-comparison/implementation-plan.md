# Technical Configuration Comparison MVP Implementation Roadmap

> **Status:** Approved feature design; implementation has not started.
>
> **Source of truth:** [proposal.md](./proposal.md), [design.md](./design.md), [contract pack](./contracts.md), [test matrix](./test-matrix.md), [spec delta](./specs/technical-configuration-comparison/spec.md), and the concise [tasks.md](./tasks.md).

## Purpose

This roadmap decomposes the MVP into narrow, dependency-aware delivery phases. It is intentionally more detailed than `tasks.md`, but it is not a substitute for the phase-specific TDD implementation plan created immediately before each phase starts.

The decomposition optimizes for:

- one focused context per phase
- one issue, branch and PR per phase
- additive, reviewable database changes
- explicit test and rollout gates
- no hidden AI implementation in MVP
- no cross-phase scope expansion

## Delivery Contract

### Unit of work

Each leaf phase SHALL use:

1. One GitHub issue with the phase goal, linked requirements and acceptance gate.
2. One branch named `feat/technical-config-p<leaf>-<scope>` or `docs/technical-config-p<leaf>-<scope>` for documentation-only work.
3. One PR whose diff contains only that phase and any explicitly approved prerequisite fix.
4. One main implementation session. Follow-up review fixes may continue in the same branch.
5. One durable handoff note containing commit/PR/issue IDs, schema decisions and remaining risks.

Parent labels such as `P3`, `P7`, `P8`, `P9`, `P10`, `P12` and `P13` group related work only. Their leaf phases (`P3A`, `P3B`...) are the actual delivery units.

Do not combine adjacent leaf phases merely because the implementation appears small. A leaf phase may be split further when discovery shows:

- more than one migration ownership boundary
- more than one independently deployable workflow
- more than roughly 10-12 production files
- a source file would approach the 350-line extraction threshold
- verification requires unrelated test suites
- the current context must load multiple unrelated modules

### Entry gate

Before a leaf phase starts:

- all declared dependencies are merged into and verified on `main`
- `main` is clean and synchronized with `origin/main`
- AgentMemory is queried with the phase ID and relevant symbols
- Code Review Graph narrows the current code area
- GitNexus impact analysis is run for narrowed existing symbols before non-trivial edits
- live Supabase is inspected read-only when schema/RPC truth matters
- the required skills are invoked:
  - all implementation: `@karpathy-coding-heuristics`, `@superpowers:test-driven-development`
  - Next.js changes: `@next-best-practices`
  - React changes: `@vercel-react-best-practices`
  - SQL changes: `@supabase-postgres-best-practices`
  - shared helpers/components: `@code-deduplication`
- a phase-specific plan lists exact files, failing tests, commands and expected output

### Exit gate

A leaf phase is complete only when:

- every phase acceptance scenario passes
- OpenSpec requirements covered by the phase remain valid
- required quality gates pass in repository order
- reviewer findings are resolved or explicitly rejected with rationale
- migration files are committed; live migration is applied only after explicit permission
- the PR is merged, the issue is updated/closed and local `main` is synchronized
- `tasks.md` is updated only after the landed state is verified

### Context budget rule

At leaf-phase start, load only:

- the current phase section in this file
- linked requirement blocks from the spec delta
- the relevant decision section in `design.md`
- files/symbols identified by graph tooling
- the previous phase handoff if it is a direct dependency

Do not reload the full feature history or all 24 leaf phases unless a cross-phase contract conflict is discovered.

## Dependency Graph

```text
P0              -> P1, P6
P1              -> P2, P3A
P2 + P3A        -> P3B
P3B             -> P3C, P4
P3B + P4        -> P5
P3A + P4        -> P7A
P4 + P6 + P7A   -> P7B
P4              -> P8A
P3A + P8A       -> P8B
P5 + P8B        -> P9A
P6 + P7B + P8B  -> P9B
P7B + P9B       -> P10A
P3A + P10A      -> P10B
P4 + P8A        -> P11
P10B + P11      -> P12A
P12A            -> P12B
P12B            -> P12C
P12C            -> P13A, P13B
P13A + P13B + P7A + P9A -> P13C
```

`P6` is technically independent after `P0`, but the default delivery order places it after `P5` and requires it to land before the first document UI in `P7B`. It does not block dossier, baseline, reference-product or supplier work that has no document UI.

## Requirement Traceability

Requirement IDs are roadmap aliases. The authoritative requirement names and scenarios remain in the OpenSpec delta.

| ID    | Requirement                                     | Primary phases                                                         |
| ----- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| TC-01 | Independent technical configuration dossier     | P0, P1                                                                 |
| TC-02 | Global administrator access boundary            | Every DB phase, P3A, P13A                                              |
| TC-03 | Flexible two-level baseline authoring           | P0, P2, P3B, P3C                                                       |
| TC-04 | Explicit save for editable workflows            | P3A, P3B, P3C, P7A, P7B, P8B, P9B, P12A                                |
| TC-05 | Standard baseline Excel template                | P0, P5                                                                 |
| TC-06 | Immutable locked baseline versions              | P4, P7A, P7B                                                           |
| TC-07 | Historical baseline linkage                     | P4, P8A                                                                |
| TC-08 | Optional reference products                     | P0, P7A                                                                |
| TC-09 | Multiple supplier configuration options         | P8A, P8B                                                               |
| TC-10 | Standard supplier option Excel template         | P9A                                                                    |
| TC-11 | URL-only document profiles                      | P6, P7B, P9B                                                           |
| TC-12 | Criterion-level document citations              | P7B, P9B                                                               |
| TC-13 | Scan-friendly comparison matrix                 | P10A, P10B                                                             |
| TC-14 | Per-option manual evaluation workflow           | P12A, P12B                                                             |
| TC-15 | Separate manual evaluation axes                 | P11, P12A                                                              |
| TC-16 | Transparent derived overall status              | P11, P12A, P12B                                                        |
| TC-17 | Non-scoring supplementary information           | P8A, P8B, P10A, P10B, P12A                                             |
| TC-18 | Optional transparent reference ranking          | P12C                                                                   |
| TC-19 | AI-ready data boundaries without MVP AI runtime | P0, P1, P11, P13C                                                      |
| TC-20 | Optimistic conflict protection                  | P0, P1, P2, P3B, P4, P5, P7A, P7B, P8A, P8B, P9A, P9B, P11, P12A, P13B |

## Shared Technical Constraints

### Database

- All DB operations use Supabase MCP project `cdthersvldpnlbvpufrr`.
- Live DB reads are allowed; writes require explicit permission for the specific operation.
- Migration filenames must be chosen at phase execution time after comparing all local migrations touching the same objects.
- New public tables start deny-by-default with explicit grants and intentional RLS/RPC access.
- Authenticated RPCs validate JWT claims, normalize `admin/global` semantics and set `search_path` for `SECURITY DEFINER`.
- List RPCs use bounded pagination and select only required columns.
- Multi-table writes are transactional.
- Filter/sort/join indexes are reviewed with representative query plans before addition.
- The dossier is the aggregate/lineage root; no separate lineage table is introduced.
- Every child mutation calls the common editable-dossier guard so archived dossiers remain readable but immutable.
- Editable aggregates use `revision BIGINT`; every mutation requires `expectedRevision`.

### Mandatory DB phase gate

Every leaf phase that creates or changes tables, RPCs, policies, grants, triggers or query contracts must complete this gate inside that phase:

1. Write failing authorization tests for `global`, raw `admin`, missing claims and at least one denied role.
2. Verify explicit grants/RLS, JWT guards, `SECURITY DEFINER search_path`, ownership and cascade behavior.
3. Review selected columns, pagination, transactions, indexes and N+1 risk for changed queries.
4. Compare migration filename order against all local migrations touching the same objects.
5. Stop and request explicit permission immediately before any live Supabase write.
6. After an approved apply, rerun focused SQL verification and `get_advisors(security)`; also run `get_advisors(performance)` when query/index behavior changed.

### Frontend

- Planned route root: `src/app/(app)/technical-configurations/`.
- Components use grep-friendly `TechnicalConfiguration...` prefixes.
- Shared types/helpers live outside page components when reused.
- No source file may exceed 450 lines; extraction starts near 350 lines.
- No autosave. Mutations originate only from explicit save actions.
- P3A owns a module-local typed RPC adapter that preserves HTTP status and PostgREST `code`, `message`, `details`, `hint`; the shared `callRpc()` contract is not changed globally.
- Long Vietnamese technical text must wrap without resizing stable controls or overlapping adjacent content.
- Baseline/reference/option comparison surfaces keep groups and criteria on rows; only compared entities become dynamic columns.
- The UI must not expose a schema builder or arbitrary content-column controls.
- The Stitch project is design guidance, not generated production code:
  - project `15308531586654760571`
  - design system `assets/5915840001267045529`
  - builder `6a623d7a26be4cfcad4faf9f31a1daf7`
  - bulk entry `c6c13d5795e4431a84504e87f46f33c7`
  - dossier list `52a2a8c662904f62b43285a4294d2b8c`

### Verification order

For phases changing TypeScript/React:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- <focused-test-paths>
node scripts/npm-run.js run react-doctor
```

Use `ctx_batch_execute` for the chain. Add focused browser verification for user-facing phases. `react-doctor` is required only when React files change.

## Phase P0 - Discovery And Contract Freeze

**Depends on:** none  
**Requirements:** TC-01, TC-02, TC-03, TC-05, TC-08, TC-19, TC-20

**Issue scope:** documentation and read-only discovery only  
**Production code:** prohibited

### Outcome

A reviewed contract pack removes schema, authorization and API ambiguity before migrations or UI work begin.

### Outputs

- `contracts.md`: feature baseline, entity/RPC ownership, state, error, Excel and performance contracts.
- `test-matrix.md`: scenario-to-leaf/layer ownership and P0 exit checks.
- Updated `design.md`, `implementation-plan.md` and spec scenarios reflecting approved decisions.

### Inspect

- `openspec/changes/add-technical-configuration-comparison/`
- `src/app/api/rpc/[fn]/route.ts`
- `src/app/api/rpc/[fn]/allowed-functions.ts`
- `src/lib/rbac.ts`
- `src/types/database.ts`
- `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailFilesTab.tsx`
- `src/app/(app)/equipment/_components/EquipmentDetailDialog/hooks/useEquipmentAttachments.ts`
- `src/lib/device-quota-excel.ts`
- live DB functions, policies, grants and current migration order

### Tasks

- [ ] Query live DB read-only for naming collisions, existing generic document models and role/grant patterns.
- [ ] Define conceptual tables, keys, ownership and cascade behavior for all MVP entities.
- [ ] Define RPC names and request/response/error contracts for all planned leaf phases.
- [ ] Define the single-lineage invariant and baseline state machine.
- [ ] Define criterion code generation and uniqueness scope.
- [ ] Define archive read/mutation behavior and one-editable-draft enforcement.
- [ ] Define complete locked-baseline copy ownership and extension points.
- [ ] Define dossier-scoped supplier normalization/uniqueness.
- [ ] Define the four suggested groups as editable seed records, not enums, and freeze the decision to exclude arbitrary content columns.
- [ ] Define optimistic concurrency token behavior and conflict response.
- [ ] Define document ownership without coupling to `thiet_bi`.
- [ ] Define standard Excel metadata/version rules.
- [ ] Define pagination and matrix query performance budgets.
- [ ] Confirm no AI runtime tables, columns, jobs, API calls or UI affordances.
- [ ] Produce a phase test matrix mapping each spec scenario to unit, integration, SQL or browser verification.
- [ ] Record the `main` feature-baseline SHA that precedes P1 for final rollout audit.

### Verification

- `openspec validate add-technical-configuration-comparison --strict`
- Self-review of architecture/spec contracts; no subagent review.
- No production file or migration diff.

### Exit gate

P1 may start only after table/RPC contracts, migration split and authorization matrix are explicitly approved.

## Phase P1 - Dossier Foundation And Authorization

**Depends on:** P0  
**Requirements:** TC-01, TC-02, TC-19, TC-20  
**Deploy boundary:** additive backend foundation; no user-visible entry point

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_dossier_foundation.sql`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Create: `src/app/(app)/technical-configurations/types.ts`
- Create: `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`
- Modify after generation only when required: `src/types/database.ts`

### Tasks

- [ ] Write failing whitelist/authorization contract tests.
- [ ] Create the dossier as the single configuration-lineage root with audit metadata; do not add a lineage table.
- [ ] Add minimal list/get/create/update/archive RPCs with bounded pagination.
- [ ] Hide archived dossiers by default, keep get/read available, provide no restore RPC and reject every descendant mutation through the common archive guard.
- [ ] Enforce `admin/global` in RPC/database policy and deny every other role.
- [ ] Add revision guards to update/archive so foundation mutations cannot overwrite stale data.
- [ ] Ensure raw session `admin` receives global semantics outside RPC proxy through `isGlobalRole()`.
- [ ] Add stable IDs that remain suitable for future AI payload references without adding AI columns.
- [ ] Verify no FK or read dependency on `thiet_bi`.
- [ ] Add only indexes justified by list/get/update paths.
- [ ] Complete the mandatory DB phase gate, including phase-local role/claim tests, explicit live-write approval and post-apply advisors.

### TDD and verification

- Failing tests first for RPC allowlist and role behavior.
- SQL verification for `global`, raw `admin`, missing claims and unauthorized roles.
- Stale-revision rejection tests for update/archive.
- Fresh-DB migration replay review.
- Security advisor and focused post-apply verification after an explicitly approved live apply.

### Exit gate

Backend can securely create/list/get one-device dossiers, but no baseline editor or navigation entry exists.

## Phase P2 - Baseline Draft Data Contracts

**Depends on:** P1  
**Requirements:** TC-02, TC-03, TC-20  
**Deploy boundary:** additive draft authoring API; still no complete UI

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_baseline_drafts.sql`
- Create: `src/app/(app)/technical-configurations/baseline-types.ts`
- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/baseline-contract.test.ts`

### Tasks

- [ ] Add baseline version draft, group and criterion tables with a partial unique rule allowing at most one draft per dossier.
- [ ] Enforce exactly two hierarchy levels.
- [ ] Seed `Yêu cầu chung`, `Yêu cầu cấu hình cung cấp`, `Yêu cầu kỹ thuật` and `Yêu cầu khác` for a blank draft as normal editable group records.
- [ ] Add stable criterion IDs, system-generated `TC-0001` display codes, optional titles, multiline requirement text and sort order through fixed structural fields.
- [ ] Keep criterion codes read-only, stable under reorder/copy and non-reusing through a per-version next-number counter.
- [ ] Do not add field-definition tables, JSON custom-column payloads or validation that locks group names.
- [ ] Add transactional create/update/delete/reorder RPCs for draft content.
- [ ] Add bulk-add preview contract without persistence.
- [ ] Add revision/`updated_at` guards to every editable aggregate mutation.
- [ ] Return structured validation errors for duplicate code, invalid order and stale revision.
- [ ] Keep product references, documents, suppliers, evaluations and locking out of this phase.
- [ ] Complete the mandatory DB phase gate for draft tables/RPCs, including phase-local role/claim tests, explicit live-write approval and post-apply advisors.

### TDD and verification

- Unit/contract tests for suggested-group creation, group rename/add/delete/reorder, ordering and multiline Unicode.
- SQL tests for duplicate criterion codes and stale revision rejection.
- Transaction rollback proof for a failed multi-row reorder.
- Query review for list/get paths and required indexes.

### Exit gate

Draft baseline aggregates are safely editable through stable contracts; no user-visible editor is required yet.

## Phase P3A - Route, Workspace Shell And Dossier List

**Depends on:** P1  
**Requirements:** TC-02, TC-04  
**Deploy boundary:** first user-visible shell behind `admin/global`; no baseline editor

### Planned files

- Create: `src/app/(app)/technical-configurations/page.tsx`
- Create: `src/app/(app)/technical-configurations/TechnicalConfigurationsClient.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierTable.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierForm.tsx`
- Create: `src/app/(app)/technical-configurations/technical-configuration-rpc.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-shell.test.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/technical-configuration-rpc.test.ts`
- Modify: `src/components/app-navigation.tsx`
- Modify: `src/components/app-sidebar-nav.tsx`
- Modify: `src/components/__tests__/app-navigation.test.ts`
- Modify: `src/components/__tests__/app-sidebar-nav.test.tsx`

### Tasks

- [ ] Add hidden-by-default navigation visible only to `isGlobalRole()`.
- [ ] Add dossier list/create/open workflow with explicit save.
- [ ] Add a workspace/tab shell for `Cấu hình cơ sở`, `Phương án` and `So sánh & đánh giá`.
- [ ] Keep unavailable work areas disabled or empty until their leaf phases land.
- [ ] Keep `TechnicalConfigurationsClient.tsx` and the shell as orchestration only.
- [ ] Add loading, empty, unauthorized and create-error states.
- [ ] Add a module-local typed RPC adapter that preserves HTTP status and PostgREST error metadata without modifying shared `callRpc()`.
- [ ] Apply Stitch list/workspace direction without AI or bidding semantics.
- [ ] Track shell line count in every later integration phase and extract tab-specific composition before 350 lines.

### TDD and verification

- Visibility tests for `global`, raw `admin` and denied roles.
- Typed RPC adapter tests for status/code/message/details/hint preservation.
- Dossier list/create/open tests.
- Workspace-tab shell tests.
- Browser verification at desktop and narrow viewport.
- React Doctor after focused tests pass.

### Exit gate

Admin/global can create and open a dossier shell. No baseline editor, supplier workflow or comparison workflow is implemented.

## Phase P3B - Manual Baseline Editor And Save Conflicts

**Depends on:** P2, P3A  
**Requirements:** TC-03, TC-04, TC-20  
**Deploy boundary:** manual draft editing; bulk entry remains deferred

### Planned files

- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineGroupList.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationCriterionEditor.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/TechnicalConfigurationBaselineEditor.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`

### Tasks

- [ ] Add a vertical group/criterion editor with stable dimensions and long-text handling.
- [ ] Render the four suggested groups as normal editable data and support additional groups without a business-count limit.
- [ ] Add group/criterion create, edit, delete and reorder controls.
- [ ] Do not add schema-builder or custom content-column controls.
- [ ] Add explicit `Lưu`; do not autosave.
- [ ] Preserve unsaved data on validation, persistence and conflict errors.
- [ ] Warn before leaving the baseline tab or dossier with unsaved changes.
- [ ] Integrate the baseline tab without moving data logic into the workspace shell.
- [ ] Add loading, empty, locked-placeholder and conflict states.

### TDD and verification

- Failing editor tests before components.
- Focused tests for save, failed save, reorder, dirty navigation and conflict preservation.
- Browser verification with long Vietnamese multiline requirements, edited suggested groups and additional groups.
- React Doctor after focused tests pass.

### Exit gate

Admin/global can manually build and save a two-level draft baseline. Bulk entry, lock and Excel remain unavailable.

## Phase P3C - Bulk Text Entry

**Depends on:** P3B  
**Requirements:** TC-03, TC-04  
**Deploy boundary:** optional productivity workflow inside baseline editor

### Planned files

- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBulkEntryDialog.tsx`
- Create: `src/app/(app)/technical-configurations/bulk-entry-utils.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor.tsx`

### Tasks

- [ ] Parse pasted text into candidate criteria for the selected group.
- [ ] Show preview and row-level validation before applying to local editor state.
- [ ] Do not call persistence while preview has errors.
- [ ] Preserve explicit-save semantics after accepted bulk entry.
- [ ] Support cancel without changing the draft.
- [ ] Keep parser independent from dialog UI.

### TDD and verification

- Unit tests for multiline parsing, blank lines and Unicode.
- Dialog tests for preview, cancel, invalid rows and accepted local changes.
- Editor regression proving no autosave occurs.

### Exit gate

Manual baseline authoring supports optional bulk text entry without changing persistence or lock behavior.

## Phase P4 - Baseline Versioning, Lock And History

**Depends on:** P2, P3B  
**Requirements:** TC-02, TC-06, TC-07, TC-20  
**Deploy boundary:** complete baseline lifecycle

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_baseline_locking.sql`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationVersionBar.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationLockDialog.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/baseline-locking.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline.ts`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`

### Tasks

- [ ] Add draft/locked state machine and sequential version numbering.
- [ ] Add lock prerequisites from the spec.
- [ ] Add database/backend rejection for every locked baseline-owned mutation.
- [ ] Record `locked_at` and `locked_by`.
- [ ] Add explicit lock confirmation and visibly render lock actor/time in the locked workspace.
- [ ] Require the expected draft revision for lock and copy operations; preserve user state on conflict.
- [ ] Add create-new-draft from blank or locked version copy.
- [ ] Copy new IDs, preserve criterion codes and `source_criterion_id`, and copy every baseline-owned entity available when this phase lands.
- [ ] Define the copy RPC as an extension contract so P7A/P7B add reference products, responses, documents and citations in their own migrations.
- [ ] Add version selector/history without unlocking old versions.
- [ ] Ensure supplier/evaluation contracts later can bind to an exact baseline version.
- [ ] Remove edit affordances in locked views while retaining backend enforcement.
- [ ] Complete the mandatory DB phase gate for versioning/locking objects and RPCs, including phase-local role/claim tests, explicit live-write approval and post-apply advisors.

### TDD and verification

- Write direct mutation tests proving admin/global cannot edit locked content.
- Run phase-local authorization tests for `global`, raw `admin`, missing claims and denied roles.
- Test copy fidelity and independent new draft IDs.
- Test rejected lock for empty/duplicate/error state.
- Test stale-revision rejection for lock and copy.
- Test historical read after a newer version is locked.

### Exit gate

Baseline versions can be locked irreversibly and revised only through a new draft.

## Phase P5 - Baseline Excel Template And Import

**Depends on:** P3B, P4  
**Requirements:** TC-05, TC-20  
**Deploy boundary:** optional productivity workflow; manual authoring remains complete

### Planned files

- Create: `src/lib/technical-configuration-baseline-excel.ts`
- Create: `src/lib/__tests__/technical-configuration-baseline-excel.test.ts`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineImportDialog.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/baseline-import-dialog.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor.tsx`

### Tasks

- [ ] Define template metadata, schema version and sheet contract from P0.
- [ ] Generate one visible row-oriented sheet with `GROUP`/`CRITERION` rows, fixed columns, wrapped multiline cells and four suggested group rows.
- [ ] Add one hidden `_meta` sheet with template kind/version, target IDs, revision and generation metadata.
- [ ] Parse only system templates and preserve Vietnamese Unicode.
- [ ] Allow group rows to be added, renamed, removed and reordered without adding columns.
- [ ] Treat existing criterion codes as read-only, require blank codes for new rows and generate them during preview/apply.
- [ ] Validate metadata, fixed columns, group/criterion ordering, changed/duplicate codes and required text.
- [ ] Present row-level preview and actionable errors before mutation.
- [ ] Import atomically into an editable draft only.
- [ ] Require the expected target-draft revision and preserve preview/input on conflict.
- [ ] Reject locked target versions and arbitrary spreadsheets.
- [ ] Keep document URLs and citations outside the template.

### TDD and verification

- Red/green round-trip tests with representative CSV-derived content.
- Malformed workbook, wrong version, unexpected content-column, custom group, duplicate ID and multiline tests.
- Stale target-revision and preview-preservation tests.
- UI tests proving no persistence before preview confirmation.
- Semantic dedup check against existing Excel helpers.

### Exit gate

Users can create the same draft baseline manually or through one versioned system template.

## Phase P6 - Shared URL Document Primitives

**Depends on:** P0; scheduled after P5 and before P7B
**Requirements:** TC-11  
**Deploy boundary:** refactor with no new technical-configuration persistence

### Planned files

- Create: `src/components/url-attachments/UrlAttachmentForm.tsx`
- Create: `src/components/url-attachments/UrlAttachmentList.tsx`
- Create: `src/components/url-attachments/url-attachment-utils.ts`
- Create: `src/components/url-attachments/__tests__/UrlAttachmentForm.test.tsx`
- Modify: `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailFilesTab.tsx`
- Test/modify as needed: existing Equipment detail attachment tests

### Tasks

- [ ] Lock current Equipment attachment behavior with focused regression tests.
- [ ] Extract URL parsing, form state and safe external-link presentation.
- [ ] Keep shared components persistence-agnostic through callbacks/props.
- [ ] Keep Equipment hook and `file_dinh_kem` adapter Equipment-specific.
- [ ] Replace duplicated Equipment presentation with shared primitives.
- [ ] Preserve loading, empty, add, delete and retry behavior.
- [ ] Avoid nested cards when composing the new shared surface.

### TDD and verification

- Existing Equipment tests must fail if behavior changes.
- New shared primitive tests cover valid/invalid URL and safe link attributes.
- `@code-deduplication` review before commit and push.
- Browser check of Equipment files tab.

### Exit gate

Equipment uses tested shared URL primitives with no behavior or storage change. The new module has not yet created document records.

## Phase P7A - Reference Products

**Depends on:** P3A, P4  
**Requirements:** TC-02, TC-04, TC-06, TC-08, TC-20  
**Deploy boundary:** optional reference-product criterion comparison; documents remain deferred

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_reference_products.sql`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceProducts.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceComparison.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/reference-products.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`

### Tasks

- [ ] Add zero-to-many reference products scoped to an exact baseline version.
- [ ] Add model, manufacturer, description and notes without creating supplier records.
- [ ] Add one multiline comparison response per `reference product + baseline criterion`.
- [ ] Render groups/criteria as rows, the baseline requirement as a sticky column and selected reference products as dynamic columns.
- [ ] Add column selection, horizontal scrolling and a full-text detail panel for large reference sets.
- [ ] Do not add custom content columns or permanent evidence columns.
- [ ] Add explicit save and dirty-state handling for draft CRUD.
- [ ] Require the expected baseline revision and preserve unsaved product/criterion-response edits on conflict.
- [ ] Reject every mutation after baseline lock.
- [ ] Extend locked-baseline copy to clone reference products/responses with new IDs and remapped criterion links.
- [ ] Exclude reference products from option counts, assessments and ranking contracts.
- [ ] Add the reference-products surface to the baseline workspace.
- [ ] Complete the mandatory DB phase gate, including phase-local role/claim tests, explicit live-write approval and post-apply advisors.

### TDD and verification

- Authorization tests for all required role/claim states.
- SQL tests for baseline ownership, criterion-response ownership/cascade and locked immutability.
- Stale-revision tests for create/update/delete.
- React tests for optional/multiple products, long criterion text, many dynamic columns, dirty state, conflict preservation and locked read-only rendering.

### Exit gate

Reference products can be compared criterion-by-criterion while authoring the baseline, but cannot enter supplier assessment or ranking.

## Phase P7B - Baseline Documents And Citations

**Depends on:** P4, P6, P7A
**Requirements:** TC-02, TC-04, TC-06, TC-11, TC-12, TC-20  
**Deploy boundary:** baseline/reference-product URL evidence and criterion citations

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_baseline_documents.sql`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineDocuments.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationCitationEditor.tsx`
- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDocuments.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/baseline-evidence.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceComparison.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`

### Tasks

- [ ] Add document URL metadata owned by the baseline or one reference product.
- [ ] Add criterion citation with document ID, page/section and excerpt while preserving owner scope.
- [ ] Reuse one document across multiple criteria without URL duplication.
- [ ] Use P6 primitives for URL list/form behavior.
- [ ] Show reference evidence through indicators and the detail panel without adding permanent evidence columns.
- [ ] Add explicit save and dirty-state handling for document/citation edits.
- [ ] Require the expected baseline revision and preserve unsaved edits on conflict.
- [ ] Extend lock enforcement to baseline/reference-product document metadata and citations.
- [ ] Extend locked-baseline copy to clone baseline/reference documents and citations with new IDs and remapped owner/criterion links.
- [ ] For editable data, show affected-link count before confirmed document deletion.
- [ ] For locked data, reject edit/delete before any confirmation flow.
- [ ] Complete the mandatory DB phase gate, including phase-local role/claim tests, explicit live-write approval and post-apply advisors.

### TDD and verification

- Authorization tests for all required role/claim states.
- SQL tests for baseline/reference-product owner scope, reuse, affected-link count, stale revision and locked immutability.
- React tests for URL validation, dirty state, conflict preservation, deletion confirmation, citation editing and locked read-only state.
- Browser check with long Vietnamese excerpts.

### Exit gate

A locked baseline preserves its own and each reference product's criterion-level URL evidence as immutable context.

## Phase P8A - Supplier And Option Data Contracts

**Depends on:** P4  
**Requirements:** TC-02, TC-07, TC-09, TC-17, TC-20  
**Deploy boundary:** backend contracts only; no supplier workspace

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_supplier_options.sql`
- Create: `src/app/(app)/technical-configurations/supplier-option-types.ts`
- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptions.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts`

### Tasks

- [ ] Add dossier-scoped supplier and option entities with multiple options per supplier.
- [ ] Normalize supplier names by trim, whitespace collapse and lowercase; enforce normalized uniqueness per dossier.
- [ ] Add option response dataset bound to exact baseline version and criterion.
- [ ] Add model/manufacturer/option name and display-label contract.
- [ ] Add separate supplementary information field.
- [ ] Add optimistic concurrency for option metadata and responses.
- [ ] Keep options directly editable with no lock/version lifecycle.
- [ ] Reject supplier, option and response mutations when the owning dossier is archived.
- [ ] Keep old baseline response datasets separate when a new baseline is selected.
- [ ] Complete the mandatory DB phase gate, including phase-local role/claim tests, explicit live-write approval and post-apply advisors.

### TDD and verification

- Authorization tests for all required role/claim states.
- Tests for multiple options under one supplier.
- Tests for correct baseline-version/criterion binding and ownership/cascade.
- Tests proving supplementary information is structurally separate from assessment data.
- Tests proving no supplier lock/version backend contract exists.

### Exit gate

Secure supplier/option contracts exist, but no user-facing supplier workspace is available.

## Phase P8B - Supplier Option Manual Workspace

**Depends on:** P3A, P8A  
**Requirements:** TC-04, TC-09, TC-17, TC-20  
**Deploy boundary:** manual supplier-option entry without Excel or evidence

### Planned files

- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionEditor.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionResponses.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/supplier-options.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`

### Tasks

- [ ] Add a lightly grouped supplier/option workspace.
- [ ] Use the label `Supplier · Model/option` in every selector and heading.
- [ ] Add manual response and supplementary-information editing with explicit save.
- [ ] Display the latest update time for editable option data.
- [ ] Preserve unsaved input on validation, persistence and conflict errors.
- [ ] Warn before leaving the option/tab/dossier while dirty.
- [ ] Expose no supplier lock/version controls.
- [ ] Keep option data hooks outside the workspace shell.

### TDD and verification

- Manual-entry and multiple-option UI tests.
- Dirty navigation, failed save and conflict preservation tests.
- Tests proving supplementary information does not change compliance.
- Tests proving no lock/version controls render.

### Exit gate

Users can manually enter and update multiple supplier options for an exact baseline version.

## Phase P9A - Supplier Option Excel

**Depends on:** P5, P8B  
**Requirements:** TC-10, TC-20  
**Deploy boundary:** option template/import only; evidence remains deferred

### Planned files

- Create: `src/lib/technical-configuration-option-excel.ts`
- Create: `src/lib/__tests__/technical-configuration-option-excel.test.ts`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionImportDialog.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/option-import.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionEditor.tsx`

### Tasks

- [ ] Generate option template from the selected baseline version.
- [ ] Preserve criterion IDs/codes and read-only requirement context.
- [ ] Import response and supplementary information only after preview.
- [ ] Require the expected option-response revision and preserve preview/input on conflict.
- [ ] Reject arbitrary, metadata-less, wrong-version and malformed workbooks.
- [ ] Reject unknown/duplicate criteria and partial writes.
- [ ] Keep URL documents and citations outside the workbook.

### TDD and verification

- Round-trip tests for multiple options and Vietnamese text.
- Wrong baseline version, unknown criterion and duplicate criterion tests.
- Stale option-revision and preview-preservation tests.
- Atomic import failure tests.
- Semantic dedup review against baseline and existing Excel helpers.

### Exit gate

Supplier options can be entered manually or through the exact system template.

## Phase P9B - Supplier Option Documents And Citations

**Depends on:** P6, P7B, P8B  
**Requirements:** TC-02, TC-04, TC-11, TC-12, TC-20  
**Deploy boundary:** option URL evidence only

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_option_evidence.sql`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionDocuments.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/option-evidence.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationCitationEditor.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionEditor.tsx`

### Tasks

- [ ] Add option-level document URL metadata.
- [ ] Add criterion citations with page/section/excerpt.
- [ ] Reuse P6 URL primitives and P7B citation behavior.
- [ ] Reuse one option document across multiple criteria.
- [ ] Add explicit save and dirty-state handling for option document/citation edits.
- [ ] Require the expected option revision and preserve unsaved edits on conflict.
- [ ] Show affected-link count before confirmed deletion of an editable linked document.
- [ ] Complete the mandatory DB phase gate, including phase-local role/claim tests, explicit live-write approval and post-apply advisors.

### TDD and verification

- Authorization tests for all required role/claim states.
- Ownership, cascade, reuse, stale-revision and affected-link-count SQL tests.
- URL validation, dirty state, conflict preservation, citation and deletion-confirmation UI tests.

### Exit gate

Supplier options have criterion-level URL evidence without changing Excel or assessment behavior.

## Phase P10A - Comparison Read Contract

**Depends on:** P7B, P9B  
**Requirements:** TC-02, TC-13, TC-17  
**Deploy boundary:** bounded read API only; no matrix UI

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_comparison_reads.sql` if a dedicated RPC is required
- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationComparison.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/comparison-contract.test.ts`

### Tasks

- [ ] Define one bounded query for baseline rows and selected option responses.
- [ ] Select only fields needed by matrix and detail panel.
- [ ] Avoid N+1 for supplier labels, responses, supplementary information and citations.
- [ ] Allow unlimited total options while enforcing at most 8 selected option IDs and 100 criteria per request.
- [ ] Add criterion pagination for baseline versions larger than 100 criteria.
- [ ] Review indexes and representative query plans.
- [ ] Keep supplementary information structurally separate from compliance.
- [ ] Complete the mandatory DB phase gate, including phase-local role/claim tests, explicit live-write approval and post-apply security/performance advisors.

### TDD and verification

- Authorization tests for all required role/claim states.
- Response-shape, option-nine boundary, 100-criterion bound and query-count tests.
- Representative `EXPLAIN` review with 500 criteria, 50 total options and 8 selected options.
- Performance advisor after an explicitly approved live apply.

### Exit gate

The backend can return bounded comparison data without exposing a new matrix UI.

## Phase P10B - Comparison Matrix UI

**Depends on:** P3A, P10A  
**Requirements:** TC-13, TC-17  
**Deploy boundary:** read/inspect comparison only; evaluation editing remains deferred

### Planned files

- Create: `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationMatrix.tsx`
- Create: `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationMatrixToolbar.tsx`
- Create: `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationCriterionPanel.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/comparison-matrix.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`

### Tasks

- [ ] Render groups/criteria as ordered rows and add a sticky baseline column.
- [ ] Add stable option columns labeled `Supplier · Model/option`.
- [ ] Add horizontal scrolling without layout shifts.
- [ ] Add column selector, pinning and focus mode.
- [ ] Add concise cell rendering and detail panel for full content/evidence without arbitrary content or permanent evidence columns.
- [ ] Show supplementary information without treating it as compliance.
- [ ] Preserve usable behavior with many options through bounded selection/loading.
- [ ] Keep matrix state/data hooks outside the workspace shell.

### TDD and verification

- Matrix rendering tests for long text, empty responses and many columns.
- Keyboard/focus tests for toolbar and detail panel.
- Desktop/mobile screenshots and browser interaction checks.
- React Doctor after focused tests pass.

### Exit gate

Users can scan and inspect baseline versus selected options, but cannot yet save manual assessments.

## Phase P11 - Manual Evaluation Domain And Persistence

**Depends on:** P4, P8A  
**Requirements:** TC-02, TC-15, TC-16, TC-19, TC-20  
**Deploy boundary:** backend/domain capability with minimal or test-only UI exposure

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_manual_assessments.sql`
- Create: `src/lib/technical-configuration-evaluation.ts`
- Create: `src/lib/__tests__/technical-configuration-evaluation.test.ts`
- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationAssessments.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/assessment-contract.test.ts`

### Tasks

- [ ] Define canonical technical-axis and evidence-axis enums.
- [ ] Implement one pure derived-status function shared by frontend/backend contract tests.
- [ ] Cover every mapping row and missing-axis case.
- [ ] Add assessment persistence keyed by baseline version, option and criterion.
- [ ] Add notes, evaluator metadata and optimistic concurrency.
- [ ] Preserve manual conclusions when supplier source data changes.
- [ ] Keep manual records separate from any future machine result.
- [ ] Add no AI result table, cache, job or quota field.
- [ ] Reject assessment mutations when the owning dossier is archived.
- [ ] Complete the mandatory DB phase gate, including phase-local role/claim tests, explicit live-write approval and post-apply advisors.

### TDD and verification

- Exhaustive table-driven mapping tests.
- Authorization tests for all required role/claim states and stale-revision tests.
- Tests proving source edits do not mutate/delete/mark manual evaluation stale.
- Schema inspection proving no AI runtime artifact was added.

### Exit gate

Manual assessments can be persisted and deterministically derived through tested contracts.

## Phase P12A - Manual Evaluation Save And Navigation Workflow

**Depends on:** P10B, P11  
**Requirements:** TC-04, TC-14, TC-15, TC-16, TC-17, TC-20  
**Deploy boundary:** saveable manual assessment workspace; progress/ranking deferred

### Planned files

- Create: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationWorkspace.tsx`
- Create: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationCriterionList.tsx`
- Create: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationPanel.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/manual-evaluation-workflow.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`

### Tasks

- [ ] Add one-option-at-a-time selector and context header.
- [ ] Add left criterion list with group/status scanning.
- [ ] Add right panel with baseline, response, supplementary info, evidence, notes and both axes.
- [ ] Add `Lưu` and `Lưu & tiếp tục`.
- [ ] Keep current criterion and unsaved input on validation/conflict/persistence failure.
- [ ] Block navigation or preserve a local draft when selecting another criterion/tab/dossier while dirty.
- [ ] Keep evaluation state/data hooks outside the workspace shell.
- [ ] Do not add progress ranking or AI controls in this phase.

### TDD and verification

- Workflow tests for save, save-next and failure preservation.
- Dirty criterion/tab/dossier navigation tests.
- Two-axis and derived-status rendering tests.
- Browser verification of the core evaluation journey.
- React Doctor after focused tests pass.

### Exit gate

Users can manually evaluate and save one option criterion at a time without losing dirty input.

## Phase P12B - Evaluation Progress And Filters

**Depends on:** P12A  
**Requirements:** TC-14, TC-16  
**Deploy boundary:** progress and navigation assistance; no ranking

### Planned files

- Create: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationProgressSummary.tsx`
- Create: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationFilters.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/evaluation-progress-filters.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationCriterionList.tsx`

### Tasks

- [ ] Add progress counters by group and option.
- [ ] Add filters for unassessed, non-compliant and insufficient-evidence criteria.
- [ ] Preserve current option/criterion selection where it remains visible.
- [ ] Provide deterministic next-criterion behavior under active filters.
- [ ] Do not add ranking or AI controls.

### TDD and verification

- Counter tests across all derived statuses.
- Filter and selection-preservation tests.
- Navigation tests with group boundaries and empty filter results.

### Exit gate

Users can measure and navigate evaluation progress without any ranking decision.

## Phase P12C - Optional Reference Ranking

**Depends on:** P12B  
**Requirements:** TC-18  
**Deploy boundary:** optional reference-only ranking

### Planned files

- Create: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationReferenceRanking.tsx`
- Create: `src/lib/technical-configuration-ranking.ts`
- Create: `src/lib/__tests__/technical-configuration-ranking.test.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/reference-ranking.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationWorkspace.tsx`

### Tasks

- [ ] Add optional ranking using only complete two-axis evaluations.
- [ ] Apply precedence: fewer `Không đạt`, fewer `Chưa đủ bằng chứng`, more `Vượt yêu cầu`.
- [ ] Add ties without hidden tie-breakers.
- [ ] Exclude incomplete options and show the reason.
- [ ] Add mandatory reference-only disclaimer.
- [ ] Block cross-dossier, cross-version and reference-product ranking.
- [ ] Do not persist award decisions or AI-derived rank.

### TDD and verification

- Table-driven precedence and tie tests.
- Incomplete-eligibility and scope-guard tests.
- UI disclaimer and no-hidden-ranking tests.

### Exit gate

The manual MVP is feature-complete, including optional transparent reference ranking.

## Phase P13A - Database Security And Performance Hardening

**Depends on:** P12C  
**Requirements:** TC-02, TC-20  
**Deploy boundary:** verification-only; fixes require separate blocking leaf phases
**Production code:** prohibited

### Planned files

- Create: `openspec/changes/add-technical-configuration-comparison/verification/P13A-db-security-performance.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md` only after verification passes

### Tasks

- [ ] Rerun the complete authorization matrix against direct backend calls.
- [ ] Inspect live schema read-only for grants, RLS, JWT guards and `search_path`.
- [ ] Audit ownership/cascade and locked-baseline immutability.
- [ ] Audit migration order and fresh-DB replay behavior.
- [ ] Verify list/matrix query bounds, selected columns, indexes and absence of N+1.
- [ ] Review representative query plans.
- [ ] Run security/performance advisors after any explicitly approved live apply.
- [ ] If any gap is found, create a blocking fix leaf with exact files/issue/branch/PR and stop P13A.
- [ ] Rerun P13A from the beginning after every blocking fix leaf is merged.

### Verification

- Focused SQL/RPC suites from every DB phase.
- Direct-call denial tests for `global`, raw `admin`, missing claims and denied roles.
- Reviewer approval of DB security/performance evidence.

### Exit gate

No release-blocking database authorization, integrity or performance gap remains.

## Phase P13B - UI, Accessibility And Regression Hardening

**Depends on:** P12C  
**Requirements:** TC-03, TC-04, TC-11, TC-13, TC-14, TC-20  
**Deploy boundary:** verification-only; fixes require separate blocking leaf phases
**Production code:** prohibited

### Planned files

- Create: `openspec/changes/add-technical-configuration-comparison/verification/P13B-ui-accessibility-regression.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md` only after verification passes

### Tasks

- [ ] Test concurrent edits and conflict recovery across two tabs.
- [ ] Verify dirty criterion/tab/dossier navigation.
- [ ] Verify long Vietnamese text, many options and narrow viewport.
- [ ] Verify suggested groups remain editable, additional groups render correctly and no custom content-column controls exist.
- [ ] Verify many reference-product columns remain selectable and all criterion content/evidence is reachable.
- [ ] Verify keyboard/focus/accessibility across workspace, matrix and evaluation.
- [ ] Verify stable dimensions and absence of overlap/layout shifts.
- [ ] Verify Equipment attachment regressions after shared extraction.
- [ ] Run focused browser screenshots/interactions on desktop and mobile.
- [ ] If any gap is found, create a blocking fix leaf with exact files/issue/branch/PR and stop P13B.
- [ ] Rerun P13B from the beginning after every blocking fix leaf is merged.

### Verification

- Full relevant Vitest suites from P3A-P12C.
- True full-repo React Doctor:

  ```bash
  node scripts/npm-run.js npx -y -p node@22 -p react-doctor@latest react-doctor . --verbose --project . --offline --full
  ```

- Browser screenshot/interaction evidence.
- Reviewer approval of UI/accessibility evidence.

### Exit gate

No release-blocking UI, accessibility or Equipment regression remains.

## Phase P13C - Release, OpenSpec And AI-Boundary Audit

**Depends on:** P13A, P13B, P7A, P9A  
**Requirements:** TC-19  
**Deploy boundary:** release documentation and final acceptance only

### Planned files

- Create: `docs/runbooks/technical-configuration-comparison.md` if operational guidance is required.
- Create: `openspec/changes/add-technical-configuration-comparison/verification/P13C-release-evidence.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`
- Modify release notes or issue metadata required by the rollout.
- Do not create AI runtime files.

### Tasks

- [ ] Use the feature-baseline SHA from P0 to enumerate all feature commits/files and verify every leaf phase landed.
- [ ] Confirm optional productivity leaves P7A and P9A are complete even though they are not on the manual-comparison critical path.
- [ ] Aggregate preserved per-leaf `verify:no-explicit-any`, `verify:dedupe`, focused test and review evidence.
- [ ] Run fresh full `typecheck` and all focused feature Vitest suites; do not claim a fresh P13 branch diff covers earlier merged leaf diffs.
- [ ] Run `openspec validate add-technical-configuration-comparison --strict`.
- [ ] Audit database and source tree for AI UI/API/job/cache/quota/table artifacts.
- [ ] Confirm stable IDs, criterion citations and manual/machine separation support a future AI OpenSpec change.
- [ ] Complete release notes, rollout boundary and rollback instructions.
- [ ] Update OpenSpec tasks only from verified landed state.
- [ ] Close/relate phase issues and create the separate AI follow-up issue only when requested.

### Verification

- Fresh quality-gate output.
- Feature-baseline-to-HEAD commit/file audit and per-leaf gate evidence.
- Strict OpenSpec validation.
- Reviewer approval of release and AI-boundary evidence.
- `main` synchronized with `origin/main`.

### Exit gate

The MVP is available only to `admin/global`, all manual workflows are verified, Equipment remains stable and AI remains a documented future extension rather than shipped runtime.

## AI Follow-Up Boundary

AI implementation starts only through a new OpenSpec change after P13C. That change must reference the compatibility notes in `design.md` and separately plan:

- criterion-level input fingerprints
- database cache and cost controls
- current AI Assistant model/version reuse
- cancellable tab-scoped progress
- current-option analysis and multi-option synthesis
- latest-result-only persistence
- expert-review refusal state
- AI staleness independent from manual evaluation

No phase in this roadmap may pre-create unused AI tables or hide AI behavior behind an inactive UI control.
