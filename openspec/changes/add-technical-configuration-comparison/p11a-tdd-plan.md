# P11A Manual Evaluation Domain Contract Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze the pure manual-evaluation domain values, Vietnamese labels, and deterministic derived-status rule required by P11A.

**Architecture:** Add one dependency-free TypeScript module under `src/lib` and one exhaustive Vitest suite. The module validates every supplied non-null axis value before applying the canonical precedence table; it exposes no persistence, RPC, client, hook, UI, or AI runtime behavior.

**Tech Stack:** TypeScript, Vitest, OpenSpec

---

## Scope And Frozen Inputs

- Base commit: `0aa44a602f9b050464eec5fd2ae9400187d3b1ef`
- Branch: `feat/p11a-manual-evaluation-domain-contract`
- Depends on completed P4 and P8A3 artifacts already present on `main`.
- Create only:
  - `src/lib/technical-configuration-evaluation.ts`
  - `src/lib/__tests__/technical-configuration-evaluation.test.ts`
- Update only P11A planning/task artifacts needed to record the executed leaf.
- Do not add or change migrations, SQL, RPC manifests, API routes, typed clients,
  hooks, React components, query keys, persistence types, or AI runtime code.

## Domain Contract

The module owns these stable ASCII values and Vietnamese display labels:

- Technical axis:
  - `exceeds` -> `Vượt yêu cầu`
  - `meets` -> `Đạt`
  - `fails` -> `Không đạt`
  - `unclear` -> `Chưa rõ`
  - `not_applicable` -> `Không áp dụng`
- Evidence axis:
  - `complete` -> `Đầy đủ`
  - `partial` -> `Một phần`
  - `missing` -> `Thiếu`
  - `not_required` -> `Không yêu cầu`
- Derived status:
  - `not_evaluated` -> `Chưa đánh giá`
  - `not_applicable` -> `Không áp dụng`
  - `fails` -> `Không đạt`
  - `unclear` -> `Chưa rõ`
  - `insufficient_evidence` -> `Chưa đủ bằng chứng`
  - `exceeds` -> `Vượt yêu cầu`
  - `meets` -> `Đạt`

`deriveTechnicalConfigurationEvaluationStatus` accepts nullable axis values and
returns one derived status. Every supplied non-null value must be canonical;
invalid technical or evidence values throw before precedence is evaluated.

## Chunk 1: RED - Freeze Values And Labels

- [x] Create `src/lib/__tests__/technical-configuration-evaluation.test.ts`.
- [x] Assert the exact ordered technical-axis tuple and label map.
- [x] Assert the exact ordered evidence-axis tuple and label map.
- [x] Assert the exact ordered derived-status tuple and label map.
- [x] Run the focused test and confirm it fails because the P11A module does not
      exist:

```bash
node scripts/npm-run.js run test:run -- \
  src/lib/__tests__/technical-configuration-evaluation.test.ts
```

## Chunk 2: RED - Freeze The Complete Truth Table

- [x] Add table-driven cases for `TC-16-S01` through `TC-16-S07`.
- [x] Cover `fails`, `unclear`, and `not_applicable` with every canonical
      evidence value plus `null` and `undefined`.
- [x] Cover `meets` and `exceeds` with `complete`, `not_required`, `partial`,
      `missing`, `null`, and `undefined`.
- [x] Cover missing technical axis with every canonical evidence value plus
      `null` and `undefined`.
- [x] Assert invalid non-null technical and evidence values throw even when the
      other axis would otherwise determine the result by precedence.
- [x] Run the focused test and confirm the new cases fail for missing behavior.

## Chunk 3: GREEN - Implement The Minimal Pure Contract

- [x] Create `src/lib/technical-configuration-evaluation.ts`.
- [x] Export readonly canonical value tuples and union types derived from them.
- [x] Export exhaustive Vietnamese label maps checked with `satisfies Record`.
- [x] Implement only the validation and precedence needed by the frozen truth
      table.
- [x] Keep the module dependency-free and side-effect-free.
- [x] Run the focused test until all cases pass.

## Chunk 4: REFACTOR And Boundary Audit

- [x] Remove test or implementation duplication without widening the API.
- [x] Confirm no equivalent manual-evaluation contract already exists through
      Code Review Graph, GitNexus, and repository search.
- [x] Confirm the diff adds no DB, migration, SQL, RPC, route, client, hook,
      React, query-key, persistence, or AI runtime artifact.
- [x] Mark only `P11A.1` through `P11A.5` complete in `tasks.md`.

## Verification

Run the TypeScript gates in repository order, followed by the focused test and
OpenSpec validation:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run verify:ts-docstrings
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- \
  src/lib/__tests__/technical-configuration-evaluation.test.ts
node scripts/npm-run.js run react-doctor
openspec validate add-technical-configuration-comparison \
  --type change --strict --no-interactive
```

Final review requirements:

- Re-run Code Review Graph and GitNexus against the changed files.
- Dispatch an independent code-review subagent with the base and head commits.
- Fix all valid Critical and Important findings, then rerun affected checks.
- Commit and push the feature branch. Do not merge without a separate request.

## Exit Gate

P11A is complete when canonical values, labels, invalid-input behavior, and every
derived-status precedence row are frozen by exhaustive tests; the final diff has
no runtime integration beyond the new pure domain module.
