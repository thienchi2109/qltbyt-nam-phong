# Equipment Dataset Tabs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-filtered “Thiết bị thường” / “Thiết bị đặt” tabbed Equipment list where `nguon_kinh_phi = "Mượn"` is isolated from normal equipment, equipment search/filter/pagination stay inside the active dataset, and borrowed equipment is excluded from equipment KPIs and Reports.

**Architecture:** The active Equipment dataset is an explicit server-side scope (`regular`, `placed`, or internal backwards-compatible `all`) carried through the existing paginated RPCs and React Query keys. The UI reuses the repository’s shadcn controlled-tabs and URL state pattern, while the existing Equipment toolbar, table, actions, filters, and export remain shared. Reports and KPI callers always request `regular`; only the Equipment page’s “Thiết bị đặt” tab requests `placed`.

**Tech Stack:** Next.js App Router, React, TanStack Query/Table, shadcn Tabs, Supabase/Postgres RPCs and immutable forward migrations, Vitest, SQL quality-gate registry.

---

## Decisions and boundaries

- The two user-visible tabs are **Thiết bị thường** (default) and **Thiết bị đặt**.
- `Thiết bị thường` means `TRIM(nguon_kinh_phi) <> 'Mượn'`; NULL and blank values remain in this dataset.
- `Thiết bị đặt` means `TRIM(nguon_kinh_phi) = 'Mượn'`.
- Matching is trim-normalized but does not silently treat `Đặt`, `Cho mượn`, or transfer purpose `cho_muon` as equipment funding.
- Search, filters, sort, pagination, department summaries, and Equipment export are intersected with the active dataset on the server. No client-side post-filtering is allowed.
- The funding filter is scoped to the active dataset: “Mượn” is hidden/disabled on Thiết bị thường and fixed on Thiết bị đặt.
- Import keeps the existing free-text `Nguồn kinh phí` field. A mixed import is classified row-by-row; if any imported row normalizes to `Mượn`, the page switches to Thiết bị đặt after the successful import summary.
- All equipment-derived KPI cards, Reports tabs, report exports, utilization/maintenance aggregates, and Device Quota compliance outputs use the regular dataset. The utilization Reports path is in scope, including `usage_log_list`, `usage_analytics_overview`, and `usage_analytics_daily`; the dashboard recent-activity feed and transfer workflow screens are outside this change.
- The existing `TransferTypeTabs` implementation is a pattern reference; do not couple Equipment dataset semantics to transfer types.
- Never edit an applied historical migration. Add forward migrations only.
- The current DB Quality Gate is known to produce false positives. Run its checks and record both lanes, but treat the output as advisory until the user explicitly authorizes a bypass. An authorized bypass must be recorded as `BYPASS AUTHORIZED / INCOMPLETE`, with targeted disposable SQL/source checks retained; it must never be reported as an unqualified PASS.

## File map

Create:

- `src/app/(app)/equipment/_components/EquipmentDatasetTabs.tsx` — two-tab presentation using `@/components/ui/tabs`, accessible labels, and active value callbacks.
- `src/app/(app)/equipment/_hooks/useEquipmentDatasetTab.ts` — URL `?tab=regular|placed` parsing, fallback to `regular`, router replacement, and page-reset callback.
- `src/app/(app)/equipment/_hooks/equipmentDataset.ts` — dataset type, labels, default, and one trim-normalization predicate used by import/UI tests.
- `supabase/migrations/20261014120000_equipment_dataset_scope.sql` — forward overload/wrapper definitions and the scoped expression index, using the repository’s real timestamp at implementation time if this filename is already occupied.
- `supabase/tests/equipment_dataset_scope_smoke.sql` — read-only dataset partition, search, pagination-count, and aggregate-consistency checks.
- `src/app/(app)/equipment/__tests__/EquipmentDatasetTabs.test.tsx` — tab labels, default, URL change, and callback behavior.
- `src/app/(app)/equipment/__tests__/useEquipmentDatasetTab.test.ts` — URL fallback and router update behavior.

Modify:

