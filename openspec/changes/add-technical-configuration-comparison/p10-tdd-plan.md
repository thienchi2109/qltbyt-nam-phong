# P10 TDD Plan - Comparison Read Contracts

## Scope And Delivery Decision

P10 comparison reads are delivered as two deploy-safe contract leaves before
the existing matrix UI leaf:

```text
P7B2 + P9B2 -> P10A1
P10A1       -> P10A2
P3A + P10A2 -> P10B1 -> P10B2 -> P10B3
```

Each leaf starts from `main` after its dependencies have merged. Do not stack
unmerged P10 implementation branches. The branches are:

1. `feat/technical-config-p10a1-comparison-read-rpc`
2. `feat/technical-config-p10a2-comparison-read-client`

P10A2 starts only after P10A1 has merged, its migration has been applied with
explicit permission and its database phase gate has passed. P10B1 starts only
after P10A2 has merged and P3A is available; P10B2/P10B3 then land
sequentially from updated `main`.

Production-only implementation estimates, excluding tests and documentation:

| Leaf  |                            Production files | Estimated additions |
| ----- | ------------------------------------------: | ------------------: |
| P10A1 | 1 RPC migration; optional 1 index migration |             300-480 |
| P10A2 |                          6 TypeScript files |             200-360 |

Do not split P10A1 into core rows, evidence aggregation or index-only leaves.
Do not split P10A2 into allowlist, types, adapter or hook leaves. Those splits
would change one contract across multiple deploy points without creating an
independent user or operational boundary.

No P10A leaf creates matrix UI, response authoring, manual assessment, ranking
or AI behavior. No live database write or state-changing phase-gate execution
is allowed until the user explicitly authorizes that exact Supabase MCP
operation.

## Fixed Cross-Leaf Contracts

### RPC Identity And Request

P10A1 owns one RPC:

```text
technical_configuration_comparison_get(
  p_baseline_version_id uuid,
  p_option_ids uuid[],
  p_page integer,
  p_page_size integer
)
```

- The RPC derives the dossier from `p_baseline_version_id`; it does not accept a
  separate dossier ID.
- `p_option_ids` contains 1-8 non-null, unique UUIDs.
- Option order is the request order. SQL preserves it with ordinality; P10A2
  snapshots and preserves it in the query key and adapter.
- Null `p_baseline_version_id`, `p_page` or `p_page_size` is rejected.
- `p_page >= 1` and is not nullable.
- `1 <= p_page_size <= 100` and is not nullable.
- Offset arithmetic uses `bigint`.
- Total options in a dossier remain unlimited.

### Response And Paging

The exact top-level and nested wire shape is:

```json
{
  "data": {
    "dossier": {
      "id": "uuid",
      "device_type_name": "string",
      "name": "string",
      "revision": 1,
      "archived_at": "timestamp|null"
    },
    "baseline_version": {
      "id": "uuid",
      "dossier_id": "uuid",
      "version_number": 1,
      "status": "draft|locked",
      "revision": 1
    },
    "options": [
      {
        "id": "uuid",
        "supplier_id": "uuid",
        "supplier_name": "string",
        "model": "string|null",
        "manufacturer": "string|null",
        "option_name": "string|null",
        "display_label": "string"
      }
    ],
    "criteria": [
      {
        "group": {
          "id": "uuid",
          "name": "string",
          "sort_order": 0
        },
        "criterion": {
          "id": "uuid",
          "criterion_code": "string",
          "title": "string|null",
          "requirement_text": "string",
          "sort_order": 0
        },
        "baseline_evidence": {
          "document_count": 0,
          "citation_count": 0,
          "has_evidence": false
        },
        "option_values": [
          {
            "option_id": "uuid",
            "comparison_set_id": "uuid|null",
            "response": {
              "id": "uuid",
              "response_text": "string",
              "supplementary_information": "string"
            },
            "evidence": {
              "document_count": 0,
              "citation_count": 0,
              "has_evidence": false
            }
          }
        ]
      }
    ]
  },
  "total": 500,
  "page": 1,
  "page_size": 100
}
```

