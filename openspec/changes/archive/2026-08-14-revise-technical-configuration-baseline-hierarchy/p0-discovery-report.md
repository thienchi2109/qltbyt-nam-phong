# P0 Discovery Report

**Change:** `revise-technical-configuration-baseline-hierarchy`
**Date:** 2026-08-07
**Execution boundary:** documentation and planning only on `main`; no runtime code change and no live database write

## Executive Findings

1. The current technical-configuration implementation is a usable mainline baseline for
   this follow-up, but the parent OpenSpec checklist is not a reliable completion ledger.
   In particular, parent phase P5D remains unchecked while the current production
   baseline tab imports `useTechnicalConfigurationBaselineImport`, mounts
   `TechnicalConfigurationBaselineImportDialog`, downloads the canonical workbook, and
   calls preview/apply.
2. Live Supabase still has the two-level schema only. There is no subgroup table and no
   `technical_configuration_baseline_criteria.subgroup_id` column.
3. P1A can remain a strictly additive schema leaf. It does not need to redefine RPCs,
   regenerate client types, change the RPC allowlist, mount UI, or alter existing rows.
4. Live data is small but non-empty: 5 dossiers, 3 draft versions, 12 groups, and 155
   criteria. The largest populated version has 102 criteria. Five manual assessments
   already reference criterion identity, so migration correctness must be proven by
   stable IDs/codes rather than by row counts alone.
5. The highest downstream blast radius is the baseline workbook boundary and the shared
   baseline wire model. Code Review Graph reports 57 importers of `baseline-types.ts`.
   GitNexus classifies the current workbook generator as critical because it participates
   in 16 baseline import/download flows.
6. The current upload path has no file-byte or meaningful-row guard before
   `file.arrayBuffer()` and `ExcelJS.Workbook.xlsx.load()`. P0 locks:
   - maximum XLSX file size: **5 MiB (5,242,880 bytes)**;
   - maximum meaningful input rows: **5,000**.
7. P1A should execute on a branch with a PR unless the user explicitly authorizes a
   different workflow. The instruction to work directly on `main` applies to P0 only.

## Sources Reviewed

The following change documents were read in full and validated with
`openspec validate revise-technical-configuration-baseline-hierarchy --strict`:

- `proposal.md`
- `design.md`
- `tasks.md`
- `specs/technical-configuration-comparison/spec.md`

The survey also compared:

- `openspec/changes/add-technical-configuration-comparison/tasks.md`
- current technical-configuration migrations, RPC tests, TypeScript contracts, hooks,
  comparison/evaluation surfaces, and result-export contracts;
- live Supabase catalog, grants, policies, indexes, migration history, function
  signatures, and representative counts.

The roadmap contains exactly 22 leaf phases:

`P0`, `P1A`, `P1B`, `P1C`, `P1D`, `P1E`, `P2A`, `P2B`, `P3A`, `P3B`, `P3C`, `P3D`,
`P4A`, `P4B`, `P4C`, `P5A`, `P5B`, `P5C`, `P5D`, `P6A`, `P6B`, and `P6C`.

## Roadmap Issues

P0 is tracked by this report and the checked P0 tasks. The 21 implementation leaves
have one issue each:

| Phase | Issue | Phase | Issue | Phase | Issue |
| ----- | ----: | ----- | ----: | ----- | ----: |
| P1A   |  #876 | P1B   |  #877 | P1C   |  #878 |
| P1D   |  #879 | P1E   |  #880 | P2A   |  #881 |
| P2B   |  #882 | P3A   |  #883 | P3B   |  #884 |
| P3C   |  #885 | P3D   |  #886 | P4A   |  #887 |
| P4B   |  #888 | P4C   |  #889 | P5A   |  #890 |
| P5B   |  #891 | P5C   |  #892 | P5D   |  #893 |
| P6A   |  #894 | P6B   |  #895 | P6C   |  #896 |

Every issue records:

- exact phase dependencies;
- separate hand-written and migration/generated/fixture estimates;
- planned focused test commands plus repository gates;
- deploy boundary and activation checks;
- phase-specific rollback notes;
- the rule that P0's direct-on-main instruction does not apply to later leaves.

## Parent Baseline And Drift

### Landed contracts

The following required foundations are present on `main` and in live Supabase:

- dossier foundation and global/admin guarded RPC access;
- editable baseline versions with revision guards;
- editable main groups and criteria;
- immutable lock and copy flows;
- canonical v1 workbook generation, parsing, authoritative preview, and atomic apply;
- comparison reads, evaluation criteria/status reads, manual assessments, and result
  export collection/rendering;
- RLS plus RPC-only table access.

### Drift that P1A must account for

- Parent `tasks.md` reports `268/373` complete and is not archived.
- Parent P5D is unchecked, but the production baseline tab currently mounts the import
  workflow and template download. Current code is the source of truth for blast-radius
  planning.
