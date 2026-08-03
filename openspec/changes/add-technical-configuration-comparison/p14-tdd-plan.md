# P14 TDD Plan - Final Comparison Result Excel Export

> **For agentic workers:** REQUIRED: use
> `superpowers:test-driven-development` for each behavior slice,
> `code-deduplication` before adding reusable logic and
> `superpowers:verification-before-completion` before any completion claim.
> Execute P14A1, P14A2, P14A3, P14A4, P14B1, P14B2, P14C1 and P14C2 as eight
> sequential PRs. Do not combine leaves without explicit user approval.

## Goal

Ship an output-only Excel export for the final technical-configuration
comparison result. The user confirms content and data scope before export. The
download is built from one canonical, stable, read-only snapshot and matches the
three approved Stitch layouts. This plan owns requirement `TC-21`.

## Scope Boundary

- P14 is independent of deferred P13A/P13B work.
- This plan does not seed or write live data for verification.
- P14A1/P14A2 may add future read-only RPC migrations, but apply requires
  explicit approval for that exact live DB operation.
- No production RPC/index/migration is changed by this planning PR.
- No result import/parser/apply path, scoring, percentage, chart, AI result or
  supplier award decision is included.
- No P13B real-browser gate is included. P14 UI leaves use pure state and React
  integration/user-event verification; the user has already deferred browser
  hardening.
- Large-workbook tests use deterministic in-memory fixtures larger than 100
  options x 102 criteria.

## Approved Reuse Decisions

- Reuse `createExcelWorkbook()` and `downloadBlob()` from
  `src/lib/excel-workbook.ts`.
- Reuse the existing lazy ExcelJS load/serialization pattern.
- Reuse baseline/option workbook codec conventions and focused workbook
  inspection tests.
- Rerun shared workbook and Equipment Excel regressions before P14B2/P14C2
  completion.
- Do not add technical-configuration flags to flat `exportToExcel()`.
- Do not create a second workbook loader, serializer or Blob-download helper.
- Do not extract a shared helper unless at least two consumers have the same
  business contract. Similar syntax alone is not sufficient.

## Approved Product And Workbook Contract

- Dialog content modes: `Đầy đủ`, `Chỉ xếp hạng`,
  `Chỉ ma trận chi tiết`.
- Initial scope: all options and all criteria.
- Paginated surfaces require explicit option/criterion scope confirmation.
- Visible sheets:
  - `full`: `Tổng quan`, `Xếp hạng`, `Ma trận chi tiết`
  - `ranking_only`: `Tổng quan`, `Xếp hạng`
  - `detailed_matrix_only`: `Tổng quan`, `Ma trận chi tiết`
- Hidden `_meta` is always present.
- Matrix columns A-D are `STT`, `Nhóm tiêu chí`, `Mã tiêu chí`,
  `Yêu cầu cấu hình cơ sở`.
- Each option owns exactly three columns:
  `Phản hồi nhà cung cấp`, `Thông tin bổ sung / tài liệu`,
  `Kết luận đánh giá`.
- Continuation matrix sheets preserve the four context columns and style when
  Excel's physical column limit is exceeded. No option is truncated.

Approved Stitch project/screens:

- Project: `1463377740887387448`
- Dialog: `4aaff09e4788412386ea8d4f1baa4da9`
- Overview/ranking: `d394c0dd25f146cf9423b8acf8eeaa86`
- Detailed matrix: `45c3a6f4ac514212ba3259064ef19ea0`

## Delivery Order

```text
P12C1
  -> P14A1
  -> P14A2
  -> P14A3
  -> P14B1
  -> P14B2
  -> P14C1
  -> P14C2
  -> future P13C
```

Every leaf starts from synchronized `main`, has one issue/branch/PR and ends
with merged `main` evidence before its successor starts.

## Tracking Issues

