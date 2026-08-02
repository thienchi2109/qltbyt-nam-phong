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

Parent labels such as `P3`, `P7`, `P8`, `P9`, `P10`, `P12`, `P13` and
`P14` group related work only. Their leaf phases (`P3A`, `P3B`...) are the
actual delivery units.

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

Do not reload the full feature history or every leaf phase unless a cross-phase
contract conflict is discovered.

## Dependency Graph

```text
P0              -> P1, P5A, P6A
P1              -> P2, P3A, P8A1
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
P8A1            -> P8A2
P4 + P7A1 + P8A2 -> P8A3
P8A3            -> P8A4
P3A + P8A2      -> P8B1
P4 + P8A3 + P8A4 + P8B1 -> P8B2
P8B2            -> P8B3
P5A + P8B2      -> P9A1
P8A4 + P9A1     -> P9A2
P8B3 + P9A2     -> P9A3
P7B1 + P8A4 + P9A3 -> P9B1
P6B + P7B2 + P8B2 + P9B1 -> P9B2
P7B2 + P9B2     -> P10A1
P10A1           -> P10A2
P3A + P10A2     -> P10B1
P10B1           -> P10B2
P10B2           -> P10B3
P4 + P8A3       -> P11A
P11A            -> P11B
P8A4 + P8B2 + P11B -> P11C
P7B2 + P11C     -> P11D
P10B3 + P11D    -> P12A1
P12A1           -> P12A2
P12A2           -> P12B1
P12B1           -> P12B2
P12B2           -> P12C1
P12C1           -> P12C2
P12C1           -> P13A-P1
P13A-P1         -> P13A-V
P13A-P1 fail    -> P13A-P2 -> approved apply/gate -> rerun P13A-P1 green -> P13A-V
P12C2           -> P13B
P12C1           -> P14A1 -> P14A2 -> P14A3 -> P14B1 -> P14B2 -> P14C1 -> P14C2
P13A-V + P13B + P7A2 + P9A3 + P14C2 -> P13C
```

`P5A` is technically independent after `P0`, but the default delivery order places it after `P4` so the completed baseline lifecycle remains the starting point for the P5A-P5D rollout. `P6A` is also technically independent after `P0`, but the default delivery order places it after `P5D`; `P6B` follows `P6A` and must land before the first document UI in `P7B2`. Neither P6 leaf blocks reference-product or supplier work that has no document UI.

P9 uses the strict delivery order
`P9A1 -> P9A2 -> P9A3 -> P9B1 -> P9B2`. P9B1 is technically grounded by
P7B1/P8A4, but it deliberately waits for P9A3 so the option RPC maps,
allowlists and response workspace are changed by one reviewed leaf at a time.
P9A1/P9A2 and P9B1 are dormant contracts; only P9A3 and P9B2 activate new
user-visible workflows. P8B3 is an external frontend prerequisite for P9A3 but
does not block P9A1 or P9A2.

P11 uses the strict delivery order `P11A -> P11B -> P11C -> P11D`. P11A deliberately
retains the original P4/P8A3 delivery dependencies even though its code is a
pure domain contract, so every leaf has a merged and verifiable predecessor.
P11B adds the dormant database contract and must be applied and gated before
P11C exposes the RPCs through the proxy and typed client. P11C also waits for
the P8A4 nullable read and P8B2 no-write-on-open/first-save orchestration that
it must reuse. P11D additionally depends on the stable shared page collector
from P7B2, completes sparse bounded assessment collection on top of the
existing P11C list contract and reconciles rows by `criterion_id`; it does not
change the database, RPC, proxy or production UI.

P12A uses the strict delivery order `P12A1 -> P12A2`. P12A1 owns the dormant
evaluation core, shared criterion composition, local draft state and save
state machine. P12A2 activates that core inside the existing
`So sánh & đánh giá` tab, owns guarded navigation and completes the
user-visible workflow. These leaves use the strict deploy-safe order
`P12A2 -> P12B1 -> P12B2 -> P12C1 -> P12C2`: P12B1 owns selected-option progress,
status counters, compact summaries and successful-save cache adoption while
leaving existing navigation unchanged; P12B2 reuses that model without changing
its data shape, adds a guarded read-only server-filter RPC for exact canonical
IDs and owns status filters, presentation pagination, selection reconciliation,
dirty/pending guards and filter-aware save-next. P12C1 then owns the complete,
set-based, read-only ranking contract; P12C2 adds only the explicit-request
ranking UI over that contract. P12C1 cannot start until P12B2 is complete, and
P12C2 cannot start until P12C1 is complete.

P14 is independent of the deferred P13A/P13B hardening path and uses the strict
delivery order
`P14A1 -> P14A2 -> P14A3 -> P14B1 -> P14B2 -> P14C1 -> P14C2`.
P14A1/P14A2 add only dormant, read-only export contracts; P14A3 completes a
stable full-dataset collector without UI; P14B1/P14B2 build and render the
workbook without mounting a trigger; P14C1 adds an unmounted export-scope state
machine/dialog; only P14C2 activates download from the evaluation workspace.
No P14 leaf seeds or writes live data for verification. Large-workbook coverage
uses in-memory fixtures larger than 100 options x 102 criteria. P13C waits for
P14C2 because final release evidence must include the approved result-export
workflow, but P14 does not wait for P13A-P1, P13A-V or P13B.

## Requirement Traceability

Requirement IDs are roadmap aliases. The authoritative requirement names and scenarios remain in the OpenSpec delta.

| ID    | Requirement                                     | Primary phases                                                                                                                                                                                         |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TC-01 | Independent technical configuration dossier     | P0, P1                                                                                                                                                                                                 |
| TC-02 | Global administrator access boundary            | Every DB phase, P3A, P13A-V                                                                                                                                                                            |
| TC-03 | Flexible two-level baseline authoring           | P0, P2, P3B, P3C                                                                                                                                                                                       |
| TC-04 | Explicit save for editable workflows            | P3A, P3B, P3C, P7A2, P7B2, P8A4, P8B1, P8B2, P8B3, P9A3, P9B2, P12A1, P12A2, P12B1, P12B2                                                                                                              |
| TC-05 | Standard baseline Excel template                | P0, P5A, P5B, P5C, P5D                                                                                                                                                                                 |
| TC-06 | Immutable locked baseline versions              | P4, P7A1, P7A2, P7B1, P7B2                                                                                                                                                                             |
| TC-07 | Historical baseline linkage                     | P4, P8A3, P8A4                                                                                                                                                                                         |
| TC-08 | Optional reference products                     | P0, P7A1, P7A2                                                                                                                                                                                         |
| TC-09 | Multiple supplier configuration options         | P8A1, P8A2, P8A3, P8A4, P8B1, P8B2, P8B3                                                                                                                                                               |
| TC-10 | Standard supplier option Excel template         | P9A1, P9A2, P9A3                                                                                                                                                                                       |
| TC-11 | URL-only document profiles                      | P6A, P6B, P7B1, P7B2, P9B1, P9B2                                                                                                                                                                       |
| TC-12 | Criterion-level document citations              | P7B1, P7B2, P9B1, P9B2                                                                                                                                                                                 |
| TC-13 | Scan-friendly comparison matrix                 | P10A1, P10A2, P10B1, P10B2, P10B3, P12A1, P12A2                                                                                                                                                        |
| TC-14 | Per-option manual evaluation workflow           | P11D, P12A1, P12A2, P12B1, P12B2                                                                                                                                                                       |
| TC-15 | Separate manual evaluation axes                 | P11A, P11B, P11C, P11D, P12A1, P12A2                                                                                                                                                                   |
| TC-16 | Transparent derived overall status              | P11A, P12A1, P12A2, P12B1, P12B2                                                                                                                                                                       |
| TC-17 | Non-scoring supplementary information           | P8A3, P8A4, P8B2, P8B3, P10A1, P10A2, P10B1, P12A1, P12A2, P13B                                                                                                                                        |
| TC-18 | Optional transparent reference ranking          | P12C1, P12C2                                                                                                                                                                                           |
| TC-19 | AI-ready data boundaries without MVP AI runtime | P0, P1, P11A, P11B, P11C, P13C                                                                                                                                                                         |
| TC-20 | Optimistic conflict protection                  | P0, P1, P2, P3B, P4, P5C, P5D, P7A1, P7A2, P7B1, P7B2, P8A1, P8A2, P8A3, P8A4, P8B1, P8B2, P8B3, P9A2, P9A3, P9B1, P9B2, P11B, P11C, P12A1, P12A2, P12B2, P13A-P1, P13A-P2 (conditional), P13A-V, P13B |
| TC-21 | Final comparison result Excel export            | P14A1, P14A2, P14A3, P14B1, P14B2, P14C1, P14C2                                                                                                                                                        |

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
- [ ] Keep mutation, toast, confirmation, dirty-state and affected-link policies outside the shared primitives so P7B2/P9B2 can supply their own persistence workflow.
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
      `EquipmentDetailFilesTab.tsx`; P7B2 later adds baseline and P9B2 later adds
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
- SQL source-contract assertions over `pg_get_functiondef`: exactly one validator; exactly four baseline/reference document create/update callers with no branch on P9B1 function presence; every list/delete/citation RPC remains a non-caller.

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

## Phase P8A1 - Supplier Data Contracts

**Depends on:** P1

**Requirements:** TC-09, TC-20

**Deploy boundary:** supplier persistence and RPC contracts only; no option,
response, hook or UI surface

### Planned files

- Create: `supabase/migrations/20260722010000_technical_configuration_suppliers.sql`
- Create: `supabase/tests/technical_configuration_suppliers_phase_gate.sql`
- Create: `src/lib/technical-configuration-supplier-option-rpcs.ts`
- Create: `src/app/(app)/technical-configurations/supplier-option-types.ts`
- Create: `src/app/(app)/technical-configurations/technical-configuration-supplier-option-rpc.ts`
- Create: `src/app/api/rpc/__tests__/technical-configuration-suppliers-migration.test.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify: `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`
- Create: `openspec/changes/add-technical-configuration-comparison/p8a-tdd-plan.md`

### Tasks

- [x] Add dossier-scoped suppliers with trim, whitespace-collapse and lowercase
      normalized-name uniqueness.
- [x] Add list/create/update/delete RPCs guarded by the existing global/raw-admin
      and editable-dossier authorization helpers.
- [x] Use dossier revision as the optimistic-concurrency owner for supplier
      mutations.
- [x] Reject mutations for archived dossiers while allowing direct supplier
      editing regardless of baseline lock state.
- [x] Keep supplier tables RPC-only with RLS enabled, deny-by-default table
      grants and exact authenticated RPC grants.
- [x] Keep suppliers outside the baseline aggregate and baseline-copy flow.
- [x] Prepare the phase-local DB gate without applying or executing it against
      live DB before explicit approval.

### TDD and verification

- Migration-source tests for ordering, schema, normalization, ownership,
  cascade, authorization, concurrency, RLS and grants.
- Type-level/runtime contract tests for supplier RPC names, wire values and the
  module-local proxy adapter.
- RPC allowlist tests proving exactly four supplier RPCs are exposed.
- Local OpenSpec, formatting, typecheck, focused Vitest and React Doctor gates.

### Exit gate

Supplier persistence and secure RPC contracts can deploy independently. No
option table, response dataset, hook or UI is present.

## Phase P8A2 - Option Identity Data Contracts

**Depends on:** P8A1

**Requirements:** TC-09, TC-20

**Deploy boundary:** option identity and metadata only; no baseline-bound responses

### Planned files

- Create: `supabase/migrations/20260722034323_technical_configuration_options.sql`
- Create:
  `supabase/migrations/20260722060629_technical_configuration_options_supplier_fk_index.sql`
  as the ordered follow-up for the supplier-first composite-FK covering index.
- Create: `supabase/tests/technical_configuration_options_phase_gate.sql`
- Create: `src/app/api/rpc/__tests__/technical-configuration-options-migration.test.ts`
- Modify: `src/lib/technical-configuration-supplier-option-rpcs.ts`
- Modify: `src/app/(app)/technical-configurations/supplier-option-types.ts`
- Modify: `src/app/(app)/technical-configurations/technical-configuration-supplier-option-rpc.ts`
- Modify: `src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify: `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`

### Tasks

- [x] Add multiple options per supplier with model, manufacturer, option-name,
      notes, audit metadata and deterministic display-label contracts.