- `response` is nullable as one object. Its nested fields are non-null when the
  object exists.
- `options` follows request order.
- `criteria` follows canonical group and criterion order.
- Every criterion's `option_values` follows the same request order as `options`.
- `total` is the full criterion count for the selected baseline version.
- Criteria are paged before option aggregation.
- A selected option without a comparison set returns
  `comparison_set_id: null`, `response: null` and zeroed evidence summary;
  reading never creates the missing set.

Evidence summaries have exactly three fixed-size fields:
`document_count`, `citation_count` and `has_evidence`. The matrix RPC does not
return citation/document arrays, reference-product responses, full documents or
excerpts. P10B3 lazy-loads full baseline/option evidence through the existing
bounded document RPCs when the detail panel opens. Reference-product
response/evidence remains owned by the existing P7 surfaces.

### Authorization And Read Semantics

- Raw `admin` and `global` are the only allowed role semantics.
- Role and non-empty `user_id` claims are mandatory and fail closed.
- This module has no `don_vi` tenant key; do not add a synthetic tenant guard.
- Baseline version, options, suppliers and comparison sets must belong to the
  same dossier.
- Missing, foreign and mixed-dossier IDs use one generic
  permission/not-found contract to avoid an ownership oracle.
- Archived dossiers and locked baselines remain readable.
- The RPC is side-effect free: it creates no comparison set, changes no
  revision and writes no audit metadata.
- `SECURITY DEFINER` uses `SET search_path = public, pg_temp`.
- Direct execution privileges are revoked by default and only the required
  authenticated path is granted.

The error contract is fixed:

- missing claims or disallowed role:
  SQLSTATE `42501`, message `permission_denied`;
- null/empty/duplicate/out-of-range request arguments:
  SQLSTATE `PT422`, message `validation_error`;
- missing baseline, missing option, foreign option or mixed-dossier selection:
  SQLSTATE `PT404`, message `not_found`.

### Query And Evidence Semantics

- P10A1 uses one set-based RPC, not sequential existing per-option RPC calls.
- The implementation selects explicit fields and must not use `SELECT *`.
- Selected options are represented by a CTE with ordinality.
- Evidence counts are pre-aggregated for the paged criteria and exact owner
  scope.
- Baseline and option evidence must never cross-link across baseline version,
  criterion, option or comparison set.
- `supplementary_information` remains separate from response/compliance. P10
  introduces no new derived compliance rule.
- Add an index only when inner-query `EXPLAIN` demonstrates that existing
  indexes do not satisfy the bounded aggregation. If that evidence appears
  after the RPC migration is applied, the index lands in an optional follow-up
  migration inside P10A1.

## Ownership And Conflict Prevention

| Concern                                | Primary owner                  | Downstream use                   | Forbidden overlap                         |
| -------------------------------------- | ------------------------------ | -------------------------------- | ----------------------------------------- |
| RPC signature, SQL, grants and indexes | P10A1                          | P10A2 calls the fixed RPC        | P10A2/P10B1-3 must not redefine SQL       |
| Authorization and same-dossier guards  | P10A1                          | P10A2 preserves errors           | No client-only authorization substitute   |
| Bounds, order and criterion paging     | P10A1                          | P10A2 mirrors in keys/enablement | P10A2 must not sort IDs or raise limits   |
| Evidence summary scope                 | P10A1                          | P10A2 types; P10B1/B3 render     | No full-evidence matrix payload           |
| RPC-name manifest and proxy allowlist  | P10A2                          | P10B1 consumes the hook          | P10A1 does not expose the proxy           |
| Wire/domain types and typed adapter    | P10A2                          | P10B1 imports them               | P10B1-3 create no second adapter          |
| Query key and read hook                | P10A2                          | P10B1 selects/render pages       | No mutation or P8/P9 invalidation         |
| Core matrix/text inspection            | P10B1                          | P10B2/P10B3 extend it            | No column/evidence ownership overlap      |
| Column visibility/pinning/focus        | P10B2                          | P13B regression coverage         | View state must not change request order  |
| Response authoring and dirty state     | P8B3                           | Matrix remains read-only         | P10 must not duplicate authoring controls |
| Full evidence document loading         | Existing P7B2/P9B2 RPCs; P10B3 | Detail panel lazy-loads          | No preload or evidence mutation controls  |
| Reference-product response/evidence    | Existing P7A2/P7B2 surfaces    | Remains separately inspectable   | P10A1 does not aggregate it               |

