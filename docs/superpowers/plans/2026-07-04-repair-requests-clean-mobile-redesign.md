# Repair Requests Clean Mobile Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Repair Requests mobile/tablet layout so it is clean, spacious, and balanced while preserving the existing fixed global header, tenant display, data flow, and desktop table experience.

**Architecture:** Keep the existing route and data hooks unchanged. Add a local mobile KPI presentation for the five repair status cards, tighten the existing compact toolbar for mobile, and simplify mobile request cards through progressive disclosure: list cards show only decision-critical information; detail/menu flows keep secondary information available. Desktop continues to use the existing shared `KpiStatusBar`, toolbar, table, and pagination patterns.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind/shadcn components, Vitest, Testing Library, existing `scripts/npm-run.js` verification wrapper.

---

## Design Constraints

- Preserve the current fixed global app header and tenant name. Do not copy the Stitch mockup header into the page body.
- Do not repeat tenant/facility text under the page title when the fixed header already displays it.
- Mobile and tablet use the card layout until desktop/laptop width. Table layout is desktop-only.
- Five KPI cards must be visually balanced:
  - `Tổng` is a full-width summary card.
  - `Chờ xử lý`, `Đã duyệt`, `Hoàn thành`, `Không HT` form a 2x2 grid below.
- Keep mobile list cards clean:
  - Show equipment name, equipment code, status, requester name with department fallback, request date, short problem description, and one primary action.
  - Move secondary actions into the existing menu/action zone.
  - Avoid nesting the list inside a large desktop-style card container on mobile.
- Treat spacing as part of the design contract, not final polish:
  - Page body horizontal padding: `px-4` on mobile, `md:px-6` on tablet.
  - Main vertical rhythm: `gap-5` to `gap-6` between title, KPI, toolbar, and list.
  - KPI grid gap: `gap-3` on mobile, `md:gap-4` on tablet.
  - KPI card padding: `p-4`; total card can use `py-4 px-5`.
  - Request card padding: `p-4`; internal sections use `gap-3` or `space-y-3`.
  - Metadata rows must have enough column gap to avoid label/value collisions: at least `gap-x-4`.
  - Action row gap: `gap-3`; primary button height 48px.
  - Bottom padding must account for bottom nav/FAB: at least `pb-28` on mobile list/page content.
- Maintain accessibility:
  - Tap targets at least 44px, preferably 48px for primary actions.
  - Card activation must remain separate from action controls.
  - Searchbox and filter controls keep accessible labels.
- Avoid broad shared component changes unless the local page cannot meet the design without them.

## File Structure

- Create: `src/app/(app)/repair-requests/_components/RepairRequestsMobileKpi.tsx`
  - Local mobile/tablet KPI renderer for the five-card balanced layout.
- Create: `src/app/(app)/repair-requests/__tests__/RepairRequestsMobileKpi.test.tsx`
  - Focused tests for total-card-first layout, 2x2 status grid, counts, loading/undefined behavior.
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsPageLayout.tsx`
  - Use `RepairRequestsMobileKpi` for mobile/tablet and keep `KpiStatusBar` for desktop.
  - Remove/avoid the desktop-style list wrapper from mobile rendering.
  - Keep access-gate empty state behavior unchanged.
- Modify: `src/app/(app)/repair-requests/__tests__/RepairRequestsPageLayout.test.tsx`
  - Assert mobile KPI is rendered with counts and desktop KPI remains available.
  - Assert mobile list is not nested inside the desktop summary card container.
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsToolbar.tsx`
  - Refine `compactFilters` layout only: search + `Bộ lọc` same row, chips below.
- Modify: `src/app/(app)/repair-requests/__tests__/RepairRequestsToolbar.test.tsx`
  - Assert compact toolbar ordering and callbacks remain intact.
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsMobileList.tsx`
  - Simplify the card visual hierarchy and action area while preserving keyboard/card/action behavior.
- Modify: `src/app/(app)/repair-requests/__tests__/RepairRequestsMobileList.a11y.test.tsx`
  - Extend current accessibility tests for the cleaner card structure.

## Chunk 1: Balanced Mobile KPI

### Task 1: Add failing tests for five-card mobile KPI layout

**Files:**

- Create: `src/app/(app)/repair-requests/__tests__/RepairRequestsMobileKpi.test.tsx`
- Create later: `src/app/(app)/repair-requests/_components/RepairRequestsMobileKpi.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, within } from "@testing-library/react"

import { RepairRequestsMobileKpi } from "../_components/RepairRequestsMobileKpi"
import type { RepairStatus } from "@/components/kpi"

const counts: Record<RepairStatus, number> = {
  "Chờ xử lý": 34,
  "Đã duyệt": 3,
  "Hoàn thành": 30,
  "Không HT": 2,
}

