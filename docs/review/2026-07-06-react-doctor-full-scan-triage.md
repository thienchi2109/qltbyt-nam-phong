# React Doctor Full Scan Triage - 2026-07-06

## Scope

Full scan was run with React Doctor `0.7.1` using the updated CLI shape:

```bash
node scripts/npm-run.js npx -y -p node@22 -p react-doctor@latest react-doctor . --verbose --project . --offline --scope full
```

The repo now uses `doctor.config.json`; `.worktrees/**` is ignored so the scan reflects the main working tree instead of auxiliary worktrees.

Report link:

```text
https://react.doctor/share?p=nextn&s=47&e=27&w=221&f=119
```

## Baseline Snapshot

| Metric                 |    Value |
| ---------------------- | -------: |
| Score                  | 47 / 100 |
| Total issues           |      248 |
| Errors                 |       27 |
| Warnings               |      221 |
| Source issues          |      245 |
| Test issues            |        3 |
| Verbose scan exit code |        1 |

Category breakdown:

| Category        | Count | Source | Test |
| --------------- | ----: | -----: | ---: |
| Maintainability |   171 |    170 |    1 |
| Bugs            |    36 |     36 |    0 |
| Security        |    30 |     30 |    0 |
| Performance     |     9 |      9 |    0 |
| Accessibility   |     2 |      0 |    2 |

Severity breakdown:

| Severity | Count | Source | Test |
| -------- | ----: | -----: | ---: |
| Error    |    27 |     27 |    0 |
| Warning  |   221 |    218 |    3 |

## Remediation Update - 2026-07-06

This report is the saved initial full-scan triage result:

```text
docs/review/2026-07-06-react-doctor-full-scan-triage.md
```

Completed fixes since the baseline scan:

| Commit     | Scope                            | Result                                                                                                            | Verification                                                                                                           |
| ---------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `cfe75fdc` | React correctness quick fixes    | Cleared `jsx-key` and `query-destructure-result`; reduced non-DB Bug errors by 5.                                 | Focused component tests, `typecheck`, React Doctor diff scan.                                                          |
| `e3b3c6c7` | Dependency hygiene               | Removed the unused Morph MCP dependency from the package surface.                                                 | Import/reference search, package install consistency, React Doctor follow-up scan.                                     |
| `c44930db` | Vitest update and test transform | Updated `vitest`/`@vitest/ui` to `4.1.10`; configured Vite 8/OXC JSX transform; cleared remaining low-supply hit. | Changed-file Prettier, `verify:no-explicit-any`, `verify:dedupe`, `typecheck`, focused Vitest, React Doctor diff scan. |

Current full-scan summary after those fixes:

| Metric         |    Value | Delta vs baseline |
| -------------- | -------: | ----------------: |
| Score          | 49 / 100 |                +2 |
| Total issues   |      241 |                -7 |
| Errors         |       20 |                -7 |
| Warnings       |      221 |                 0 |
| Source issues  |      238 |                -7 |
| Test issues    |        3 |                 0 |
| Scan exit code |        1 |                 0 |

Current category breakdown:

| Category        | Count | Delta vs baseline |
| --------------- | ----: | ----------------: |
| Maintainability |   171 |                 0 |
| Bugs            |    31 |                -5 |
| Security        |    28 |                -2 |
| Performance     |     9 |                 0 |
| Accessibility   |     2 |                 0 |

Current remaining error-level findings are all `supabase-table-missing-rls` and must stay on the separate Supabase MCP audit track.

## Priority Triage

### P0 - Verify Before Fixing

These are error-level findings or security findings where the correct action depends on current live behavior and existing migration policy.