`callTechnicalConfigurationRpc` is a shared transport hotspot. P10A2 may call
it through a new module-local adapter but must not change its behavior,
signature, retry policy or error normalization.

Scenario ownership remains explicit:

- P10A1 is the primary owner of TC-13-S04 and a required database prerequisite
  for TC-13-S01.
- P10A2 is a required client/proxy prerequisite for TC-13-S01 and reruns P10A1
  source contracts.
- P10B1 owns TC-13-S01, the core-dimension/text portion of TC-13-S02 and the
  TC-17-S01 core text surface.
- P10B2 owns TC-13-S03; P10B3 owns the evidence-inspection portions of
  TC-13-S02/S05; P12A completes their manual-assessment composition.
- P10A1/P10A2 only preserve structural separation for supplementary
  information. TC-17-S02 remains P8A3-owned with P10B1 regression coverage.

## Required Workflow Before Each Leaf

- Recall AgentMemory with the leaf ID and target symbols.
- Run Code Review Graph minimal context, then GitNexus impact for narrowed
  symbols before editing.
- Invoke `karpathy-coding-heuristics`.
- For P10A1, invoke `supabase-postgres-best-practices`.
- For P10A2, invoke `next-best-practices` then `react-best-practices`.
- Invoke `code-deduplication` before adding shared types, adapters, hooks or
  query-key behavior.
- Check the latest local migration touching every referenced table/function
  before choosing the P10A1 timestamp.
- Keep production changes inside the files assigned to the active leaf. A
  dependency gap requires an OpenSpec/issue update, not an opportunistic edit
  in another phase's files.

## P10A1 - Comparison Matrix Read RPC And Performance Contract

**Depends on:** P7B2, P9B2

**Deploy boundary:** dormant database contract only. It may be applied and
verified before any proxy/client exposure.

### Files

- Create:
  `supabase/migrations/<ordered_timestamp>_technical_configuration_comparison_reads.sql`
- Optionally create after live plan evidence:
  `supabase/migrations/<later_ordered_timestamp>_technical_configuration_comparison_indexes.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-comparison-migration.test.ts`
- Create:
  `supabase/tests/technical_configuration_comparison_phase_gate.sql`

Do not modify TypeScript RPC manifests, allowlists, adapters, hooks, query keys
or matrix components in P10A1.

### RED 1 - Migration Source Contract

Add a failing source-contract test that requires:

- exact RPC name, arguments and top-level response envelope;
- exact nested keys, types, nullability, ordering and fixed evidence-summary
  shape;
- `SECURITY DEFINER` and `SET search_path = public, pg_temp`;
- raw admin/global normalization and required role/user claims;
- exact `42501`/`PT422`/`PT404` message contracts;
- same-dossier validation without a `don_vi` guard;
- non-null baseline/page/page-size, 1-8 unique ordered option IDs and 1-100
  criterion paging;
- explicit column lists and no `SELECT *`;
- criteria-first paging and selected-option ordinality;
- archived/locked read support and no mutation statements;
- explicit revoke/grant statements;
- primary RPC migration length at or below 450 lines;
- the rollback-only phase-gate fixture.

Run:

```bash
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/technical-configuration-comparison-migration.test.ts
```

Expected RED: the comparison migration and phase gate do not exist.

### GREEN 1 - Minimal Bounded RPC

Create the migration with the smallest set-based implementation that satisfies
the source contract:

