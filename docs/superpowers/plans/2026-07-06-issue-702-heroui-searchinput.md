# Issue 702 HeroUI SearchInput Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing shared `SearchInput` shadcn-backed input primitive with a HeroUI-backed primitive while preserving the current shared API and consumer behavior.

**Architecture:** Keep `src/components/shared/SearchInput.tsx` as the single public shared surface. Preserve the wrapper layout, icon, clear button, `endAddon`, ref, and `onChange(value)` contract; only swap the internal primitive from `@/components/ui/input` to HeroUI v3 `Input`. Do not create a new shared layer and do not change page-level consumers unless a failing compatibility test proves it is required.

**Tech Stack:** React 19, Next.js App Router project, Vitest, Testing Library, HeroUI v3 `@heroui/react`, lucide-react.

---

## Scope

In scope:

- `src/components/shared/SearchInput.tsx`
- `src/components/shared/__tests__/SearchInput.test.tsx`
- Existing shared/consumer focused tests that already cover `SearchInput` integration.

Out of scope:

- `ListFilterSearchCard` internals. That is #703.
- `FacetedMultiSelectFilter` internals. That is #704.
- Any page-specific HeroUI fork or adapter.
- Debounce/deferred search logic. Consumers own it.
- Removing the Equipments HeroUI pilot.

## Current Facts

- Issue #702 title: `[HeroUI Filter/Search] Replace shared SearchInput shadcn backing`.
- Parent: #701.
- Decision source: #686.
- `SearchInput` currently imports `Input` from `@/components/ui/input`.
- No dedicated `src/components/shared/__tests__/SearchInput.test.tsx` exists yet.
- Existing integration coverage includes `src/components/shared/__tests__/ListFilterSearchCard.test.tsx`.
- Direct `SearchInput`/`searchInputRef` references exist across 20 source/test files, so this change must preserve the public API.
- HeroUI v3 Input is a primitive; use controlled `value` + `onChange`. Do not rely on v2-only `startContent` / `endContent` props.

## Files

- Create: `src/components/shared/__tests__/SearchInput.test.tsx`
- Modify: `src/components/shared/SearchInput.tsx`
- Do not modify: page consumers unless a focused regression fails after the shared component is fixed.

## Task 1: Branch And Baseline

- [ ] **Step 1: Check working tree**

Run:

```bash
git status --short
```

Expected: note any unrelated dirty files and do not revert them.

- [ ] **Step 2: Sync main**

Run:

```bash
git fetch origin
git switch main
git pull --rebase
```

Expected: local `main` is current.

- [ ] **Step 3: Create issue branch**

Run:

```bash
git switch -c feat/702-heroui-searchinput-shared
```

Expected: branch created before edits.

## Task 2: Add Focused RED Tests

**Files:**

- Create: `src/components/shared/__tests__/SearchInput.test.tsx`

- [ ] **Step 1: Create the test file**

Use this test shape:

