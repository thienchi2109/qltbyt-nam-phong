# P6C Live Acceptance And Closeout Evidence

**Issue #896**

**Branch:** `feat/896-p6c-acceptance-closeout`

**Base:** `4f2be3bd638a55fc62e1995b8b78d8b13d8abfc7`

**Supabase project:** `cdthersvldpnlbvpufrr`

**Browser execution:** skipped because production credentials are unavailable, as
explicitly instructed by the user.

## Live Write Authorization

Status: **CORRECTED ACCEPTANCE AUTHORIZED, PASSED, AND ROLLED BACK**

The user explicitly authorized the first rollback-only attempt on `2026-08-14`.
The original smoke was intended to run
`supabase/tests/technical_configuration_baseline_hierarchy_p6c_live_acceptance.sql`
through Supabase MCP, copy an existing empty draft, import one XLSX v2 subgroup
and criterion into the copy, lock it, force rollback, and prove no copied-version
residue. The diagnostic attempts stopped at the initial copy RPC, so import,
apply, lock, and end-to-end identity assertions in that original flow were not
reached.

The first attempt returned `PT422: validation_error`. The second authorized
diagnostic attempt captured an empty `PG_EXCEPTION_DETAIL`. The third authorized
attempt added explicit stage and exception context, proving the failure occurred
at `technical_configuration_baseline_copy` inside
`_technical_configuration_baseline_copy_p4`.

The root cause was fixture lifecycle, not XLSX validation: the smoke selected a
`draft` source while the deployed copy RPC requires a `locked` source and rejects
copying when the dossier already has another draft.

All three nested exception subtransactions rolled back cleanly. Read-only residue
checks after each attempt confirmed the preflight counts remained `4` versions,
`16` groups, `0` subgroups, `155` criteria, `0` documents, and `0` citations,
with no P6C fixture marker.

The user then explicitly authorized the corrected rollback-only transaction. The
corrected smoke snapshots the representative draft, applies and locks its XLSX v2
hierarchy, copies the locked source, locks the copy, forces rollback, and proves
both exact source restoration and copied-version residue removal.

## Live Migration And RPC State

Read-only preflight ran through Supabase MCP at
`2026-08-14 04:00:00.652769 UTC`.

Applied hierarchy migrations:

| Applied version  | Migration                                                        |
| ---------------- | ---------------------------------------------------------------- |
| `20260807195424` | `technical_configuration_baseline_hierarchy_reads`               |
| `20260808003442` | `technical_configuration_baseline_hierarchy_snapshots`           |
| `20260808144853` | `technical_configuration_baseline_hierarchy_mutation_helpers`    |
| `20260808145124` | `technical_configuration_baseline_hierarchy_criterion_mutations` |
| `20260809014821` | `technical_configuration_baseline_hierarchy_import_metadata`     |
| `20260809015115` | `technical_configuration_baseline_hierarchy_import_validation`   |
| `20260809015144` | `technical_configuration_baseline_hierarchy_import_preview`      |
| `20260809085349` | `technical_configuration_baseline_hierarchy_import_apply`        |
| `20260813024842` | `technical_configuration_evaluation_hierarchy_order`             |
| `20260813132516` | `technical_configuration_baseline_hierarchy_server_activation`   |

Deployed acceptance RPCs all return `jsonb`, are `SECURITY DEFINER`, and set
`search_path=public, pg_temp`:

- `technical_configuration_baseline_import_preview_v2(uuid, jsonb, jsonb, bigint)`
- `technical_configuration_baseline_import_apply_v2(uuid, jsonb, jsonb, bigint)`
- `technical_configuration_baseline_copy(uuid, bigint)`
- `technical_configuration_baseline_lock(uuid, bigint)`

Live preflight counts:

| Dossiers | Versions | Draft | Locked | Groups | Subgroups | Criteria |
| -------: | -------: | ----: | -----: | -----: | --------: | -------: |
|        5 |        4 |     4 |      0 |     16 |         0 |      155 |

The selected runtime fixture contract requires a current empty draft owned by an
active `global` or `admin` user, one to four existing groups, and no subgroup,
criterion, document, or citation rows. Preflight found two matching four-group
draft candidates, so the SQL does not hardcode a dossier or version UUID.