1. Validate claims and paging arguments.
2. Resolve the baseline and owning dossier.
3. Validate every requested option against that dossier.
4. Page ordered criteria.
5. Aggregate exact baseline/option summaries for only that page.
6. Return the fixed envelope without writes.
7. Revoke and grant only the required execution privileges.

Do not add speculative indexes in this step.

Run the same focused Vitest command. Expected GREEN: the source contract passes.

### RED 2 - SQL Behavior And Performance Gate

Add a rollback-only SQL phase gate covering:

- allowed raw admin/global claims;
- missing role, empty user ID and disallowed role rejection;
- null baseline, page and page-size rejection;
- missing baseline, missing option and mixed-dossier generic rejection;
- null, empty, duplicate and nine-option rejection;
- preservation of option request order;
- exact total/page/page-size behavior across more than 100 criteria;
- a ninth option succeeding in a separate request;
- nullable response/empty evidence when no comparison set exists;
- exact baseline/option evidence isolation and fixed-size evidence summaries;
- separate supplementary information;
- archived dossier and locked baseline reads;
- unchanged comparison-set count, dossier revision and audit metadata;
- representative 500 criteria, 50 total options and 8 selected options;
- `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` of the inner set-based query, not
  only `SELECT technical_configuration_comparison_get(...)`.

Expected RED before implementation is complete: at least one behavior or query
plan requirement fails.

### GREEN 2 - Exact Aggregation And Proven Indexes

Complete the page-local aggregations and inspect representative `EXPLAIN`.
Passing means the plan is restricted to paged criteria and selected comparison
sets, contains no per-criterion/per-option repeated subplan and has no cartesian
row expansion across all dossier criteria, options and citations.

If the live plan proves an index is required after the RPC migration is already
applied, add the smallest idempotent follow-up index migration inside P10A1,
apply it with fresh explicit permission and rerun the full phase gate. P10A2
cannot begin until the optional migration has also merged/applied/gated.

Rerun the source-contract test locally. Do not execute the SQL phase gate
against live Supabase without explicit permission.

### REFACTOR

- Keep CTEs ordered by validation, criteria page and owner-specific aggregates.
- Keep evidence summaries bounded and avoid cartesian criteria x options x
  citations expansion.
- Do not create an index-only leaf. A plan-proven follow-up index migration
  remains part of P10A1.
- Do not add helper functions unless they remove real duplication and preserve
  the same security/grant contract.

### P10A1 Verification And Live Gate

Local verification:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/technical-configuration-comparison-migration.test.ts
openspec validate add-technical-configuration-comparison \
  --type change --strict --no-interactive
```

Live verification is a separate permission boundary:

1. Ask for explicit permission to apply the exact P10A1 RPC migration through
   Supabase MCP.
2. After apply, run read-only security and performance advisors.
3. Ask for explicit permission to execute
   `supabase/tests/technical_configuration_comparison_phase_gate.sql`.
4. Execute the phase gate through Supabase MCP inside its rollback-only
   transaction.
5. If the inner-query plan proves an index is required, create the optional
   follow-up migration, obtain fresh permission to apply it and obtain fresh
   permission to rerun the rollback-only phase gate.
6. Confirm fixture cleanup and rerun read-only advisors if the gate exercises
   planner-sensitive objects.

Do not use the Supabase CLI. If either permission is absent, stop before that
operation and report the corresponding live gate as pending.

### P10A1 Exit Gate

- The migration source contract passes.
- The exact RPC migration and any plan-proven follow-up index migration are
  applied with explicit permission.
- The rollback-only SQL phase gate passes with separate explicit permission.
- Security/performance advisors introduce no unresolved P10A1 regression.
- The 500 x 50 x 8 plan is reviewed and any new index is evidence-based.
- No proxy/client/UI file changed.

Only then may P10A2 begin.

## P10A2 - Comparison Read Client Contract

**Depends on:** P10A1 merged, applied and DB-gated

**Deploy boundary:** dormant typed proxy/client contract. P10B1 is the first UI
consumer.

### Files

- Create: `src/lib/technical-configuration-comparison-rpcs.ts`
- Create:
  `src/app/(app)/technical-configurations/comparison-types.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-comparison-rpc.ts`
- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationComparison.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/comparison-contract.test.ts`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify:
  `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`