| Rule                                            | Count | Examples                                                                                                                | Triage                                                                                                                                                                                          |
| ----------------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Security / supabase-table-missing-rls / error` |    20 | `supabase/migrations/20241220_create_luan_chuyen_tables.sql`, `supabase/migrations/20241220_create_nhan_vien_table.sql` | Needs live Supabase MCP inspection before edits. Some old tables may be intentionally RPC-only or later protected by subsequent migrations. Do not bulk-enable policies from this report alone. |
| `Security / low-supply-chain-score / error`     |     0 | None                                                                                                                    | Cleared by removing the unused runtime dependency and updating `vitest`/`@vitest/ui`.                                                                                                           |
| `Bugs / jsx-key / error`                        |     0 | None                                                                                                                    | Fixed in `cfe75fdc`.                                                                                                                                                                            |
| `Bugs / query-destructure-result / error`       |     0 | None                                                                                                                    | Fixed in `cfe75fdc`.                                                                                                                                                                            |

### P1 - User-Facing Correctness And Security Warnings

These should be grouped into small PRs by module.

| Rule                                       | Count | Examples                                                                  | Triage                                                                                                                                                                 |
| ------------------------------------------ | ----: | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Security / dangerous-html-sink / warning` |     6 | `use-maintenance-print.ts:92`, `useRepairRequestUIHandlers.ts:52`         | Review generated print/template HTML. If sources are controlled templates, document/sanitize. If user-controlled, fix with escaping/sanitization before interpolation. |
| `Bugs / exhaustive-deps / warning`         |     3 | `DeviceQuotaCategoryContext.tsx:298`, `DeviceQuotaCategoryDialog.tsx:135` | Needs manual hook review. Do not blindly add dependencies; stale closure fixes may require functional updates or stabilizing callbacks.                                |
| `Bugs / prefer-use-effect-event / warning` |     3 | `handover-preview-dialog.tsx:188`, `realtime-context.tsx:348`             | React 19-compatible cleanup. Good candidate for a small shared pattern if the same event listener shape repeats.                                                       |
| `Bugs / no-derived-state / warning`        |     5 | `DeviceQuotaMappingContext.tsx:140`, `dashboard-tabs.tsx:80`              | Verify whether state mirrors props/query data. Fix only where it creates stale UI or extra render loops.                                                               |
| `Bugs / no-event-handler / warning`        |    18 | `EquipmentPageClient.tsx:156`, `inventory-report-tab.tsx:58`              | Many are likely state-plus-effect event shims. Batch by page because behavior risk is page-specific.                                                                   |
| `Bugs / no-pass-data-to-parent / warning`  |     2 | `EquipmentPageClient.tsx:210`, `inventory-report-tab.tsx:39`              | Review parent/child data ownership. Fix only if it removes extra renders without widening responsibilities.                                                            |

### P2 - Performance And Maintainability Cleanup

These are useful cleanup but should not block product work unless touching nearby code.

| Rule                                                            | Count | Examples                                                                 | Triage                                                                                                                             |
| --------------------------------------------------------------- | ----: | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Maintainability / no-react19-deprecated-apis / warning`        |    89 | `LinkedRequestContext.tsx:47`, `SearchInput.tsx:32`                      | Broad migration warning. Do not sweep in one PR unless the team explicitly wants a React 19 API cleanup batch.                     |
| `Maintainability / prefer-module-scope-pure-function / warning` |    19 | `dashboard/page.tsx:99`, `DeviceQuotaMappingGuide.tsx:58`                | Mechanical hoists. Safe when files are already being touched; otherwise keep as cleanup batch.                                     |
| `Maintainability / no-multi-comp / warning`                     |    12 | `ui/accordion.tsx`, `ui/select.tsx`                                      | Many UI wrapper files intentionally colocate primitives. Treat as low priority unless file size or ownership is a current problem. |
| `Maintainability / no-giant-component / warning`                |    10 | `DeviceQuotaComplianceReport.tsx:65`, `DeviceQuotaDecisionDialog.tsx:51` | Aligns with repo file-size rules. Split only when there is a feature/fix reason or a targeted cleanup issue.                       |
| `Maintainability / unused-export / warning`                     |    10 | `suggestion-ai-reranker.ts:50`, `suggestion-ai-reranker.ts:171`          | Validate with existing dead-code tooling before removing exports.                                                                  |
| `Maintainability / unused-dependency / warning`                 |     6 | `cmdk`, `firebase`, `react-window`                                       | Confirm with repo-specific build/runtime usage before removal. Service worker or dynamic usage can create false positives.         |
| `Maintainability / unused-dev-dependency / warning`             |     2 | `@radix-ui/react-menubar`, `@radix-ui/react-slider`                      | Candidate package cleanup after import search.                                                                                     |
| `Performance / no-barrel-import / warning`                      |     2 | `equipment-toolbar-layout.tsx:9`, `equipment-toolbar.tsx:28`             | Low-risk direct import cleanup.                                                                                                    |
| `Performance / rerender-lazy-ref-init / warning`                |     2 | `DeviceQuotaMappingPreviewDialog.tsx:226`, `realtime-context.tsx:72`     | Low-risk lazy ref initialization.                                                                                                  |
| `Performance / async-defer-await / warning`                     |     1 | `qr-scanner-camera.tsx:140`                                              | Check control flow; likely safe if await is moved below a guard without changing side effects.                                     |
| `Performance / js-flatmap-filter / warning`                     |     1 | `DeviceQuotaChiTietContext.tsx:189`                                      | Micro-optimization. Defer unless the code is hot or already being touched.                                                         |
| `Performance / js-hoist-intl / warning`                         |     1 | `qr-action-sheet-config.tsx:95`                                          | Hoist `Intl.NumberFormat` if locale/config is static.                                                                              |

### P3 - Test-Only Accessibility

| Rule                                                   | Count | Examples                                                                         | Triage                                                                                                     |
| ------------------------------------------------------ | ----: | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Accessibility / dialog-has-accessible-name / warning` |     2 | `RepairRequestsDetailView.test.tsx:114`, `repairRequestSheetAdapter.test.tsx:26` | Test fixture warnings only. Fix when editing those tests or if CI starts enforcing accessibility warnings. |

## Quick Win / High ROI Plan