- `src/app/(app)/equipment/_components/EquipmentPageClient.tsx` — wrap the current toolbar, summary, content, pagination, export, and mobile filters in the dataset tabs; pass the active scope to page/data hooks and import success handling.
- `src/app/(app)/equipment/_hooks/useEquipmentPage.ts` — own active dataset, reset page on scope change, preserve tenant-scoped filters, and expose import-tab navigation.
- `src/app/(app)/equipment/_hooks/EquipmentDataQueryParams.ts` — include dataset in query-key params and RPC args.
- `src/app/(app)/equipment/_hooks/useEquipmentData.ts` — pass scope to list, department distribution, and filter-bucket calls; include scope in every query key.
- `src/app/(app)/equipment/_hooks/useEquipmentExport.ts` — export only the active dataset while retaining the current 10,000-row cap and warning.
- `src/app/(app)/equipment/_hooks/useEquipmentFilterBuckets.ts` — request bucket counts for the active dataset and remove impossible “Mượn” choices from the regular tab.
- `src/components/equipment/equipment-toolbar-layout.tsx` and/or the existing funding-filter test fixture — enforce scoped funding options without duplicating filtering logic.
- `src/components/import-equipment-dialog.tsx` — report whether a successful import contains at least one normalized `Mượn` row.
- `src/app/(app)/reports/hooks/use-inventory-data.ts`, `use-unused-equipment-report.ts`, `use-equipment-aggregate-search.ts`, `use-maintenance-data.ts`, `use-maintenance-stats.ts`, and utilization hooks — pass the fixed regular scope where the corresponding RPC contract supports it.
- `src/hooks/use-dashboard-stats.ts`, `src/hooks/use-equipment-distribution.ts`, and Device Quota hooks — pass the fixed regular scope to equipment-derived KPI/report RPCs.
- Existing focused tests under `src/app/(app)/equipment/__tests__`, `src/app/(app)/reports/hooks/__tests__`, dashboard tests, utilization tests, and Device Quota tests — assert scope propagation rather than only UI rendering.
- SQL gate registry/docs as required by the repository’s Database Quality Gate contract.

## Chunk 1: Lock the server contract with RED tests

### Task 1: Add dataset types and query-contract tests

**Files:**

- Create: `src/app/(app)/equipment/_hooks/equipmentDataset.ts`
- Modify: `src/app/(app)/equipment/__tests__/EquipmentDataQueryParams.test.ts`
- Create: `src/app/(app)/equipment/__tests__/equipmentDataset.test.ts`

- [ ] **Step 1: Write failing tests** for `regular`/`placed` values, default `regular`, trim normalization, and query args containing `p_equipment_dataset`.
- [ ] **Step 2: Run the focused tests** with `node scripts/npm-run.js npx vitest run 'src/app/(app)/equipment/__tests__/equipmentDataset.test.ts' 'src/app/(app)/equipment/__tests__/EquipmentDataQueryParams.test.ts'`; expect failures because the scope type/argument does not exist.
- [ ] **Step 3: Implement the smallest constants/type/predicate and query-param extension.** Preserve the existing funding-array behavior and add the dataset as a separate named argument.
- [ ] **Step 4: Re-run the focused tests** and expect PASS.
- [ ] **Step 5: Commit** `test: define equipment dataset query contract`.

### Task 2: Add RED SQL/source checks for partition semantics

**Files:**

- Create: `supabase/tests/equipment_dataset_scope_smoke.sql`
- Modify: the committed SQL gate registry used by the repository

- [ ] **Step 1: Write read-only assertions** proving that regular and placed predicates are disjoint, that NULL/blank funding belongs to regular, that surrounding whitespace belongs to placed, and that search/page totals are calculated after the scope predicate.
- [ ] **Step 2: Add assertions for equipment list, department distribution, current-stock count, status distribution, and report aggregate sources.** Preserve historical imported/exported semantics where those RPCs intentionally include soft-deleted rows; only add the dataset predicate.
- [ ] **Step 3: Run the static/source check** and confirm it fails until the new parameter/predicate exists.
- [ ] **Step 4: Register the smoke test** with the exact `requiredForMigrations` mapping and documented protected objects.
- [ ] **Step 5: Commit** `test: cover equipment dataset SQL partition`.

