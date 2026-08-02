# P13A-P1 Representative Ranking Plan Evidence

Date: 2026-08-02

Status: P13A-P1 blocked because representative scale is unavailable.

## Scope

This artifact covers only the mandatory representative ranking performance
evidence leaf. It does not change the production RPC, indexes, schema or data.

The user cancelled production seeding before any live write. The persistent
fixture, status and cleanup design was removed from the branch.

## Required invariant

The upper-limit workload requires:

- required option_count > 100 and criterion_count = 102 at page_size = 100
- `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` or an equivalent JSON plan
- bounded result cardinality and work
- no temp spill
- no repeated correlated `SubPlan`
- no unbounded full rescan outside the ranking contract
- no hard latency threshold without an approved SLO

## Read-only discovery

The live inventory query grouped options by dossier and criteria by baseline
version, then counted pairs satisfying the required invariant.

Observed on 2026-08-02:

| Metric                         | Value |
| ------------------------------ | ----: |
| dossier_total                  |     2 |
| option_total                   |     1 |
| criterion_total                |   102 |
| max_options_per_dossier        |     1 |
| max_criteria_per_baseline      |   102 |
| representative_candidate_count |     0 |

The checked-in read-only preflight reproduced SQLSTATE `P0001` with:

```text
P13A-P1 representative scale unavailable: required option_count > 100 and
criterion_count = 102 at page_size = 100; observed {"page_size": 100,
"option_total": 1, "dossier_total": 2, "criterion_total": 102,
"max_options_per_dossier": 1, "max_criteria_per_baseline": 102,
"representative_candidate_count": 0}
```

The exact unmet invariant is:

`max_options_per_dossier = 1`, `max_criteria_per_baseline = 102`, and
`representative_candidate_count = 0`, while P13A-P1 requires
`option_count > 100` paired with `criterion_count = 102` and `page_size = 100`.

## Non-seeded dataset source audit

Issue #836 was investigated through read-only sources only. The audit did not
create a Supabase branch, restore a dump, seed data or write to a database.

| Source                               | Read-only evidence                                                                                                               | Representative candidate |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Live Supabase project                | `2` dossiers, `1` option, `102` criteria; the checked-in preflight failed with SQLSTATE `P0001`                                  | No                       |
| Supabase development branches        | The project reported `0` existing branches                                                                                       | No source available      |
| VPS snapshot `20260731T150001Z.dump` | Offline `pg_restore --data-only` inspection found `2` dossiers, `1` option, `1` baseline version, `4` groups and `102` criteria  | No                       |
| VPS snapshot `20260801T150001Z.dump` | Offline `pg_restore --data-only` inspection found `2` dossiers, `1` option, `2` baseline versions, `8` groups and `102` criteria | No                       |
| Other local snapshots                | A read-only filesystem search found no `.dump` files beyond the two snapshots above                                              | No source available      |
| `gdrive:qltbyt-backup/`              | The configured rclone directory contained no dump files                                                                          | No source available      |
| GitHub repository and Actions        | Actions reported `0` artifacts; `database/` contains migrations only                                                             | No source available      |

Both available snapshots fail the upper-limit invariant from total option
cardinality alone, so restoring either snapshot would not make representative
plan capture possible. No restore was attempted.

The exact blocker is the absence of an already-existing environment or snapshot
where one dossier has more than `100` options and a paired baseline has exactly
`102` criteria. P13A-P1 cannot proceed through the approved read-only,
non-seeded path until such a source is made available.

## Plan result

No representative EXPLAIN was captured. Running the plan against one option
would not prove bounded work, cardinality, spill behavior or correlated
`SubPlan` behavior at the required scale.

The test-only read-only preflight is:

`supabase/tests/technical_configuration_reference_ranking_performance_preflight.sql`

It fails closed with the observed inventory until existing data satisfies the
required scale. Passing this preflight means only that plan capture may begin;
it is not representative performance evidence by itself. It does not seed data
or execute a write statement.

## Phase decision

P13A-P1 remains blocked before plan capture and P13A-V remains blocked.

P13A-P2 is not instantiated because no representative plan ran and therefore
no reproducible ranking query or index invariant failed. Treating missing test
data as a query remediation would exceed the approved P13A-P2 scope.

The non-seeded representative-data blocker is tracked by
[GitHub issue #836](https://github.com/thienchi2109/qltbyt-nam-phong/issues/836).

No live write occurred. No Supabase branch was created, and no dump restore or
seed occurred. No migration, RPC, index or production remediation was created
or applied.