```tsx
import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SearchInput } from "../SearchInput"

describe("SearchInput", () => {
  it("preserves the controlled search input contract", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <SearchInput
        aria-label="Tim kiem thiet bi"
        value=""
        onChange={onChange}
        placeholder="Nhap tu khoa"
      />
    )

    const input = screen.getByRole("searchbox", { name: "Tim kiem thiet bi" })

    expect(input).toHaveAttribute("type", "search")
    expect(input).toHaveAttribute("placeholder", "Nhap tu khoa")

    await user.type(input, "abc")

    expect(onChange).toHaveBeenCalledWith("a")
    expect(onChange).toHaveBeenCalledWith("b")
    expect(onChange).toHaveBeenCalledWith("c")
  })

  it("forwards refs and disabled state to the input element", () => {
    const ref = React.createRef<HTMLInputElement>()

    render(<SearchInput ref={ref} aria-label="Tim kiem" value="" onChange={vi.fn()} disabled />)

    const input = screen.getByRole("searchbox", { name: "Tim kiem" })

    expect(ref.current).toBe(input)
    expect(input).toBeDisabled()
  })

  it("clears with the clear button, calls onClear, and refocuses the input", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onClear = vi.fn()

    render(<SearchInput aria-label="Tim kiem" value="abc" onChange={onChange} onClear={onClear} />)

    const input = screen.getByRole("searchbox", { name: "Tim kiem" })
    await user.click(screen.getByRole("button", { name: "Xoa tim kiem" }))

    expect(onChange).toHaveBeenCalledWith("")
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(input).toHaveFocus()
  })

  it("clears with Escape only when a value exists", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onClear = vi.fn()

    const { rerender } = render(
      <SearchInput aria-label="Tim kiem" value="abc" onChange={onChange} onClear={onClear} />
    )

    await user.keyboard("{Escape}")

    expect(onChange).toHaveBeenCalledWith("")
    expect(onClear).toHaveBeenCalledTimes(1)

    onChange.mockClear()
    onClear.mockClear()

    rerender(<SearchInput aria-label="Tim kiem" value="" onChange={onChange} onClear={onClear} />)

    await user.keyboard("{Escape}")

    expect(onChange).not.toHaveBeenCalled()
    expect(onClear).not.toHaveBeenCalled()
  })

  it("supports icon, clear button, and end addon visibility controls", () => {
    render(
      <SearchInput
        aria-label="Tim kiem"
        value="abc"
        onChange={vi.fn()}
        showSearchIcon={false}
        showClearButton={false}
        endAddon={<span data-testid="search-addon">A</span>}
      />
    )

    expect(screen.getByTestId("search-addon")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Xoa tim kiem" })).not.toBeInTheDocument()
  })
})
```

If the existing component uses Vietnamese accents in `aria-label`, use exact accessible names from the current component. Keep test text ASCII only if the repo convention prefers ASCII.

- [ ] **Step 2: Add a boundary assertion test**

Add this to the same file:

```tsx
import { readFileSync } from "node:fs"
import { join } from "node:path"

it("uses HeroUI instead of the shadcn input backing", () => {
  const source = readFileSync(join(process.cwd(), "src/components/shared/SearchInput.tsx"), "utf8")

  expect(source).toContain("@heroui/react")
  expect(source).not.toContain("@/components/ui/input")
})
```

This is the intentional RED assertion for #702.

- [ ] **Step 3: Run focused test and verify RED**

Run through context-mode:

```bash
node scripts/npm-run.js run test:run -- src/components/shared/__tests__/SearchInput.test.tsx
```

Expected: FAIL because `SearchInput.tsx` still imports `@/components/ui/input` and does not import `@heroui/react`.

Do not implement until this RED is observed.

## Task 3: Replace The Internal Primitive

**Files:**

- Modify: `src/components/shared/SearchInput.tsx`

- [ ] **Step 1: Change only the backing import**

Replace:

```tsx
import { Input } from "@/components/ui/input"
```

With:

```tsx
import { Input as HeroInput } from "@heroui/react"
```

- [ ] **Step 2: Preserve the public props**

Keep this public surface stable:

```tsx
export interface SearchInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "type"> {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  showSearchIcon?: boolean
  showClearButton?: boolean
  endAddon?: React.ReactNode
}
```

Do not add debounce, variant props, page-specific modes, or a second adapter.

- [ ] **Step 3: Render HeroUI primitive with the existing handlers**

Keep the existing wrapper and right-side controls. Replace the input element only:

```tsx
<HeroInput
  ref={inputRef}
  type="search"
  value={value}
  onChange={handleChange}
  onKeyDown={handleKeyDown}
  className={cn(paddingLeft, paddingRight, className)}
  {...props}
/>
```

If HeroUI v3 requires `className` on the actual input slot instead of the wrapper, inspect local installed types/examples and use the narrowest compatible `classNames` mapping. Preserve the DOM role/accessibility behavior proven by tests.

- [ ] **Step 4: Keep clear/focus behavior unchanged**

Preserve the logic:

```tsx
const handleClear = React.useCallback(() => {
  onChange("")
  onClear?.()
  inputRef.current?.focus()
}, [onChange, onClear])
```

If HeroUI's forwarded ref resolves to a wrapper instead of `HTMLInputElement`, use HeroUI's documented input ref support or a minimal local ref bridge so `SearchInput` still forwards `HTMLInputElement`.

## Task 4: GREEN And Compatibility Tests

- [ ] **Step 1: Run focused SearchInput test**

Run:

```bash
node scripts/npm-run.js run test:run -- src/components/shared/__tests__/SearchInput.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run shared card integration test**

Run:

```bash
node scripts/npm-run.js run test:run -- src/components/shared/__tests__/ListFilterSearchCard.test.tsx
```

Expected: PASS, especially `forwards searchInputRef to the search input` and `can disable the shared search input`.

- [ ] **Step 3: Run one representative consumer test**

Run:

```bash
node scripts/npm-run.js run test:run -- src/components/__tests__/add-tasks-dialog.filters-and-pagination.test.tsx
```

Expected: PASS, especially the `type="search"` coverage.

Only add more consumer tests if these fail or if the implementation required a public API compromise.

## Task 5: Repo Gates

Run through one context-mode batch in this order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- src/components/shared/__tests__/SearchInput.test.tsx src/components/shared/__tests__/ListFilterSearchCard.test.tsx src/components/__tests__/add-tasks-dialog.filters-and-pagination.test.tsx
node scripts/npm-run.js run react-doctor
```

Expected: all pass. If formatting fails, run the repo formatter on changed files or rely on Lefthook during commit, then rerun the gate that failed.

## Task 6: Boundary And Issue Evidence

- [ ] **Step 1: Confirm shadcn backing is gone from `SearchInput`**

Run:

```bash
rg -n '@/components/ui/input|from "@heroui/react"' src/components/shared/SearchInput.tsx
```

Expected: only the HeroUI import remains.

- [ ] **Step 2: Confirm no page-specific HeroUI search fork was added**

Run:

```bash
rg -n '@heroui/react' src/app src/components | rg -v 'src/components/shared/SearchInput.tsx|src/components/equipment/heroui-pilot|src/components/shared/floating-actions'
```

Expected: no new #702-related page-level imports.

Do not update `scripts/check-heroui-import-boundary.js` in #702 unless the existing boundary gate blocks this shared component import. If it blocks, add only `src/components/shared/SearchInput.tsx` as a narrow allowlist entry and note that #706 will handle the broader boundary/evidence cleanup.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/components/shared/SearchInput.tsx src/components/shared/__tests__/SearchInput.test.tsx
git commit -m "feat: migrate shared search input to HeroUI"
```

Expected: Lefthook passes without `--no-verify`.

- [ ] **Step 4: Update #702 with evidence**

Comment on #702:

```markdown
Implemented #702 on branch `feat/702-heroui-searchinput-shared`.

Evidence:

- Focused `SearchInput` tests: PASS
- `ListFilterSearchCard` integration test: PASS
- Representative AddTasksDialog consumer test: PASS
- `verify:no-explicit-any`: PASS
- `verify:dedupe`: PASS
- `typecheck`: PASS
- `react-doctor`: PASS

Scope held:

- Kept `@/components/shared/SearchInput` as the shared public surface.
- Replaced shadcn-backed input internals with HeroUI-backed internals.
- Did not add page-specific HeroUI filter/search forks.
```

## Ambiguities To Resolve Only If They Appear During Execution

- If HeroUI `Input` does not forward `HTMLInputElement` refs directly, inspect local package types and implement the smallest ref bridge that preserves current `SearchInput` API.
- If HeroUI wraps the input in a way that changes `getByRole("searchbox")`, adjust implementation first, not consumers, so accessibility remains stable.
- If `verify:heroui-boundary` fails because `SearchInput.tsx` imports `@heroui/react`, either make a narrow allowlist update in #702 or split that exact guard update into #706, depending on whether #702 can pass without it.
