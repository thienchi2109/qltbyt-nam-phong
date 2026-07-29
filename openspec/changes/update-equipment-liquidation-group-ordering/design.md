## Context

The existing `p_liquidation_last` behavior was introduced to keep equipment that
is both decommissioned and assigned to the liquidation warehouse at the end of
the main Equipments result. The current effective order is:

1. non-liquidation rows before liquidation rows;
2. requested table sort inside each group;
3. equipment ID as the deterministic tie-breaker.

The client uses server-side manual sorting and does not reorder the returned
page. The default empty table sort becomes `id.asc`, and persisted user sorting
can replace that secondary key.

The target warehouse currently contains only rows that satisfy the liquidation
condition. Therefore, filtering to that warehouse removes all variation from
the first priority key and exposes the requested sort as the visible top-level
order.

`public.thiet_bi` has no `updated_at` column. It does have
`ngay_ngung_su_dung`, stored as nullable ISO `YYYY-MM-DD` text. The edit form
auto-populates today's Vietnam date when status transitions from a
non-decommissioned status to `Ngưng sử dụng` and the field is empty.

Read-only live evidence on 2026-07-29:

- 272 visible rows matched the exact liquidation condition;
- 200 rows had ISO-shaped decommission dates;
- 72 rows had null dates;
- 0 rows had non-ISO non-null dates;
- 1 row had `ngay_ngung_su_dung = '2026-07-29'`.

## Goals

- Keep the whole liquidation group at the end of the complete filtered result.
- Keep newly dated liquidation entries at the end of that group.
- Produce the same chronology with and without the warehouse filter.
- Preserve server pagination, requested sorting, RPC compatibility, security,
  grants, and caller scope.
- Keep the implementation limited to one SQL function replacement and focused
  regression coverage.

## Non-Goals

- Record the exact timestamp when equipment enters the liquidation warehouse.
- Define exact arrival order between multiple devices decommissioned on the
  same date.
- Backfill the 72 legacy null dates.
- Change how `ngay_ngung_su_dung` is entered, validated, or displayed.
- Add or use `updated_at`.
- Change export, transfer, maintenance-selection, cached-search, or other
  `equipment_list_enhanced` consumers.
- Change frontend table state, session storage, or TanStack Table behavior.

## Decisions

### 1. Use `ngay_ngung_su_dung` as the v1 chronology key

The implementation will use the existing decommission date rather than adding a
new warehouse-entry timestamp.

Rationale:

- it already exists in the RPC output and edit contract;
- the current transition flow auto-fills the date;
- ISO text sorts chronologically in ascending lexical order;
- no schema, payload, type, or frontend change is required;
- the observed bug is fixed for the approved status-plus-department transition.

Accepted limitation:

- if equipment was already `Ngưng sử dụng` and only its department changes to
  the liquidation warehouse, its existing date may be old or null;
- multiple entries on the same date are ordered by the requested sort and ID,
  not by exact transition time.

If exact warehouse-entry time becomes a requirement, it should be a separate
change introducing a dedicated `liquidation_entered_at timestamptz` contract and
a DB-owned transition mechanism.

### 2. Keep legacy null/blank dates before dated liquidation rows

Null or blank dates represent legacy/unknown chronology. They will receive an
empty internal sort key, which sorts before valid ISO dates in ascending order.

This avoids an unsafe date cast and prevents legacy null records from occupying
the final positions after newly dated entries. No backfill is included.

### 3. Make chronology stronger than the requested sort

When `p_liquidation_last = true`, the effective order will be equivalent to:

```sql
CASE
  WHEN <exact liquidation condition> THEN 1
  ELSE 0
END ASC,
CASE
  WHEN <exact liquidation condition>
    THEN COALESCE(NULLIF(btrim(tb.ngay_ngung_su_dung), ''), '')
  ELSE ''
END ASC,
tb.<validated_sort_column> <validated_sort_direction>,
tb.id ASC
```