describe("RepairRequestsMobileKpi", () => {
  it("renders total as a full-width summary before a balanced 2x2 status grid", () => {
    render(<RepairRequestsMobileKpi counts={counts} loading={false} />)

    const region = screen.getByTestId("repair-mobile-kpi")
    const total = screen.getByTestId("repair-mobile-kpi-total")
    const statusGrid = screen.getByTestId("repair-mobile-kpi-status-grid")

    expect(total).toHaveTextContent("Tổng")
    expect(total).toHaveTextContent("69")
    expect(total).toHaveClass("col-span-2")
    expect(total.compareDocumentPosition(statusGrid)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    expect(within(statusGrid).getAllByTestId(/^repair-mobile-kpi-status-/)).toHaveLength(4)
    expect(screen.getByTestId("repair-mobile-kpi-status-Chờ xử lý")).toHaveTextContent("34")
    expect(screen.getByTestId("repair-mobile-kpi-status-Đã duyệt")).toHaveTextContent("3")
    expect(screen.getByTestId("repair-mobile-kpi-status-Hoàn thành")).toHaveTextContent("30")
    expect(screen.getByTestId("repair-mobile-kpi-status-Không HT")).toHaveTextContent("2")
  })

  it("uses zero counts while status counts are unavailable", () => {
    render(<RepairRequestsMobileKpi counts={undefined} loading={false} />)

    expect(screen.getByTestId("repair-mobile-kpi-total")).toHaveTextContent("0")
    expect(screen.getByTestId("repair-mobile-kpi-status-Chờ xử lý")).toHaveTextContent("0")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run through context-mode:

```bash
node scripts/npm-run.js run test:run -- src/app/\(app\)/repair-requests/__tests__/RepairRequestsMobileKpi.test.tsx
```

Expected: FAIL because `RepairRequestsMobileKpi` does not exist.

- [ ] **Step 3: Implement minimal mobile KPI component**

Create `src/app/(app)/repair-requests/_components/RepairRequestsMobileKpi.tsx`.

Implementation notes:

- Import `REPAIR_STATUS_CONFIGS` and `type RepairStatus` from `@/components/kpi`.
- Render a wrapper with `data-testid="repair-mobile-kpi"` and `className="grid grid-cols-2 gap-3 md:max-w-3xl"`.
- Render total first with `data-testid="repair-mobile-kpi-total"` and `className` including `col-span-2`.
- Render status cards inside `data-testid="repair-mobile-kpi-status-grid"` with `className="col-span-2 grid grid-cols-2 gap-3"`.
- Use consistent card padding (`p-4`, total `px-5 py-4`) and avoid cramped icon/value stacks.
- Use the existing status config order. Do not introduce a new status order unless product asks for it.
- Use existing icon/color config where practical, but keep styling local and restrained.
- Loading may use muted placeholders, but do not add spinner-only UI.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node scripts/npm-run.js run test:run -- src/app/\(app\)/repair-requests/__tests__/RepairRequestsMobileKpi.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/repair-requests/_components/RepairRequestsMobileKpi.tsx src/app/\(app\)/repair-requests/__tests__/RepairRequestsMobileKpi.test.tsx
git commit -m "test: add repair request mobile KPI layout"
```

## Chunk 2: Page Layout Integration

### Task 2: Use mobile KPI and remove mobile desktop-style container

**Files:**

- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsPageLayout.tsx`
- Modify: `src/app/(app)/repair-requests/__tests__/RepairRequestsPageLayout.test.tsx`

- [ ] **Step 1: Write failing integration tests**

Add tests to `RepairRequestsPageLayout.test.tsx`.

Test intent:

- The layout passes `statusCounts` to the mobile KPI.
- The mobile/tablet branch renders a card list without forcing it inside the desktop summary `Card`.
- Desktop table/pagination behavior remains unchanged.

Suggested test shape:

```tsx
vi.mock("../_components/RepairRequestsMobileKpi", () => ({
  RepairRequestsMobileKpi: ({
    counts,
  }: {
    counts: Record<string, number> | undefined
    loading: boolean
  }) => (
    <div
      data-testid="repair-mobile-kpi"
      data-total={counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : 0}
    />
  ),
}))

it("renders the balanced mobile KPI with status counts", () => {
  render(<RepairRequestsPageLayout {...defaultProps} />)

  expect(screen.getByTestId("repair-mobile-kpi")).toHaveAttribute("data-total", "10")
})

it("keeps mobile cards outside the desktop summary card shell", () => {
  render(<RepairRequestsPageLayout {...defaultProps} />)

  const mobileList = screen.getByTestId("repair-mobile-list")
  expect(mobileList.closest("[data-testid='repair-requests-desktop-card']")).toBeNull()
})
```

If current tests do not expose stable container test ids, add semantic/test ids only where they document a real layout boundary.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node scripts/npm-run.js run test:run -- src/app/\(app\)/repair-requests/__tests__/RepairRequestsPageLayout.test.tsx
```

Expected: FAIL because the page does not yet render the local mobile KPI or the new mobile layout boundary.

- [ ] **Step 3: Implement minimal layout integration**

In `RepairRequestsPageLayout.tsx`:

- Import `RepairRequestsMobileKpi`.
- Render mobile KPI in the mobile/tablet content section with `className` visibility equivalent to `lg:hidden` or the repo's current breakpoint convention.
- Keep shared `KpiStatusBar` in the desktop section only.
- Add a stable `data-testid="repair-requests-desktop-card"` to the desktop summary card if needed by the test.
- Add or preserve `data-testid="repair-mobile-list"` around the mobile list wrapper.
- Keep the access-gate empty state unchanged; do not show mobile list when `shouldFetchData=false`.

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
node scripts/npm-run.js run test:run -- src/app/\(app\)/repair-requests/__tests__/RepairRequestsPageLayout.test.tsx src/app/\(app\)/repair-requests/__tests__/RepairRequestsMobileKpi.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/repair-requests/_components/RepairRequestsPageLayout.tsx src/app/\(app\)/repair-requests/__tests__/RepairRequestsPageLayout.test.tsx
git commit -m "feat: balance repair request mobile KPI layout"
```

## Chunk 3: Compact Toolbar

### Task 3: Make mobile search/filter airy and single-purpose

**Files:**

- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsToolbar.tsx`
- Modify: `src/app/(app)/repair-requests/__tests__/RepairRequestsToolbar.test.tsx`

- [ ] **Step 1: Write failing toolbar test**

Extend compact filter tests:

```tsx
it("places compact search and filter trigger in one row with chips below", () => {
  render(<RepairRequestsToolbar {...baseProps} compactFilters showFacilityFilter />)

  const search = screen.getByRole("searchbox", { name: "Tìm thiết bị, mô tả..." })
  const filter = screen.getByRole("button", { name: "Bộ lọc" })
  const row = screen.getByTestId("repair-toolbar-compact-row")

  expect(row).toContainElement(search)
  expect(row).toContainElement(filter)
  expect(row).toHaveClass("grid")
  expect(screen.getByTestId("repair-toolbar-filter-chips")).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node scripts/npm-run.js run test:run -- src/app/\(app\)/repair-requests/__tests__/RepairRequestsToolbar.test.tsx
```

Expected: FAIL because compact row/chips boundary test ids/classes do not exist yet.

- [ ] **Step 3: Implement compact toolbar refinement**

In `RepairRequestsToolbar.tsx`:

- For `compactFilters=true`, render:
  - One row: search input flexes, `Bộ lọc` button stays 48px height.
  - Chips below the row with clear wrapping.
- Use `gap-3` between search and filter, and `mt-3` or `gap-3` before filter chips so the toolbar breathes without wasting vertical space.
- Preserve all current callbacks: `onSearchChange`, `onOpenFilterModal`, `onClearFilters`, `onRemoveFilter`.
- Keep desktop inline controls unchanged.
- Do not add explanatory visible text.

- [ ] **Step 4: Run toolbar tests**

Run:

```bash
node scripts/npm-run.js run test:run -- src/app/\(app\)/repair-requests/__tests__/RepairRequestsToolbar.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/repair-requests/_components/RepairRequestsToolbar.tsx src/app/\(app\)/repair-requests/__tests__/RepairRequestsToolbar.test.tsx
git commit -m "feat: refine repair request mobile filters"
```

## Chunk 4: Clean Mobile Request Cards

### Task 4: Simplify mobile request card hierarchy

**Files:**

- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsMobileList.tsx`
- Modify: `src/app/(app)/repair-requests/__tests__/RepairRequestsMobileList.a11y.test.tsx`

- [ ] **Step 1: Write failing card layout tests**

Add tests that protect the clean structure without over-specifying CSS:

```tsx
it("renders decision-critical fields without turning the whole content block into the activation button", () => {
  render(
    <RepairRequestsMobileList
      requests={[request]}
      isLoading={false}
      setRequestToView={setRequestToView}
      columnOptions={columnOptions}
    />
  )

  const card = screen.getByTestId(`repair-mobile-card-${request.id}`)
  expect(card).toHaveTextContent("Máy siêu âm")
  expect(card).toHaveTextContent(request.ma_thiet_bi)
  expect(card).toHaveTextContent("Người yêu cầu")
  expect(card).toHaveTextContent("Ngày yêu cầu")
  expect(card).toHaveTextContent("Mô tả sự cố")

  const activationButton = screen.getByRole("button", { name: /Máy siêu âm/ })
  expect(within(activationButton).queryByText("Mô tả sự cố")).not.toBeInTheDocument()
})

it("keeps one primary action and moves secondary actions into the action zone", () => {
  render(
    <RepairRequestsMobileList
      requests={[request]}
      isLoading={false}
      setRequestToView={setRequestToView}
      columnOptions={columnOptions}
    />
  )

  const card = screen.getByTestId(`repair-mobile-card-${request.id}`)
  expect(
    within(card).getByRole("button", { name: /Hoàn thành|Duyệt|Xem chi tiết/ })
  ).toBeInTheDocument()
  expect(within(card).getByRole("button", { name: "Mở menu" })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node scripts/npm-run.js run test:run -- src/app/\(app\)/repair-requests/__tests__/RepairRequestsMobileList.a11y.test.tsx
```

Expected: FAIL because the card boundary/test id and simplified hierarchy do not exist yet.

- [ ] **Step 3: Implement card refinement**

In `RepairRequestsMobileList.tsx`:

- Keep `MobileCompactCard` if it supports the desired interaction boundary.
- Add stable card test id.
- Use a cleaner internal structure:
  - Header row: equipment name/code left, status badge right.
  - Metadata grid: requester department and request date.
  - Problem description inset box with a short label.
  - Action row: one primary action + compact menu/action control.
- Use stable spacing: outer `p-4`, header `gap-3`, metadata `gap-y-3 gap-x-4`, description `p-3`, action row `gap-3 pt-1`.
- Avoid adding all table columns to the card.
- Keep existing `DaysRemainingBar` only if it is visually lightweight. If it makes the card busy, keep it for detail view or menu follow-up instead; document that choice in the handoff.
- Preserve current keyboard activation and action-zone behavior.

- [ ] **Step 4: Run mobile list tests**

Run:

```bash
node scripts/npm-run.js run test:run -- src/app/\(app\)/repair-requests/__tests__/RepairRequestsMobileList.a11y.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/repair-requests/_components/RepairRequestsMobileList.tsx src/app/\(app\)/repair-requests/__tests__/RepairRequestsMobileList.a11y.test.tsx
git commit -m "feat: simplify repair request mobile cards"
```

## Chunk 5: Visual and Regression Verification

### Task 5: Run focused and repo-required gates

**Files:**

- No new edits unless verification exposes issues.

- [ ] **Step 1: Run focused tests**

Run through context-mode:

```bash
node scripts/npm-run.js run test:run -- \
  src/app/\(app\)/repair-requests/__tests__/RepairRequestsMobileKpi.test.tsx \
  src/app/\(app\)/repair-requests/__tests__/RepairRequestsPageLayout.test.tsx \
  src/app/\(app\)/repair-requests/__tests__/RepairRequestsToolbar.test.tsx \
  src/app/\(app\)/repair-requests/__tests__/RepairRequestsMobileList.a11y.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript/React repo gates in required order**

Use one `ctx_batch_execute` call for these commands:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run react-doctor
```

Expected: all PASS. If `format:check` fails only on changed files, run Prettier or rely on Lefthook staged formatting before commit, then re-run.

- [ ] **Step 3: Run browser visual check**

Start the local dev server if needed and inspect Repair Requests at:

- Mobile: 390x844
- Tablet: 768x1024
- Desktop: 1280x900

Acceptance:

- Fixed header remains the source of tenant display.
- Page body does not duplicate tenant name.
- KPI layout is balanced: total full-width, four statuses 2x2.
- Spacing is intentional: no cramped card content, no oversized dead zones, consistent page padding/gaps across mobile and tablet.
- Search/filter row does not wrap awkwardly.
- Request cards do not feel dense; description and actions are readable.
- Bottom nav/FAB do not cover final card actions.
- Desktop table remains unchanged.

- [ ] **Step 4: Commit verification fixes if any**

```bash
git add <changed files>
git commit -m "fix: polish repair request mobile layout"
```

Only commit if verification required changes.

## Chunk 6: Landing

### Task 6: Push and hand off

- [ ] **Step 1: Pull/rebase**

```bash
git pull --rebase
```

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Confirm clean/up-to-date status**

```bash
git status
```

Expected: working tree clean and branch up to date with origin.

- [ ] **Step 4: Handoff summary**

Include:

- Files changed.
- Tests/gates run.
- Visual viewport checks.
- Any explicit non-scope choices, especially if secondary fields were intentionally left for detail view to keep the mobile card clean.
