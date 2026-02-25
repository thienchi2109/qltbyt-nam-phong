# no-array-index-as-key Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all 29 `react-doctor/no-array-index-as-key` warnings from the full-repo scan while preserving behavior.

**Architecture:** Replace index-based keys with stable semantic keys (`id`, `href`, `title`, `label`, `name`, `dataKey`) where available. For skeleton/placeholder UI, use module-level key constants. For repeated string lists, render from pre-keyed view models so duplicate strings still get deterministic unique keys.

**Tech Stack:** Next.js 15, React 18, TypeScript, React Doctor v0.0.29, Vitest

---

### Task 1: Baseline and Key Utility

**Files:**
- Create: `src/lib/list-key-utils.ts`
- Create: `src/lib/__tests__/list-key-utils.test.ts`

**Step 1: Write the failing check**

Run:
```bash
$cfg='react-doctor.config.json'; $created=$false; if (!(Test-Path $cfg)) { Set-Content -Path $cfg -Value '{"diff": false}' -Encoding ASCII; $created=$true }; try { node scripts/npm-run.js npx react-doctor@latest . --verbose -y } finally { if ($created -and (Test-Path $cfg)) { Remove-Item $cfg -Force } }
```
Expected: full-scan output includes `Array index "..." used as key ... (29)`.

**Step 2: Add duplicate-safe key helper**

Create helper that converts `string[]` into deterministic keyed rows:
```ts
type KeyedText = { key: string; text: string };
```
Implementation rule: same text gets incremented suffix (`error-1`, `error-2`) in first-seen order.

**Step 3: Add helper tests**

Test cases:
- unique strings => unique deterministic keys
- duplicate strings => still unique deterministic keys
- same input order => same key output order

**Step 4: Run targeted tests**

Run:
```bash
node scripts/npm-run.js run test:run -- src/lib/__tests__/list-key-utils.test.ts
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/list-key-utils.ts src/lib/__tests__/list-key-utils.test.ts
git commit -m "refactor: add deterministic list key helper"
```

### Task 2: Fix Runtime Dynamic Lists (Highest Risk)

**Files:**
- Modify: `src/components/performance-dashboard.tsx`
- Modify: `src/components/interactive-equipment-chart.tsx`
- Modify: `src/components/dynamic-chart.tsx`
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsProcessStepper.tsx`

**Step 1: Write the failing check**

Run:
```bash
$cfg='react-doctor.config.json'; $created=$false; if (!(Test-Path $cfg)) { Set-Content -Path $cfg -Value '{"diff": false}' -Encoding ASCII; $created=$true }; try { node scripts/npm-run.js npx react-doctor@latest . --verbose -y } finally { if ($created -and (Test-Path $cfg)) { Remove-Item $cfg -Force } }
```
Expected locations include:
- `performance-dashboard.tsx:207,243`
- `interactive-equipment-chart.tsx:37`
- `dynamic-chart.tsx:255`
- `RepairRequestsProcessStepper.tsx:100`

**Step 2: Implement minimal key fixes**

- `performance-dashboard.tsx`
  - alerts: key from stable composite (`timestamp + metric/message`)
  - suggestions: key from suggestion string
- `interactive-equipment-chart.tsx`
  - tooltip rows: key from `entry.dataKey` (fallback `entry.name`)
- `dynamic-chart.tsx`
  - pie cells: key from entry `nameKey` value, not index
- `RepairRequestsProcessStepper.tsx`
  - step key from stable `step.title`

**Step 3: Run typecheck**

Run:
```bash
node scripts/npm-run.js run typecheck
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/performance-dashboard.tsx src/components/interactive-equipment-chart.tsx src/components/dynamic-chart.tsx src/app/(app)/repair-requests/_components/RepairRequestsProcessStepper.tsx
git commit -m "refactor: replace index keys in runtime status and chart lists"
```

### Task 3: Fix Validation/Error List Rendering

**Files:**
- Modify: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryImportDialog.tsx`
- Modify: `src/components/bulk-import/BulkImportDialogParts.tsx`
- Modify: `src/components/__tests__/import-equipment-dialog.test.tsx`
- Modify: `src/app/(app)/device-quota/decisions/_components/__tests__/DeviceQuotaImportDialog.test.tsx`

