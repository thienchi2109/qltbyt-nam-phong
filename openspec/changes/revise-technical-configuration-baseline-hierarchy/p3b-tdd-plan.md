# P3B TDD Plan - XLSX V2 Parser And Legacy Compatibility

## Goal

Implement Issue #884 as a library/test-only parser capability:

- parse `.xlsx` files using the P3A workbook contract;
- infer section, subgroup, and criterion rows from `STT`;
- normalize canonical order from physical row position;
- validate hidden identity against the selected baseline hierarchy;
- preserve authoritative titles only for identity-matched criteria;
- enforce the 5 MiB and 5,000 meaningful-row limits without truncation;
- retain canonical v1 workbook read compatibility.

Production download and import hooks remain unchanged. This phase adds no
migration and performs no live database write.

## Preflight

Local repository:

- clean starting commit: `b759104b48d789f5f27240c3a83f95c557ae18c4`;
- implementation branch: `feat/884-p3b-xlsx-v2-parser`;
- P3A workbook contract/export codec is present;
- GitNexus index matches `b759104b`;
- the existing v1 parser is on the production import path and has critical
  blast radius, so P3B will not replace or modify that path.

Read-only live Supabase:

- migration tail remains `20260809085349`;
- hierarchy counts remain 3 versions, 12 groups, 0 subgroups, and 155 criteria;
- hierarchy tables and preview/apply v2 signatures, `SECURITY DEFINER`,
  `search_path`, and grants match the local contract.

Any local/live contract mismatch is a stop condition.

## Issue #898 Baseline

Recorded before source changes on `b759104b`:

- full technical-configuration regression:
  - 4 failed files, 118 passed files;
  - 5 failed tests, 1,158 passed tests;
  - failures are the pre-existing phase-ledger assertion and three async UI
    timing/resilience files;
- migration/RPC-named regression:
  - 3 failed files, 51 passed files;
  - 2 failed tests, 562 passed tests;
  - failures are the pre-existing phase-ledger assertion, RPC JWT status
    expectation, and AI migration-gate import suite.

P3B requires zero new failures. These baseline failures are not in scope unless
the parser directly changes their contract.

## Scope Decisions

### Add a separate parser boundary

Add a v2 parser module instead of changing the production v1 parser. The new
file-level compatibility boundary:

- rejects non-`.xlsx` names before loading;
- rejects files larger than 5,242,880 bytes before `arrayBuffer()`;
- loads the workbook once;
- detects contract version from `_meta`;
- routes version 1 to the unchanged legacy parser;
- routes version 2 to the new hierarchy parser.

### Canonical v2 rows

The v2 result uses physical row numbers plus canonical structural order:

- Roman `STT` -> main section;
- positive-integer `STT` -> subgroup;
- blank `STT` -> criterion;
- section and subgroup ordinals are regenerated from row position;
- criterion order is canonical within the main section;
- direct criteria remain before subgroup blocks by construction.

Unsupported nonblank markers, empty meaningful rows, and content before a
section fail with physical-row issues.

### Hidden identity is untrusted

The parser receives the current authoritative hierarchy and validates hidden
IDs/codes against it:

- complete matching identity is preserved;
- entirely absent identity uses create/delete fallback;
- partial, foreign, duplicate, wrong-kind, or mismatched identity fails closed;
- original hidden parent IDs may move physically but must still match the
  authoritative original owner;
- hidden criterion title is never trusted.

An identity-matched criterion receives its authoritative current title. A new
criterion always receives `title = null`.

### Compatibility boundary

The compatibility result is discriminated by `format: "legacy" | "v2"`.
Legacy metadata and canonical rows remain byte-for-byte equivalent to the
existing parser result; no subgroup is invented.

## TDD Slices

1. RED: v2 round-trip, row-kind inference, canonical numbering, and physical-row
   unsupported-marker errors.