## Chunk 2: Implement the forward SQL contract

### Task 3: Add the immutable migration and performance index

**Files:**

- Create: `supabase/migrations/20261014120000_equipment_dataset_scope.sql`

- [ ] **Step 1: Inventory every current overload, grant, and app caller before writing SQL.** Add a new named `p_equipment_dataset text` argument **without a default** to the scoped overload; keep the exact old signature as an `all` compatibility wrapper until every repository caller has migrated. Never leave two callable overloads with the same defaults, and add a contract test that omitted calls resolve unambiguously to the old wrapper while scoped calls resolve to the new overload. Validate only `all`, `regular`, and `placed`; UI callers must never use `all`.
- [ ] **Step 2: Apply the exact predicate** at each base equipment CTE/WHERE clause, before LIMIT/OFFSET and before aggregate counts:
  - `placed`: `btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn'`.
  - `regular`: `btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'`.
  - `all`: no dataset predicate for backwards-compatible non-UI callers.
- [ ] **Step 3: Update these equipment list/aggregate RPCs:** `equipment_list_enhanced`, `equipment_department_distribution`, `equipment_filter_buckets`, `equipment_count_enhanced`, `equipment_status_distribution` overloads, `equipment_list_for_reports`, `equipment_aggregates_for_reports`, `unused_equipment_report_for_reports`, and `equipment_aggregate_search`.
- [ ] **Step 4: Update equipment-derived dashboard/report RPCs:** `dashboard_kpi_summary`, `dashboard_equipment_total`, `dashboard_maintenance_count`, `equipment_attention_list`, `equipment_attention_list_paginated`, `usage_log_list`, `usage_analytics_overview`, `usage_analytics_daily`, `get_maintenance_report_data`, `maintenance_stats_for_reports`, `get_facilities_with_equipment_count`, `dinh_muc_compliance_summary`, and `dinh_muc_compliance_detail`. Put the predicate in the shared/scoped CTE so nested metrics, totals, and page rows agree. Attention lists are included as the dashboard KPI companion; `dashboard_recent_activities` remains out of scope.
- [ ] **Step 5: Preserve existing semantics unrelated to this feature.** Do not add soft-delete predicates to historical imported/exported aggregates unless their current contract already requires it; do not alter transfer `muc_dich` filtering.
- [ ] **Step 6: Add a partial expression index** on the tenant/funding expression used by placed lookups, after checking the current index catalog and avoiding a duplicate existing index.
- [ ] **Step 7: Run the SQL smoke test against a disposable gate database** and expect the new assertions to pass.
- [ ] **Step 8: Commit** `feat: add server equipment dataset scope`.

### Task 4: Verify RPC signatures and read-only API contracts

- [ ] **Step 1: Update source contract tests** that enumerate allowed RPC completeness/signatures; named RPC allowlists should remain unchanged because no new RPC name is introduced.
- [ ] **Step 2: Run focused RPC tests and the registered SQL smoke test** against both control and candidate disposable databases.
- [ ] **Step 3: Record static and baseline-forward results separately.** If the known gate false positive appears, retain the raw evidence, identify the false-positive signature, and wait for explicit user authorization before bypassing; after authorization, mark the result `BYPASS AUTHORIZED / INCOMPLETE` rather than PASS.
- [ ] **Step 4: Commit** `test: verify equipment dataset RPC contracts`.

## Chunk 3: Add the Equipment tabs and active-dataset data flow

### Task 5: Implement URL-persisted tabs

**Files:**

- Create: `src/app/(app)/equipment/_components/EquipmentDatasetTabs.tsx`
- Create: `src/app/(app)/equipment/_hooks/useEquipmentDatasetTab.ts`
- Modify: `src/app/(app)/equipment/_components/EquipmentPageClient.tsx`
- Modify: `src/app/(app)/equipment/_hooks/useEquipmentPage.ts`