- [x] Add dossier/supplier ownership and supporting index contracts without
      speculative option uniqueness or user-managed ordering.
- [x] Add direct-edit option CRUD with dossier-revision optimistic concurrency.
- [x] Add ownership/cascade constraints and archived-dossier guards.
- [x] Define no option lock/version backend contract.
- [x] Keep option identity outside the baseline aggregate and baseline-copy flow.

### TDD and verification

- Tests for multiple options under one supplier and cross-dossier rejection.
- Tests for display labels, stale dossier revisions and cascade behavior.
- Tests for current-revision increments, archived reads and audit metadata.
- Tests proving no baseline lock/version dependency exists.
- Phase-local authorization and RPC allowlist tests.

### Exit gate

Supplier and option identity contracts can deploy without response persistence or
user-facing option workspace.

## Phase P8A3 - Baseline-Bound Option Response Contracts

**Depends on:** P4, P7A1, P8A2

**Requirements:** TC-02, TC-07, TC-09, TC-17, TC-20

**Deploy boundary:** exact-baseline response persistence only; no hook or UI

### Planned files

- Create: `supabase/migrations/20260722072748_technical_configuration_option_responses.sql`
- Create: `supabase/tests/technical_configuration_option_responses_phase_gate.sql`
- Create:
  `supabase/tests/technical_configuration_option_responses_constraints_phase_gate.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-option-responses-migration.test.ts`
- Modify: `src/lib/technical-configuration-supplier-option-rpcs.ts`
- Modify: `src/app/(app)/technical-configurations/supplier-option-types.ts`
- Modify: `src/app/(app)/technical-configurations/technical-configuration-supplier-option-rpc.ts`
- Modify: `src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify: `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`
- Modify: `openspec/changes/add-technical-configuration-comparison/p8a-tdd-plan.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`

### Tasks

- [x] Add option response datasets bound to an exact baseline version and
      criterion with ownership and cascade constraints.
- [x] Store supplementary information structurally apart from compliance and
      future manual-assessment fields.
- [x] Use dossier-revision optimistic concurrency without baseline-lock checks.
- [x] Treat an existing comparison set as a read, including after dossier
      archive; keep its revision/response snapshot writer-consistent, return
      `PT404` instead of nullable data after a concurrent cascade, and reject
      missing-set creation and response upsert for archived dossiers.
- [x] Keep historical response datasets separate when a new baseline version is
      selected; source updates preserve stable criterion linkage and audit
      metadata instead of rewriting old datasets.
- [x] Complete the mandatory DB phase gate after separate explicit live-write
      approvals for migration apply and transaction-wrapped phase-gate
      execution, followed by security and performance advisors.

### TDD and verification

- Tests for correct baseline-version/criterion binding, direct composite-FK
  enforcement and cross-owner rejection.
- Tests proving response and supplementary text are independent and that P8A3
  exposes no compliance/evaluation fields; actual compliance derivation remains
  owned by P11A and ranking remains owned by P12C1/P12C2.
- Tests for stale dossier revisions, cascade and historical dataset separation.
- Tests proving an existing set is readable after archive while create/upsert
  mutations are rejected.
- Tests proving baseline lock does not block supplier-option response editing.

### Exit gate

Secure supplier, option and exact-baseline response contracts exist, but no
user-facing supplier workspace is available.

## Phase P8A4 - Side-Effect-Free Option Response Read Contract

**Depends on:** P8A3

**Requirements:** TC-02, TC-04, TC-07, TC-09, TC-17, TC-20

**Deploy boundary:** nullable comparison-set read RPC only; no table, index, hook
or UI and no change to the existing create/upsert mutation contracts

### Planned files

- Create:
  `supabase/migrations/<ordered_timestamp>_technical_configuration_comparison_set_read.sql`
- Create:
  `supabase/tests/technical_configuration_comparison_set_read_phase_gate.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-comparison-set-read-migration.test.ts`
- Modify: `src/lib/technical-configuration-supplier-option-rpcs.ts`
- Modify: `src/app/(app)/technical-configurations/supplier-option-types.ts`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-supplier-option-rpc.ts`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify:
  `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`

### Tasks

- [ ] Add `technical_configuration_comparison_set_get(p_option_id, p_baseline_version_id)`.
- [ ] Return the exact existing comparison-set snapshot or `{ data: null }`.
- [ ] Reuse P8A3 authentication and exact option/baseline dossier-ownership guards.
- [ ] Allow archived reads while performing no insert, update, row lock, revision
      increment or audit change.
- [ ] Keep `anon` denied and grant execute only to `authenticated` and
      `service_role`.
- [ ] Keep `get_or_create` and response-upsert behavior unchanged.

### TDD and verification

- Migration-source tests for function ordering, JWT guards, fixed `search_path`,
  grants and allowlist ownership.
- SQL phase-gate tests for missing/existing pairs, exact response ordering,
  archived reads, cross-dossier rejection and zero revision/audit side effects.
- Adapter/type tests for the nullable response and no `p_expected_revision`.

### Exit gate

P8B2 can inspect existing or empty option-response state without writing to the
database. P8B1 remains independently deployable and does not depend on P8A4.

## Phase P8B1 - Supplier And Option Identity CRUD Workspace

**Depends on:** P3A, P8A2

**Requirements:** TC-04, TC-09, TC-20
**Deploy boundary:** supplier/option identity CRUD UI without baseline-bound
responses, Excel or evidence

### Planned files

- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers.tsx`
- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionEditor.tsx`
- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptions.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-supplier-option-state.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-supplier-option-operations.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-options.test.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-options-fixtures.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-options-hook-cases.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-options-workspace-cases.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-options-conflict-cases.tsx`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-beforeunload.test.tsx`

### Tasks

- [ ] Add a lightly grouped supplier/option workspace and enable the `options` tab.
- [ ] Use the label `Nhà cung cấp · Model hoặc tên phương án` in every selector,
      heading and delete confirmation.
- [ ] Add explicit create/update/delete flows for suppliers and options.
- [ ] Confirm option deletion with dependent response-dataset warning.
- [ ] Confirm supplier deletion with affected-option count and cascade warning.
- [ ] Display the selected option's latest metadata update time.
- [ ] Preserve unsaved input on validation, persistence and revision conflicts.
- [ ] Warn before leaving the option/tab/dossier while dirty and block navigation while a mutation is pending.
- [ ] Keep archived dossiers read-only and expose no supplier/option lock or version controls.
- [ ] Keep option data hooks/state/operations outside the workspace shell.

### TDD and verification

- Supplier and multiple-option create/update/delete tests.
- Delete cancel/confirm/cascade-warning, expected-revision and post-delete
  selection tests.
- Dirty navigation, beforeunload, failed save and conflict/reload preservation tests.
- Archived read-only and no-lock-control tests.
- Desktop/mobile browser verification for grouped selection, forms, long labels,
  destructive dialogs and empty/error states.

### Exit gate

Users can manage dossier-scoped suppliers and multiple option identities without
creating or reading baseline-bound response datasets.

## Phase P8B2 - Exact-Baseline Option Response Workspace

**Depends on:** P4, P8A3, P8A4, P8B1

**Requirements:** TC-04, TC-09, TC-17, TC-20  
**Deploy boundary:** manual exact-baseline response entry without Excel,
evidence, comparison or evaluation

### Planned files

- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionResponses.tsx`
- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptionResponses.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-option-response-state.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-option-response-operations.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-option-response-cases.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-option-response-conflict-cases.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers.tsx`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/supplier-options.test.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-beforeunload.test.tsx`

### Tasks

- [ ] Reuse exact baseline-version selection and load the nullable P8A4 snapshot.
- [ ] Prove option/baseline selection performs no create or revision increment.
- [ ] Add separate multiline response and supplementary-information editors with explicit save.
- [ ] On the first valid save, call get-or-create and then upsert using the returned current dossier revision.
- [ ] Display `max(option.updated_at, response.updated_at)` for the current editor context.
- [ ] Preserve the selected option, baseline, criterion and unsaved text across validation, persistence and conflict errors.
- [ ] Warn before changing option, baseline, tab or dossier while dirty.
- [ ] Keep draft and locked baselines editable, archived dossiers read-only and render no option lock/version controls.
- [ ] Keep supplementary information outside compliance/evaluation state.

### TDD and verification

- No-write-on-open, existing/null snapshot and first-save sequencing tests.
- Exact baseline/criterion ownership and separate multiline field tests.
- Dirty navigation, failed save, conflict/reload and pending-operation tests.
- Tests proving supplementary information does not alter compliance and no
  comparison/evaluation controls render.
- Desktop/mobile browser verification for 102-criterion scrolling, text fitting,
  focus order, save feedback and responsive layout.

### Exit gate

Users can manually enter and update multiple supplier options for an exact
baseline version without side effects before explicit save.

## Phase P8B3 - Focused Option Response Comparison UX

**Depends on:** P8B2<br>
**Requirements:** TC-04, TC-09, TC-17, TC-20<br>
**Detailed TDD plan:** [P8B3 - Focused Option Response Comparison UX](./p8b-tdd-plan.md#p8b3-red-green-refactor)<br>
**Deploy boundary:** desktop-focused frontend refinement for one selected
option/baseline/criterion; no new RPC, API shape, data contract, migration or
live database write

### Planned files

- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionResponsePanels.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-option-response-ux-cases.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionResponseEditor.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptionResponses.ts`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-option-response-state.ts`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/supplier-options.test.tsx`

### Tasks

- [ ] Keep the supplier selector and option identity editor in the existing
      upper region; move the exact-baseline response workspace into a full-width
      desktop region below them.
- [ ] Render a stable criterion navigator, a read-only baseline panel and an
      editable response/supplementary panel for only the selected criterion.
- [ ] Show compact criterion states for no response, persisted response and the
      current dirty draft.
- [ ] Add `Sao chép từ cấu hình cơ bản`; copy only `requirement_text` into the
      response draft, preserve supplementary information, keep the copied text
      editable and perform no mutation before explicit save.
- [ ] Require confirmation before copy replaces a non-empty response; cancel
      preserves both response and supplementary drafts exactly.
- [ ] Rename the current action to secondary `Lưu` and add primary
      `Lưu & tiếp theo`; advance only after success to the immediately following
      criterion in canonical baseline order, never skip a persisted criterion
      and render only `Lưu` on the final criterion.
- [ ] Preserve P8B2 dirty-navigation, conflict/reload, pending coordination,
      locked-baseline editability and archived read-only behavior.
- [ ] Keep bulk copy, batch save, all-criteria inline editing, matrix controls,
      mobile responsive UX and every backend/data change out of scope.

### TDD and verification

- Pure state tests for criterion status, copy semantics and canonical next-item
  selection.
- React tests for the full-width desktop layout and exact selected-criterion
  binding.
- Copy/confirm/cancel tests proving supplementary preservation, editable dirty
  state and zero mutation before explicit save.
- Save/save-next success, final-criterion, validation, persistence and conflict
  tests.
- Regression tests for locked/archived states, dirty navigation and existing
  P8B2 operation coordination.
- Desktop browser screenshots and interaction checks only; no mobile responsive
  acceptance belongs to P8B3.

### Exit gate

Users can compare one selected baseline criterion directly against one editable
supplier response, copy the baseline requirement deliberately and move through
criteria in canonical order without introducing a matrix or changing persistence
contracts.

## Phase P9A1 - Supplier Option Workbook Codec