2. GREEN: minimal workbook structure, metadata, cell, and row parser.
3. RED: missing, partial, foreign, duplicate, reordered, inserted, deleted, and
   moved identity/title cases.
4. GREEN: authoritative identity maps and canonical hierarchy output.
5. RED: `.xlsx` only, 5 MiB, 5,000 meaningful rows, no truncation, and legacy
   compatibility.
6. GREEN: file-level guard and version router using the unchanged legacy parser.
7. REFACTOR: remove local duplication without widening the production import or
   download graph.

## TDD Evidence

- RED 1: focused tests failed because the XLSX v2 parser module and public
  compatibility boundary did not exist.
- GREEN 1: workbook structure, metadata, cell, and row parsing made round-trip,
  row-kind inference, canonical numbering, and physical-row errors pass.
- RED 2: identity tests exposed missing handling for optional parent hints,
  partial/foreign/duplicate identity, changed criterion codes, authoritative
  titles, and physical reordering/moves.
- GREEN 2: authoritative hierarchy maps and seen-identity guards made missing,
  reordered, inserted, deleted, and moved rows deterministic.
- RED 3: file-level tests failed before `.xlsx`, 5 MiB, 5,000 meaningful-row,
  and legacy routing guards existed.
- GREEN 3: the file boundary now rejects unsupported types/oversized inputs
  before reading bytes, enforces row limits for v1/v2 without truncation, and
  delegates version 1 to the unchanged legacy parser.
- REVIEW RED: independent review reproduced skipped sparse physical rows,
  extra-column row-limit bypass, the generated section-4,000 marker mismatch,
  missing observed limit values, and false-positive test narrowing.
- REVIEW GREEN: physical scans now use the highest row number and all used
  columns, safety limits run before shape validation and report configured plus
  observed values, generated Roman markers remain parseable, and topology/
  identity regressions assert v2 results explicitly.
- REVIEW RED 2: an extreme sparse coordinate proved rectangular row/column
  traversal could exhaust CPU, while a hyperlink object in column H bypassed
  exact-column validation.
- REVIEW GREEN 2: workbook, metadata, row, and limit scans now use sparse
  ExcelJS row/cell iteration, preserving physical coordinates without visiting
  empty rectangles and treating every nonblank extra-column value as invalid.
- REFACTOR: parser responsibilities were split into contract, cell, row,
  workbook, file, and public-facade modules; every source file remains below
  the 350-line extraction threshold.

## Verification

Run in repository order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js exec vitest run \
  src/lib/__tests__/technical-configuration-baseline-excel-v2-parse.test.ts \
  src/lib/__tests__/technical-configuration-baseline-excel-v2-parse-identity.test.ts \
  src/lib/__tests__/technical-configuration-baseline-excel-v2-parse-limits.test.ts
node scripts/npm-run.js run react-doctor
openspec validate revise-technical-configuration-baseline-hierarchy --strict
```

Then re-run the same full technical-configuration and migration/RPC-named
regressions recorded above and require zero new failures.

Final verification:

- formatting, explicit-`any`, duplicate-code, and TypeScript gates passed;
- all three focused parser files passed: 25 tests;
- React Doctor diff scan scored 100/100 with no findings;
- strict OpenSpec validation passed;
- independent review finished with zero findings after three rounds;
- technical-configuration regression finished with 1 failed file / 124 passed
  and 1 failed test / 1,187 passed; the only failure was the pre-existing
  phase-ledger assertion, so there were zero new failures;
- migration/RPC-named regression matched the recorded baseline exactly at
  3 failed files / 51 passed and 2 failed tests / 562 passed, covering the same
  phase-ledger, RPC JWT expectation, and AI migration-gate suite.

## Completion Boundary

P3B is complete when the compatible parser is available and fully tested while:

- production download/import files remain unchanged;
- no migration or generated database type is added;
- the P3C/P3D download and UI wiring remain unimplemented;
- all review findings are resolved and the branch is pushed without opening a
  pull request.
