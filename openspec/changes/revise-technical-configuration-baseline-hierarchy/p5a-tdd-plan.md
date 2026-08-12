# P5A TDD Plan - Aggregate Status Model

Issue: #890

Branch: `feat/issue-890-p5a-aggregate-status-model`

Base: clean `main` at merge commit `a0d85678`

## Scope

Implement P5A.1-P5A.3 as a pure TypeScript domain model with focused Vitest
coverage. This phase does not wire the model into production UI, hooks, RPCs,
migrations, or live Supabase state.

## Assumptions

- The canonical leaf status contract is
  `TechnicalConfigurationDerivedStatus` from
  `src/lib/technical-configuration-evaluation.ts`.
- The canonical failing leaf value is `fails`; the OpenSpec prose word
  `failed` describes that existing domain value.
- Missing entries in the leaf status map are treated as `not_evaluated`.
- A subgroup aggregates only its direct leaf criterion IDs.
- A section aggregates its direct leaf criterion IDs plus every leaf criterion
  ID declared by its subgroups.
- Duplicate criterion IDs are counted once per aggregate and once in the
  hierarchy-wide leaf universe.
- Structural IDs are metadata only. They never enter the leaf universe,
  descendant counts, progress denominators, filter totals, ranking inputs, or
  score inputs.

## Model Contract

Add `src/lib/technical-configuration-hierarchy-aggregate-status.ts` with:

- stable aggregate states and Vietnamese labels:
  `no_criteria`, `failed`, `in_progress`, `needs_clarification`,
  `not_applicable`, and `passed`;
- exact counts for every canonical derived leaf status;
- minimal section/subgroup hierarchy input types containing structural IDs and
  leaf criterion IDs only;
- one builder that returns:
  - the hierarchy-wide unique leaf criterion IDs;
  - the hierarchy-wide leaf status projection and exact status counts;
  - subgroup rollups;
  - section rollups;
  - each rollup's unique descendant IDs, descendant count, exact status counts,
    and aggregate status.

Do not change `deriveTechnicalConfigurationEvaluationStatus` or existing
production consumers in P5A.

## File Map

Create:

- `src/lib/technical-configuration-hierarchy-aggregate-status.ts`
  - owns aggregate precedence, unique-ID collection, exact counts, and rollups.
- `src/lib/__tests__/technical-configuration-hierarchy-aggregate-status.test.ts`
  - owns exhaustive precedence and owner rollup behavior.
- `src/lib/__tests__/technical-configuration-hierarchy-aggregate-structure.test.ts`
  - owns hierarchy-wide deduplication, empty structural rows, snapshot
    independence, and P5A.3 denominator/filter/ranking/score invariants.

Update after GREEN:

- `openspec/changes/revise-technical-configuration-baseline-hierarchy/tasks.md`
  - mark P5A.1-P5A.3 complete only after all required verification passes.

No other production source file is in scope.

## TDD Sequence

### RED 1 - Aggregate Precedence And Counts

1. Add a focused test suite that imports the planned model API.
2. Cover:
   - zero descendants;
   - fail-fast `fails`, including a simultaneous `not_evaluated` leaf;
   - incomplete `not_evaluated` before review-required statuses;
   - `unclear` and `insufficient_evidence` review-required cases;
   - all `not_applicable`;
   - passing `meets`/`exceeds` combinations;
   - exact count for every canonical derived status;
   - supplementary `exceeds` count without a separate aggregate state.
3. Run the focused suite and confirm RED because the model module does not yet
   exist.

### RED 2 - Hierarchy Rollups And Structural Invariants

1. Add subgroup and section cases with:
   - direct section criteria;
   - subgroup criteria;
   - multiple subgroups;
   - duplicate leaf IDs inside and across structural nodes;
   - missing leaf statuses.
2. Assert subgroup rollups use direct subgroup leaves only.
3. Assert section rollups use the unique union of direct and subgroup leaves.
4. Assert hierarchy-wide leaf IDs remain unique and structural IDs are absent.
5. Compare flat and nested hierarchies through the returned leaf projection:
   - progress denominator uses the leaf projection length;
   - filter totals use every canonical status count;
   - ranking inputs preserve the unique criterion universe and map the
     failed/insufficient/exceeds fields available from derived statuses;
   - ranking completeness remains owned by consumers with the raw
     technical/evidence axes and is not inferred from `not_evaluated`;
   - score inputs remain the same ordered leaf-status set without inventing a
     numeric or weighted score.

### GREEN - Minimal Model

1. Add the stable aggregate status values, labels, types, and empty count
   factory.
2. Normalize leaf IDs with `Set` while preserving first-seen canonical order.
3. Resolve missing status entries as `not_evaluated`.
4. Count each unique descendant exactly once.
5. Apply precedence in this order:
   - `no_criteria`;
   - `failed`;
   - `in_progress`;
   - `needs_clarification`;
   - `not_applicable`;
   - `passed`.
6. Build subgroup and section rollups without mutating input.
7. Return the unique hierarchy leaf universe and canonical status projection
   separately from structural rollups.
8. Run the focused suite to GREEN.

### REFACTOR

1. Keep helpers private unless a testable public contract is required.
2. Keep the model independent of React, RPC, wire-decoder, and database types.
3. Keep source and test files below repository size thresholds.
4. Run Prettier and simplify names only after behavior is green.

## Verification

Run through one context-mode batch where practical:

1. `node scripts/npm-run.js run format:check`
2. `node scripts/npm-run.js run verify:no-explicit-any`
3. `node scripts/npm-run.js run verify:dedupe`
4. `node scripts/npm-run.js run typecheck`
5. `node scripts/npm-run.js exec vitest run src/lib/__tests__/technical-configuration-hierarchy-aggregate-status.test.ts src/lib/__tests__/technical-configuration-hierarchy-aggregate-structure.test.ts`
6. `node scripts/npm-run.js run react-doctor`
7. `openspec validate revise-technical-configuration-baseline-hierarchy --strict`

Then run change-aware review:

- Code Review Graph `detect_changes_tool` with minimal output;
- GitNexus `detect_changes` and focused impact/context for risky symbols;
- xhigh independent code review, fixing findings and repeating review until
  zero findings.

## Completion Boundary

Stop before landing. Report issue, branch, changed files, RED/GREEN evidence,
gate results, strict OpenSpec result, and xhigh review result. Do not merge,
push, or close issue #890 until the user approves landing.
