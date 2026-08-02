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

No live write occurred. No migration, RPC, index or production remediation was
created or applied.