- The follow-up proposal describes the parent as nearly complete. P1A requires only the
  landed schema/data contracts, not completion of unrelated parent leaves such as URL
  document extraction, reference-product UI debt, ranking acceptance, or final closeout.
- No technical-configuration runtime file changed between GitNexus commit `81985967` and
  current `main` commit `fffc6759`. The intervening runtime changes are limited to auth
  tests and `package-lock.json`, so the existing GitNexus technical-configuration graph
  remains applicable.

## Live Database Contract

### Existing tables

All four tables below have RLS enabled, a deny-all policy for `anon` and
`authenticated`, revoked direct Data API grants, and full `service_role` ownership:

- `technical_configuration_dossiers`
- `technical_configuration_baseline_versions`
- `technical_configuration_baseline_groups`
- `technical_configuration_baseline_criteria`

Current baseline structure:

- version: dossier ownership, status, `next_criterion_number`, revision, lock metadata,
  source version, and audit columns;
- group: version ownership, name, positive `sort_order`, and audit columns;
- criterion: version and group ownership, stable `criterion_code`, optional title,
  required text, positive `sort_order`, source criterion, and audit columns.

Important current constraints:

- one draft per dossier;
- unique version number per dossier;
- unique group order per version, deferrable;
- unique criterion order per group, deferrable;
- unique criterion code per version;
- composite criterion-to-group ownership FK on `(group_id, baseline_version_id)`.

### Representative live counts

| Measure                        | Live value |
| ------------------------------ | ---------: |
| Dossiers                       |          5 |
| Baseline versions              |          3 |
| Draft versions                 |          3 |
| Locked versions                |          0 |
| Main groups                    |         12 |
| Criteria                       |        155 |
| Groups per populated version   |          4 |
| Criteria per populated version |     53-102 |
| Baseline citations             |          0 |
| Option responses               |          0 |
| Manual assessments             |          5 |

Integrity checks returned zero for:

- missing criterion group;
- criterion/group cross-version ownership;
- duplicate group order;
- duplicate criterion order;
- duplicate criterion code per version.

### Current RPC boundary

Baseline functions are `SECURITY DEFINER`, pin
`search_path = public, pg_temp`, and are executable by `authenticated` through the RPC
proxy. Relevant contracts include:

- `technical_configuration_baseline_draft_get`
- `technical_configuration_baseline_versions_list`
- `technical_configuration_baseline_copy`
- `technical_configuration_baseline_lock`
- `technical_configuration_baseline_import_preview`
- `technical_configuration_baseline_import_apply`
- group and criterion create/update/delete/reorder functions

P1A must not change any of these signatures, result shapes, grants, or behavior.

## Current Application Contract

### Baseline wire model

`TechnicalConfigurationBaselineDraftWire` contains an array of main groups. Each
`TechnicalConfigurationBaselineGroupWire` owns a `criteria` array. Criteria have no
subgroup field. Editor state, save mappers, evaluation navigation, comparison, workbook
generation, and many tests consume this two-level shape.

Code Review Graph reports:

- 57 importers of `baseline-types.ts`;
- 7 importers of result-export types;
- 4 importers of evaluation progress.

This confirms the rollout order in `tasks.md`: additive schema first, compatible client
types second, then producer/read changes.

### Canonical XLSX v1

The current generated workbook contract is version 1:

- visible sheet: `Baseline`;
- hidden sheet: `_meta`;
- seven visible machine-oriented columns:
  `row_type`, `group_order`, `group_name`, `criterion_order`, `criterion_code`,
  `criterion_title`, and `requirement_text`;
- metadata binds template kind/version, dossier, baseline version, revision, and
  generation time.

The parser loads the whole file with ExcelJS, converts every worksheet row, then filters
meaningful rows. There is currently no file-byte or row-count rejection.

## XLSX Safety Limits

### Locked limits

- `MAX_BASELINE_WORKBOOK_FILE_BYTES = 5 * 1024 * 1024`
- `MAX_BASELINE_WORKBOOK_MEANINGFUL_ROWS = 5_000`

These limits apply to legacy v1 and XLSX v2 baseline imports during the compatibility
window.

### Counting contract

- Check `File.size` before `arrayBuffer()` or ExcelJS load.
- A meaningful row is a physical input-sheet row after the header with at least one
  nonblank cell in any used column.
- Fully blank rows do not count.
- `_meta` rows do not count.
- Unsupported columns or markers still count before validation rejects them; invalid
  content cannot bypass the safety bound.
- Exceeding either limit rejects the workbook without truncation, preview, or mutation.
- Errors must report the configured limit and the observed byte/row count.

### Evidence

Live versions currently contain at most 102 criteria. A synthetic two-column ExcelJS
benchmark on the repository runtime produced:

