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
P0              -> P1, P5A, P6A
P1              -> P2, P3A
P2 + P3A        -> P3B
P3B             -> P3C, P4
P3B + P4 + P5A  -> P5B
P4 + P5B        -> P5C
P5B + P5C       -> P5D
P6A             -> P6B
P3A + P4        -> P7A1
P7A1            -> P7A2
P4 + P6B + P7A2 -> P7B1
P7B1            -> P7B2
P4              -> P8A
P3A + P8A       -> P8B
P5A + P8B       -> P9A
P6B + P7B2 + P8B -> P9B
P7B2 + P9B      -> P10A
P3A + P10A      -> P10B
P4 + P8A        -> P11
P10B + P11      -> P12A
P12A            -> P12B
P12B            -> P12C
P12C            -> P13A, P13B
P13A + P13B + P7A2 + P9A -> P13C
```

`P5A` is technically independent after `P0`, but the default delivery order places it after `P4` so the completed baseline lifecycle remains the starting point for the P5A-P5D rollout. `P6A` is also technically independent after `P0`, but the default delivery order places it after `P5D`; `P6B` follows `P6A` and must land before the first document UI in `P7B2`. Neither P6 leaf blocks reference-product or supplier work that has no document UI.

## Requirement Traceability

Requirement IDs are roadmap aliases. The authoritative requirement names and scenarios remain in the OpenSpec delta.

| ID    | Requirement                                     | Primary phases                                                                             |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| TC-01 | Independent technical configuration dossier     | P0, P1                                                                                     |
| TC-02 | Global administrator access boundary            | Every DB phase, P3A, P13A                                                                  |
| TC-03 | Flexible two-level baseline authoring           | P0, P2, P3B, P3C                                                                           |
| TC-04 | Explicit save for editable workflows            | P3A, P3B, P3C, P7A2, P7B2, P8B, P9B, P12A                                                  |
| TC-05 | Standard baseline Excel template                | P0, P5A, P5B, P5C, P5D                                                                     |
| TC-06 | Immutable locked baseline versions              | P4, P7A1, P7A2, P7B1, P7B2                                                                 |
| TC-07 | Historical baseline linkage                     | P4, P8A                                                                                    |
| TC-08 | Optional reference products                     | P0, P7A1, P7A2                                                                             |
| TC-09 | Multiple supplier configuration options         | P8A, P8B                                                                                   |
| TC-10 | Standard supplier option Excel template         | P9A                                                                                        |
| TC-11 | URL-only document profiles                      | P6A, P6B, P7B1, P7B2, P9B                                                                  |
| TC-12 | Criterion-level document citations              | P7B1, P7B2, P9B                                                                            |
| TC-13 | Scan-friendly comparison matrix                 | P10A, P10B                                                                                 |
| TC-14 | Per-option manual evaluation workflow           | P12A, P12B                                                                                 |
| TC-15 | Separate manual evaluation axes                 | P11, P12A                                                                                  |
| TC-16 | Transparent derived overall status              | P11, P12A, P12B                                                                            |
| TC-17 | Non-scoring supplementary information           | P8A, P8B, P10A, P10B, P12A                                                                 |
| TC-18 | Optional transparent reference ranking          | P12C                                                                                       |
| TC-19 | AI-ready data boundaries without MVP AI runtime | P0, P1, P11, P13C                                                                          |
| TC-20 | Optimistic conflict protection                  | P0, P1, P2, P3B, P4, P5C, P5D, P7A1, P7A2, P7B1, P7B2, P8A, P8B, P9A, P9B, P11, P12A, P13B |

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
```

Run the exact focused test command listed in the active leaf TDD plan after `typecheck`. Then run `node scripts/npm-run.js run react-doctor` when React files change. Use `ctx_batch_execute` for the chain and add focused browser verification for user-facing phases.

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
- Create: `src/app/api/rpc/__tests__/technical-configuration-dossier-migration.test.ts`
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
- [ ] Require `p_expected_revision` and validate the owning aggregate's `revision BIGINT` for every editable aggregate mutation.
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

### Approved live DB phase gate

- Applied migration registry versions `20260713010933`, `20260713011058`, `20260713011206` and `20260713011301` through Supabase MCP after explicit approval.
- Verified three P2 tables, RLS with deny policies, denied direct `anon`/`authenticated` table access, function signatures, `SECURITY DEFINER`, fixed `search_path` and grants for all 11 authenticated RPCs.
- Passed the rollback-only 11-RPC workflow smoke; no verification rows remain in the P2 tables.
- Reviewed security/performance advisors and Postgres logs; no P2 deployment blocker remains.
- Deferred the non-blocking `source_criterion_id` index improvement to issue `#746`.

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