## Security Advisors

Read-only Supabase security advisors ran before acceptance and were rerun after
the passing smoke on `2026-08-14`.

The project has pre-existing project-wide findings, including:

- an `ERROR` for the unrelated `public.v_don_vi_dia_ban_check` security-definer
  view;
- mutable-search-path warnings on unrelated legacy functions;
- RLS-enabled-with-no-policy informational notices on RPC-only/internal tables,
  including technical-configuration document and citation tables;
- signed-in execution warnings for exposed `SECURITY DEFINER` RPCs.

The four P6C acceptance RPCs independently passed the live catalog check for
`search_path=public, pg_temp`. P6C adds no migration, grant, policy, function, or
persistent schema change, so the branch introduces no new advisor finding.

Advisor reference:
`https://supabase.com/docs/guides/database/database-linter`

## Performance Advisors

Read-only Supabase performance advisors ran before acceptance and were rerun
after the passing smoke on `2026-08-14`.

Relevant pre-existing informational findings are:

- uncovered composite foreign keys on baseline criteria and subgroups;
- an uncovered source-version foreign key on baseline versions;
- the existing `technical_configuration_baseline_versions_source_idx` reported
  unused.

P6C adds no production query, index, table, RPC, or migration. These findings are
baseline follow-up candidates and are not regressions caused by this closeout
branch.

Advisor reference:
`https://supabase.com/docs/guides/database/database-linter`

## XLSX v2 Production Acceptance

Status: **PASSED**

The corrected smoke contract is designed to verify:

1. the public XLSX v2 preview accepts a canonical four-section payload against
   the representative draft;
2. the public apply response matches the preview and authoritative hierarchy
   snapshot;
3. one subgroup and one criterion are applied before the source is locked;
4. copy preserves dossier ownership, exact hierarchy counts, criterion lineage,
   and returns its own draft revision;
5. locking the copy with that revision preserves its canonical hierarchy and
   returns `status = locked`;
6. both success and failure paths roll back before exact source-restoration and
   copied-version residue checks run.

Current evidence:

- corrected smoke result at `2026-08-14T05:46:47.762817Z`:
  `status = passed`, `rolled_back = true`, and
  `residue_check = fixture_scoped`;
- independent post-smoke residue query at
  `2026-08-14T05:47:00.193085Z`: `5` dossiers, `4` baseline versions, `16`
  groups, `0` subgroups, `155` criteria, `0` documents, `0` citations, `0`
  subgroup markers, and `0` criterion markers;
- the smoke's internal post-rollback assertions confirmed that the representative
  source draft matched its exact pre-smoke snapshot and that no copied-version
  residue remained;
- the independent post-smoke query separately confirmed aggregate counts and the
  absence of P6C subgroup and criterion markers;
- post-smoke security and performance advisor reruns reported only the
  pre-existing project findings documented above; P6C made no persistent schema
  change;
- focused protected-surface suite: 11 files, 60 tests passed;
- complete technical-configuration directory: 106 files, 842 tests passed;
- no failures in evaluation, comparison, result export, copy, lock, navigation,
  focus, inline editing, or reload coverage.
- read-only preview of the same representative four-section payload returned
  `errors: []`, so the observed `PT422` occurs after preview;
- stage and exception context proved the failure was the copy RPC's locked-source
  guard; preview passed, while apply and lock were not reached by those
  diagnostics;
- deployed copy requires `status = locked` and no existing dossier draft;
- the corrected flow imports and locks the selected draft before copying it;
- all three post-failure live checks prove the nested rollback left no residue;
- the closeout contract now requires exact restoration of the source snapshot in
  addition to copied-version residue checks.

## Protected P6B Surfaces

P6C must not modify:

- `src/components/ui/heroui/HeroActionDropdown.tsx`
- `src/components/equipment/equipment-toolbar.tsx`
- `src/components/equipment/heroui-pilot/controls.tsx`
- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineProductionActions.tsx`
- `src/components/ui/heroui/__tests__/HeroActionDropdown.test.tsx`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-download-actions.test.tsx`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-production-isolation.test.tsx`

Evaluation, comparison, result export, version navigation, focus mode, inline
editing, copy, lock, and reload production behavior remain out of implementation
scope and are regression-only surfaces.

## Browser Test Exception

P6A.2, P6A.5, and P6B.2 remain unchecked because browser execution needs
production credentials that are not available. This PR does not convert Vitest
coverage into a browser-acceptance claim.

Compensating verification:

- shared `HeroActionDropdown` regression: passed;
- P6B production activation/isolation regression: passed;
- hierarchy download/import/authoring focused suite: passed;
- complete technical-configuration test directory: 106 files, 842 tests passed;
- TypeScript typecheck, no-explicit-any, and diff-dedupe gates: passed;
- production build: passed;
- OpenSpec strict validation: passed;
- React Doctor: changed-source scan covered one TypeScript file, scored `100/100`,
  and returned no findings;
- formatting and `git diff --check`: passed;
- final P6C artifact contract: 2 tests passed.

## Rollback And Recovery

If XLSX v2 acceptance fails:

1. do not merge, deploy, archive the OpenSpec change, or close #896;
2. preserve the current parser and server compatibility contracts;
3. disable or revert P6B UI activation through a separately reviewed code PR;
4. do not restore duplicate legacy workbook actions beside the XLSX v2 dropdown;
5. never drop populated hierarchy data;
6. never edit applied migration history;
7. if a database correction is required, ship a separately reviewed forward
   migration and request fresh explicit permission before applying it through
   Supabase MCP;
8. rerun the rollback-only smoke, security advisors, performance advisors, focused
   tests, broad tests, and OpenSpec strict validation.

The retired legacy UI path is recoverable through source control. Shared legacy
parser/server compatibility remains available for controlled data recovery
without reintroducing the retired duplicate production actions.

## Independent Review

Status: **ZERO FINDINGS ON FINAL EVIDENCE-UPDATED DIFF**

The review chronology is:

1. six findings corrected exception-safe rollback, fixture-scoped residue checks,
   DDL-free execution, lock/apply hierarchy identity, stronger test assertions, and
   pending-language accuracy;
2. one finding expanded the contract to forbid all relevant DDL/DCL verbs and
   require every residue table explicitly;
3. the pre-live re-review returned zero findings;
4. after live diagnostics changed the fixture lifecycle, four findings corrected
   copied-draft revision handoff, exact lineage/count checks, and stale plan text;
5. three findings strengthened evidence accuracy, structural test coverage, and
   review-state tracking;
6. two evidence-wording findings corrected unsupported claims and stale review
   chronology;
7. final lifecycle-corrected re-review returned zero findings.
8. the passing live evidence was then added to this report and the task trackers;
   one evidence-attribution finding was corrected, and the final re-review returned
   zero findings.

Required review inputs:

- issue #896 and `p6c-tdd-plan.md`;
- the rollback-only SQL and this evidence report;
- protected P6B file manifest;
- focused, broad, gates, React Doctor, build, and OpenSpec strict results;
- live smoke and post-smoke advisor evidence after authorization.

Review must repeat until zero findings remain.

## Merge And Deployment Blockers

Completed outcome:

- P6C.1: complete after the authorized rollback-only smoke and advisor reruns;
- P6C.2: complete after passing XLSX v2 acceptance and recording rollback and
  recovery evidence;
- P6C.3: final independent review returned zero findings, the user accepted the
  merge, PR #913 squash-merged as `f8fe17f2`, its Vercel deployment completed,
  and the change was moved to the archive after its specification delta was
  preserved in the active parent change; archive PR #914 then squash-merged as
  `aaae364c` at `2026-08-14T07:17:27Z` and closed Issue #896;
- P6C.4: archive-branch commit/push, upstream verification, archive PR merge,
  final `main` synchronization, stale-branch pruning, stash verification, and
  handoff are complete.

Before archive, the exact normalized requirement blocks for structured three-level
authoring, XLSX v2, hierarchical aggregate evaluation, and hierarchy-aware
surfaces were copied into active parent
`add-technical-configuration-comparison`. Hash comparison confirmed all four
blocks matched, the retired two-level requirement was absent, and no duplicate
requirement names remained. Archive then used `--skip-specs` only to avoid
applying the already-preserved delta twice.

P6A.2, P6A.5, and P6B.2 remain intentionally unchecked because browser
credentials were unavailable. Their exception and compensating verification are
recorded above.