| Meaningful rows | XLSX bytes |  Write |   Load | Observed heap delta |
| --------------: | ---------: | -----: | -----: | ------------------: |
|             100 |      9,070 |  42 ms |  30 ms |             2.7 MiB |
|           1,000 |     23,354 |  49 ms |  41 ms |             3.2 MiB |
|           5,000 |     87,396 | 170 ms |  85 ms |            14.6 MiB |
|          10,000 |    166,863 | 205 ms | 150 ms |            12.8 MiB |

The row bound gives roughly 49 times the largest current live criterion count. The byte
bound protects against highly formatted, image-heavy, or otherwise compressed XLSX
files whose in-memory expansion is not represented by simple text benchmarks.

## Blast Radius

### Graph state

- Code Review Graph was refreshed to `fffc6759`: 11,876 nodes, 145,306 edges, 2,094
  files.
- GitNexus is indexed at `81985967`. A refresh with embeddings failed because the
  installed `sharp` binary requires a newer x64 CPU microarchitecture. The indexed
  technical-configuration runtime is still current because no technical-configuration
  code changed after that commit.

### Surface map

| Surface                  | Current assumption                                | Impact       |
| ------------------------ | ------------------------------------------------- | ------------ |
| Baseline draft/editor    | group owns flat criteria                          | P1B, P4A-P4C |
| Snapshot/version/history | JSON groups with nested criteria                  | P1C          |
| Copy/lock                | copies groups then criteria                       | P1D          |
| Mutations                | group-scoped criterion CRUD/reorder               | P1E          |
| Import preview/apply     | v1 group/criterion rows                           | P2A-P2B      |
| Workbook codec/UI        | v1 seven-column contract                          | P3A-P3D      |
| Comparison               | each data row is one criterion with group fields  | P5B          |
| Evaluation/progress      | navigation and denominators flatten criteria only | P5A, P5C     |
| Result export            | criterion axis repeats group fields               | P5D          |

GitNexus findings:

- baseline workbook generation: critical, 16 affected flows;
- evaluation progress: high, 4 affected flows;
- baseline parser: direct import hook plus baseline tab/dialog/workspace chain;
- result-export data: hook, export control, and evaluation workspace chain.

P1A avoids this blast radius because no producer or consumer sees subgroup data yet.

## P1A Schema Contract

P1A is limited to one additive migration and migration contract tests.

### New subgroup table

`technical_configuration_baseline_subgroups`:

- UUID primary key;
- `baseline_version_id` and `group_id` ownership;
- nonblank `name`;
- positive `sort_order`;
- `created_at`, `created_by`, `updated_at`, `updated_by`;
- composite group/version FK with `ON DELETE CASCADE`;
- unique `(id, group_id, baseline_version_id)` scope key;
- deferrable unique `(group_id, sort_order)`;
- version/group/order read index;
- RLS enabled;
- deny-all policy for `anon` and `authenticated`;
- direct grants revoked from `PUBLIC`, `anon`, and `authenticated`;
- full grant only to `service_role`.

### Criterion extension

- add nullable `subgroup_id UUID` with no default and no backfill update;
- add a deferrable composite FK on
  `(subgroup_id, group_id, baseline_version_id)` to the subgroup scope key;
- use deferred `NO ACTION` deletion so subgroup deletion must explicitly move or delete
  descendant criteria in the same transaction;
- add a partial subgroup/order index for non-null subgroup ownership;
- keep the existing group-level order constraint unchanged in P1A.

All existing rows therefore remain direct main-section children with identical values.

## Deploy And Rollback Risks

| Risk                                            | P1A control                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| Table/column exposed through Data API           | explicit revoke, deny policy, service-role only                       |
| Cross-version or cross-group subgroup ownership | composite FK plus later guarded RPC validation                        |
| Existing row rewrite                            | nullable column with no default and no `UPDATE`                       |
| Existing RPC response drift                     | no function replacement in P1A                                        |
| Existing client/generated type drift            | defer generated types and decoders to P1B                             |
| Migration source-order overwrite                | timestamp after `20260806031201` and no function redefinition         |
| Lock duration                                   | create new table first; nullable column and empty-reference FK only   |
| Destructive rollback after adoption             | leave additive schema in place or use a forward superseding migration |

Preferred rollback is application rollback while retaining the additive schema. A
schema drop is permissible only before any producer exists and only after explicit
authorization plus read-only proof that the subgroup table is empty and every
`subgroup_id` is null. Once hierarchy data exists, table/column drops are forbidden.

## P1A Go/No-Go

P1A is ready to plan and implement after:

- P0 issue creation and documentation are complete;
- execution starts from synchronized `main` on a dedicated branch/PR;
- the P1A migration contract test is written RED first;
- no live apply occurs until the user grants explicit permission for that specific
  Supabase MCP write.

Detailed execution steps are in `p1a-tdd-plan.md`.