- [x] Add draft/locked state machine and sequential version numbering.
- [x] Add lock prerequisites from the spec.
- [x] Add database/backend rejection for every locked baseline-owned mutation.
- [x] Record `locked_at` and `locked_by`.
- [x] Add explicit lock confirmation and visibly render lock actor/time in the locked workspace.
- [x] Require the expected draft revision for lock and copy operations; preserve user state on conflict.
- [x] Add create-new-draft from blank or locked version copy.
- [x] Copy new IDs, set `source_baseline_version_id` on every newly copied baseline version, preserve criterion codes and `source_criterion_id`, and copy every baseline-owned entity available when this phase lands.
- [x] Define the copy RPC as an extension contract so P7A1/P7B1 add reference products, responses, documents and citations in their own migrations.
- [x] Add version selector/history without unlocking old versions.
- [x] Ensure supplier/evaluation contracts later can bind to an exact baseline version.
- [x] Remove edit affordances in locked views while retaining backend enforcement.
- [x] Complete the mandatory DB phase gate for versioning/locking objects and RPCs, including phase-local role/claim tests, explicit live-write approval and post-apply advisors.

### TDD and verification

- Write direct mutation tests proving admin/global cannot edit locked content.
- Run phase-local authorization tests for `global`, raw `admin`, missing claims and denied roles.
- Test copy fidelity, independent new draft IDs and `source_baseline_version_id` lineage.
- Test rejected lock for empty/duplicate/error state.
- Test stale-revision rejection for lock and copy.
- Test historical read after a newer version is locked.

### Exit gate

Baseline versions can be locked irreversibly and revised only through a new draft.

## Phase P5A - Shared Equipment Excel Primitives

**Detailed TDD plan:** [`p5-tdd-plan.md`](./p5-tdd-plan.md)<br>
**Depends on:** P0; scheduled after P4<br>
**Requirements:** TC-05<br>
**Deploy boundary:** shared refactor only; Equipment import/export behavior remains unchanged

### Planned files

- Create: `src/lib/excel-workbook.ts`
- Create: `src/lib/__tests__/excel-workbook.test.ts`
- Create: `type-tests/useBulkImportState-options.ts`
- Modify: `src/lib/excel-utils.ts`
- Modify: `src/components/bulk-import/useBulkImportState.ts`
- Modify: `src/components/bulk-import/bulk-import-types.ts`
- Create: `src/components/bulk-import/__tests__/useBulkImportState.test.tsx`
- Modify: `src/app/(app)/equipment/_hooks/useEquipmentExport.ts`
- Test/modify as needed: Equipment import/export and Excel template regression tests

### Tasks

- [x] Freeze the current Equipment template download, data export, workbook parsing, validation and submit behavior with focused tests.
- [x] Extract generic workbook creation/loading, worksheet conversion and Blob download primitives from the oversized `excel-utils.ts`.
- [x] Preserve existing exports so Equipment and current bulk-import consumers do not require a flag-driven rewrite.
- [x] Add an optional custom workbook parser seam to `useBulkImportState`; keep the current first-sheet/header-map flow as the default.
- [x] Keep `BulkImportFileInput`, parse/error presentation and submit-state components as the shared dialog primitives.
- [x] Replace the manual `URL.createObjectURL` template-download block in Equipment with the shared Blob download primitive.
- [x] Do not add baseline-specific metadata, columns, validation or RPC behavior to shared Excel modules.

### TDD and verification

- Existing Equipment template, export hook and import dialog tests must remain GREEN.
- Shared workbook tests cover dynamic ExcelJS loading, worksheet conversion, Blob download cleanup and custom parser delegation.
- Existing DeviceQuota consumers prove the default `useBulkImportState` path remains backward-compatible.
- Run `@code-deduplication` before commit and document the reuse decision.

### Exit gate

Equipment and existing bulk-import consumers use the same tested behavior, while P5B-P5D can reuse workbook, download and custom-parser seams without adding technical-configuration behavior.

## Phase P5B - Baseline Workbook Codec

**Depends on:** P3B, P4, P5A<br>
**Requirements:** TC-05<br>
**Deploy boundary:** domain codec only; no database mutation or user-facing import workflow

### Planned files

- Create: `src/lib/technical-configuration-baseline-excel-contract.ts`
- Create: `src/lib/technical-configuration-baseline-excel-export.ts`
- Create: `src/lib/technical-configuration-baseline-excel-parse.ts`
- Create: `src/lib/__tests__/technical-configuration-baseline-excel.test.ts`
- Reuse: `src/lib/excel-workbook.ts`

### Tasks

