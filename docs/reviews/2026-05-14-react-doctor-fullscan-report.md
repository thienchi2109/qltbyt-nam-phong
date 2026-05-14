# React Doctor Full-Scan Report — 2026-05-14

- **Date**: 2026-05-14
- **Branch**: `main`
- **Commit (HEAD)**: `265008ef` (Merge PR #475 — knip files classification)
- **Tool**: `react-doctor@latest` (0.1.6)
- **Command**: `node scripts/npm-run.js npx react-doctor@latest . --full --verbose --project nextn --offline`
- **Scan mode**: full repo
- **Source files scanned**: 535
- **Files with issues**: 193
- **Total issues**: **560**
- **Distinct rules fired**: 28
- **Health score**: **79 / 100 — _Great_**
- **Telemetry**: disabled (`--offline`)
- **Code changes in this run**: none — read-only audit

> Stack confirmed by tool: Next.js · React `^18.3.1` · TypeScript · React Compiler not enabled.

---

## TL;DR — Comparison vs 2026-05-12 Baseline

| Metric | 2026-05-12 (`f365e15`) | 2026-05-14 (`265008ef`) | Δ |
|---|---:|---:|---:|
| Health score | 63 / 100 | **79 / 100** | **+16** |
| Total issues | 1310 | **560** | **−750 (−57.3%)** |
| Files with issues | 298 / 527 | 193 / 535 | −105 |
| Distinct rules fired | 49 | 28 | −21 |

The big drop comes from PRs that landed since 2026-05-12: P0 correctness (#463), P1 hydration audit (#464), P2 rerender (#465), Phase 1 size codemod (#466), accessibility batch (#0e3c8c7e), flex spacing (#470), P3 cosmetic phase 3 (#472), knip files classification (#475).

**However**, the headline P0 item from the previous report — `query-mutation-missing-invalidation` (×13) — is **still 13 and on the exact same files / lines** as the baseline. The "P0 correctness" PR (#463) did not touch the TanStack Query invalidation set; it cleared the scattered easy P0s instead (`react/no-unknown-property`, `no-array-index-as-key`, partial `knip/duplicates`, etc.).

---

## How to Reproduce

```bash
# Full scan
node scripts/npm-run.js npx react-doctor@latest . --full --verbose --project nextn --offline

# Score-only
node scripts/npm-run.js npx react-doctor@latest . --score --yes --project nextn --offline

# Diff-only against main
node scripts/npm-run.js npx react-doctor@latest . --verbose --yes --project nextn --offline --diff main
```

Diagnostics directory for this run: `/tmp/react-doctor-590027ae-346c-4d53-b639-1a4920a49e5b`.

---

## Per-Rule Comparison (sorted by current count)

| Rule | 2026-05-12 | 2026-05-14 | Δ | Notes |
|------|---:|---:|---:|---|
| `react-doctor/design-no-default-tailwind-palette` | 152 | **154** | +2 | Untouched; needs token migration |
| `knip/exports` | 125 | **124** | −1 | Largely unchanged |
| `react-doctor/no-react19-deprecated-apis` | 90 | **90** | = | Pre-flight item; React 18 today |
| `knip/types` | 89 | **89** | = | Unchanged |
| `react-doctor/react-compiler-destructure-method` | 16 | **16** | = | Compiler not enabled |
| `react-doctor/js-combine-iterations` | 18 | **15** | −3 | Code smell, micro |
| `react-doctor/query-mutation-missing-invalidation` | 13 | **13** | = | ⚠️ **P0 still open** — same 13 mutations |
| `react-doctor/no-giant-component` | 11 | **11** | = | Refactor backlog |
| `react-doctor/no-effect-event-handler` | 9 | **7** | −2 | Partial cleanup |
| `react-doctor/no-generic-handler-names` | 8 | **6** | −2 | Code style |
| `react-doctor/no-many-boolean-props` | 4 | **4** | = | API design |
| `react-doctor/no-render-in-render` | 3 | **3** | = | Inline render functions |
| `react-doctor/no-polymorphic-children` | 3 | **3** | = | API design |
| `react-doctor/rerender-state-only-in-handlers` | 10 | **3** | −7 | P2 rerender PR effect |
| `react-doctor/no-cascading-set-state` | 9 | **3** | −6 | P2 rerender PR effect |
| `react-doctor/prefer-useReducer` | 6 | **3** | −3 | P2 rerender PR effect |
| `react-doctor/server-dedup-props` | 2 | **2** | = | RSC |
| `react-doctor/js-hoist-intl` | 2 | **2** | = | Perf micro |
| `react-doctor/rerender-functional-setstate` | 2 | **2** | = | Perf micro |
| `knip/duplicates` | 3 | **2** | −1 | 1 disambiguated |
| `react-doctor/nextjs-no-use-search-params-without-suspense` | 1 | **1** | = | ⚠️ Next 15 SSR risk |
| `jsx-a11y/heading-has-content` | 1 | **1** | = | A11y |
| `react-doctor/js-batch-dom-css` | 1 | **1** | = | Perf micro |
| `react-doctor/prefer-dynamic-import` | 1 | **1** | = | Bundling |
| `react-doctor/no-derived-useState` | 1 | **1** | = | Code smell |
| `react-doctor/no-side-tab-border` | 5 | **1** | −4 | Cosmetic phase 3 |
| `react/no-children-prop` | 1 | **1** | = | DOM correctness |
| `react-doctor/js-flatmap-filter` | 4 | **1** | −3 | Micro perf |

### Eliminated in this period (rule no longer firing on `main`)

| Rule | 2026-05-12 | Likely fixer |
|------|---:|---|
| `react-doctor/design-no-redundant-size-axes` | **540** | Phase 1 size codemod (PR #466) |
| `react-doctor/rendering-hydration-mismatch-time` | **49** | P1 hydration audit (PR #464) |
| `react-doctor/design-no-space-on-flex-children` | **41** | Flex spacing PR (#470) |
| `react-doctor/design-no-bold-heading` | 24 | Cosmetic batches |
| `react-doctor/design-no-three-period-ellipsis` | 19 | Cosmetic batches |
| `knip/files` | 8 | knip files classification (PR #475) |
| `react/no-unknown-property` | 5 | P0 correctness (PR #463) |
| `jsx-a11y/no-static-element-interactions` | 5 | A11y batch (`0e3c8c7e`) |
| `jsx-a11y/click-events-have-key-events` | 5 | A11y batch |
| `react-doctor/rendering-usetransition-loading` | 4 | P2 rerender (PR #465) |
| `react-doctor/no-array-index-as-key` | 4 | P0 correctness (PR #463) |
| `jsx-a11y/label-has-associated-control` | 4 | A11y batch |
| `react-doctor/no-pure-black-background` | 3 | Cosmetic phase 3 (PR #472) |
| `jsx-a11y/anchor-is-valid` | 2 | A11y batch |
| `react-doctor/rendering-hydration-no-flicker` | 1 | P1 hydration audit |
| `react-doctor/prefer-use-sync-external-store` | 1 | P1 hydration audit |
| `react-doctor/no-long-transition-duration` | 1 | Cosmetic phase 3 |
| `react-doctor/design-no-redundant-padding-axes` | 1 | Cosmetic phase 3 |
| `react-doctor/design-no-em-dash-in-jsx-text` | 1 | Cosmetic phase 3 |
| `react-doctor/async-parallel` | 1 | Misc |
| `jsx-a11y/no-autofocus` | 1 | A11y batch |
| **Total eliminated** | **720** | |

---

## What's Still On The Board

### 🔴 P0 — Correctness, **not yet addressed**

1. **`query-mutation-missing-invalidation` (×13)** — same exact files/lines as 2026-05-12:
   - <ref_snippet file="/root/qltbyt-nam-phong/src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx" lines="75-220" /> (5 mutations: lines 75, 116, 155, 178, 212)
   - <ref_snippet file="/root/qltbyt-nam-phong/src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryContext.tsx" lines="80-184" /> (3 mutations: lines 80, 131, 184)
   - <ref_snippet file="/root/qltbyt-nam-phong/src/app/(app)/device-quota/decisions/_components/DeviceQuotaDecisionsContext.tsx" lines="94-214" /> (4 mutations: lines 94, 140, 186, 214)
   - <ref_snippet file="/root/qltbyt-nam-phong/src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingContext.tsx" lines="118-118" /> (1 mutation: line 118)
   - **User-visible symptom:** stale data after create/update/delete in repair-requests and device-quota flows.
   - **Fix:** add `onSuccess: () => queryClient.invalidateQueries({ queryKey: [...] })` aligned with each module's existing query keys.

2. **`nextjs-no-use-search-params-without-suspense` (×1)** — Next.js 15 SSR/SSG risk. Wrap the consumer in `<Suspense>`.

3. **`knip/duplicates` (×2)** — remaining duplicate exports across `repair-requests/_components/`. Disambiguate to a single source.

### 🟡 P1 — Maintenance / readiness backlog

- **`design-no-default-tailwind-palette` (×154)** — palette → semantic tokens. Codemod-friendly, requires design alignment.
- **`knip/exports` (×124) + `knip/types` (×89)** — dead-code cleanup; some are intentional `*.types.assert.ts` typecheck helpers, audit before deleting.
- **`no-react19-deprecated-apis` (×90)** — `useContext` / `forwardRef` in `src/components/ui/*`. Pre-flight for React 19; not a current bug.
- **`no-giant-component` (×11)** — same 11 components flagged before; refactor backlog.

### 🟢 P2 — Low-cost remainder

- `js-combine-iterations` (15), `react-compiler-destructure-method` (16), `no-effect-event-handler` (7), `no-generic-handler-names` (6), `no-many-boolean-props` (4), small a11y/perf items (≤3 each).

---

## Recommended Next Steps

1. **Open a P0 PR addressing the 13 `query-mutation-missing-invalidation` issues** in `RepairRequestsContext`, `DeviceQuotaCategoryContext`, `DeviceQuotaDecisionsContext`, `DeviceQuotaMappingContext`. Verification: TanStack Query devtools + reproduction of each stale-data flow. _This is the highest user-visible correctness gap left in the report._
2. Fix the lone `useSearchParams`-without-Suspense site (1 issue) before the next Next.js bump.
3. Resolve the 2 remaining `knip/duplicates` to remove import ambiguity.
4. Plan a token migration PR for `design-no-default-tailwind-palette` (154) — biggest remaining bucket but design-system-coupled.
5. Track React 19 / React Compiler readiness (90 + 16) as a single milestone, not as inline cleanup.