ROI ranking uses four criteria: likely issue-count reduction, low blast radius, simple verification, and low chance of business-logic or DB-policy regression. This intentionally does not start with the highest-severity SQL findings because those need live Supabase MCP inspection before any migration work.

| Rank | Batch                                                                                                                                   | Issues | Risk        | Why this is high ROI                                                                                                                                | Verification                                                                       |
| ---: | --------------------------------------------------------------------------------------------------------------------------------------- | -----: | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
|    1 | React correctness quick fixes: `jsx-key`, `query-destructure-result` - completed                                                        |      0 | Low         | Completed in `cfe75fdc`; removed 5 non-DB Bug errors.                                                                                               | Focused component tests, `typecheck`, React Doctor diff scan.                      |
|    2 | Module-scope hoists: `prefer-module-scope-pure-function`, `prefer-module-scope-static-value`, `rerender-lazy-ref-init`, `js-hoist-intl` |     28 | Low         | Mostly mechanical moves of pure helpers/static values. Good issue reduction with small runtime risk when values are truly local-state independent.  | `typecheck`, focused tests for touched components, React Doctor diff scan.         |
|    3 | Dependency hygiene: remaining `unused-dev-dependency` and verified `unused-dependency`                                                  |      8 | Low-Medium  | Low-supply findings are cleared; remaining package cleanup still needs import/runtime checks, especially for dynamic or service-worker usage.       | Import search, build/typecheck, dependency install sanity, React Doctor diff scan. |
|    4 | Print/template HTML review: `dangerous-html-sink`                                                                                       |      6 | Medium      | Security ROI is high, count is modest. Requires source-by-source check to avoid breaking print/export flows.                                        | Targeted escaping/sanitization tests, manual print/export smoke checks.            |
|    5 | Hook behavior cleanup: `exhaustive-deps`, `prefer-use-effect-event`, selected `no-event-handler`                                        |     24 | Medium      | Good correctness value, but render timing/subscription changes can regress UI behavior. Start with repeated patterns, not a sweeping rewrite.       | Focused page tests, interaction smoke tests, React Doctor diff scan.               |
|    6 | Direct import/perf small fixes: `no-barrel-import`, `async-defer-await`, `js-flatmap-filter`                                            |      4 | Low         | Easy cleanup, but lower score impact than ranks 1-3. Bundle/runtime benefit is incremental.                                                         | `typecheck`, focused smoke check.                                                  |
|    7 | Component split cleanup: `no-giant-component`, selected `no-multi-comp`                                                                 |     22 | Medium      | High count, but lower immediate product value and higher churn. Do this only when those files are already in scope or as a dedicated cleanup issue. | Existing tests plus visual/manual smoke checks.                                    |
|    8 | Supabase RLS audit: `supabase-table-missing-rls`                                                                                        |     20 | High        | High severity but not a quick win. Correct fix depends on live grants/RLS/policies and historical migrations.                                       | Supabase MCP live inspection, migration safety review, security advisors.          |
|    9 | React 19 API migration: `no-react19-deprecated-apis`                                                                                    |     89 | Medium-High | Biggest count drop, but broad churn across 88 source locations. Defer unless the team explicitly wants a React 19 API migration batch.              | Broad test suite, React Doctor full scan, careful review of `ref` behavior.        |

### Recommended First Three PRs

1. **PR 1: React Doctor error cleanup outside DB - completed**
   - Scope: `jsx-key` and `query-destructure-result`.
   - Result: fixed in `cfe75fdc`; current full scan no longer reports either rule.
   - Reason: removed real React error findings without touching DB/security policy.

2. **PR 2: Mechanical render-cost cleanup**
   - Scope: module-scope pure functions/static values, lazy ref initialization, `Intl.NumberFormat` hoist.
   - Expected reduction: up to 28 warnings.
   - Reason: best warning-count reduction with low behavior risk if each hoist is verified as state-independent.

3. **PR 3: Dependency/security noise cleanup - partially completed**
   - Completed: removed Morph MCP dependency in `e3b3c6c7`; updated `vitest`/`@vitest/ui` in `c44930db`.
   - Remaining scope: unused dev dependencies and verified unused runtime dependencies.
   - Reason: low-supply-chain noise is cleared, but package-surface cleanup still needs per-package usage checks.

### Defer From Quick-Win Track

- **Supabase RLS findings:** high severity, but they require live DB truth. Treat as a separate security audit, not a quick cleanup.
- **React 19 API migration:** largest issue count, but too broad for quick win. Do only with an explicit migration plan.
- **Large component splitting:** useful but churn-heavy. Bundle with feature work or create targeted cleanup issues per module.

## Notes

- The first scan included `.worktrees` and reported 295 issues with score 43. That result was treated as noisy.
- After updating React Doctor usage and ignoring `.worktrees/**`, the scan reports 248 issues with score 47.
- After completing the first React correctness and low-supply-chain cleanup, the current full scan reports 241 issues with score 49.
- React Doctor exits non-zero for the verbose scan because the remaining 20 error-level diagnostics are the Supabase RLS audit items.