- [ ] Define template metadata, schema version, fixed columns and canonical row types from P0.
- [ ] Generate one visible `Baseline` sheet with `GROUP`/`CRITERION` rows and one hidden `_meta` sheet.
- [ ] Seed four suggested group rows while allowing groups to be added, renamed, removed and reordered through valid rows.
- [ ] Parse the whole workbook through the P5A custom-parser seam and preserve Vietnamese Unicode and multiline text.
- [ ] Reject unexpected sheets, metadata keys, columns, row types, ordering and required-text violations.
- [ ] Treat existing criterion codes as read-only and require blank codes for new criteria.
- [ ] Produce canonical rows and client-side structural errors without allocating authoritative codes or persisting data.
- [ ] Keep document URLs, citations and supplier-option fields outside the baseline workbook contract.

### TDD and verification

- Red/green round-trip tests use representative CSV-derived content.
- Cover custom groups, renamed/reordered groups, exact metadata, fixed column order and no-extra-sheet behavior.
- Cover malformed workbook, wrong version, unexpected content column, changed/duplicate code, Unicode and multiline content.
- Semantic dedup review proves only baseline domain logic is new.

### Exit gate

The baseline workbook can be generated and parsed deterministically through shared Excel primitives, but no import RPC or UI consumer is active.

## Phase P5C - Atomic Baseline Import Contract

**Depends on:** P4, P5B<br>
**Requirements:** TC-02, TC-05, TC-20<br>
**Deploy boundary:** additive preview/apply backend; no user-facing import action

### Planned files

