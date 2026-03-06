# Unified Inventory Chart Hooks Stabilization Design

**Date:** 2026-02-25
**Scope:** Error-level findings #5-#9 from `docs/react-doctor-full-scan-2026-02-25.md` (only `src/components/unified-inventory-chart.tsx` + focused tests)
**Status:** Approved

---

## 1) Problem Statement

React Doctor reports hook-order violations in `src/components/unified-inventory-chart.tsx`:

- `:49` — `useQuery` conditionally called
- `:60` — `useState` conditionally called
- `:61` — `useMemo` conditionally called
- `:75` — `useMemo` conditionally called
- `:81` — `useEffect` conditionally called

Root cause: the current component performs an early return for role visibility before these hooks (`src/components/unified-inventory-chart.tsx:44`), creating render paths with different hook counts.

---

## 2) Goals / Non-goals

### Goals
- Eliminate findings #5-#9 by making hook execution order stable.
- Preserve current UI behavior and prop contracts.
- Keep fix maintainable and consistent with recent reports-page auth-gate pattern.
- Add focused regression tests to prevent recurrence.

### Non-goals
- No feature expansion or UX redesign.
- No backend/RPC behavior changes.
- No parent component refactors beyond compatibility verification.

---

## 3) Recommended Architecture (Approved)

Use **Auth/Visibility Gate + Content Split** inside `unified-inventory-chart.tsx`.

### 3.1 Gate Wrapper Component
- Keep `UnifiedInventoryChart` as a thin wrapper.
- Responsibilities:
  - read session/role (`useSession`, role helpers)
  - evaluate visibility (`isGlobalOrRegionalLeader` + role semantics)
  - return `null` for unauthorized viewers
  - render child content component when authorized
- Do **not** keep data/state hooks in wrapper.

### 3.2 Content Component
- Introduce an internal child (e.g., `UnifiedInventoryChartContent`) that receives the same props.
- Move all currently flagged hooks into child and execute them unconditionally in fixed order:
  1. `useQuery` (facilities query)
  2. `useState(showAll)`
  3. `useMemo(sortedData)`
  4. `useMemo(visibleData)`
  5. `useEffect(telemetry)`
- Preserve existing render branches and output:
  - single-mode (`tenantFilter !== 'all'`) → `InteractiveEquipmentChart`
  - all-mode → facilities card/chart/toggle UI

---

## 4) Data Flow and Behavioral Contract

### Inputs (unchanged)
- `tenantFilter?: string`
- `selectedDonVi?: number | null`
- `effectiveTenantKey?: string`
- `isGlobalOrRegionalLeader?: boolean`

### Behavior (unchanged)
- Unauthorized or non-target roles: render nothing.
- `tenantFilter === 'all'`: fetch facilities distribution, Top 10 default, show-all toggle.
- `tenantFilter !== 'all'`: render existing interactive per-facility chart.

### Performance/Best-Practice Notes
- Keep `useQuery` guarded with `enabled: isAllMode` to avoid unnecessary fetches.
- Keep `useMemo` dependency arrays minimal and primitive where possible.
- Avoid introducing additional abstractions not needed for this fix (YAGNI).

---

## 5) Testing Strategy (TDD-focused)

### New focused test file
- `src/components/__tests__/unified-inventory-chart.hooks-and-modes.test.tsx`

### Core regression cases
1. **Role transition hidden → visible** should not throw runtime hook-order errors.
2. **Role transition visible → hidden** should not throw runtime hook-order errors.

### Behavior preservation cases
3. Visible + all-mode renders facilities distribution path.
4. Visible + single-mode renders `InteractiveEquipmentChart` path.
5. Non-visible role returns null.

Tests use targeted mocks for:
- `next-auth/react` (`useSession`)
- `@tanstack/react-query` (`useQuery`) or a light `QueryClientProvider` setup
- chart subcomponents to assert render path without heavy rendering coupling

---

## 6) Verification and Exit Criteria

1. Targeted tests pass:
   - `node scripts/npm-run.js run test:run -- "src/components/__tests__/unified-inventory-chart.hooks-and-modes.test.tsx"`
2. Targeted lint passes:
   - `node scripts/npm-run.js run lint -- --file "src/components/unified-inventory-chart.tsx"`
3. React Doctor no longer reports findings #5-#9:
   - `node scripts/npm-run.js run react-doctor:verbose`
4. Typecheck remains clean:
   - `node scripts/npm-run.js run typecheck`

**Done when:** all four checks are green and findings #5-#9 are absent.

---

## 7) Risks and Mitigation

- **Risk:** Accidental behavior drift in mode rendering.
  - **Mitigation:** explicit behavior-preservation tests for all-mode vs single-mode.
- **Risk:** Future edits reintroduce conditional hooks.
  - **Mitigation:** keep gate/content split and retain transition regression tests.
- **Risk:** Noise from unrelated repo-wide lint issues.
  - **Mitigation:** use targeted lint for scope verification.