**Step 1: Write the failing check**

Expected warning locations:
- `DeviceQuotaCategoryImportDialog.tsx:427,449`
- `BulkImportDialogParts.tsx:87`
- test files at `...:118` and `...:102`

**Step 2: Implement minimal key fixes**

- production components: map through keyed rows from `list-key-utils` helper
- test doubles: key by stable string value (or same helper) instead of index

**Step 3: Run targeted tests**

Run:
```bash
node scripts/npm-run.js run test:run -- src/components/__tests__/import-equipment-dialog.test.tsx src/app/(app)/device-quota/decisions/_components/__tests__/DeviceQuotaImportDialog.test.tsx
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryImportDialog.tsx src/components/bulk-import/BulkImportDialogParts.tsx src/components/__tests__/import-equipment-dialog.test.tsx src/app/(app)/device-quota/decisions/_components/__tests__/DeviceQuotaImportDialog.test.tsx
git commit -m "refactor: replace index keys in validation and test error lists"
```

### Task 4: Fix Template/Form Row Keys

**Files:**
- Modify: `src/components/handover-template.tsx`
- Modify: `src/components/log-template.tsx`
- Modify: `src/components/maintenance-form.tsx`

**Step 1: Write the failing check**

Expected warning locations:
- `handover-template.tsx:141`
- `log-template.tsx:137`
- `maintenance-form.tsx:111`

**Step 2: Implement minimal key fixes**

- build row view-models before render with deterministic `_rowKey`
- prefer domain fields (`code`, `serial`, `dateTime`, `user`) where present
- keep placeholder rows stable with explicit placeholder keys (not render-time index key)

**Step 3: Run typecheck**

Run:
```bash
node scripts/npm-run.js run typecheck
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/handover-template.tsx src/components/log-template.tsx src/components/maintenance-form.tsx
git commit -m "refactor: stabilize row keys in printable templates"
```

### Task 5: Fix Static Feature/Stats Keys

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/login-template.tsx`

**Step 1: Write the failing check**

Expected warning locations:
- `src/app/page.tsx:236,251,320,335`
- `src/components/login-template.tsx:79,103`

**Step 2: Implement minimal key fixes**

- `app/page.tsx`
  - stats key: `stat.label`
  - features key: `feature.title`
- `login-template.tsx`
  - feature cards key: `feature.title`
  - chart cells key: `entry.name`

**Step 3: Run typecheck**

Run:
```bash
node scripts/npm-run.js run typecheck
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/app/page.tsx src/components/login-template.tsx
git commit -m "refactor: replace index keys in static marketing lists"
```

### Task 6: Fix Skeleton/Placeholder Keys

**Files:**
- Modify: `src/app/(app)/device-quota/_components/DeviceQuotaSubNav.tsx`
- Modify: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx`
- Modify: `src/app/(app)/device-quota/mapping/_components/DeviceQuotaCategoryTree.tsx`
- Modify: `src/app/(app)/reports/components/inventory-charts.tsx`
- Modify: `src/app/(app)/reports/components/inventory-table.tsx`
- Modify: `src/components/equipment-distribution-summary.tsx`
- Modify: `src/components/monthly-maintenance-summary.tsx`
- Modify: `src/components/upcoming-maintenance-card.tsx`
- Modify: `src/components/ui/calendar-widget.tsx`

**Step 1: Write the failing check**

Expected warning locations:
- sub-nav, category trees, inventory skeletons, equipment summary, monthly/upcoming cards, calendar skeletons

**Step 2: Implement minimal key fixes**