- Create: `supabase/migrations/20260715001200_technical_configuration_baseline_import_metadata_validation.sql`
- Create: `supabase/migrations/20260715001250_technical_configuration_baseline_import_validation.sql`
- Create: `supabase/migrations/20260715001300_technical_configuration_baseline_import.sql`
- Create: `src/app/api/rpc/__tests__/technical-configuration-baseline-import-migration.test.ts`
- Create: `supabase/tests/technical_configuration_baseline_import_phase_gate.sql`
- Create: `supabase/tests/technical_configuration_baseline_import_atomicity_phase_gate.sql`
- Modify: `src/lib/technical-configuration-baseline-rpcs.ts`
- Modify: `src/app/(app)/technical-configurations/baseline-types.ts`
- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline.ts`
- Modify: `src/app/(app)/technical-configurations/__tests__/baseline-contract.test.ts`
- Modify: `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`

### Tasks

- [x] Add `technical_configuration_baseline_import_preview` and `technical_configuration_baseline_import_apply`.
- [x] Define one internal server-side validator/normalizer used by both RPCs so preview and apply cannot drift.
- [x] Reuse the current JWT/editable-version helpers, lock order, criterion numbering semantics and response snapshot contract.
- [x] Validate template metadata against the target dossier/version and reject arbitrary or wrong-version payloads.
- [x] Return authoritative row-level preview errors and provisional codes without mutation.
- [x] Apply only to an editable draft with matching `p_expected_revision`.
- [x] Revalidate under dossier/baseline row locks, preserve existing criterion IDs/codes/source links and allocate new codes transactionally.
- [x] Reconcile the complete group/criterion tree, increment the owning revision once and roll back the entire mutation on any error.
- [x] Keep grants fail-closed and allowlist only the two P5C RPCs for `authenticated`.

### TDD and verification

- Migration tests freeze signatures, `SECURITY DEFINER`, `search_path`, grants and response shapes.
- Phase-local SQL tests cover global/raw-admin access, missing claims, denied roles, archived dossier and locked target.
- Preview/apply parity tests prove the shared validator returns the same canonical result.
- Trust-boundary tests prove both RPCs reject wrong template kind/version, mismatched dossier/version/revision metadata, malformed payloads and tampered canonical rows.
- Success tests prove complete-tree create/update/delete/reorder reconciliation, preserved existing criterion identity, exactly one revision increment and exact `next_criterion_number` advancement for new rows only.
- Atomicity tests inject row, duplicate, relationship and stale-revision failures and prove zero partial writes.
- Apply to live Supabase only after explicit user approval; then run role/claim verification and security/performance advisors.

### Exit gate

The backend can authoritatively preview and atomically apply one complete baseline workbook to an editable draft, but no UI invokes the RPCs.

## Phase P5D - Baseline Import Workflow UI

**Depends on:** P5B, P5C<br>
**Requirements:** TC-05, TC-20<br>
**Deploy boundary:** activates the optional baseline Excel workflow; manual authoring remains complete

### Planned files

- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineImport.ts`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineImportDialog.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineImportPreview.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/baseline-import-dialog.test.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/use-technical-configuration-baseline-import.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationVersionBar.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineAlerts.tsx`

### Tasks

- [x] Add template download/import actions only when the selected version is an editable draft.
- [x] Wire template download through the P5B generator and P5A shared Blob helper; do not add parallel workbook or object-URL logic.
- [x] Use the P5A `useBulkImportState` custom parser and shared bulk-import dialog parts.
- [x] Send P5B canonical rows to the P5C preview RPC and render authoritative provisional codes and row-level errors.
- [x] Require explicit preview confirmation before calling the atomic apply RPC.
- [x] Never persist through the existing sequential group/criterion save steps.
- [x] Adopt the returned complete snapshot and synchronize selected-version, dossier revision and version-history caches after success.
- [x] Preserve the selected file, canonical rows and preview when apply rejects a stale revision; refresh revision/history without discarding input.
- [x] Keep import file/preview/errors transient and block the lock affordance only while unresolved import state is active.
- [x] Keep import state outside the already-large baseline editor and lifecycle hook.

### TDD and verification

- UI tests prove no persistence occurs before preview confirmation.
- Download tests prove the selected draft is generated through the P5B codec and downloaded through the P5A helper.
- Draft-only tests prove locked versions never render import controls and backend rejection remains authoritative.
- Conflict tests preserve file, canonical rows and preview while refreshing the current revision.
- Success tests prove one apply RPC, one returned snapshot adoption and no sequential CRUD calls.
- Run focused baseline workflow tests plus the full repository TypeScript/React verification order.

### Exit gate

Users can create the same draft baseline manually or through one versioned system workbook built on the existing Equipment Excel infrastructure.

## Phase P6A - URL Document Contracts And Shared Primitives

**Depends on:** P0; scheduled after P5D

**Requirements:** TC-11

**Deploy boundary:** additive tests and persistence-agnostic UI primitives; Equipment production code remains unchanged

**Detailed TDD plan:** [P6A - TDD sequence](./p6-tdd-plan.md#p6a---tdd-sequence)

### Planned files

- Create: `src/app/(app)/equipment/__tests__/equipment-detail-files-tab.test.tsx`
- Create: `src/components/url-documents.types.assert.ts`
- Create: `src/components/url-documents/UrlDocumentForm.tsx`
- Create: `src/components/url-documents/UrlDocumentList.tsx`
- Create: `src/components/url-documents/url-document-utils.ts`
- Create: `src/components/url-documents/__tests__/UrlDocumentForm.test.tsx`
- Create: `src/components/url-documents/__tests__/UrlDocumentList.test.tsx`
- Create: `src/components/url-documents/__tests__/url-document-ast-helpers.ts`
- Create: `src/components/url-documents/__tests__/url-document-browser-capability-helpers.ts`
- Create: `src/components/url-documents/__tests__/url-document-browser-boundary.test.ts`
- Create: `src/components/url-documents/__tests__/url-document-browser-network-boundary.test.ts`
- Create: `src/components/url-documents/__tests__/url-document-module-reference-edge-cases.test.ts`
- Create: `src/components/url-documents/__tests__/url-document-module-reference-helpers.ts`
- Create: `src/components/url-documents/__tests__/url-document-production-boundary.test.ts`
- Create: `src/components/url-documents/__tests__/url-document-scope-helpers.ts`
- Create: `src/components/url-documents/__tests__/url-document-source-contract-fixtures.ts`
- Create: `src/components/url-documents/__tests__/url-document-source-contract-helpers.ts`
- Create: `src/components/url-documents/__tests__/url-document-utils.test.ts`
- Create: `src/components/url-documents/__tests__/url-document-source-contract.test.ts`

### Tasks

- [ ] Add direct characterization tests for the current Equipment files tab instead of relying on dialog tests that mock the tab and attachment hook.
- [ ] Lock loading, empty, listed-link, invalid URL, successful add/reset, rejected add/retry, add-pending inputs/button/spinner, delete cancel/confirm and delete-pending behavior.
- [ ] Add pure `new URL(...)`-equivalent parser plus a separate document policy
      that requires case-insensitive lexical `^https?://`, rejects raw
      backslashes and then requires parsed `http:`/`https:` protocol, with no
      RPC, query-key or table knowledge.
- [ ] Add controlled form/list primitives whose props use canonical `id`, `name` and `url` fields; the form accepts accessible inline validation feedback without owning validation policy.
- [ ] Freeze exact utility/form/list TypeScript signatures and preserve accepted
      raw URL strings in callbacks and anchor attributes rather than exposing
      normalized `URL.href`; tests also assert the resolved anchor destination.
- [ ] Keep mutation, toast, confirmation, dirty-state and affected-link policies outside the shared primitives so P7B2/P9B can supply their own persistence workflow.
- [ ] Keep external links on the shared list in a new tab with `noopener noreferrer`.
- [ ] Require `role="alert"` validation feedback plus `type="button"` and document-specific accessible labels for delete; prove delete cannot submit an outer form.
- [ ] Add one TypeScript-AST source-contract test that recursively inventories every supported TS/JS module extension; parses import, import-equals, export-from, dynamic import, `require()` and `ImportTypeNode`; fails non-literal references; and enforces concrete per-file module-specifier set equality with no prefix matching.
- [ ] Avoid nested cards and avoid introducing a shared manager component before multiple consumers prove that abstraction.

