# P3A TDD Plan - XLSX V2 Workbook Model And Export Codec

## Goal

Add a library-only XLSX v2 workbook model and ExcelJS export codec for Issue
#883. Production download and import paths remain on the existing v1 generator
and parser.

## Preflight

Local repository:

- clean `main` baseline: `3d9ab40c6fafb017d4f9e7cc8044027f9962ff33`;
- implementation branch: `feat/883-p3a-xlsx-v2-workbook-export`;
- P2B local migration:
  `20260809070000_technical_configuration_baseline_hierarchy_import_apply.sql`.

Read-only live Supabase:

- migration tail: `20260809085349`;
- P2B internal and guarded public function body hashes match local;
- function signatures, `SECURITY DEFINER`, volatility, `search_path`, and grants
  match local.

Any contract mismatch is a stop condition. P3A performs no live database writes
and adds no migration.

## Scope Decisions

### Separate v2 modules

Do not change or re-export the production v1
`createTechnicalConfigurationBaselineWorkbook` API. Add separate v2 model and
export modules imported only by focused tests in this leaf.

### Workbook intent

The pure model builder accepts one of two explicit intents:

- `current-data`: render the supplied ordered main sections, direct criteria,
  subgroups, and subgroup criteria;
- `blank-template`: keep `Nhập cấu hình` header-only and place examples solely
  on `Hướng dẫn & Ví dụ`.

Both intents carry dossier, baseline version, revision, and generation metadata.

### Visible and hidden data

`Nhập cấu hình` exposes exactly two visible editable columns:

1. `STT`;
2. `NỘI DUNG YÊU CẦU`.

Hidden columns preserve section ID, subgroup ID, criterion ID, criterion code,
and existing criterion title. They do not carry a row-kind marker: P3B remains
responsible for inferring row kind from `STT`.

### Numbering and content

- main sections use canonical Roman numerals in array order;
- subgroups use canonical positive integers within their main section;
- criteria keep `STT` blank;
- structural visible content is the section or subgroup name;
- criterion visible content is `requirement_text`;
- criterion title appears only in a hidden round-trip column.

## TDD Slices

1. RED: current-data model sheets, visible/hidden columns, canonical order,
   Unicode, multiline text, and identity/title mapping.
2. GREEN: add the minimal pure contract and model builder.
3. RED: blank-template header-only input sheet, instructions/examples, and
   versioned `_meta`.
4. GREEN: add the blank-template model.
5. RED: ExcelJS rendering, restrained row styles, wrapped text, fixed widths,
   hidden columns/sheet, frozen header, and serialize/load preservation.
6. GREEN: add the renderer and serializer using the shared lazy
   `createExcelWorkbook()` primitive.
7. REFACTOR: remove duplication while keeping the v1 production import graph
   unchanged.

## Verification

Required before handoff:

1. focused P3A export test with recorded RED and GREEN runs;
2. existing v1 baseline workbook regressions;
3. full technical-configuration tests;
4. full SQL/RPC migration tests;
5. format, no-explicit-any, dedupe, typecheck, and React Doctor;
6. OpenSpec strict validation;
7. Code Review Graph and GitNexus change review;
8. independent subagent review to zero findings;
9. branch commit and push without opening a PR.

## TDD Evidence

- RED 1: focused test failed to resolve the not-yet-created v2 contract module.
- GREEN 1: current-data model passed with canonical hierarchy rows, Unicode,
  multiline content, and hidden identity/title fields.
- RED 2: blank-template test received no instruction/example rows.
- GREEN 2: blank-template input remained header-only while examples moved to
  `Hướng dẫn & Ví dụ` and metadata remained versioned.
- RED 3: focused test failed to resolve the not-yet-created ExcelJS export
  module.
- GREEN 3: four focused tests passed, including an XLSX serialize/load
  round-trip for layout, styles, hidden fields, Unicode, and multiline text.
- REVIEW RED: focused tests proved the merged instructions title was blank,
  runtime `Cell.col` left STT values misaligned, and fixed row heights could
  clip wrapped content.
- REVIEW GREEN: the title now occupies the merge master cell, STT alignment
  handles ExcelJS runtime column values, and wrapped data/instruction rows use
  automatic height.

Hidden identity columns are intentionally not worksheet-protected. The design
treats them as untrusted round-trip hints that P3B must validate against the
selected dossier, baseline version, and revision. The unused model-level
`editable` flag was removed instead of implying protection that the codec did
not enforce.

## Regression Baseline

The full technical-configuration run completed with 121 passing files and one
pre-existing failing phase-ledger assertion. At clean base `3d9ab40c`, that test
expects `P2B.1` unchecked while the same base already records it as complete.

The full migration/RPC-named run completed with 51 passing files and three
pre-existing failing files. The additional failures are the known auth/RPC and
AI contract baseline tracked by Issue #898. None of those files differ from
`3d9ab40c`, and P3A does not import or modify them.

## Completion Boundary

P3A is complete when the v2 workbook model/export codec is tested and available
to later leaves, while no production component, hook, download action, parser,
or import path imports it.