Do not modify the P10A1 migration/phase gate, shared
`callTechnicalConfigurationRpc`, P8/P9 hooks or any matrix component in P10A2.

### RED 1 - RPC Name And Proxy Exposure

Add failing source tests requiring:

- one exported RPC-name constant for
  `technical_configuration_comparison_get`;
- one append-only proxy allowlist entry;
- no mutation RPC name;
- no change to shared transport behavior.

Expected RED: the name manifest and allowlist entry are absent.

### RED 2 - Types And Adapter

Add failing adapter tests requiring:

- exact P10A1 arguments;
- ordered option IDs forwarded unchanged;
- exact page/page-size forwarding;
- one RPC call per adapter invocation;
- `AbortSignal` forwarding;
- typed normalization of the fixed response envelope;
- no evidence-detail follow-up calls and no mutation/invalidation.

Expected RED: types and adapter do not exist.

### RED 3 - Query Key And Hook

Add failing hook tests requiring:

- query keys differ when option order differs;
- query keys hold an immutable snapshot of option IDs rather than the caller's
  mutable array reference;
- query keys differ by baseline version, page and page size;
- no fetch for missing baseline, 0 options, duplicate options or more than 8
  options;
- one fetch for valid inputs;
- `staleTime: 30_000`;
- `retry: false`;
- `refetchOnWindowFocus: false`;
- cancellation forwards the query `AbortSignal`.

Expected RED: the comparison query-key factory and hook do not exist.

### GREEN

Implement only:

1. RPC-name manifest.
2. Append-only allowlist entry.
3. Wire/domain types.
4. Typed adapter around the existing shared transport.
5. Ordered comparison query-key factory that snapshots option IDs.
6. `useTechnicalConfigurationComparison`.

Do not add matrix state, selection UI, cache invalidation or a second
per-option data path.

### REFACTOR

- Keep wire types separate from domain-facing types when normalization is
  required.
- Keep the adapter responsible for request/response translation.
- Keep enablement and query policy in the hook.
- Reuse established query-key and RPC error patterns.
- Do not add a generic comparison abstraction before P10B1 demonstrates a
  second consumer.

### P10A2 Verification

Focused tests:

```bash
node scripts/npm-run.js run test:run -- \
  'src/app/(app)/technical-configurations/__tests__/comparison-contract.test.ts' \
  src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-comparison-migration.test.ts
```

Full diff gates:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run react-doctor
openspec validate add-technical-configuration-comparison \
  --type change --strict --no-interactive
```

P10A2 performs no live database write and does not rerun the state-changing SQL
phase gate unless the user separately authorizes that exact execution.

### P10A2 Exit Gate

- RPC-name and allowlist source tests pass.
- Types and adapter match the applied P10A1 contract.
- Ordered query-key and hook tests pass.
- P10A1 migration source tests remain green.
- Shared RPC transport and P8/P9 consumers are unchanged.
- No matrix UI exists.

Only then may P10B1 begin.

## P10B1/P10B2/P10B3 Handoff Contract

The UI delivery contract, file ownership, RED/GREEN sequence and per-leaf gates
live in [p10b-tdd-plan.md](./p10b-tdd-plan.md).

Across all three leaves:

- consume `useTechnicalConfigurationComparison` and the P10A2 types/adapter/query
  key without redefining them;
- preserve selected option order and the 1-8 option / 1-100 criterion bounds;
- keep response authoring, dirty state and save commands in P8B3;
- lazy-load full evidence only in P10B3 through existing bounded P7/P9 paths;
- treat P10B3 as the evidence-inspection portion of TC-13-S05; P12A composes
  manual assessment into the same detail workflow after P11;
- introduce no manual assessment persistence, ranking or derived compliance;
- run focused React, keyboard and responsive-source tests without browser tests;
  P13B remains the browser screenshot/interaction regression owner.