### TDD and verification

- Characterization tests pass against the pre-refactor Equipment component and fail on deliberate behavior regressions.
- Utility tests are written before implementation and cover parseable/unparseable URLs using the existing `new URL(...)` contract.
- Form/list tests are written before implementation and cover controlled
  callbacks, disabled states, live accessible inline URL errors,
  outer-form-safe delete actions, loading/empty rendering and a table-driven
  malformed/relative/scheme-relative/protocol-only/single-slash/backslash/non-HTTP/HTTP/HTTPS
  link matrix; invalid items remain named text with no link role, anchor or
  fallback `href`. The accepted matrix includes
  `HtTpS://EXAMPLE.com/a/../spec.pdf`, preserves raw `getAttribute("href")` and
  resolves to `new URL(raw).href`.
- Handler-level invalid cases use `fireEvent.submit(form)` so native `type="url"` constraints cannot bypass parser/policy assertions; separate `userEvent` cases cover native disabled and valid submit behavior.
- Source-contract synthetic fixtures cover every parsed AST form, `ImportTypeNode`,
  JSDoc `import()`/`@import`, recursively wrapped/destructured ambient loader
  roots, variable/assignment/parameter/nested/computed constructor escapes,
  reflective access, computed-reference fail-closed behavior, TS/JS extension
  inventory drift and missing/extra module specifiers before the production
  source check is trusted.
- Run `@code-deduplication` discovery before creating the shared files; current graph/search evidence found no reusable URL-document form/list abstraction.
- Run focused Vitest plus the TypeScript/React quality gates required for the new shared files.

### Exit gate

Shared controlled URL-document primitives and direct Equipment characterization tests exist, but no Equipment production consumer and no technical-configuration document record has changed.

## Phase P6B - Equipment URL Document Consumer Migration

**Depends on:** P6A

**Requirements:** TC-11

**Deploy boundary:** Equipment presentation refactor with HTTP(S)-only document-link hardening; existing hook/RPC/storage behavior remains authoritative