- add module-level constants for skeleton keys (e.g. `['s1','s2','s3']`)
- map using those constants for `key={token}`
- for calendar grid, use row and column token arrays and composite string keys

**Step 3: Run typecheck**

Run:
```bash
node scripts/npm-run.js run typecheck
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/app/(app)/device-quota/_components/DeviceQuotaSubNav.tsx src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx src/app/(app)/device-quota/mapping/_components/DeviceQuotaCategoryTree.tsx src/app/(app)/reports/components/inventory-charts.tsx src/app/(app)/reports/components/inventory-table.tsx src/components/equipment-distribution-summary.tsx src/components/monthly-maintenance-summary.tsx src/components/upcoming-maintenance-card.tsx src/components/ui/calendar-widget.tsx
git commit -m "refactor: replace index keys in skeleton and placeholder lists"
```

### Task 7: Full Verification and Closeout

**Files:**
- Modify: `docs/react-doctor-full-scan-2026-02-25.md` (optional summary refresh)

**Step 1: Run quality gates**

Run:
```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run lint
node scripts/npm-run.js run test:run
```
Expected: PASS (or capture known unrelated failures separately).

**Step 2: Run React Doctor full scan and assert zero index-key warnings**

Run:
```bash
$cfg='react-doctor.config.json'; $created=$false; if (!(Test-Path $cfg)) { Set-Content -Path $cfg -Value '{"diff": false}' -Encoding ASCII; $created=$true }; try { node scripts/npm-run.js npx react-doctor@latest . --verbose -y } finally { if ($created -and (Test-Path $cfg)) { Remove-Item $cfg -Force } }
```
Expected: no `react-doctor/no-array-index-as-key` warnings.

**Step 3: Commit verification updates**

```bash
git add docs/react-doctor-full-scan-2026-02-25.md
git commit -m "docs: refresh react-doctor scan summary after key fixes"
```

**Step 4: Sync and push**

```bash
git pull --rebase
bd sync
git push
git status
```
Expected: clean working tree and branch up to date with origin.

---

## Source Warning Inventory (29)

1. `src/app/(app)/device-quota/_components/DeviceQuotaSubNav.tsx:33`
2. `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryImportDialog.tsx:427`
3. `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryImportDialog.tsx:449`
4. `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx:92`
5. `src/app/(app)/device-quota/decisions/_components/__tests__/DeviceQuotaImportDialog.test.tsx:102`
6. `src/app/(app)/device-quota/mapping/_components/DeviceQuotaCategoryTree.tsx:89`
7. `src/app/(app)/repair-requests/_components/RepairRequestsProcessStepper.tsx:100`
8. `src/app/(app)/reports/components/inventory-charts.tsx:115`
9. `src/app/(app)/reports/components/inventory-table.tsx:226`
10. `src/app/page.tsx:236`
11. `src/app/page.tsx:251`
12. `src/app/page.tsx:320`
13. `src/app/page.tsx:335`
14. `src/components/__tests__/import-equipment-dialog.test.tsx:118`
15. `src/components/bulk-import/BulkImportDialogParts.tsx:87`
16. `src/components/dynamic-chart.tsx:255`
17. `src/components/equipment-distribution-summary.tsx:77`
18. `src/components/handover-template.tsx:141`
19. `src/components/interactive-equipment-chart.tsx:37`
20. `src/components/login-template.tsx:79`
21. `src/components/login-template.tsx:103`
22. `src/components/log-template.tsx:137`
23. `src/components/maintenance-form.tsx:111`
24. `src/components/monthly-maintenance-summary.tsx:103`
25. `src/components/performance-dashboard.tsx:207`
26. `src/components/performance-dashboard.tsx:243`
27. `src/components/ui/calendar-widget.tsx:66`
28. `src/components/ui/calendar-widget.tsx:396`
29. `src/components/upcoming-maintenance-card.tsx:105`