| Leaf  | GitHub issue                                                        |
| ----- | ------------------------------------------------------------------- |
| P14A1 | [#839](https://github.com/thienchi2109/qltbyt-nam-phong/issues/839) |
| P14A2 | [#840](https://github.com/thienchi2109/qltbyt-nam-phong/issues/840) |
| P14A3 | [#841](https://github.com/thienchi2109/qltbyt-nam-phong/issues/841) |
| P14B1 | [#842](https://github.com/thienchi2109/qltbyt-nam-phong/issues/842) |
| P14B2 | [#843](https://github.com/thienchi2109/qltbyt-nam-phong/issues/843) |
| P14C1 | [#844](https://github.com/thienchi2109/qltbyt-nam-phong/issues/844) |
| P14C2 | [#845](https://github.com/thienchi2109/qltbyt-nam-phong/issues/845) |

## P14A1 - Canonical Export Snapshot Manifest

### Planned Files

- Modify:
  `openspec/changes/add-technical-configuration-comparison/contracts.md`
- Create at execution time after migration-order inspection:
  `supabase/migrations/<timestamp>_technical_configuration_result_export_manifest.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-result-export-manifest-migration.test.ts`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-result-export-rpc-whitelist.test.ts`
- Create:
  `supabase/tests/technical_configuration_result_export_manifest_phase_gate.sql`
- Create: `src/lib/technical-configuration-result-export-rpcs.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`

### Locked Manifest Contract

- Request:
  `{ p_dossier_id, p_baseline_version_id, p_option_ids, p_criterion_ids }`.
- `p_option_ids` and `p_criterion_ids` are nullable. Non-null arrays are
  ordered, non-empty, null-free, unique and must belong to the exact
  dossier/baseline scope.
- Response:
  `{ data: { dossier, baseline_version, option_total, criterion_total,
snapshot_token, ranking_snapshot_token } }`.
- `dossier` is exactly
  `{ id, device_type_name, name, revision, archived_at }`.
- `baseline_version` is exactly
  `{ id, dossier_id, version_number, status, revision, locked_at }`.
- The private helper may additionally carry ordered option/criterion IDs for
  P14A2 consumers, but the public manifest response exposes no extra fields.

### RED

1. Inspect current local migration order and live functions/grants read-only.
2. Write migration/source tests for the exact manifest request and response.
3. Prove ordered scope validation rejects empty, duplicate, foreign-dossier and
   foreign-baseline IDs.
4. Prove the full token changes for every workbook-visible source field and the
   ranking token matches P12C1 for the same complete universe.
5. Prove missing comparison/response/evidence/assessment rows remain absent and
   no revision, row or audit metadata changes.
6. Run focused tests and confirm failure is only the missing P14A1 contract.

### GREEN

1. Add the smallest canonical snapshot helper and guarded manifest RPC.
2. Add only the manifest RPC name to the dedicated name manifest and proxy
   allowlist.
3. Preserve `SECURITY DEFINER`, `search_path`, JWT guard, grant/revoke and
   fail-closed conventions from the nearest ranking/read RPC.
4. Run focused migration/whitelist tests and confirm green.

### Refactor And Gate

1. Run semantic deduplication against existing ranking snapshot helpers.
2. Run `format:check`, `verify:no-explicit-any`, `verify:dedupe`, `typecheck`
   and focused Vitest tests in repository order.
3. After explicit live approval only, apply through Supabase MCP, run the
   rollback-only SQL phase gate and read-only security advisor.
4. Validate OpenSpec strictly, review, merge and sync `main`.

**Deploy boundary:** dormant read-only manifest RPC; no page RPC, client,
workbook, UI or download.

### P14A1 Execution Evidence - 2026-08-02

- RED migration/source coverage failed on missing volatility, canonical UTC
  timestamps and runtime validation cases before the implementation fix.
- Supabase MCP applied
  `20260802054948_technical_configuration_result_export_manifest.sql` as live
  migration `20260802073104`.
- Live metadata confirms the helper, public manifest RPC and P12C1 ranking RPC
  are `STABLE`, `SECURITY DEFINER` and pinned to
  `search_path = public, pg_temp`; grants match the locked contract.
- The rollback-only phase gate passed authorization, exact response shape,
  ordered scopes, validation branches, canonical timestamp, token sensitivity
  and side-effect checks. Post-gate fixture counts are zero.
- Security/performance advisors were reviewed with no P14A1 blocker. Independent
  re-review reached zero findings; required local gates and strict OpenSpec
  validation passed.

## P14A2 - Paginated Export Ranking And Matrix Contracts

### Planned Files

- Create at execution time after migration-order and file-ceiling inspection:
  `supabase/migrations/<timestamp>_technical_configuration_result_export_ranking_source.sql`
- Create immediately after the ranking migration:
  `supabase/migrations/<timestamp>_technical_configuration_result_export_snapshot_token_source.sql`
- Create immediately after the snapshot-token migration:
  `supabase/migrations/<timestamp>_technical_configuration_result_export_matrix_page.sql`
- Create after live advisor feedback:
  `supabase/migrations/<timestamp>_technical_configuration_result_export_helper_search_path.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-result-export-pages-migration.test.ts`
- Create:
  `supabase/tests/technical_configuration_result_export_pages_phase_gate.sql`
- Modify: `src/lib/technical-configuration-result-export-rpcs.ts`
- Modify:
  `src/app/api/rpc/__tests__/technical-configuration-result-export-rpc-whitelist.test.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`

### Locked Page Contracts

- Both requests are exactly
  `{ p_dossier_id, p_baseline_version_id, p_option_ids, p_criterion_ids,
p_page, p_page_size }` and reuse P14A1 scope validation.
- Ranking page size is 1-100. Its exact item is
  `{ option_id, supplier_id, supplier_name, display_label, eligibility,
incomplete_criterion_count, failed_count, insufficient_evidence_count,
exceeds_count, rank }`.
- Ranking counters/ranks are computed once over the complete P12C1
  dossier/baseline universe, then filtered to the validated option scope and
  paginated in P12C1 presentation order. Criterion scope does not redefine
  ranking semantics.
- Matrix page size is 1-1000. Cells are ordered by validated criterion
  ordinality, then option ordinality. Each exact cell is
  `{ group_id, group_name, group_order, criterion_id, criterion_code,
criterion_title, requirement_text, criterion_order, option_id, supplier_id,
supplier_name, display_label, model, manufacturer, option_name, response_text,
supplementary_information, document_links, technical_axis, evidence_axis,
assessment_notes, conclusion }`.
- Each `document_links` item is exactly
  `{ document_id, document_name, document_url, citation_id, page_section,
excerpt }`. Missing rows return nullable scalar fields and `document_links: []`.
- Both responses are exactly
  `{ data, dossier_id, baseline_version_id, snapshot_token,
ranking_snapshot_token, total, page, page_size }`.

### RED

1. Write exact contract tests for ranking and flattened matrix pages.
2. Cover page bounds, canonical order, repeated dossier/baseline/scope/totals
   and both snapshot tokens.
3. Cover zero, sparse and complete data without get-or-create behavior.
4. Prove reference products and baseline-only evidence cannot enter option
   columns.
5. Prove ranking counters/rank match P12C1 semantics rather than a duplicate
   implementation.
6. Confirm focused tests fail only because P14A2 RPCs do not exist.

### GREEN

1. Add set-based ranking and matrix list RPCs over the P14A1 helper.
2. Delegate ranking semantics to the P12C1 contract.
3. Re-source the P14A1 private snapshot ranking token through the shared token
   helper so ranking pages do not trigger a preliminary paged P12C1 scan.
4. Share immutable option-display-label and derived-status helpers between the
   active ranking and matrix definitions.
5. Return only selected fields with bounded pages and deterministic keys.
6. Add only the two P14A2 names to the manifest/allowlist.
7. Run focused migration/whitelist tests and confirm green.

### Refactor And Gate

1. Inspect plans for bounded cardinality/work and no per-option/per-criterion
   query loop.
2. Run repository TypeScript gates and focused SQL/RPC tests.
3. After explicit live approval only, apply and run authorization,
   rollback-only phase gate and read-only advisors through Supabase MCP.
4. Validate OpenSpec strictly, review, merge and sync `main`.

**Deploy boundary:** two dormant read-only page RPCs; no adapter, collector,
workbook, UI or download.

### P14A2 Execution Evidence - 2026-08-02

- Read-only Supabase MCP inspection confirmed live P14A1 migration
  `20260802073104`, expected helper/function metadata and absence of both P14A2
  RPCs before implementation.
- Initial RED source/allowlist tests failed only because the page migrations,
  phase gate and RPC names did not exist. Review RED then proved the snapshot
  helper still invoked paged P12C1 before the export ranking source and that
  the plan seam did not execute the function body; both regressions are now
  locked by focused GREEN tests.
- Ranking semantics live in one private set-returning source shared by the
  backward-compatible P12C1 RPC and the scoped export page. The P14A1 private
  snapshot is superseded without changing its signature and now obtains the
  exact ranking token directly from the shared token helper. Matrix work is
  set-based over P14A1 validated IDs and pages cells before evidence joins.
  Private immutable helpers now keep option labels and seven-status precedence
  identical across the active ranking and matrix definitions.
- The implementation is split across four ordered migrations to preserve
  applied P14A1 history and keep every source file below the mandatory
  450-line ceiling. The fourth migration supersedes the already-applied helper
  definitions by pinning `search_path = pg_catalog`; the first migration carries
  the same setting for fresh databases.
- The rollback-only phase gate covers non-empty second pages, repeated metadata
  and tokens, complete ACLs, raw `admin` authorization and an actual
  `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` wrapper-execution seam plus
  source-level no-loop/get-or-create/page-limit guards.
- Independent re-review resolved both initial Important findings and ended with
  zero Critical/Important findings. PR review then correctly rejected the
  outer-plan no-spill claim and identified shared-expression drift risk; RED
  tests now lock the corrected evidence wording and shared helpers. The outer
  PL/pgSQL plan still does not expose internal statement plan nodes or prove
  their temporary-spill behavior.
- Supabase MCP applied the four repository migrations as live versions
  `20260802111235`, `20260802111352`, `20260802111437` and `20260802112335`.
  The first live gate attempt correctly rolled back when its fixture violated
  the deployed non-null `supplementary_information` contract; the corrected
  fixture uses the column's empty-string default semantics.
- The corrected rollback-only phase gate passed authorization, bounds, ranking,
  matrix, token, source-plan and read-only assertions twice, including the
  superseding helper `search_path` check. Post-gate fixture counts remain zero.
- Security/performance advisors were rerun after the superseding migration. The
  P14A2 helper search-path warning is resolved; remaining notices are pre-existing
  baseline findings outside this leaf.

## P14A3 - Typed Export Adapters And Stable Dataset Collector

### Planned Files

- Create:
  `src/app/(app)/technical-configurations/technical-configuration-result-export-types.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-result-export-decoders.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-result-export-rpc.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-result-export-data.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-result-export-data.test.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-result-export-fixtures.ts`

### RED

1. Write adapter tests for exact wire decoding, nullable fields and typed
   PT404/PT409/PT422/PT500 handling.
2. Reject malformed IDs, totals, page metadata, tokens and duplicate/missing
   `(criterion_id, option_id)` keys.
3. Cover zero, one and many ranking/matrix pages.
4. Prove collector reads manifest, collects required surfaces sequentially,
   validates every page and rereads manifest.
5. Prove any mismatch rejects the whole operation without publishing partial
   data.
6. Prove mode-specific collection never calls an unrequested surface.

### GREEN

1. Implement module-local adapters through the existing
   technical-configuration RPC client.
2. Implement one immutable complete-dataset collector.
3. Keep collection imperative and unmounted; do not add query keys/hooks yet.
4. Run focused tests and confirm green.

### Refactor And Gate

1. Search for equivalent existing bounded-page collectors before extracting any
   helper. Reuse only where metadata/business contracts match.
2. Run standard TypeScript gates and focused ranking/collector regressions.
3. Validate OpenSpec strictly, review, merge and sync `main`.

**Deploy boundary:** typed data contract only; no production caller, ExcelJS,
UI or download.

### P14A3 Execution Evidence - 2026-08-02

- Read-only Supabase MCP inspection confirmed the applied P14A1/P14A2 live
  migrations and all three export RPC signatures, `STABLE SECURITY DEFINER`
  metadata, pinned `search_path`, authenticated-only Data API exposure and exact
  public JSON keys. P14A3 adds no migration and performs no live DB write.
- Initial RED failed because the planned adapter and collector modules did not
  exist. The focused suite now covers exact/nullable wire decoding, typed
  PT404/PT409/PT422/PT500 and sanitized HTTP 500 handling, malformed 2xx JSON,
  malformed identity/selected-scope totals/tokens, exact bounded-page
  cardinality, zero/one/many pages, duplicate or missing matrix keys, malformed
  nested document links, final-manifest drift, custom and timeout cancellation
  reason preservation, deep runtime freezing and requested-surface suppression.
- The adapter calls the existing `callTechnicalConfigurationRpc()` seam and the
  collector reuses `collectStableTechnicalConfigurationPages()`. No shared
  `callRpc()` behavior, query key, hook, UI, ExcelJS, workbook or download seam
  changed.
- Approved file ownership extraction keeps each source below the repository
  threshold: types `149`, decoders `348`, RPC adapter `130` and collector `242`
  lines.
- Ranking pages use fixed size `100`; matrix pages use fixed size `1000`.
  Collection is sequential, validates dossier/baseline identity, page metadata,
  manifest totals, both opaque tokens and deterministic keys, and only returns
  the frozen dataset after the final manifest matches the first.
- Focused P14A3 tests pass `29/29`; shared pagination and reference-ranking
  regressions bring the focused total to `48/48`. Format, no-explicit-any,
  diff-only dedupe and typecheck gates pass. React Doctor reports `100/100`, and
  strict OpenSpec validation passes.

## P14A4 - Ordered Result-Export Axes

### Planned Files

- Create:
  `supabase/migrations/20260802161400_technical_configuration_result_export_snapshot_axes_source.sql`
- Create:
  `supabase/migrations/20260802161401_technical_configuration_result_export_axes.sql`
- Create:
  `supabase/tests/technical_configuration_result_export_axes_phase_gate.sql`
- Create:
  `supabase/tests/technical_configuration_result_export_axes_pagination_phase_gate.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-result-export-axes-migration.test.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-result-export-axis-decoders.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-result-export-axes.test.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-result-export-rpc.test.ts`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-result-export-types.ts`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-result-export-rpc.ts`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-result-export-data.ts`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-result-export-decoders.ts`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-result-export-data.test.ts`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-result-export-fixtures.ts`
- Modify: `src/lib/technical-configuration-result-export-rpcs.ts`
- Modify:
  `src/app/api/rpc/__tests__/technical-configuration-result-export-rpc-whitelist.test.ts`

### RED

1. Lock exact bounded option-axis and criterion-axis request/response contracts,
   validated request ordinality, item keys and repeated snapshot identities.
2. Prove the public manifest keeps its exact P14A1 shape while the private
   snapshot exposes the already-hashed option/criterion descriptors to the two
   new page RPCs.
3. Reproduce `0 x 0`, `1 x 0`, `0 x 1` and normal `N x M` datasets without
   deriving either axis from matrix cells.
4. Reject duplicate/missing/reordered axis IDs, changed totals/tokens and
   malformed descriptor fields before publishing the dataset.
5. Keep client fixtures deterministic and in memory. The post-apply SQL gate
   may create transaction-local deterministic rows but must roll back; do not
   add persistent seed data or derive fixtures from live domain rows.

### GREEN

1. Add two `STABLE SECURITY DEFINER` page RPCs with page size `1-100`, pinned
   `search_path`, existing global/admin guard and least-privilege grants.
2. Page the ordered descriptor arrays already used by the P14A1 full snapshot
   token; do not duplicate matrix joins or change public manifest keys.
3. Add module-local exact decoders/adapters, collect each axis sequentially,
   and await both independent axes before ranking/matrix surfaces.
4. Return one deeply immutable complete dataset or one typed error.

### Refactor And Gate

1. Keep the near-threshold P14A3 decoder line count stable by exporting existing
   primitives to a dedicated axis decoder. Extract the existing RPC-adapter
   tests before adding axis coverage so the 450-line test ceiling is preserved.
2. Run migration/source tests, focused adapter/collector regressions, semantic
   dedupe, standard TypeScript gates and strict OpenSpec validation.
3. Keep the primary runtime gate at the 450-line ceiling and use a separate
   rollback-only pagination gate for valid page-2 coverage.
4. Apply and run each live phase gate only after fresh explicit approval for the
   exact Supabase MCP write.

### Execution Evidence - 2026-08-02

- Read-only Supabase inspection confirmed the deployed P14A2 snapshot helper is
  `STABLE SECURITY DEFINER`, pins `search_path = public, pg_temp`, keeps the
  private helper service-only and projects the exact public manifest keys.
- RED review test:
  `technical-configuration-result-export-axes-migration.test.ts` failed `1/6`
  because the draft added `display_label` to the hashed snapshot payload.
- GREEN keeps the pre-return P14A2 snapshot source byte-for-byte unchanged and
  derives `display_label` through the existing immutable helper only in the
  option-axis RPC.
- Local gates passed: Prettier, no explicit `any`, diff-only dedupe, exported
  TSDoc, typecheck, all seven P14 export files (`74/74`), React Doctor
  (`100/100`), `git diff --check` and strict OpenSpec validation.
- The rollback-only SQL phase gate now covers exact ACLs, missing/denied/global/
  raw-admin roles, page bounds, ordered exact envelopes, repeated tokens,
  `0 x 0`, `1 x 0`, `0 x 1`, normal `2 x 2` and before/after side-effect
  counts.
- On 2026-08-03, fresh explicit approval was received and both migrations were
  applied through Supabase MCP as live ledger versions `20260803001344` and
  `20260803001429`.
- The first rollback-only phase-gate run failed RED with SQLSTATE `23505`
  because its fixture created two draft baselines per dossier. A focused
  regression failed `1/7`; the fixture now keeps one draft and one valid locked
  baseline per dossier, and the focused test passes `7/7`.
- The corrected live phase gate completed through its final `ROLLBACK`, covering
  ACLs, authorization, bounds, exact order/envelopes/tokens, asymmetric
  dimensions and side-effect counts. Follow-up inspection found zero residual
  fixture rows.
- Independent review found the primary gate did not exercise a valid page 2.
  RED source coverage reported `2 failed / 7 passed` while the supplemental
  gate was absent.
  GREEN adds a 216-line rollback-only pagination gate and passes `9/9`, proving
  page size `1`, pages `1` and `2`, requested `B -> A` ordering, exact total `2`
  and repeated snapshot/ranking tokens for both axes.
- Final review then found two source-test mutations still passed: a missing SQL
  function terminator and `COMMIT;` appended after `ROLLBACK;`. Focused RED
  reported `2 failed / 7 passed`; GREEN requires both function markers, rejects
  `COMMIT;` and requires `ROLLBACK` as the final non-comment statement, passing
  `9/9`.
- On 2026-08-03, fresh explicit approval was received for the supplemental gate
  with SHA256
  `2c8c1ca3e31d0bae39c66d2a3d6b38876ab5c34d7bd87c4c8796ae3bde6ef594`.
  It completed through `ROLLBACK`; follow-up counts were zero for dossiers,
  versions, groups, criteria, suppliers and options, proving no gate-specific
  persistent state. The rerun security advisor reported the same project-wide
  baseline.
- Security and performance advisors completed. They reported the existing
  project-wide baseline, including the generic authenticated
  `SECURITY DEFINER` advisory; P14A4 intentionally grants the guarded axis RPCs
  to `authenticated`, while the private snapshot helper remains service-only.
- Code Review Graph, GitNexus and exact repository searches found no existing
  equivalent ordered-axis collector or order validator to reuse.

**Deploy boundary:** dormant bounded read-only axes and typed dataset fields; no
workbook model, ExcelJS, UI, Blob/download, parser/import/apply or seed.

## P14B1 - Result Workbook Schema And Representative Fixtures

### Planned Files

- Create: `src/lib/technical-configuration-result-excel-contract-types.ts`
- Create: `src/lib/technical-configuration-result-excel-contract.ts`
- Create:
  `src/lib/__tests__/technical-configuration-result-excel-fixtures.ts`
- Create:
  `src/lib/__tests__/technical-configuration-result-excel-contract.test.ts`

### RED

1. Write pure tests for the three content modes and exact visible sheet order.
2. Lock hidden `_meta`, version/scope/snapshot fields and stable option/criterion
   order.
3. Lock four context columns and three columns per option.
4. Lock overview/ranking/matrix row models without ExcelJS.
5. Lock continuation partitioning from Excel's physical column limit.
6. Add deterministic empty, sparse, tie, missing-data and
   > 100-options x 102-criteria in-memory fixtures.

### GREEN

1. Implement the smallest output-only versioned schema/model.
2. Implement pure partition/model builders.
3. Keep import/parser/apply, Blob and ExcelJS outside the leaf.
4. Run focused tests and confirm green.

### Refactor And Gate

1. Compare baseline/option workbook contracts for naming/version conventions;
   share only generic contracts that are genuinely identical.
2. Run standard TypeScript gates and focused pure tests.
3. Validate OpenSpec strictly, review and open a non-draft PR. Merge and sync
   `main` remain a separately approved follow-up.

### Execution Evidence - 2026-08-03

- The preserved pre-P14A4 stash was applied without dropping it. Its original
  pure draft passed `11/11`, providing a recovery baseline before contract
  changes.
- RED added P14A4 ordered-axis ownership, narrowed-order and asymmetric
  dimension coverage. The focused suite reported `2 failed / 10 passed`;
  GREEN used `optionAxis` and `criterionAxis` as the independent ordered
  sources and passed `12/12`.
- Independent review required overview scope, a complete sparse `2 x 2`
  fixture with one explicit `not_evaluated` cell, a true `2 of 3` narrowed
  selection, the exact `5,460`-option boundary and independent deterministic
  fixture construction.
- Review-follow-up RED reported `1 failed / 11 passed`, only because overview
  scope was absent. GREEN shares one pure scope builder between overview and
  hidden `_meta` and passes `12/12`.
- Final `mix-gpt-5.6` review found the narrowed test still mixed `2 x 2` axes
  with a `3 x 3` manifest/ranking/matrix source, and missing-data coverage
  nulled descriptors on matrix cells even though option headers own them.
  RED reported `2 failed / 10 passed`; GREEN adds a consistent selected-scope
  fixture, filters axes/ranking/matrix together, sets manifest totals to
  `2 x 2` and covers nullable descriptors on `optionAxis`, passing `12/12`.
- Boundary coverage proves one matrix sheet fits exactly `5,460` options in
  `16,384` physical columns, while `5,461` options partition as `5,460 + 1`
  without truncation. Empty coverage includes `0 x 0`, `1 x 0` and `0 x 1`.
- Local gates passed: Prettier, no explicit `any`, diff-only dedupe, exported
  TSDoc, typecheck, all eight P14 export files (`86/86`), React Doctor
  (`100/100`), `git diff --check`, the output-only import boundary and strict
  OpenSpec validation.
- Code Review Graph, GitNexus and exact repository search found no equivalent
  output-only result-workbook model or generic worksheet partition capability
  to reuse. Existing baseline/option contracts own different templates; the
  closest option path also owns ExcelJS/import parsing and is outside P14B1.
- All fixtures remain deterministic and in-memory. No seed, live DB operation,
  ExcelJS/rendering, Blob/download, UI or parser/import/apply work was added.

**Deploy boundary:** pure model and test fixtures; no rendering or side effect.

## P14B2 - Approved ExcelJS Workbook Rendering

### Planned Files

- Create: `src/lib/technical-configuration-result-excel-export.ts`
- Create:
  `src/lib/__tests__/technical-configuration-result-excel-export.test.ts`
- Reuse unchanged unless a shared-contract gap is proven:
  `src/lib/excel-workbook.ts`

### RED

1. Inspect generated workbooks with ExcelJS and lock sheet names/order/state.
2. Lock title/header values, merges, fonts, fills, borders, zebra rows,
   alignment, filters, panes, widths/heights and hyperlinks.
3. Lock `#166534`, white title text, amber disclaimer and restrained
   conclusion-status fills.
4. Lock all three modes and continuation matrix sheets.
5. Assert no chart, gradient, score, percentage, award decision or truncation.
6. Run tests and confirm failure is only the missing renderer.

### GREEN

1. Build workbooks through `createExcelWorkbook()`.
2. Render exactly from the P14B1 model and the two approved workbook layouts.
3. Use the existing lazy ExcelJS serialization pattern.
4. Return the workbook/serialized bytes without calling `downloadBlob()`.
5. Run focused workbook tests and confirm green.

### Refactor And Gate

1. Invoke semantic deduplication before adding any style/helper abstraction.
2. Rerun `excel-workbook`, baseline/option workbook and Equipment Excel
   regressions.
3. Run standard TypeScript gates and focused tests.
4. Validate OpenSpec strictly, review, merge and sync `main`.

**Deploy boundary:** workbook API exists but has no mounted production caller or
download effect.

## P14C1 - Export Scope Dialog And State Machine

### Planned Files

- Create:
  `src/app/(app)/technical-configurations/technical-configuration-result-export-state.ts`
- Create:
  `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationResultExportDialog.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-result-export-dialog.test.tsx`

### RED

1. Write pure transition tests for open, reset, content mode, option scope,
   criterion scope, cancel and confirm.
2. Write React user-event tests for labels, validation, focus and disabled
   confirmation.
3. Prove initial scope is all options/all criteria.
4. Prove selected options/current criterion page appear only as explicit
   alternatives when source surfaces are paginated.
5. Prove dossier/baseline identity changes reset state.
6. Confirm tests fail only because the isolated state/dialog is missing.

### GREEN

1. Implement one pure state contract and one controlled dialog.
2. Match the approved Stitch dialog format.
3. Emit one validated request object on confirm.
4. Do not import RPC adapters, collector, ExcelJS or Blob helpers.
5. Run focused tests and confirm green.

### Refactor And Gate

1. Invoke `next-best-practices` then `react-best-practices` before React edits.
2. Run format, explicit-any, dedupe, typecheck, focused Vitest and React Doctor
   in repository order.
3. Validate OpenSpec strictly, review, merge and sync `main`.

**Deploy boundary:** dialog/state exists but is not mounted and has no network
or download side effect.

## P14C2 - Export Orchestration, Download And Workspace Activation

### Planned Files

- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationResultExport.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-result-export.test.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationWorkspace.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-workspace.test.tsx`

### RED

1. Mount the trigger in a test and prove no export request occurs on workspace
   mount.
2. Cover dialog open/cancel/confirm for every content/scope mode.
3. Cover loading, typed error, explicit retry and dossier/baseline context
   switch.
4. Prove unrequested ranking/matrix surfaces are not collected.
5. Prove changed final manifest prevents rendering/download.
6. Prove successful flow serializes once and calls shared `downloadBlob()`
   exactly once with the expected filename.
7. Prove current ranking/matrix pagination and selected-option evaluation state
   remain unchanged.

### GREEN

1. Implement one orchestration hook over P14A3 and P14B2.
2. Mount one `Xuất kết quả Excel` action and the P14C1 dialog in
   `TechnicalConfigurationEvaluationWorkspace`.
3. Cancel or ignore obsolete work after context changes.
4. Download only after complete collection, final manifest revalidation and
   successful serialization.
5. Run focused React integration tests and confirm green.

### Refactor And Gate

1. Invoke `next-best-practices`, `react-best-practices` and
   `code-deduplication` before finalizing shared logic.
2. Run, in order:
   - `node scripts/npm-run.js run format:check`
   - `node scripts/npm-run.js run verify:no-explicit-any`
   - `node scripts/npm-run.js run verify:dedupe`
   - `node scripts/npm-run.js run typecheck`
   - focused P14, Excel/Equipment, evaluation and ranking Vitest suites
   - `node scripts/npm-run.js run react-doctor`
   - `openspec validate add-technical-configuration-comparison --strict`
3. Do not add a browser/agent-browser gate in P14.
4. Review, merge and sync `main`; update future P13C dependency evidence.

**Deploy boundary:** first user-visible P14 leaf. It activates only the approved
stable read-only Excel export and does not change existing ranking, evaluation,
pagination or persistence contracts.

## Stop Conditions

Stop the active leaf and report a blocker when:

- live DB apply/rollback-only verification is required but explicit approval is
  absent;
- current code/live schema contradicts the frozen request/response or snapshot
  contract;
- a leaf requires changing another leaf's deploy boundary;
- representative workbook verification would require seed/live DB data;
- the approved Stitch workbook layout cannot be represented without changing a
  normative content/semantics decision;
- an existing shared Excel primitive must change in a way that can regress
  Equipment and no focused compatibility test can first lock that behavior.