**Detailed TDD plan:** [P6B - TDD-safe migration sequence](./p6-tdd-plan.md#p6b---tdd-safe-migration-sequence)

### Planned files

- Modify: `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailFilesTab.tsx`
- Modify: `src/app/(app)/equipment/__tests__/equipment-detail-files-tab.test.tsx`
- Create: `src/app/(app)/equipment/__tests__/equipment-detail-files-tab-delegation.test.tsx`
- Modify: `src/components/url-documents/__tests__/url-document-source-contract.test.ts`

### Tasks

- [ ] Replace duplicated Equipment form/list presentation with the P6A controlled primitives.
- [ ] Map Equipment `Attachment` fields to canonical shared `id`, `name` and `url` props inside the Equipment wrapper.
- [ ] Keep local input state, `useToast`, invalid-URL feedback, delete confirmation and Google Drive affordance Equipment-specific, while gating that folder `href` through the same P6A URL parser/policy.
- [ ] Keep `useEquipmentAttachments`, `equipment_attachments_list`, `equipment_attachment_create`, `equipment_attachment_delete`, query keys and `file_dinh_kem` ownership unchanged.
- [ ] Preserve current supported HTTP(S) behavior while rejecting `javascript:`, `data:`, `file:` and other non-document schemes before add or any attachment/folder clickable-link rendering.
- [ ] Apply the same table-driven
      malformed/relative/scheme-relative/protocol-only/single-slash/backslash/non-HTTP/HTTP/HTTPS
      matrix to add input, existing attachments and `googleDriveFolderUrl`;
      include `HtTpS://EXAMPLE.com/a/../spec.pdf` as the accepted mixed-case
      vector at all three sinks.
- [ ] Preserve exact accepted raw strings in Equipment add payloads and
      attachment/folder `href` attributes, while asserting each resolved anchor
      destination equals `new URL(raw).href`.
- [ ] Catch rejected delete callbacks in the Equipment wrapper after hook feedback, reset pending state and allow retry without an unhandled rejection.
- [ ] Preserve loading, empty, add/reset, rejected-add retry, delete and safe-link behavior under the P6A regression suite.
- [ ] Extend the AST source contract with exact shared module paths/named
      bindings and cumulative manifest set equality. P6B requires exactly
      `EquipmentDetailFilesTab.tsx`; P7B2 later adds baseline and P9B later adds
      option without dropping earlier consumers.
- [ ] Add a focused runtime-delegation test that mocks the exact
      form/list/utility modules and proves captured props/callbacks drive active
      Equipment field, add, mapped-list, delete-confirmation and Google Drive
      workflows; imports alone do not satisfy the contract.
- [ ] Run semantic dedup review and verify that the shared layer imports no Equipment type, hook, RPC client or persistence identifier.

### TDD and verification

- Run the P6A Equipment characterization/shared/source-contract baseline green;
  append wrapper cases for every URL sink, runtime delegation and
  rejected-delete retry; confirm behavior/delegation/source-contract suites fail
  on pre-P6B source; migrate Equipment; rerun the unchanged baseline plus new
  cases green.
- Run shared primitive tests, focused Equipment dialog tests, typecheck and React Doctor in repository verification order.
- When an authenticated non-production fixture/mock path already exists, browser-smoke the Equipment files tab read-only. Otherwise record it as `N/A`; focused React tests remain the mandatory gate and P6 does not add a browser harness.

### Exit gate

Equipment renders through the tested P6A primitives with no storage-contract change. Supported HTTP(S) workflow remains unchanged; disallowed schemes are rejected or rendered non-clickable. P7B1 may now add independent document records and P7B2 may reuse the controlled primitives.

No P6C is planned. Current import/graph inspection shows one Equipment consumer boundary, one Equipment-specific hook/RPC adapter and no second independent extraction seam. Add P6C only if P6A/P6B execution reveals a separately testable boundary that cannot land safely in either leaf.

## Phase P7A1 - Reference Product Data Contracts

**Detailed TDD plan:** [P7A1 - Reference Product Data Contracts](./p7-tdd-plan.md#p7a1---reference-product-data-contracts)

**Depends on:** P3A, P4  
**Requirements:** TC-02, TC-04, TC-06, TC-08, TC-20  
**Deploy boundary:** backend reference-product contracts only; no reference-product UI

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_reference_products.sql`
- Create: `src/app/api/rpc/__tests__/technical-configuration-reference-products-migration.test.ts`
- Create: `supabase/tests/technical_configuration_reference_products_phase_gate.sql`
- Create: `src/lib/technical-configuration-reference-rpcs.ts`
- Create: `src/app/(app)/technical-configurations/reference-product-types.ts`
- Create: `src/app/(app)/technical-configurations/technical-configuration-reference-rpc.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify: `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`

### Tasks

- [ ] Add zero-to-many reference products scoped to an exact baseline version.
- [ ] Add model, manufacturer, description and notes without creating supplier records.
- [ ] Add one multiline comparison response per `reference product + baseline criterion`.
- [ ] Require the expected baseline revision for every reference-product mutation.
- [ ] Reject every mutation after baseline lock.
- [ ] Extend locked-baseline copy to clone reference products/responses with new IDs and remapped criterion links.
- [ ] Exclude reference products from option counts, assessments and ranking contracts.
- [ ] Add typed RPC names, wire types, module-local wrappers and RPC allowlisting without changing `callTechnicalConfigurationRpc`.
- [ ] Complete the mandatory DB phase gate, including phase-local role/claim tests, explicit live-write approval and post-apply advisors.

### TDD and verification

- Authorization tests for all required role/claim states.
- Migration/source tests for exact tables, constraints, RPC names, grants and allowlist entries.
- SQL tests for baseline ownership, criterion-response ownership/cascade, archived/locked immutability and copy remapping.
- Stale-revision tests for create/update/delete/upsert with no partial write.
- Contract tests proving reference products remain outside supplier, assessment and ranking domains.

### Exit gate

Reference-product persistence, revision, lock and copy contracts are deployable but no new user-facing reference-product surface exists.

## Phase P7A2 - Reference Product Workspace

**Detailed TDD plan:** [P7A2 - Reference Product Workspace](./p7-tdd-plan.md#p7a2---reference-product-workspace)

**Depends on:** P7A1
**Requirements:** TC-04, TC-06, TC-08, TC-20
**Deploy boundary:** optional reference-product criterion comparison; documents remain deferred

### Planned files

- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationReferenceProducts.ts`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceProducts.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceComparison.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/reference-products.test.tsx`
- Modify: `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`

### Tasks

- [ ] Render groups/criteria as rows, the baseline requirement as a sticky column and selected reference products as dynamic columns.
- [ ] Add column selection, horizontal scrolling and a full-text detail panel for large reference sets.
- [ ] Do not add custom content columns or permanent evidence columns.
- [ ] Add explicit save and dirty-state handling for product/criterion-response edits.
- [ ] Preserve unsaved product/criterion-response edits on stale-revision conflict.
- [ ] Render locked versions read-only with no mutation affordance.
- [ ] Add the reference-products surface through `TechnicalConfigurationWorkspaceShell` without adding P7 state to `TechnicalConfigurationBaselineTab` or `useTechnicalConfigurationBaselineEditor`.

### TDD and verification

- React tests for optional/multiple products, long criterion text, many dynamic columns, dirty state, conflict preservation and locked read-only rendering.
- RPC adapter/query-key tests for create/update/delete/upsert success, error and invalidation behavior.
- Source/file-size review proving the workspace shell remains composition-only and every new source file stays below the 350-line extraction threshold.

### Exit gate

Reference products can be compared criterion-by-criterion while authoring the baseline, but cannot enter supplier assessment or ranking.

## Phase P7B1 - Baseline And Reference Evidence Contracts

**Detailed TDD plan:** [P7B1 - Baseline And Reference Evidence Contracts](./p7-tdd-plan.md#p7b1---baseline-and-reference-evidence-contracts)

**Depends on:** P4, P6B, P7A2
**Requirements:** TC-02, TC-04, TC-06, TC-11, TC-12, TC-20  
**Deploy boundary:** backend evidence contracts only; no baseline/reference document UI

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_baseline_documents.sql`
- Create: `src/app/api/rpc/__tests__/technical-configuration-baseline-documents-migration.test.ts`
- Create: `supabase/tests/technical_configuration_baseline_documents_phase_gate.sql`
- Create: `src/lib/technical-configuration-document-rpcs.ts`
- Create: `src/app/(app)/technical-configurations/document-types.ts`
- Create: `src/app/(app)/technical-configurations/technical-configuration-document-rpc.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify: `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`

### Tasks

- [ ] Add document URL metadata owned by the baseline or one reference product.
- [ ] Add criterion citation with document ID, page/section and excerpt while preserving owner scope.
- [ ] Reuse one document across multiple criteria without URL duplication.
- [ ] Define `technical_configuration_baseline_documents_list` as the single
      paginated P7B1 read path for both owner types. Return discriminated
      `baseline`/`reference_product` items with exact `owner_id`, raw URL and
      nested same-version citations.
- [ ] Add
      `public._technical_configuration_validate_document_url(text) RETURNS void`
      and call it from baseline/reference document create/update RPCs before
      write or revision increment; enforce lexical `^https?://`, no backslash
      and parsed HTTP(S) semantics without rewriting accepted input.
- [ ] Require the expected baseline revision for every document/citation mutation.
- [ ] Extend lock enforcement to baseline/reference-product document metadata and citations.
- [ ] Extend locked-baseline copy to clone baseline/reference documents and citations with new IDs and remapped owner/criterion links.
- [ ] Return affected-link count from editable document delete contracts.
- [ ] Add typed RPC names, wire types, module-local wrappers and RPC allowlisting without changing `callTechnicalConfigurationRpc`.
- [ ] Complete the mandatory DB phase gate, including phase-local role/claim tests, explicit live-write approval and post-apply advisors.

### TDD and verification

- Authorization tests for all required role/claim states.
- Migration/source tests for four evidence tables, constraints, eleven RPCs, exact grants and allowlist entries.
- SQL tests for baseline/reference-product aggregate-list owner discrimination
  and citation scope, reuse,
  malformed/disallowed/protocol-only/single-slash/backslash URL rejection with
  no write/revision change, mixed-case-scheme acceptance and exact raw URL
  stored/returned equality across create, update and aggregate list,
  affected-link count, stale revision and locked immutability.
- SQL source-contract assertions over `pg_get_functiondef`: exactly one validator; exactly four baseline/reference document create/update callers with no branch on P9B function presence; every list/delete/citation RPC remains a non-caller.

### Exit gate

Baseline/reference evidence persistence, URL validation, revision, lock, copy and delete-count contracts are deployable but no new evidence UI exists.

## Phase P7B2 - Baseline And Reference Evidence Workspace

**Detailed TDD plan:** [P7B2 - Baseline And Reference Evidence Workspace](./p7-tdd-plan.md#p7b2---baseline-and-reference-evidence-workspace)

**Depends on:** P7B1
**Requirements:** TC-04, TC-06, TC-11, TC-12, TC-20
**Deploy boundary:** baseline/reference-product URL evidence and criterion citations

### Planned files

- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineDocuments.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationCitationEditor.tsx`
- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDocuments.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/baseline-evidence.test.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/baseline-evidence-delegation.test.tsx`
- Modify: `src/components/url-documents/__tests__/url-document-source-contract.test.ts`
- Modify: `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceComparison.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`

### Tasks

- [ ] Use P6B-proven primitives for URL list/form behavior.
- [ ] Wire `useTechnicalConfigurationDocuments` and both baseline/reference UI states to the P7B1 aggregate response.
- [ ] Extend the URL-document consumer AST contract to enforce the cumulative
      Equipment + `TechnicalConfigurationBaselineDocuments.tsx` manifest with
      exact shared module paths/named bindings, primitive render usage, shared
      parser/policy calls and no local `new URL(...)` or extracted field/list
      presentation.
- [ ] Show reference evidence through indicators and the detail panel without adding permanent evidence columns.
- [ ] Add explicit save and dirty-state handling for document/citation edits.
- [ ] Preserve unsaved edits on stale-revision conflict.
- [ ] For editable data, show affected-link count before confirmed document deletion.
- [ ] For locked data, reject edit/delete before any confirmation flow.
- [ ] Integrate through the workspace/reference surfaces without adding document state to `TechnicalConfigurationBaselineTab` or `useTechnicalConfigurationBaselineEditor`.

### TDD and verification

- React tests for URL validation, aggregate baseline/reference owner routing,
  exact raw create/update/list/render behavior, dirty state, conflict
  preservation, deletion confirmation, citation editing and locked read-only
  state. Mocked primitive/utility delegation assertions prove the active
  baseline and reference workflows are driven through shared props/callbacks.
- Consumer source-contract test is red before the baseline document UI exists
  and green only when the cumulative Equipment + baseline manifest uses exact
  shared paths/bindings.
- Browser check with long Vietnamese excerpts.
- Source/file-size review proving shared URL primitives remain unchanged and each new workspace file stays below the 350-line extraction threshold.

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

**Depends on:** P5A, P8B<br>
**Requirements:** TC-10, TC-20<br>
**Deploy boundary:** option template/import only; evidence remains deferred

### Planned files

- Create: `src/lib/technical-configuration-option-excel.ts`
- Create: `src/lib/__tests__/technical-configuration-option-excel.test.ts`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionImportDialog.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/option-import.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionEditor.tsx`

### Tasks

- [ ] Generate option template from the selected baseline version.
- [ ] Reuse P5A workbook/download/import-state primitives and keep only option-specific codec logic in this phase.
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

**Depends on:** P6B, P7B2, P8B
**Requirements:** TC-02, TC-04, TC-11, TC-12, TC-20  
**Deploy boundary:** option URL evidence only

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_option_evidence.sql`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionDocuments.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/option-evidence.test.tsx`
- Create: `supabase/tests/technical_configuration_option_documents_phase_gate.sql`
- Modify: `src/components/url-documents/__tests__/url-document-source-contract.test.ts`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationCitationEditor.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionEditor.tsx`

### Tasks

- [ ] Add option-level document URL metadata.
- [ ] Add criterion citations with page/section/excerpt.
- [ ] Reuse P6B-proven URL primitives and P7B2 citation behavior.
- [ ] Extend the URL-document consumer AST contract to enforce the cumulative
      Equipment + baseline + `TechnicalConfigurationOptionDocuments.tsx`
      manifest with exact shared module paths/named bindings, primitive render
      usage, shared parser/policy calls and no local `new URL(...)` or extracted
      field/list presentation.
- [ ] Reuse the P7B1 authoritative HTTP(S) URL validator in option document create/update RPCs.
- [ ] Reuse one option document across multiple criteria.
- [ ] Add explicit save and dirty-state handling for option document/citation edits.
- [ ] Require the expected option revision and preserve unsaved edits on conflict.
- [ ] Show affected-link count before confirmed deletion of an editable linked document.
- [ ] Complete the mandatory DB phase gate, including phase-local role/claim tests, explicit live-write approval and post-apply advisors.

### TDD and verification

- Authorization tests for all required role/claim states.
- Option-list ownership/citation scope, cascade, reuse,
  malformed/disallowed/protocol-only/single-slash/backslash URL rejection,
  mixed-case-scheme acceptance and exact raw URL stored/returned equality across
  create, update and list, stale-revision and affected-link-count SQL tests.
- SQL source-contract assertions over `pg_get_functiondef` proving the same validator has exactly six callers after P9B: baseline/reference/option document create/update only.
- URL validation, exact raw create/update/list/render behavior, dirty state,
  conflict preservation, citation and deletion-confirmation UI tests. Mocked
  primitive/utility delegation assertions prove the active option workflow is
  driven through shared props/callbacks.
- Consumer source-contract test is red before the option document UI exists and
  green only when the cumulative Equipment + baseline + option manifest uses
  exact shared paths/bindings.
- Rerun `supabase/tests/technical_configuration_baseline_documents_phase_gate.sql` and `baseline-evidence.test.tsx` together with the P9B option suites.
- Mark TC-11-S01/S02/S03 and TC-12-S01/S02 complete only after baseline, reference-product and supplier-option cases pass together.

### Exit gate

Baseline, reference-product and supplier-option cases all pass TC-11-S01/S02/S03 and TC-12-S01/S02 with authoritative HTTP(S) validation and correctly scoped reusable citations; supplier options gain criterion-level URL evidence without changing Excel or assessment behavior.

## Phase P10A - Comparison Read Contract

**Depends on:** P7B2, P9B
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

**Depends on:** P13A, P13B, P7A2, P9A
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
- [ ] Confirm optional productivity leaves P7A1, P7A2 and P9A are complete even though they are not on the manual-comparison critical path.
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