**Depends on:** P5A, P8B2<br>
**Requirements:** TC-10<br>
**Detailed TDD plan:** [P9A1 - Supplier Option Workbook Codec](./p9-tdd-plan.md#p9a1---supplier-option-workbook-codec)<br>
**Deploy boundary:** dormant option workbook contract and codec only

### Planned files

- Create: `src/lib/technical-configuration-option-excel-contract.ts`
- Create: `src/lib/technical-configuration-option-excel-export.ts`
- Create: `src/lib/technical-configuration-option-excel-parse.ts`
- Create: `src/lib/__tests__/technical-configuration-option-excel.test.ts`

### Tasks

- [ ] Freeze workbook v1 with exactly one visible option-response sheet, one
      hidden `_meta` sheet and no extra sheet or content column.
- [ ] Generate from the selected option and exact baseline version while
      preserving criterion IDs/codes, group labels and requirement text as
      read-only context.
- [ ] Require every baseline criterion exactly once. Reject missing, unknown or
      duplicate criteria instead of treating a removed row as a clear command.
- [ ] Canonicalize blank response and supplementary cells to empty strings so a
      confirmed import explicitly clears prior values.
- [ ] Reject arbitrary, metadata-less, wrong-option, wrong-baseline,
      wrong-version and malformed workbooks.
- [ ] Keep URL documents, citations, assessments and option identity outside the
      workbook.
- [ ] Reuse P5A workbook loading/creation, worksheet conversion and Blob
      primitives without changing Equipment or baseline codec behavior.

### TDD and verification

- Exact sheet, column and metadata tests.
- Vietnamese/multiline export-parse round trips.
- Blank-cell clear canonicalization and complete-criterion-set tests.
- Missing/unknown/duplicate criterion, wrong target, extra sheet/column and
  unsupported-cell tests.
- Equipment and baseline Excel regression tests plus semantic dedup review.

### Exit gate

The exact option workbook v1 contract round-trips deterministically and remains
dormant: no RPC, migration or user-visible import action exists.

## Phase P9A2 - Atomic Supplier Option Import Contracts

**Depends on:** P8A4, P9A1<br>
**Requirements:** TC-02, TC-10, TC-20<br>
**Detailed TDD plan:** [P9A2 - Atomic Supplier Option Import Contracts](./p9-tdd-plan.md#p9a2---atomic-supplier-option-import-contracts)<br>
**Deploy boundary:** dormant authoritative preview/apply RPCs only

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_option_import.sql`
- Create: `supabase/tests/technical_configuration_option_import_phase_gate.sql`
- Create: `src/app/api/rpc/__tests__/technical-configuration-option-import-migration.test.ts`
- Create: `src/app/(app)/technical-configurations/technical-configuration-option-import-rpc.ts`
- Modify: `src/lib/technical-configuration-supplier-option-rpcs.ts`
- Modify: `src/app/(app)/technical-configurations/supplier-option-types.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify: `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`

### Tasks

- [ ] Add preview/apply RPCs that share one authoritative server-side
      validator/normalizer for an exact option + baseline pair.
- [ ] Accept the P9A1 metadata/canonical rows plus `p_expected_revision`, using
      the dossier revision rather than inventing an option-response revision.
- [ ] Keep preview side-effect-free: no comparison set, response or audit write
      and no revision increment.
- [ ] Let confirmed apply create the comparison set inside the same transaction
      when it does not exist.
- [ ] Reconcile the complete criterion response snapshot, including deleting
      prior text through canonical empty strings, and increment revision exactly
      once for the whole apply.
- [ ] Revalidate under the established dossier lock order and reject stale,
      archived, mismatched, malformed or tampered requests with zero partial
      writes.
- [ ] Leave option identity, baseline/reference data, URL evidence, citations
      and assessments unchanged.
- [ ] Add exact RPC names, wire types, wrappers and allowlist entries without
      activating UI.

### TDD and verification

- Migration/source tests for signatures, `SECURITY DEFINER`, `search_path`,
  grants and allowlist entries.
- Role/claim, exact owner/version and archived-dossier tests.
- Preview no-write/no-revision/no-comparison-set tests.
- Complete-set, blank-clear, missing/unknown/duplicate criterion and
  metadata/tamper rejection tests.
- Apply success tests proving optional comparison-set creation, full
  reconciliation and one revision increment.
- Failure injection and stale-revision tests proving total rollback.
- Apply through Supabase MCP only after explicit permission; then run the phase
  gate and security/performance advisors.

### Exit gate

Authoritative option import preview/apply contracts are deployed and verified
but unused by the application; preview is read-only and apply is one atomic
full-snapshot mutation.

## Phase P9A3 - Supplier Option Import Workspace

**Depends on:** P8B3, P9A2<br>
**Requirements:** TC-04, TC-10, TC-20<br>
**Detailed TDD plan:** [P9A3 - Supplier Option Import Workspace](./p9-tdd-plan.md#p9a3---supplier-option-import-workspace)<br>
**Deploy boundary:** option template download and import UI only

### Planned files

- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptionImport.ts`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionImportDialog.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionImportPreview.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/option-import.test.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/use-technical-configuration-option-import.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionResponses.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers.tsx`

### Tasks

- [ ] Add template download/import actions to the header of the P8B3 full-width
      exact-baseline response workspace, not the option identity editor or the
      baseline/response panels.
- [ ] Wire download through P9A1 and P5A Blob primitives; use
      `useBulkImportState` and shared bulk-import dialog parts.
- [ ] Parse locally, request authoritative preview and require explicit
      confirmation before calling the P9A2 apply RPC.
- [ ] Preserve selected file, canonical rows and preview when apply rejects a
      stale dossier revision; refresh revision without discarding input.
- [ ] Adopt the returned complete comparison snapshot and synchronize
      option-response and dossier/detail caches after success.
- [ ] Propagate import pending/dirty state through the existing external
      mutation-blocking contract so identity, response and navigation actions
      cannot race.
- [ ] Keep option import editable against draft or locked baselines and
      read-only only when the dossier is archived.
- [ ] Keep import file/rows/preview/errors transient and evidence outside the
      workbook.
- [ ] Preserve the P8B3 selected-criterion layout, copy confirmation, status
      indicators and save/save-next ownership; import does not add matrix or
      inline editing behavior.

### TDD and verification

- Template download delegation and exact target metadata tests.
- Full-snapshot preview tests proving blank cells clear and missing rows reject.
- No mutation before confirmation and one apply call after confirmation.
- Stale-conflict preservation and refreshed-revision retry tests.
- Success snapshot/cache adoption and pending-state coordination tests.
- Draft/locked baseline editability, archived read-only and dirty navigation
  tests.
- Focused option-response, supplier coordination, shared import, file-size and
  React Doctor gates.

### Exit gate

Supplier option responses can be entered manually or imported through the exact
system template with authoritative preview, full-snapshot semantics and
conflict-safe retry.

## Phase P9B1 - Supplier Option Evidence Contracts

**Depends on:** P7B1, P8A4, P9A3<br>
**Requirements:** TC-02, TC-11, TC-12, TC-20<br>
**Detailed TDD plan:** [P9B1 - Supplier Option Evidence Contracts](./p9-tdd-plan.md#p9b1---supplier-option-evidence-contracts)<br>
**Deploy boundary:** dormant option-document/citation schema and RPCs only

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_option_evidence.sql`
- Create: `supabase/tests/technical_configuration_option_documents_phase_gate.sql`
- Create: `src/app/api/rpc/__tests__/technical-configuration-option-documents-migration.test.ts`
- Modify: `src/lib/technical-configuration-document-rpcs.ts`
- Modify: `src/app/(app)/technical-configurations/document-types.ts`
- Modify: `src/app/(app)/technical-configurations/technical-configuration-document-rpc.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify: `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`

### Tasks

- [ ] Add option-level URL document metadata and citation rows constrained
      through the matching option/baseline comparison set and criterion.
- [ ] Keep one document reusable across baseline versions for the same option;
      citations remain exact-baseline and exact-criterion.
- [ ] Add a side-effect-free option + baseline list RPC that returns shared
      documents, citations for the exact comparison set when present and each
      document's total affected citation count across all baselines.
- [ ] Add document create/update/delete and citation upsert/delete RPCs using
      dossier revision and the existing global/raw-admin authorization helpers.
- [ ] Reuse the P7B1 authoritative HTTP(S) validator only in option document
      create/update, increasing its exact caller set from four to six.
- [ ] Permit mutations when the selected baseline is locked because option
      evidence is outside the baseline aggregate; reject archived dossiers.
- [ ] Cascade confirmed document deletion through every linked option citation
      in one transaction.
- [ ] Add RPC types/wrappers/allowlist entries without creating a UI consumer.

### TDD and verification

- Migration/source tests for two tables, composite ownership/version FKs,
  indexes, RLS, grants, six RPCs and allowlist entries.
- Role/claim, archived/readable, locked-baseline editable and stale dossier
  revision tests.
- Side-effect-free list, option-global document reuse, exact-set citation scope
  and cross-option/version rejection tests.
- Raw URL rejection/acceptance/equality tests and
  `pg_get_functiondef` exact-six-caller assertions.
- Affected-count, confirmed cascade and rollback tests across more than one
  baseline comparison set.
- Rerun the P7B1 SQL phase gate.
- Apply through Supabase MCP only after explicit permission; then run the phase
  gate and security/performance advisors.

### Exit gate

Option evidence persistence is deployed, denied for direct client table access
and fully verified, but no option evidence UI exists.

## Phase P9B2 - Supplier Option Evidence Workspace

**Depends on:** P6B, P7B2, P8B2, P9B1<br>
**Requirements:** TC-04, TC-11, TC-12, TC-20<br>
**Detailed TDD plan:** [P9B2 - Supplier Option Evidence Workspace](./p9-tdd-plan.md#p9b2---supplier-option-evidence-workspace)<br>
**Deploy boundary:** option URL evidence UI only

### Planned files

- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptionDocuments.ts`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionDocuments.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/option-evidence.test.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/option-evidence-delegation.test.tsx`
- Modify: `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionResponseEditor.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers.tsx`
- Modify: `src/components/url-documents/__tests__/url-document-source-contract.test.ts`
- Modify: `src/app/(app)/technical-configurations/__tests__/baseline-evidence.test.tsx`

### Tasks

- [ ] Add an option-specific evidence hook instead of adding option branches to
      the existing baseline/reference document hook.
- [ ] Compose the P6B-proven form/list primitives and the P7B2-proven
      owner-neutral citation editor without adding option-specific branches to
      the already-large citation editor.
- [ ] Keep list/open side-effect-free. On the first explicit citation save,
      follow the established comparison-set get-or-create revision chain before
      the citation upsert.
- [ ] Preserve unsaved document/citation edits on stale conflicts and propagate
      evidence pending/dirty state to identity/response mutation blockers and
      navigation guards.
- [ ] Show the total affected citation count across all baselines before a
      confirmed option-document delete.
- [ ] Keep evidence editable against locked baselines and read-only for archived
      dossiers.
- [ ] Extend the cumulative URL consumer source contract to exactly Equipment +
      baseline + option with active primitive/utility delegation.
- [ ] Rerun baseline/reference evidence SQL and React suites with the option
      suites before completing normative TC-11/TC-12 ownership.

### TDD and verification

- Option-global document reuse and exact-baseline citation render tests.
- One option document linked independently to multiple criteria without
  duplicating the document record.
- URL validation and exact raw create/update/list/render behavior.
- First-citation get-or-create revision-chain tests with no write on open.
- Dirty state, stale conflict preservation, pending coordination and archived
  read-only tests.
- Multi-baseline affected-count confirmation and delete retry tests.
- Cumulative Equipment + baseline + option source-contract and mocked runtime
  delegation tests.
- Rerun `technical_configuration_baseline_documents_phase_gate.sql`,
  `baseline-evidence.test.tsx` and all shared URL primitive suites.
- Mark TC-11-S01..S05 and TC-12-S01/S02 complete only after
  baseline/reference and option cases pass together.

### Exit gate

Baseline, reference-product and supplier-option cases all pass
TC-11-S01..S05 and TC-12-S01/S02; option documents are reusable across
baselines, citations remain exact-set scoped and P10A1 may begin.

## Phase P10A1 - Comparison Matrix Read RPC And Performance Contract

**Depends on:** P7B2, P9B2<br>
**Requirements:** TC-02, TC-13, TC-17<br>
**Detailed TDD plan:** [P10A1 - Comparison Matrix Read RPC And Performance Contract](./p10-tdd-plan.md#p10a1---comparison-matrix-read-rpc-and-performance-contract)<br>
**Deploy boundary:** dormant bounded database read contract only; no proxy,
client hook or matrix UI

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_comparison_reads.sql`
- Optionally create after live plan evidence:
  `supabase/migrations/<later_ordered_timestamp>_technical_configuration_comparison_indexes.sql`
- Create: `src/app/api/rpc/__tests__/technical-configuration-comparison-migration.test.ts`
- Create: `supabase/tests/technical_configuration_comparison_phase_gate.sql`

### Tasks

- [ ] Add `technical_configuration_comparison_get` as one set-based,
      side-effect-free RPC for one baseline version and 1-8 ordered option IDs.
- [ ] Authenticate raw `admin`/`global`, fail closed on missing claims and
      validate baseline, options, suppliers and comparison sets against the
      same dossier without exposing an ownership oracle.
- [ ] Page baseline criteria before aggregating exact baseline and
      selected-option responses/evidence summaries.
- [ ] Reject null, duplicate, zero or more than eight option IDs, preserve
      request order through ordinality and return at most 100 criteria per page.
- [ ] Keep `supplementary_information` separate from response/compliance and
      return fixed-size `document_count`/`citation_count`/`has_evidence`
      summaries only; full evidence remains on existing bounded document RPCs
      and reference-product data remains on P7 surfaces.
- [ ] Preserve archived-dossier and locked-baseline reads without creating
      comparison sets, incrementing revision or changing audit metadata.
- [ ] Add explicit grants/revokes, mandatory `search_path` and only indexes
      justified by inner-query `EXPLAIN`; a proven follow-up index migration
      remains inside P10A1 and blocks P10A2 until gated.
- [ ] Add migration source tests and a rollback-only SQL phase gate for 500
      criteria, 50 total options and 8 selected options.

### TDD and verification

- Migration source-contract tests for exact nested/error schema, claims,
  ownership, null/bound checks, grants, search path, no `SELECT *`, no side
  effects and the 450-line migration ceiling.
- Rollback-only SQL tests for exact-scope aggregation, archived/locked reads,
  option order, duplicate rejection, option-nine and 100-criterion boundaries.
- Representative `EXPLAIN` review with 500 criteria, 50 total options and 8 selected options.
- Explicit permission before migration apply and separate explicit permission
  before live rollback-only phase-gate execution.
- Security and performance advisors after an explicitly approved live apply.

### Exit gate

The applied database contract can return bounded, ordered and exact-scope
comparison summaries without exposing a proxy/client consumer or matrix UI.

## Phase P10A2 - Comparison Read Client Contract

**Depends on:** P10A1 merged, applied and DB-gated<br>
**Requirements:** TC-13, TC-17<br>
**Detailed TDD plan:** [P10A2 - Comparison Read Client Contract](./p10-tdd-plan.md#p10a2---comparison-read-client-contract)<br>
**Deploy boundary:** dormant typed client/proxy contract only; no matrix UI

### Planned files

- Create: `src/lib/technical-configuration-comparison-rpcs.ts`
- Create: `src/app/(app)/technical-configurations/comparison-types.ts`
- Create: `src/app/(app)/technical-configurations/technical-configuration-comparison-rpc.ts`
- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationComparison.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/comparison-contract.test.ts`
- Modify: `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify: `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`

### Tasks

- [ ] Add the RPC-name manifest and append the comparison read RPC to the proxy
      allowlist without changing shared RPC transport behavior.
- [ ] Define wire/domain types and one typed adapter for the fixed P10A1
      request/response contract.
- [ ] Add a query key containing baseline version, ordered option IDs, page and
      page size; snapshot the IDs and do not sort or deduplicate them in the key.
- [ ] Add `useTechnicalConfigurationComparison` with exact enablement,
      `AbortSignal` forwarding, `staleTime: 30_000`, `retry: false` and
      `refetchOnWindowFocus: false`.
- [ ] Add source/contract tests for RPC name, allowlist, arguments, wire shape,
      option-order-sensitive key, one-call behavior and disabled states.
- [ ] Rerun P10A1 source contracts without changing the migration, SQL phase
      gate or database ownership.

### TDD and verification

- RPC-name/allowlist source tests fail before proxy exposure.
- Adapter tests prove exact arguments, typed normalization and one RPC call.
- Hook tests prove immutable ordered query keys, disabled states, abort
  forwarding, `staleTime: 30_000`, `retry: false` and
  `refetchOnWindowFocus: false`.
- Mandatory TypeScript/React gates and focused contract tests.
- P10A1 migration source tests rerun as an upstream regression gate.

### Exit gate

The stable P10A1 RPC is exposed through a typed, bounded and dormant client
contract. No P8/P9 consumer changes behavior, and P10B1 may begin.

P10B delivery follows the detailed
[P10B TDD plan](./p10b-tdd-plan.md) and lands as three sequential, deploy-safe
UI leaves. Browser screenshot/interaction verification is intentionally
deferred to P13B by explicit product-owner direction; every P10B leaf still
owns focused React, keyboard, responsive-source and read-only ownership gates.

## Phase P10B1 - Core Read-Only Comparison Matrix

**Depends on:** P3A, P10A2

**Requirements:** TC-13-S01, TC-13-S02 core-dimension/text portion, TC-17-S01;
regression for TC-17-S02

**Deploy boundary:** useful read-only baseline/option scan and text inspection;
column ergonomics and evidence documents remain deferred

### Planned files

- Create: `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationComparisonTab.tsx`
- Create: `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationMatrix.tsx`
- Create: `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationMatrixToolbar.tsx`
- Create: `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationCriterionPanel.tsx`
- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationComparisonMatrix.ts`
- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptionListQuery.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/comparison-matrix-core.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptions.ts`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`

### Tasks

- [ ] Add baseline-version selection and ordered selected-option controls with a
      maximum of eight options; add appends, removal preserves remaining order
      and no code sorts option IDs.
- [ ] Reuse one shared read-only option-list query seam without changing P8
      supplier/option draft or mutation behavior.
- [ ] Add criterion paging with a fixed default page size of 50, reset page one
      after baseline/selection changes and keep every request within P10A limits.
- [ ] Render ordered group/criterion rows, a sticky baseline and stable option
      columns labeled `Nhà cung cấp · Model hoặc tên phương án`.
- [ ] Add bounded horizontal scrolling, concise read-only cells and a text-only
      detail panel for full requirement, response and supplementary information.
- [ ] Keep matrix state/data hooks outside the workspace shell and enable the
      comparison tab only when the complete P10B1 surface is mounted.
- [ ] Render no response editor, copy control, dirty draft, save command,
      assessment persistence, ranking or derived compliance.

### TDD and verification

- Ordered selection, maximum-eight, page reset and disabled-query tests.
- Ordered-row, sticky-baseline, long-text, empty-response and paging tests.
- Loading, error, no-selection and empty-page tests.
- Ownership tests proving the toolbar, cells and text detail remain read-only.
- Existing P8 supplier/option query and authoring regressions after shared query
  extraction.
- Responsive class/source assertions and keyboard/focus React tests; no browser
  test in this leaf.
- React Doctor after focused tests pass.

### Exit gate

Users can select ordered options, page through criteria, scan the baseline and
option responses, and inspect full text without duplicating P8B3 authoring.

## Phase P10B2 - Many-Option Column Ergonomics

**Depends on:** P10B1

**Requirements:** TC-13-S03

**Deploy boundary:** view-only column visibility, pinning and focus controls on
the already useful P10B1 matrix

### Planned files

- Create: `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationMatrixColumnControls.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/comparison-matrix-columns.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationMatrix.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationMatrixToolbar.tsx`
- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationComparisonMatrix.ts`

### Tasks

- [ ] Keep request membership/order in `selectedOptionIds` and view-only
      visibility in a separate ordered subset that never changes the query key.
- [ ] Keep the baseline permanently sticky and allow at most two visible option
      columns to be pinned in selected-option order.
- [ ] Add focus mode showing baseline plus one option without mutating selected,
      visible or pinned state; exiting restores the prior view.
- [ ] Preserve stable widths/sticky offsets and complete horizontal access with
      eight selected options at narrow and wide layout constraints.
- [ ] Add keyboard-operable visibility, pin and focus controls with deterministic
      focus restoration.

### TDD and verification

- View-state reducer tests proving selection and query order never change.
- Pin-limit, sticky-offset and focus-mode restoration tests.
- Keyboard/focus, narrow-layout and many-column React tests.
- Source/file-size checks for matrix, toolbar and state hook.
- No browser test in this leaf; P13B remains the browser regression owner.
- React Doctor after focused tests pass.

### Exit gate

Users can reach, hide, pin and focus selected option columns without changing
comparison request membership or order.

## Phase P10B3 - Lazy Read-Only Evidence Inspector

**Depends on:** P10B2

**Requirements:** TC-13-S02/S05 evidence-inspection portions; rerun
TC-13-S01/S03 and TC-17-S01/S02

**Deploy boundary:** one active comparison detail lazily loads existing bounded
baseline/option evidence reads; no evidence authoring or assessment data

### Planned files

- Create: `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationComparisonEvidence.tsx`
- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationComparisonEvidence.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/comparison-matrix-evidence.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationCriterionPanel.tsx`

### Tasks

- [ ] Extend the text detail panel with read-only documents, excerpts and
      criterion citations for exactly one open baseline or option cell.
- [ ] Do not issue an evidence request before the panel opens or when the fixed
      evidence summary reports no evidence.
- [ ] Reuse existing P7 baseline and P9 exact-baseline option document RPC
      wrappers/query keys with bounded page/load-more behavior.
- [ ] Keep baseline, option and reference-product ownership distinct; never
      aggregate reference-product evidence into the matrix.
- [ ] Restore focus to the opening cell and render loading, error, no-evidence
      and long-excerpt states without mutation controls.
- [ ] Do not invent assessment fields from TC-13-S05 wording; manual evaluation
      remains owned by P11A-P11D/P12.

### TDD and verification

- Lazy enablement tests for closed panel, no-evidence summary and one active
  baseline/option detail.
- Exact RPC/query-key, bounded pagination and criterion-citation filtering tests.
- Read-only ownership tests proving no create/update/delete/save controls render.
- Existing P7/P9 document contract and evidence regression suites.
- Keyboard/focus and responsive React tests; no browser test in this leaf.
- React Doctor after focused tests pass.

### Exit gate

Users can inspect full text and lazily loaded evidence for one matrix cell
without N+1 fetching, evidence authoring or manual assessment persistence.

## Phase P11A - Manual Evaluation Domain Contract

**Depends on:** P4, P8A3

**Requirements:** TC-15, TC-16, TC-19
**Deploy boundary:** pure domain contract with no database, RPC, hook or UI behavior

### Planned files

- Create: `src/lib/technical-configuration-evaluation.ts`
- Create: `src/lib/__tests__/technical-configuration-evaluation.test.ts`

### Tasks

- [ ] Define stable ASCII values for both axes and every derived status, with
      Vietnamese display labels kept outside the persisted/domain values.
- [ ] Implement one pure derived-status function as the application source of
      truth; the derived status is never a directly editable or persisted input.
- [ ] Map a missing technical axis to `not_evaluated`.
- [ ] Map a missing evidence axis to `not_evaluated` when the technical axis is
      `meets` or `exceeds`.
- [ ] Cover every precedence row, both missing-axis paths and invalid values.
- [ ] Add no database, RPC, React hook, UI or machine-result contract.

### TDD and verification

- Exhaustive table-driven tests for canonical values, labels and every mapping
  row.
- Missing technical-axis and missing evidence-axis regression tests.
- Source audit proving the leaf adds no persistence, RPC or AI runtime artifact.

### Exit gate

The canonical manual-evaluation values and deterministic derived-status
function are frozen through exhaustive tests without changing runtime behavior.

## Phase P11B - Manual Assessment Persistence And Security

**Depends on:** P11A

**Requirements:** TC-02, TC-15, TC-18-S06 persistence prerequisite, TC-19, TC-20
**Deploy boundary:** dormant database capability with no proxy/client exposure

### Planned files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_manual_assessments.sql`
- Create: `supabase/tests/technical_configuration_manual_assessments_phase_gate.sql`
- Create: `src/app/api/rpc/__tests__/technical-configuration-manual-assessments-migration.test.ts`

### Tasks

- [ ] Add manual-assessment persistence unique by comparison set and criterion,
      preserving exact option/baseline/criterion ownership through composite
      foreign keys.
- [ ] Persist only the two canonical axes and notes; do not persist a writable
      derived status or any machine-result/staleness field.
- [ ] Give each assessment row its own `revision BIGINT`; source-response,
      supplementary-information and document updates do not increment that row
      revision or cause an assessment conflict.
- [ ] Treat `updated_by` and `updated_at` as the latest evaluator metadata; do
      not add duplicate evaluator columns.
- [ ] Freeze and implement the exact bounded-list/upsert arguments, nullability,
      wire fields, ordering and first-create revision semantics defined in
      `contracts.md`.
- [ ] Validate JWT role/user claims, normalize `admin` to `global`, reject
      non-global roles fail-closed and reject mutations for archived dossiers.
- [ ] Keep the table RPC-only with deny-by-default RLS and explicit grants.
- [ ] Preserve manual conclusions when supplier source data changes and prove
      no automatic delete, mutation or stale marker occurs.
- [ ] Complete the mandatory DB phase gate, including migration ordering,
      role/claim, ownership, archive, conflict, cascade, grant/RLS and no-AI
      checks.

### TDD and verification

- Migration source tests freezing table constraints, RPC signatures, guards,
  row-level revision behavior and deterministic wire fields.
- Rollback-only SQL phase gate for authorization, exact ownership, current and
  stale revisions, source-update preservation, cascades and direct privileges.
- Obtain explicit permission to apply the exact migration through Supabase MCP.
- After apply, run read-only security and performance advisors.
- Obtain a separate explicit permission to execute the rollback-only SQL phase
  gate through Supabase MCP.
- After the gate, confirm rollback/fixture cleanup and rerun read-only advisors.

### Exit gate

Manual assessments can be stored and read through applied, guarded and tested
database contracts, but no application proxy or client can call them yet.

## Phase P11C - Manual Assessment Client Contract

**Depends on:** P8A4, P8B2, P11B merged/applied/gated

**Requirements:** TC-15, TC-19, TC-20
**Deploy boundary:** typed proxy/client capability with no production assessment UI

### Planned files

- Create: `src/lib/technical-configuration-assessment-rpcs.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-assessment-rpc-whitelist.test.ts`
- Create: `src/app/(app)/technical-configurations/assessment-types.ts`
- Create: `src/app/(app)/technical-configurations/technical-configuration-assessment-rpc.ts`
- Modify: `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationAssessments.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/assessment-contract.test.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/assessment-hook-contract.test.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/assessment-test-fixtures.ts`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`

### Tasks

- [ ] Freeze exactly the P11B list/upsert RPC names in a dedicated manifest and
      allowlist them only after the database contract is applied and gated.
- [ ] Add typed wire/request contracts that preserve canonical ASCII values,
      notes, audit metadata and row revisions without remapping derived status.
- [ ] Reuse the P8A4 nullable comparison-set read and the P8B2
      no-write-on-open/first-save orchestration over P8A3 get-or-create; P11C
      must not introduce a second comparison-set mutation path and concurrent
      first saves must share one in-flight comparison-set acquisition.
- [ ] Add a bounded assessment query key and a dedicated hook outside the
      workspace shell; successful writes invalidate every bounded page for the
      affected comparison set.
- [ ] Preserve validation, authorization and stale-revision errors for P11D
      and P12A1;
      do not add navigation, dirty-draft handling or save controls.
- [ ] Add no production UI, ranking or AI runtime artifact.

### TDD and verification

- RPC-manifest and proxy allowlist contract tests.
- Wire-shape, exact-argument, bounded-list and stale-revision adapter tests.
- Hook query/mutation/cache tests without rendering assessment controls.
- React Doctor after focused tests pass.

### Exit gate

The applied P11B contract is available through a typed, tested client surface,
while the production UI remains unchanged through P11D and P12A1; P12A2 owns
activation.

## Phase P11D - Complete Manual Assessment Collection

**Depends on:** P7B2, P11C

**Requirements:** TC-14, TC-15, TC-20 prerequisite completion

**Deploy boundary:** complete assessment read model; no database, proxy or
production UI change

### Planned files

- Modify:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationAssessments.ts`
- Reuse or minimally generalize:
  `src/app/(app)/technical-configurations/technical-configuration-pagination.ts`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/assessment-hook-contract.test.ts`
- Modify or create focused pagination tests only when the shared collector
  contract requires additional coverage.

### Tasks

- [ ] Add a complete-collection query path under the existing assessment query
      prefix; keep the bounded single-page P11C query available for its current
      contract tests.
- [ ] Collect stable bounded pages through the existing
      `technical_configuration_assessments_list` RPC and
      `collectStableTechnicalConfigurationPages()`; do not add a second RPC,
      proxy entry or persistence path.
- [ ] Reconcile the complete result by `criterion_id`; never assume assessment
      page N aligns with criterion page N because assessment rows are sparse.
- [ ] Preserve `AbortSignal`, exact wire values, typed errors, no-write-on-open
      behavior and the existing comparison-set acquisition contract.
- [ ] Guard against duplicate or incomplete pages and terminate deterministically
      for zero rows, sparse rows and more than one hundred rows.
- [ ] Keep successful-mutation invalidation under the existing assessment
      prefix so every bounded and complete-collection query becomes stale.
- [ ] Add no database migration, RPC/proxy change, UI, derived-status rendering,
      dirty state, navigation, ranking or AI runtime artifact.

### TDD and verification

- RED tests for zero rows, sparse rows, more than one hundred rows and an
  assessment located on a different assessment page than its criterion page.
- Duplicate/incomplete-page protection, abort propagation and exact-error tests.
- Prefix invalidation and no-write-on-mount regressions.
- Existing P11C manifest, wire, adapter, hook and mutation tests.
- Standard TypeScript/React quality-gate order and React Doctor.

### Exit gate

P12A1 can obtain one complete assessment map for a comparison set, keyed by
`criterion_id`, without assuming assessment-page and criterion-page alignment.

## Phase P12A1 - Evaluation Core And Shared Composition

**Depends on:** P10B3, P11D

**Requirements:** TC-04 core, TC-13-S02/S05 composition prerequisite, TC-14
core, TC-15, TC-16, TC-17, TC-20

**Deploy boundary:** dormant, tested evaluation core; production UI unchanged

### Planned files

- Create:
  `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationCriterionList.tsx`
- Create:
  `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationPanel.tsx`
- Create:
  `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationAssessmentControls.tsx`
- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationEvaluationDraft.ts`
- Create if pure state transitions need a separate owner:
  `src/app/(app)/technical-configurations/technical-configuration-evaluation-state.ts`
- Modify:
  `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationCriterionPanel.tsx`
  only to add the minimum typed composition slot.
- Create focused core/state/composition tests and fixtures.

### Tasks

- [x] Add a criterion list in canonical group/order with only a simple current
      derived-status badge; counters/summaries remain P12B1 and filters remain
      P12B2.
- [x] Make `TechnicalConfigurationEvaluationPanel` a thin wrapper around the
      shared `TechnicalConfigurationCriterionPanel` for baseline, response,
      supplementary information and evidence.
- [x] Compose notes and both manual axes through
      `TechnicalConfigurationAssessmentControls`; reuse P11A values, labels and
      `deriveTechnicalConfigurationEvaluationStatus()` as the only source of
      truth.
- [x] Add pure/local draft state and a core save command that adopts the saved
      assessment row revision and returned comparison-set revision.
- [x] Preserve the current criterion and local input on validation,
      authorization, conflict or persistence failure.
- [x] Adopt the saved assessment locally without adding a second comparison,
      assessment or evidence fetch path.
- [x] Keep every component and hook dormant; do not mount them in the comparison
      tab or workspace shell in this leaf.
- [x] Add no progress summaries, counters, filters, ranking or AI controls.

### TDD and verification

- Composition tests proving the shared detail/evidence renderer is used once.
- Axis value/label and derived-status source-of-truth tests.
- Draft transition tests for save success, row-revision adoption and every
  failure class.
- Source response/supplementary/evidence changes must not silently rewrite the
  saved manual assessment.
- Existing P10B3 and P11D regressions.
- Standard TypeScript/React quality-gate order and React Doctor.

### Exit gate

The dormant evaluation core can render and save one criterion safely through
shared composition, but no new production workflow is reachable.

## Phase P12A2 - Guarded Navigation And Workspace Activation

**Depends on:** P12A1

**Requirements:** TC-04, TC-13-S02/S05 completion, TC-14, TC-15, TC-16,
TC-17, TC-20

**Deploy boundary:** saveable manual assessment workspace; progress, filters and
ranking deferred

### Planned files

- Create:
  `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationWorkspace.tsx`
- Create:
  `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationActiveWorkspace.tsx`
- Create shared P10B/P12A2 seams:
  `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationCriterionPagination.tsx`,
  `src/app/(app)/technical-configurations/_components/comparison/technical-configuration-criterion-detail.ts`
  and
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationGuardedNavigation.tsx`.
- Modify:
  `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationComparisonTab.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`
- Modify P10B matrix composition only to consume the shared criterion pagination
  and option-detail builder.
- Modify P12A1 components/hooks only where activation or navigation contracts
  require it.
- Create focused workflow, navigation and shell-integration tests using
  `@testing-library/user-event`.

### Tasks

- [x] Activate evaluation as an internal `Ma trận` / `Đánh giá` segmented mode
      inside the existing `So sánh & đánh giá` tab; do not add a sixth
      top-level tab.
- [x] Add one independent option selector and reuse the existing canonical
      criterion page controls; do not add a toolbar or duplicate option actions.
- [x] Expose only the two primary assessment commands: `Lưu` and
      `Lưu & tiếp tục`.
- [x] Keep `Lưu` on the current criterion. Advance only after
      `Lưu & tiếp tục` succeeds, including across canonical page boundaries;
      keep the final criterion selected.
- [x] Use one navigation contract for option, criterion, page, internal mode,
      top-level tab and dossier/back changes: pending mutation hard-blocks;
      dirty idle state asks for confirm-discard; cancel keeps the draft.
- [x] Add the existing before-unload guard without creating persistent
      multi-criterion drafts.
- [x] Propagate comparison-set revision to the existing workspace revision seam
      only when first acquisition changes that aggregate; keep assessment row
      revision local to assessment state.
- [x] Keep evaluation state/data hooks outside the workspace shell.
- [x] Add no progress summaries, counters, filters, ranking or AI controls.

### TDD and verification

- `Lưu`, successful `Lưu & tiếp tục`, cross-page advance and final-criterion tests.
- Dirty cancel/confirm tests across option, criterion, page, internal mode,
  top-level tab and dossier/back navigation.
- Pending-mutation hard-block and before-unload tests.
- Validation, authorization, conflict and persistence failures preserve the
  selected criterion and local input.
- Comparison-tab and workspace-shell integration tests.
- Existing P10B3, P11D and P12A1 regressions.
- Standard TypeScript/React quality-gate order and React Doctor.
- Focused `@testing-library/user-event` journeys for select, inspect, edit,
  save, save-next and dirty-cancel behavior.
- Defer all real-browser, desktop/mobile screenshot, interaction,
  accessibility and the canonical full regression matrix to P13B; retain
  focused P10B3/P11D/P12A1 regressions in P12A2.
- Implementation evidence on 2026-07-30: 16 focused Vitest files / 135 tests
  pass across P10B, P11D, P12A1 and P12A2; React Doctor reports 100/100.

### Exit gate

Users can evaluate and save one option criterion at a time without accidental
draft loss, including deterministic save-next across page boundaries.

## Phase P12B1 - Selected-Option Progress Foundation

**Depends on:** P12A2

**Requirements:** TC-04, TC-14, TC-16

**Deploy boundary:** correct selected-option progress; existing navigation unchanged

### Entry gate

- Progress is contractually scoped to the currently selected option. An
  all-option summary requires a separate data-contract discovery leaf and is
  not part of P12B1.
- Product owner confirms group-summary density before implementation.
  Recommended default: compact `đã đánh giá / tổng` only, without seven-status
  breakdown, percentage or progress-card grid.

### Planned files

- Create: `src/app/(app)/technical-configurations/_components/evaluation/technical-configuration-evaluation-progress.ts`
- Create: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationProgressSummary.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-progress.test.ts`
- Modify: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationWorkspace.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationActiveWorkspace.tsx`
- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationAssessments.ts`
- Modify: focused assessment-hook, evaluation-workspace and test-support files

### Tasks

- [x] Start RED with a pure progress-model matrix covering zero/sparse/>100
      assessments, every derived status, repeated/mixed status distributions,
      exact group/option reconciliation and selected-option changes.
- [x] Build one immutable progress model from
      `useTechnicalConfigurationBaselineVersionSelection().selectedVersion`,
      whose `TechnicalConfigurationBaselineDraftWire.groups[].criteria[]`
      contains the complete ordered criterion universe for one locked version,
      and the selected option's complete assessment collection. Reconcile only
      by `criterion_id`; baseline-history pagination is across versions, not
      criteria.
- [x] Count only `not_evaluated` as incomplete; expose option totals, evaluated
      totals, canonical status counters and compact group totals without adding
      filter or navigation state.
- [x] Render loading/error/no-comparison-set states without false
      all-unassessed counters.
- [x] Adopt a successful mutation result into the complete assessment cache by
      `criterion_id` before retaining the existing prefix invalidation,
      cancellation, pagination and exact error contracts.
- [x] Pass the complete `selectedVersion.groups[].criteria[]` snapshot into the
      active evaluation composition and extract summary/model ownership as
      needed so
      `TechnicalConfigurationEvaluationActiveWorkspace.tsx` stays below the
      450-line ceiling and does not absorb P12B2 navigation logic.
- [x] Add no migration, RPC, proxy path, query contract, ranking, scoring or AI.

### TDD and verification

- RED/GREEN pure model tests for denominator, completion and canonical status
  counts, including group totals that reconcile exactly to option totals.
- Hook/cache tests proving immediate save-result adoption plus retained prefix
  invalidation and P11D complete-collection behavior.
- Focused React integration tests for selected-option summary,
  loading/error/no-comparison-set states and unchanged P12A2 navigation.
- Run the standard TypeScript/React gate order, focused
  P11A/P11D/P12A1/P12A2 regressions, React Doctor and strict OpenSpec validation.

### Exit gate

P12B1 can deploy independently with correct full-universe progress for the
selected option, immediate post-save summary updates and no filter or
navigation behavior change.

## Phase P12B2 - Filtered Guarded Navigation

**Depends on:** P12B1

**Requirements:** TC-04, TC-14, TC-16, TC-20

**Deploy boundary:** deterministic filtered navigation; no ranking

### Entry gate

The implementation uses these approved choices:

- `Lưu` preserves the P12A2 current panel when the criterion leaves the active
  filter, reports that it no longer matches and does not auto-navigate.
- `Lưu & tiếp tục` does not wrap when no matching criterion remains; it keeps
  the saved panel and shows a no-more-match state.
- Changing option retains the single selected filter and resolves the new
  option's selection deterministically.

### Planned files

- Create: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationFilters.tsx`
- Create:
  `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationNavigatorPane.tsx`
- Create:
  `src/app/(app)/technical-configurations/_components/evaluation/technical-configuration-evaluation-navigation.ts`
- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationEvaluationCriteria.ts`
- Create or extract:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationEvaluationNavigator.ts`
- Create:
  `supabase/migrations/20260730151948_technical_configuration_evaluation_criteria_filter.sql`
- Create:
  `supabase/tests/technical_configuration_evaluation_criteria_filter_phase_gate.sql`
- Modify: assessment RPC manifest, proxy allowlist, typed adapter, query keys and
  successful-save invalidation
- Modify: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationCriterionList.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationActiveWorkspace.tsx`
- Reuse unchanged where possible:
  `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationCriterionPagination.tsx`
- Modify: evaluation-workspace test support and focused integration tests

### Tasks

- [x] Start RED with exact filter-ID, canonical-order, cross-group/page,
      empty-result, dirty/pending and failed-save journeys.
- [x] Add one guarded read-only RPC that filters `all` / `not_evaluated` /
      `fails` / `insufficient_evidence` in Postgres and returns exact
      `criterion_id`, `canonical_index` and `canonical_page` rows in bounded
      canonical pages.
- [x] Collect complete server-filtered IDs through the shared stable page
      collector, preserve canonical group/criterion order, paginate only the
      display projection with the existing page size and map criterion detail
      requests to the canonical comparison page rather than the filtered page
      number.
- [x] Preserve current selection, page and panel state while the criterion
      remains visible; when a filter change would replace selection, reuse the
      P12A2 dirty-confirm/pending-block contract and make cancel restore the
      previous filter, filtered page, criterion, panel/open state and local
      draft.
- [x] Define deterministic empty-result behavior with the option retained,
      selection cleared, panel closed and a clear-filter action.
- [x] Make `Lưu & tiếp tục` move only after save success to the next matching
      criterion in canonical order across group/page boundaries; preserve
      filter/page/criterion/draft on failure and implement the approved entry-gate
      behavior when no match remains.
- [x] Keep existing `Lưu` persistence semantics and implement its approved
      post-save selection behavior without changing P12B1 counters or cache
      ownership.
- [x] Put navigation state in the extracted navigator owner so the active
      workspace stays below the file-size ceiling.
- [x] Add no table or write RPC. Keep the new read RPC set-based, guarded,
      explicitly granted and bounded; add no ranking, scoring or AI.
      Browser/accessibility/responsive matrices remain P13B-owned.

### TDD and verification

- Pure projection/navigation tests for exact IDs, order, pagination and
  canonical comparison-page mapping.
- React user-event journeys for preserved/hidden selection, dirty cancel/
  confirm, pending hard-block, empty results, failed save and filter-aware
  save-next across group/page boundaries.
- Existing P10B/P11D/P12A1/P12A2 progress/detail/evidence/guard regressions.
- Run the standard TypeScript/React gate order, React Doctor and strict OpenSpec
  validation. Do not add or run the P13B browser matrix as P12B2 evidence.

### Exit gate

P12B2 can deploy independently with deterministic server-filtered IDs,
selection, presentation pagination and save-next behavior under the complete
dirty/pending contract; P12B1 progress remains correct and no write path,
ranking/scoring/AI behavior exists.

## Phase P12C1 - Complete Option Ranking Read Contract

**Depends on:** P12B2 merged, applied and phase-gated

**Requirements:** TC-18-S01, TC-18-S02, TC-18-S03, TC-18-S05,
TC-18-S06 data/contract prerequisites

**Deploy boundary:** read-only complete-universe ranking contract; no ranking UI

### Product entry gates

Tie numbering is locked to dense rank (`1, 1, 2`) before RED tests.

`technical_axis = not_applicable` is not an open P12C1 product decision. It
completes that non-applicable criterion even when `evidence_axis` is null, as
already required by the normative "applicable criterion" distinction and the
P11A derived-status contract.

Within one tied rank, presentation order reuses the existing canonical option
order (`supplier.normalized_name`, option identity, option ID). That order must
not alter the shared rank.

### Server/client ownership

- The server owns dossier/baseline scope validation, the complete option and
  criterion universe, raw-axis eligibility, aggregate counters, precedence,
  tie rank and canonical presentation order.
- The complete universe is every supplier option in the dossier paired with
  every canonical criterion in the exact baseline version, left joined to the
  persisted manual assessment for that option/criterion. A zero-criterion exact
  baseline preserves every option with zero counters, eligible status and dense
  rank `1`.
- The read path must remain set-based and bounded. It must not issue one request
  per option, collect current filtered pages as if they were complete, or call
  get-or-create comparison-set behavior.
- Every result page must repeat one opaque snapshot identity derived from the
  complete option universe and every contributing comparison-set/assessment
  revision. The client must pass `isSameSnapshot` to the shared bounded-page
  collector and reject the full collection when a later page differs.
- The contract excludes reference products and must not join supplier responses,
  supplementary information, documents or citations. Source changes therefore
  cannot mutate eligibility or create a manual stale state.
- The client contract owns only typed transport, stable bounded-page collection
  and cache identity. P12C2 owns the explicit request and presentation.

### Ranking RPC wire contract

- RPC name:
  `technical_configuration_reference_ranking_list(p_dossier_id,
p_baseline_version_id, p_page, p_page_size)`.
- Request paging is 1-based offset pagination. `p_page >= 1`,
  `1 <= p_page_size <= 100`; the complete collector always requests 100. There
  is no parallel cursor contract and no hidden cap on total dossier options or
  baseline criteria.
- Response root is exactly
  `{ data, dossier_id, baseline_version_id, snapshot_token, total, page, page_size }`.
  Each item is exactly
  `{ option_id, supplier_id, supplier_name, display_label, eligibility,
incomplete_criterion_count, failed_count, insufficient_evidence_count,
exceeds_count, rank }`.
- `option_id` is the stable collector key. `eligibility` is `eligible` or
  `incomplete`; rank is a positive integer only for eligible rows and null for
  incomplete rows. Every count is a non-negative integer.
- The server computes eligibility, counters and shared rank over the complete
  option/criterion universe before `LIMIT/OFFSET`. Eligible rows sort by rank
  then canonical option order; incomplete rows follow in canonical option order.
- Every page repeats exact scope, page metadata, total and one opaque
  `snapshot_token`. A page beyond exhaustion returns empty `data` with unchanged
  metadata. The client requests sequential pages only until collected count
  equals `total`, exposes no partial ranking and rejects early empty pages,
  duplicates, overflow, metadata/total mismatch or snapshot mismatch.
- Invalid page arguments return `PT422/validation_error`; missing or
  dossier-mismatched baseline identity returns `PT404/not_found`. Missing
  comparison sets remain read-only incomplete rows.

### Planned files

- Create: `supabase/migrations/<timestamp>_technical_configuration_reference_ranking.sql`
- Create: `supabase/tests/technical_configuration_reference_ranking_phase_gate.sql`
- Create: `src/lib/technical-configuration-ranking-rpcs.ts`
- Create: `src/app/(app)/technical-configurations/reference-ranking-types.ts`
- Create: `src/app/(app)/technical-configurations/technical-configuration-reference-ranking-rpc.ts`
- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationReferenceRanking.ts`
- Create: `src/app/api/rpc/__tests__/technical-configuration-reference-ranking-migration.test.ts`
- Create: `src/app/api/rpc/__tests__/technical-configuration-reference-ranking-rpc-whitelist.test.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/reference-ranking-hook.test.tsx`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify: `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Modify: `openspec/changes/add-technical-configuration-comparison/contracts.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/design.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/test-matrix.md`

The exact RPC name is locked by the migration/source-contract RED tests. Do not
reuse or widen `technical_configuration_evaluation_criteria_list`; that RPC owns
one-option filtered navigation, not dossier-wide ranking.

### TDD and verification

- RED migration/source tests for a missing guarded RPC, missing explicit grants,
  wrong result shape, incomplete scope guards or any reference-product/source
  data join.
- RED table-driven SQL cases for precedence, incomplete raw axes, the
  `not_applicable` null-evidence exception, dense ties (`1, 1, 2`) and
  deterministic tied presentation order. Explicitly cover `fails` and `unclear`
  with null evidence so derived-status precedence cannot hide incompleteness.
- RED phase-gate cases for cross-dossier/version rejection, absent comparison
  sets, zero criteria, more than 100 options, more than 100 criteria, page sizes
  0/101, page exhaustion, page-invariant ranks, source changes after manual
  evaluation, denied roles, raw `admin` compatibility and rollback cleanliness.
- RED source/manifest tests proving the ranking RPC is imported and spread into
  `allowed-functions.ts`, not only declared in its own manifest.
- GREEN typed adapter/query tests proving stable bounded-page collection,
  exact wire fields, fixed collector page size 100, no partial publication,
  exact exhaustion, total/metadata mismatch rejection, snapshot mismatch after
  a mutation between page requests and no hidden comparison-set mutation.
- Run format, explicit-any, dedupe, typecheck, focused tests, React Doctor and
  strict OpenSpec validation.
- Apply the exact migration only after explicit approval for that migration
  write through Supabase MCP.
- After apply, request a second explicit approval before running the
  rollback-only live phase gate. Run read-only security/performance advisors
  after the gate.

### Exit gate

P12C1 can deploy independently when the read-only RPC is merged, explicitly
applied, phase-gated and available through the typed client. No user-visible
ranking is mounted.

## Phase P12C2 - Optional Reference Ranking UI

**Depends on:** P12C1 merged, applied and phase-gated

**Requirements:** TC-18

**Deploy boundary:** optional supplier-option reference ranking UI

### Planned files

- Create: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationOptionReferenceRanking.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/reference-ranking.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationWorkspace.tsx`
- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationReferenceRanking.ts`
- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationAssessments.ts`
- Modify: `src/app/(app)/technical-configurations/__tests__/assessment-hook-contract.test.ts`
- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-workspace.test.tsx`
- Modify: `openspec/changes/add-technical-configuration-comparison/contracts.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/design.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/test-matrix.md`

### Tasks

- [ ] Mount ranking as a sibling of the selected-option evaluation flow in
      `TechnicalConfigurationEvaluationWorkspace`; do not move dossier-wide
      state into `TechnicalConfigurationEvaluationActiveWorkspace`.
- [ ] Keep the ranking query disabled until the user explicitly requests it.
- [ ] Reset the explicit-request latch and visible ranking when `dossier.id` or
      baseline version identity changes. Cancel or ignore obsolete in-flight
      requests so a previous context cannot render or trigger ranking in the new
      context.
- [ ] Render loading, error/retry, eligible ranking, tied ranks, incomplete
      options and the exact incomplete message without adding hidden score,
      percentage or tie-break criteria.
- [ ] Render the mandatory reference-only disclaimer whenever ranking is shown.
      Do not add export/print behavior merely because the normative scenario
      also constrains future exported ranking.
- [ ] Invalidate/refetch an active ranking after a successful manual assessment
      save without delaying save completion or navigation release. Supplier
      response/document changes may refetch the same result but must not create
      a manual stale marker.
- [ ] Keep reference products outside the request and render model.

### TDD and verification

- RED React integration for no automatic request on mount, explicit request,
  loading, error/retry and empty/single-option states.
- RED dossier/baseline-switch regressions proving request state resets, obsolete
  results never render and the new context still requires an explicit request.
- RED rendering cases for precedence output, incomplete reason, ties, stable
  tied presentation order, disclaimer and reference-product exclusion.
- RED assessment-hook contract proving successful save invalidates the ranking
  cache without changing existing assessment/filter invalidations or waiting for
  the optional ranking refresh to finish.
- RED active-refetch failure proving the previous cached ranking remains hidden
  behind the error/retry state.
- Source-update regression proving no manual stale marker is rendered.
- Run format, explicit-any, dedupe, typecheck, focused P11/P12 tests, React
  Doctor and strict OpenSpec validation. Browser/mobile hardening remains P13B.

### Exit gate

The manual MVP is feature-complete when TC-18-S01-S06 pass end to end and the
optional ranking remains transparent, read-time only and separate from any
supplier award decision.

## Phase P13A - Database Security And Performance Hardening

P13A is DB-only. P13B retains UI, accessibility and browser regression
ownership. P13A-P2 exists only when mandatory P13A-P1 evidence fails.

### Phase P13A-P1 - Mandatory Representative Ranking Performance Evidence

**Depends on:** P12C1 merged, applied and phase-gated<br>
**Requirements:** TC-20 DB prerequisite; representative ranking performance
evidence<br>
**Deploy boundary:** mandatory verification/test-only leaf; no deploy artifact<br>
**Production code:** prohibited; evidence and test harness changes only<br>
**Migration/apply/rollback-only live-write approval:** no migration apply;
read-only `EXPLAIN` on existing data needs no write approval; a rollback-only
seeded scale gate on live requires separate explicit user approval through
Supabase MCP<br>
**Deploy-safe state:** P12C1 runtime behavior remains unchanged; any approved
scale seed is rolled back

#### Planned files/surfaces

- Create:
  `openspec/changes/add-technical-configuration-comparison/verification/P13A-P1-representative-ranking-plan.md`.
- Modify
  `supabase/tests/technical_configuration_reference_ranking_phase_gate.sql`
  only if test-only plan assertions need a reproducible harness.
- Inspect the deployed ranking RPC, supporting indexes and representative normal
  and upper-limit data shapes.

#### Acceptance

- Required scale dataset: more than 100 options x 102 criteria, collected with
  page size 100.
- Plan evidence uses `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` or an equivalent
  JSON-plan seam.
- Cardinality and work remain bounded, with no temp spill, repeated correlated
  `SubPlan` or unbounded full rescan outside the contract.
- Do not hard-code a wall-clock threshold until an approved SLO exists.

#### Tasks

- [ ] Build the normal dataset and required scale dataset of more than 100
      options x 102 criteria; collect ranking pages at size 100.
- [ ] Capture `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` or equivalent JSON plans
      and record indexes, cardinality, loops, buffers, sorts and pagination work.
- [ ] Assert bounded cardinality/work, no temp spill, no repeated correlated
      `SubPlan` and no unbounded full rescan outside the contract.
- [ ] Record plan metrics without adding a wall-clock assertion until an SLO is
      approved.
- [ ] If existing data cannot prove representative scale, request explicit user
      approval for the rollback-only seeded scale gate before running it through
      Supabase MCP.
- [ ] Run the focused ranking performance assertions and preserve plan and
      rollback evidence.
- [ ] On failure, stop and instantiate P13A-P2 with only the exact evidenced
      query/index gap; otherwise omit P13A-P2 and unblock P13A-V.

#### Verification

- Evidence identifies the more-than-100-options x 102-criteria dataset, page
  size 100 and JSON plans for every collected page.
- Focused assertions prove bounded cardinality/work, no temp spill, no repeated
  correlated `SubPlan` and no unbounded full rescan outside the contract.
- No wall-clock pass/fail threshold is claimed without an approved SLO.
- Reviewer confirmation that no migration apply or production-code change
  occurred and any approved scale seed was rolled back.

#### Exit gate

Direct path: all representative TC-20 acceptance criteria pass and P13A-V is
unblocked.
Failure path: P13A-P1 remains failed, the exact P13A-P2 scope is recorded and
P13A-V remains blocked until P13A-P2 is applied/phase-gated and P13A-P1 reruns
green.

### Phase P13A-P2 - Conditional Ranking Query Remediation

**Depends on:** P13A-P1 failed with reproducible evidence and exact scope<br>
**Requirements:** only the exact failed TC-20 ranking query/index invariant from
P13A-P1<br>
**Deploy boundary:** conditional single-gap DB remediation; absent when P13A-P1
passes<br>
**Production code:** allowed only for the exact evidence-backed ranking
query/index gap; no UI, client or adjacent DB hardening<br>
**Migration/apply/rollback-only live-write approval:** prepare locally; the
exact apply and rollback-only live gate each require separate explicit approval
through Supabase MCP<br>
**Deploy-safe state:** before approval the change is repo-only; after approved
apply, ranking result and paging contracts remain unchanged

#### Planned files/surfaces

- Create one exact ranking migration only if required by P13A-P1 evidence.
- Modify
  `supabase/tests/technical_configuration_reference_ranking_phase_gate.sql`
  for the reproduced gap.
- Create:
  `openspec/changes/add-technical-configuration-comparison/verification/P13A-P2-ranking-query-remediation.md`.
- Touch only the evidenced ranking RPC/index surface; do not touch P13B-owned
  UI/browser surfaces.

#### Tasks

- [ ] Add a RED SQL/plan assertion reproducing the P13A-P1 failure.
- [ ] Implement the minimum query/index remediation without changing contracts.
- [ ] Verify migration order, fresh replay and rollback cleanliness locally.
- [ ] Rerun the failed plan matrix and all focused ranking SQL/RPC suites.
- [ ] Apply only after explicit approval; request separate approval before the
      rollback-only live gate, then run read-only advisors.
- [ ] Rerun P13A-P1 from the beginning after the remediation is phase-gated.

#### Verification

- RED/GREEN regression evidence and before/after representative plans.
- Unchanged result shape, deterministic ranks and bounded paging.
- Approved apply/rollback gate evidence and read-only advisors when deployed.

#### Exit gate

P13A-P2 is applied and phase-gated, the exact P13A-P1 gap is closed, P13A-P1
reruns green and no broader production change was introduced; P13A-V is
unblocked.

### Phase P13A-V - Final Database Security And Performance Verification

**Depends on:** P13A-P1 passed directly, or P13A-P2 applied and phase-gated
followed by a green P13A-P1 rerun<br>
**Requirements:** TC-02, TC-20 final DB gate<br>
**Deploy boundary:** verification-only final gate; fixes require separate
blocking leaves<br>
**Production code:** prohibited<br>
**Migration/apply/rollback-only live-write approval:** prohibited in this leaf;
any corrective live write belongs to its fix leaf and requires separate
explicit approval<br>
**Deploy-safe state:** runtime and DB state remain unchanged; accepted evidence
satisfies only P13C's P13A dependency

#### Planned files/surfaces

- Create:
  `openspec/changes/add-technical-configuration-comparison/verification/P13A-V-db-security-performance.md`.
- Modify `openspec/changes/add-technical-configuration-comparison/tasks.md`
  only after verification passes.
- Inspect all DB-phase tests, migration order and live schema/advisors read-only.

#### Tasks

- [ ] Rerun the complete authorization matrix against direct backend calls.
- [ ] Inspect live schema read-only for grants, RLS, JWT guards and `search_path`.
- [ ] Audit ownership/cascade and locked-baseline immutability.
- [ ] Audit migration order and fresh-DB replay behavior.
- [ ] Verify list/matrix/ranking bounds, selected columns, indexes and absence
      of N+1.
- [ ] Run read-only security/performance advisors against the final DB state.
- [ ] If any gap is found, create an exact blocking fix leaf and stop P13A-V;
      do not widen P13A-P2 or edit production in P13A-V.
- [ ] Rerun P13A-V from the beginning after every blocking fix is phase-gated.

#### Verification

- Focused SQL/RPC suites from every DB phase.
- Direct-call denial tests for `global`, raw `admin`, missing claims and denied roles.
- Reviewer approval of DB security/performance evidence.

#### Exit gate

No release-blocking database authorization, integrity or performance gap
remains; only P13C's P13A dependency is satisfied. P13C still requires P13B,
P7A2, P9A3 and P14C2.

## Phase P13B - UI, Accessibility And Regression Hardening

**Depends on:** P12C2

**Requirements:** TC-03, TC-04, TC-11, TC-13, TC-14, TC-17, TC-18, TC-20

**Deploy boundary:** verification-only; fixes require separate blocking leaf phases
**Production code:** prohibited

### Planned files

- Create: `openspec/changes/add-technical-configuration-comparison/verification/P13B-ui-accessibility-regression.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md` only after verification passes

### Tasks

- [ ] Test concurrent edits and conflict recovery across two tabs.
- [ ] Verify dirty criterion/tab/dossier navigation.
- [ ] Verify long Vietnamese text, many options and narrow viewport.
- [ ] Verify P10B3 one-cell evidence detail loading, no-evidence, error,
      load-more and focus-restoration states on desktop and mobile.
- [ ] Verify suggested groups remain editable, additional groups render correctly and no custom content-column controls exist.
- [ ] Verify many reference-product columns remain selectable and all criterion content/evidence is reachable.
- [ ] Verify P12A1/P12A2 compose assessment controls onto the shared P10B detail and
      supplementary information remains non-scoring after save, save-next and
      derived-status rendering.
- [ ] Verify the complete TC-18 flow on desktop and mobile: no ranking request on
      mount or after dossier/baseline switch, explicit request, loading,
      error/retry, incomplete options, ties, disclaimer, context reset and
      refresh after a successful assessment save.
- [ ] Verify keyboard/focus/accessibility across workspace, matrix and evaluation.
- [ ] Verify stable dimensions and absence of overlap/layout shifts.
- [ ] Verify Equipment attachment regressions after shared extraction.
- [ ] Run focused browser screenshots/interactions on desktop and mobile.
- [ ] If any gap is found, create a blocking fix leaf with exact files/issue/branch/PR and stop P13B.
- [ ] Rerun P13B from the beginning after every blocking fix leaf is merged.

### Verification

- Full relevant Vitest suites from P3A-P12C2.
- True full-repo React Doctor:

  ```bash
  node scripts/npm-run.js npx -y -p node@22 -p react-doctor@latest react-doctor . --verbose --project . --offline --full
  ```

- Browser screenshot/interaction evidence covering P10B3 evidence detail,
  P12A2 assessment activation, TC-17 non-scoring behavior and the complete
  TC-18 explicit-request ranking flow.
- Reviewer approval of UI/accessibility evidence.

### Exit gate

No release-blocking UI, accessibility or Equipment regression remains.

> Shared P14 execution source:
> [p14-tdd-plan.md](./p14-tdd-plan.md). Each leaf still refreshes exact
> migration timestamps, current file paths and commands at its entry gate.

## Phase P14A1 - Canonical Export Snapshot Manifest

**Depends on:** P12C1 merged/applied/gated

**Requirements:** TC-21-S02, TC-21-S06, TC-21-S07, TC-21-S08

**Deploy boundary:** dormant read-only manifest RPC; no UI, workbook or download

### Planned files

- Create at execution time after migration-order inspection:
  `supabase/migrations/<timestamp>_technical_configuration_result_export_manifest.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-result-export-manifest-migration.test.ts`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-result-export-rpc-whitelist.test.ts`
- Create:
  `supabase/tests/technical_configuration_result_export_manifest_phase_gate.sql`
- Create: `src/lib/technical-configuration-result-export-rpcs.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`

### Tasks

- [x] Inspect current migrations, live functions/grants read-only and the P12C1
      ranking snapshot contract before choosing the migration timestamp.
- [x] Write RED migration/source tests for the exact manifest request/response,
      `admin/global` authorization, canonical ordered scope validation,
      side-effect-free behavior and opaque full/ranking snapshot tokens.
- [x] Add the smallest shared SQL helper and manifest RPC needed to fingerprint
      every workbook-visible source field without creating comparison sets or
      missing rows.
- [x] Add only the P14A1 RPC name to the dedicated manifest and proxy allowlist.
- [x] Run migration contract tests, rollback-only phase gate after explicit live
      approval, read-only security advisor and strict OpenSpec validation.

### Exit gate

The manifest RPC is merged, applied and phase-gated as a dormant read-only
contract. It returns deterministic ordered scope metadata and both snapshot
tokens without changing any revision, audit state or data row.

## Phase P14A2 - Paginated Export Ranking And Matrix Contracts

**Depends on:** P14A1 merged/applied/gated

**Requirements:** TC-21-S03, TC-21-S04, TC-21-S06, TC-21-S07, TC-21-S08

**Deploy boundary:** dormant bounded read-only data RPCs; no client, UI or workbook

### Planned files

- Create at execution time after migration-order and file-ceiling inspection:
  `supabase/migrations/<timestamp>_technical_configuration_result_export_ranking_source.sql`
- Create immediately after the ranking migration:
  `supabase/migrations/<timestamp>_technical_configuration_result_export_snapshot_token_source.sql`
- Create immediately after the snapshot-token migration:
  `supabase/migrations/<timestamp>_technical_configuration_result_export_matrix_page.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-result-export-pages-migration.test.ts`
- Create:
  `supabase/tests/technical_configuration_result_export_pages_phase_gate.sql`
- Modify: `src/lib/technical-configuration-result-export-rpcs.ts`
- Modify:
  `src/app/api/rpc/__tests__/technical-configuration-result-export-rpc-whitelist.test.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`

### Tasks

- [x] Write RED SQL/source tests for exact ranking and flattened matrix payloads,
      pagination bounds, canonical order, repeated scope/totals/tokens and
      missing-data empty/null semantics.
- [x] Reuse P12C1 ranking semantics instead of implementing a second ranking
      algorithm.
- [x] Re-source the P14A1 private snapshot token through the shared token helper
      so a ranking page performs no preliminary paged P12C1 full-universe scan.
- [x] Implement set-based read-only ranking and matrix RPCs over the P14A1
      snapshot helper with no get-or-create or per-cell query loop.
- [x] Prove reference products and baseline-only evidence never enter option
      columns, and every returned cell belongs to the requested dossier,
      baseline, option and criterion scope.
- [ ] Apply and phase-gate only after explicit live DB approval; run focused
      authorization, plan/bounds and advisor checks.

### Exit gate

Both dormant RPCs return complete bounded pages with canonical keys and the
P14A1 snapshot identities. No UI can call them yet and no export file exists.

## Phase P14A3 - Typed Export Adapters And Stable Dataset Collector

**Depends on:** P14A2 merged/applied/gated

**Requirements:** TC-21-S02, TC-21-S04, TC-21-S06, TC-21-S07, TC-21-S08

**Deploy boundary:** client data contract only; no mounted query, UI, workbook or download

### Planned files

- Create:
  `src/app/(app)/technical-configurations/technical-configuration-result-export-rpc.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-result-export-data.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-result-export-data.test.ts`

### Tasks

- [ ] Write RED adapter tests for exact wire decoding, error taxonomy, nullable
      fields and rejection of malformed identities/totals/tokens.
- [ ] Write RED collector tests for all pages, deterministic key uniqueness,
      complete-before-publish, requested-surface short-circuiting and final
      manifest revalidation.
- [ ] Implement module-local typed RPC adapters through the existing
      technical-configuration RPC client; do not change shared `callRpc()`.
- [ ] Collect pages sequentially, validate every response against the first
      manifest and reject the entire dataset when the final manifest differs.
- [ ] Prove `ranking_only` never fetches matrix pages and
      `detailed_matrix_only` never fetches ranking pages.

### Exit gate

One typed function returns a complete immutable export dataset or one typed
error. It never publishes partial rows and remains unreachable from production
UI.

## Phase P14B1 - Result Workbook Schema And Representative Fixtures

**Depends on:** P14A3

**Requirements:** TC-21-S03, TC-21-S04, TC-21-S05, TC-21-S09

**Deploy boundary:** pure workbook model/fixtures; no ExcelJS rendering or download

### Planned files

- Create: `src/lib/technical-configuration-result-excel-contract.ts`
- Create:
  `src/lib/__tests__/technical-configuration-result-excel-fixtures.ts`
- Create:
  `src/lib/__tests__/technical-configuration-result-excel-contract.test.ts`

### Tasks

- [ ] Write RED contract tests for the three content modes, visible sheet order,
      hidden `_meta`, exact four matrix context columns and exact three-column
      option groups.
- [ ] Define one output-only versioned workbook model; do not add an import,
      parser or apply contract.
- [ ] Encode continuation-sheet planning from Excel's physical column limit;
      never truncate or introduce a hidden option cap.
- [ ] Add deterministic in-memory fixtures for empty/sparse/tied/missing-data
      cases and more than 100 options x 102 criteria.
- [ ] Keep fixture generation local to tests and free of seed/live DB access.

### Exit gate

The pure schema/model deterministically describes every required sheet and
continuation partition for all modes, including the representative large
fixture, without importing ExcelJS or producing a Blob.

## Phase P14B2 - Approved ExcelJS Workbook Rendering

**Depends on:** P14B1

**Requirements:** TC-21-S03, TC-21-S04, TC-21-S05, TC-21-S09

**Deploy boundary:** workbook creation API only; no mounted trigger or automatic download

### Planned files

- Create: `src/lib/technical-configuration-result-excel-export.ts`
- Create:
  `src/lib/__tests__/technical-configuration-result-excel-export.test.ts`
- Reuse unchanged unless a proven shared-contract gap exists:
  `src/lib/excel-workbook.ts`

### Tasks

- [ ] Write RED focused workbook tests that inspect sheets, hidden state,
      merged cells, values, hyperlinks, filters, panes, widths/heights, borders,
      fills and representative continuation sheets.
- [ ] Reuse `createExcelWorkbook()` and the existing lazy ExcelJS serialization
      pattern; do not route the domain workbook through flat `exportToExcel()`.
- [ ] Render the two approved workbook layouts from Stitch project
      `1463377740887387448`: overview/ranking
      `d394c0dd25f146cf9423b8acf8eeaa86` and detailed matrix
      `45c3a6f4ac514212ba3259064ef19ea0`. P14C1 separately owns dialog
      `4aaff09e4788412386ea8d4f1baa4da9`.
- [ ] Lock `#166534` title/header styling, white title text, thin gray borders,
      zebra rows, wrap/top alignment, filters, frozen panes, amber disclaimer
      and restrained conclusion fills.
- [ ] Assert no chart, gradient, score, percentage, award decision or truncated
      option exists.

### Exit gate

The renderer returns a complete ExcelJS workbook matching the approved visual
and data contract for every mode. No production component imports it yet and no
download side effect occurs.

## Phase P14C1 - Export Scope Dialog And State Machine

**Depends on:** P14B2

**Requirements:** TC-21-S01, TC-21-S02, TC-21-S04

**Deploy boundary:** unmounted UI/state contract; no RPC collection or download

### Planned files

- Create:
  `src/app/(app)/technical-configurations/technical-configuration-result-export-state.ts`
- Create:
  `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationResultExportDialog.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-result-export-dialog.test.tsx`

### Tasks

- [ ] Write RED pure-state and React user-event tests for open/reset/confirm,
      content mode, option scope, criterion scope, validation and cancellation.
- [ ] Default every new dossier/baseline dialog session to all options and all
      criteria, independent of current selected options or criterion page.
- [ ] Ask for explicit scope whenever the source surfaces are paginated and
      expose current selection/page only as deliberate alternatives.
- [ ] Keep the dialog unaware of RPC collection, ExcelJS and Blob download.
- [ ] Preserve the approved Stitch dialog layout and accessible labels/focus
      behavior without mounting it into the evaluation workspace.

### Exit gate

The isolated dialog emits one validated export request and has no network,
workbook or download side effect. Existing workspace UI remains unchanged.

## Phase P14C2 - Export Orchestration, Download And Workspace Activation

**Depends on:** P14C1

**Requirements:** TC-21

**Deploy boundary:** activates the user-visible Excel export workflow

### Planned files

- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationResultExport.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-result-export.test.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationWorkspace.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-workspace.test.tsx`

### Tasks

- [ ] Write RED React integration tests for mounted trigger, scope confirmation,
      loading/success/error/retry, changed-snapshot abort, context switch,
      requested-surface fetch suppression and no partial download.
- [ ] Mount one `Xuất kết quả Excel` action in the evaluation workspace without
      changing current matrix/ranking ownership or pagination behavior.
- [ ] Orchestrate P14A3 collection then P14B2 rendering, serialize through the
      existing ExcelJS pattern and call shared `downloadBlob()` exactly once
      only after successful final manifest revalidation.
- [ ] Cancel or ignore obsolete work after dossier/baseline changes and keep
      retry explicit; never download a stale or partial workbook.
- [ ] Run standard TypeScript/React gates, focused existing Excel/Equipment and
      evaluation/ranking regressions, React Doctor and strict OpenSpec
      validation. P14 does not add a P13B real-browser gate.

### Exit gate

The approved export action produces the requested complete workbook from one
stable read-only snapshot, preserves all existing Excel and evaluation
workflows and is independently deployable before deferred P13 hardening.

## Phase P13C - Release, OpenSpec And AI-Boundary Audit

**Depends on:** P13A-V, P13B, P7A2, P9A3, P14C2
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
- [ ] Confirm optional productivity leaves P7A1, P7A2 and P9A1-P9A3 are complete even though they are not on the manual-comparison critical path.
- [ ] Confirm P14A1-P14C2 landed and the final result workbook contract remains
      read-only, snapshot-stable and free of scoring/award semantics.
- [ ] Aggregate preserved per-leaf `verify:no-explicit-any`, `verify:dedupe`, focused test and review evidence.
- [ ] Run fresh full `typecheck` and all focused feature Vitest suites; do not claim a fresh P13 branch diff covers earlier merged leaf diffs.
- [ ] Run `openspec validate add-technical-configuration-comparison --strict`.
- [ ] Audit database and source tree for AI UI/API/job/cache/quota/table artifacts.
- [ ] Confirm stable IDs, criterion citations and manual/machine separation support a future AI OpenSpec change.
- [ ] Complete release notes, rollout boundary and rollback instructions.
- [ ] Update OpenSpec tasks only from verified landed state.
- [ ] Close/relate phase issues and create the separate AI follow-up issue only when requested.
- [ ] Record final acceptance, then archive this OpenSpec change; do not archive
      before every P13C dependency and acceptance gate passes.
- [ ] Verify the archived change state and preserve its archive evidence.

### Verification

- Fresh quality-gate output.
- Feature-baseline-to-HEAD commit/file audit and per-leaf gate evidence.
- Strict OpenSpec validation.
- Reviewer approval of release and AI-boundary evidence.
- Final-acceptance evidence followed by verified OpenSpec archived state.
- `main` synchronized with `origin/main`.

### Exit gate

The MVP is available only to `admin/global`, all manual workflows are verified,
Equipment remains stable and AI remains a documented future extension rather
than shipped runtime. Final acceptance is recorded before this OpenSpec change
is archived, and the archived state is verified in release evidence.

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