- [ ] **Step 1: Write failing tests** for default `Thiết bị thường`, `Thiết bị đặt` label, valid/invalid `?tab=`, URL replacement without scroll, and pagination reset.
- [ ] **Step 2: Run the focused tab tests** and expect failures.
- [ ] **Step 3: Implement the controlled Tabs wrapper** using `Tabs`, `TabsList`, and `TabsTrigger`; use the existing transfer URL-sync behavior as a pattern, not as a dependency.
- [ ] **Step 4: Keep the tab outside `EquipmentFilterContext`** so tenant-scoped search/sort/column filters survive a tab switch. Reset only the page index and scope-specific impossible funding choice.
- [ ] **Step 5: Render the existing toolbar, department summary, table/card content, pagination, export, and mobile filter sheet inside the active dataset shell.** Do not duplicate table/action/detail components.
- [ ] **Step 6: Run the focused tab/page tests** and expect PASS.
- [ ] **Step 7: Commit** `feat: add equipment regular and placed tabs`.

### Task 6: Thread scope through list, buckets, summaries, and export

**Files:**

- Modify: `EquipmentDataQueryParams.ts`, `useEquipmentData.ts`, `useEquipmentPage.ts`, `useEquipmentFilterBuckets.ts`, and `useEquipmentExport.ts`.
- Modify: focused Equipment hook tests.

- [ ] **Step 1: Add failing assertions** that every list, department, bucket, and export RPC call includes the active scope and that every React Query key changes when scope changes.
- [ ] **Step 2: Run the focused hook tests** and expect failures.
- [ ] **Step 3: Add `equipmentDataset` to query-key params and RPC args.** Keep all existing search/filter/sort arrays unchanged.
- [ ] **Step 4: Ensure active dataset is applied before server pagination and export caps.** The placed export must never fetch regular rows and the regular export must never fetch Mượn rows.
- [ ] **Step 5: Scope filter buckets** so regular does not offer an impossible Mượn option and placed exposes only the locked Mượn funding value plus the other common filters.
- [ ] **Step 6: Run focused hook tests** and expect PASS.
- [ ] **Step 7: Commit** `feat: scope equipment queries and export by active tab`.

## Chunk 4: Import classification and shared actions

### Task 7: Route imported rows to the correct dataset

**Files:**

- Modify: `src/components/import-equipment-dialog.tsx`
- Modify: `src/app/(app)/equipment/_components/EquipmentPageClient.tsx` or `useEquipmentPage.ts`
- Create/modify: focused import tests

- [ ] **Step 1: Write failing tests** for all-regular, all-Mượn, and mixed imports, including whitespace around Mượn and preserving ordinary rows in the regular dataset.
- [ ] **Step 2: Run the focused import tests** and expect failures.
- [ ] **Step 3: Normalize only for classification** with the shared trim helper; keep the persisted value unchanged unless the existing form/import normalization already changes it.
- [ ] **Step 4: Invalidate equipment list, bucket, summary, and report query keys after success.** Switch to Thiết bị đặt when any imported row is Mượn and show the existing import summary/toast surface.
- [ ] **Step 5: Confirm add/edit transitions use the same server scope automatically**; no new workflow or database field is introduced.
- [ ] **Step 6: Run focused import/edit tests** and expect PASS.
- [ ] **Step 7: Commit** `feat: route imported borrowed equipment to placed tab`.

## Chunk 5: Exclude placed equipment from KPI and Reports pipelines

### Task 8: Thread fixed regular scope through dashboard and Device Quota KPI callers

**Files:**

- Modify: `src/hooks/use-dashboard-stats.ts`, `src/components/dashboard/kpi-cards.tsx` tests, dashboard distribution hooks/tests, and Device Quota hooks/tests.

- [ ] **Step 1: Add failing mock assertions** that dashboard KPI and Device Quota calls pass `p_equipment_dataset: 'regular'`.
- [ ] **Step 2: Run focused dashboard/Device Quota tests** and expect failures.
- [ ] **Step 3: Add the fixed regular argument** without changing transfer/activity-feed contracts.
- [ ] **Step 4: Verify attention list totals and paged rows use the same regular predicate.**
- [ ] **Step 5: Run focused tests** and expect PASS.
- [ ] **Step 6: Commit** `fix: exclude placed equipment from KPI datasets`.