Consequences:

- normal rows remain ordered by the requested sort because their chronology key
  is constant;
- liquidation rows with older/unknown dates appear before newer dates;
- a custom user sort cannot move a newer dated liquidation row above an older
  dated row;
- rows with the same date retain the requested user sort and deterministic ID
  tie-breaker.

### 4. Preserve exact condition and caller scope

The liquidation condition remains:

- normalized department equals `VT-TBYT- KHO THANH LÍ`; and
- trimmed status equals `Ngưng sử dụng`.

The behavior remains guarded by `p_liquidation_last`. The parameter keeps its
default `false`, and only the main Equipments hook continues to opt in.

### 5. Use a superseding migration

The implementation will create a new migration that sorts after
`20260722094302_equipment_list_liquidation_last.sql`. It will replace the current
18-argument function without changing:

- function name, parameter order, defaults, or JSON response;
- JWT guards and allowed-tenant logic;
- `SECURITY DEFINER`;
- `SET search_path = public, pg_temp`;
- explicit execute grants and revokes;
- filters, search behavior, count behavior, selected columns, or pagination.

No existing migration will be edited or renamed.

## Test Strategy

### Source-contract test

Extend the existing migration test to require:

- a new migration after the current liquidation-order migration;
- the liquidation priority key before the chronology key;
- the chronology key before the requested dynamic sort;
- the requested sort before `OFFSET/LIMIT`;
- unchanged opt-out ordering when the flag is false;
- unchanged signature, security attributes, and grants.

### Transactional SQL smoke

Extend the rollback-only smoke fixture with:

- normal rows;
- liquidation rows with null, older, same-day, and newest dates;
- an unfiltered call;
- a call filtered to the liquidation warehouse;
- a custom requested sort that would otherwise put the newest row first;
- an unfiltered page boundary proving the newest dated liquidation cohort
  remains on the final applicable page;
- a warehouse-filtered page boundary proving the same chronology remains on the
  final applicable page.

The smoke must prove identical liquidation chronology with and without the
warehouse filter.

### Existing caller-scope and overload regressions

Run the existing caller-scope Vitest file in PR 2 without changing it. Run the
read-only `supabase/tests/equipment_list_enhanced_overload_regression.sql`
against live database metadata after the migration is applied. No new frontend
behavior test is required unless implementation unexpectedly touches client
code.

## Rollout

1. Merge the focused SQL/TDD implementation PR without applying live changes.
2. Request explicit user authorization for the exact live migration apply and
   transactional smoke write set.
3. Inspect the live signature and migration state through Supabase MCP.
4. Apply the superseding migration through Supabase MCP.
5. Verify the live function definition and execute grants read-only.
6. Run the read-only overload regression SQL.
7. Run the approved rollback-only smoke fixture.
8. Run Supabase security and performance advisors.
9. Record rollout evidence, then archive the OpenSpec change in a separate PR.

Rollback is forward-only: if rollout verification finds a regression, create
and apply a new superseding migration that restores the previous `v_order_by`
expression. Do not edit migration metadata or mutate an already applied file.

## PR Boundaries

### PR 1 - OpenSpec proposal

Documentation only: proposal, design, tasklist, and spec delta. No runtime code
or live DB writes.

### PR 2 - SQL ordering contract

One superseding migration plus the focused source-contract and transactional
smoke test files. This PR has a hard cap of three changed files and is organized
as four small work packages: failing source contract, minimal SQL change,
transactional behavior proof, and regression gates. No frontend changes, helper
extraction, unrelated SQL cleanup, or live DB apply belongs in the PR. Any need
for an additional source file or schema change requires a separate follow-up
proposal rather than expanding this boundary.

### Operational checkpoint

Apply and verify the migration only after explicit approval. This is tracked as
a phase but does not require an artificial code PR.

### PR 3 - OpenSpec archive

Archive the completed change and publish the capability spec after successful
deployment verification. No runtime changes.