### Task 9: Thread fixed regular scope through Reports and report exports

**Files:**

- Modify: `src/app/(app)/reports/hooks/use-inventory-data.ts`, `use-unused-equipment-report.ts`, `use-equipment-aggregate-search.ts`, `use-maintenance-data.ts`, `use-maintenance-stats.ts`, `src/app/(app)/reports/hooks/use-usage-analytics.ts`, and their focused tests.
- Modify: Reports export tests/builders only if a contract assertion is needed; do not add a second client-side exclusion pass.

- [ ] **Step 1: Add failing assertions** for inventory, maintenance, utilization (`usage_log_list`, `usage_analytics_overview`, `usage_analytics_daily`), unused, equipment-search, `get_facilities_with_equipment_count`, and report export data calls passing regular scope.
- [ ] **Step 2: Run focused Reports/utilization tests** and expect failures.
- [ ] **Step 3: Pass the fixed regular scope** through each hook and preserve existing tenant/facility/date/filter parameters.
- [ ] **Step 4: Verify report builders consume already-filtered data.** Do not filter returned arrays on the client because pagination, totals, and capped usage analytics would drift.
- [ ] **Step 5: Keep Equipment-page export scope-sensitive:** regular tab excludes Mượn; placed tab exports only Mượn.
- [ ] **Step 6: Run focused tests** and expect PASS.
- [ ] **Step 7: Commit** `fix: exclude placed equipment from reports and exports`.

## Chunk 6: Verification and handoff

### Task 10: Run repository checks in the required order

- [ ] **Step 1:** `node scripts/npm-run.js run format:check` — expect PASS.
- [ ] **Step 2:** `node scripts/npm-run.js run verify:no-explicit-any` — expect PASS.
- [ ] **Step 3:** `node scripts/npm-run.js run verify:dedupe` — expect PASS; invoke the `code-deduplication` skill because the change adds shared dataset behavior across hooks/RPC callers.
- [ ] **Step 4:** `node scripts/npm-run.js run typecheck` — expect PASS.
- [ ] **Step 5:** Run focused Equipment, import, dashboard, Reports, utilization, Device Quota, and SQL source tests — expect PASS.
- [ ] **Step 6:** `node scripts/npm-run.js run react-doctor` — expect PASS/no findings.
- [ ] **Step 7:** Run `node scripts/npm-run.js run db:quality-gate:local` and the manual Oracle baseline-forward lane. Report `static` and `baseline-forward` separately; because the current gate has known false positives, do not turn a suspicious result into PASS without explicit user-authorized bypass and documented replacement evidence.
- [ ] **Step 8:** Run `git diff --check` and inspect the final diff for accidental historical migration edits, client post-filtering, or transfer-domain coupling.

### Task 11: Review and rollout handoff

- [ ] **Step 1:** Dispatch a plan/implementation reviewer with this plan, the originating decisions, and the fixed base ref; resolve findings before implementation begins.
- [ ] **Step 2:** Confirm no live Supabase write has occurred. Applying the forward migration later requires explicit operation-specific user authorization through Supabase MCP.
- [ ] **Step 3:** Before live rollout, require readable `static PASS` and `baseline-forward PASS` evidence for the exact landed commit, then apply the migration before deploying the client so the new named RPC argument exists first. If the user authorizes a DB-gate bypass, record the exact commit digest, failing false-positive signature, replacement disposable SQL/source evidence, and status `BYPASS AUTHORIZED / INCOMPLETE`; that status prohibits live apply and client deploy until the user separately authorizes a safe alternative.
- [ ] **Step 4:** Smoke-test: open default Thiết bị thường; switch to Thiết bị đặt; search; change each shared filter; paginate; export both tabs; import regular/Mượn/mixed files; edit funding in both directions; verify KPI/Reports exclude Mượn.
- [ ] **Step 5:** Commit/push only after the user-approved gate/bypass status and all focused evidence are recorded.
