# Baseline Criterion Owner Select → Shadcn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay native HTML `<select>` bằng Shadcn/Radix Select trong dropdown cột "Vị trí" của bảng "Bản nháp cấu hình cơ sở" mà không đổi props API.

**Architecture:** Swap internals của đúng 1 component trung gian (`TechnicalConfigurationBaselineCriterionOwnerSelect`) — cả 2 caller (spreadsheet desktop + subgroup mobile) tự hưởng. Trigger giữ `h-9` để khớp density hàng với `Input`/`Textarea` kề bên. Portal của Radix khắc phục dropdown bị cắt trong container `overflow-x-auto`.

**Tech Stack:** Next.js App Router, React 19, Radix Select (`@/components/ui/select`), Vitest + Testing Library + userEvent.

**Spec:** Yêu cầu trực tiếp từ maintainer (session 2026-08-23): "đổi dropdown cột Vị trí từ native HTML sang Shadcn component"; đã chốt hướng giữ `h-9` compact. Không có spec file riêng.

## Global Constraints

- Không đổi props API: `label`, `owner`, `options`, `disabled`, `onMove` giữ nguyên tên và kiểu.
- Không sửa caller: `TechnicalConfigurationBaselineSubgroupCriteria.tsx`, `TechnicalConfigurationCriteriaSpreadsheet.tsx`.
- Không sửa `src/components/ui/select.tsx`.
- Trigger height phải là `h-9` (không dùng mặc định `h-10`) để khớp hàng grid.
- Accessible name giữ nguyên dạng "Chuyển …" qua `aria-label` trên trigger (test phụ thuộc vào nó).
- File ≤450 dòng; không thêm comment trừ khi cần.
- Verification chain bắt buộc trước commit: `verify:no-explicit-any` → `verify:dedupe` → `typecheck` → focused vitest → `react-doctor` (diff-only), tất cả qua `node scripts/npm-run.js`.
- Lefthook không được bypass (`--no-verify` cấm).

---

### Task 1: Chuyển test sang tương tác Radix (bước đỏ TDD)

**Files:**

- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-authoring-controls.test.tsx:2,227-245`

**Interfaces:**

- Consumes: pattern jsdom đã có trong repo tại `__tests__/technical-configuration-baseline-tab-fixtures.tsx:218-228` (`act(focus)` + `{ArrowDown}` mở dropdown, click `role="option"`).
- Produces: 2 helper test-local `openCriterionOwnerSelect`, `selectCriterionOwnerOption`.

Lý do vỡ: test hiện dùng `user.selectOptions()` (chỉ hoạt động với native select). Option labels sinh bởi `getTechnicalConfigurationBaselineCriterionOwnerOptions` (`TechnicalConfigurationBaselineHierarchyAuthoring.ts:67-89`): `"I. Yêu cầu chung - Trực tiếp"`, `"I.1 Hạ tầng"`, `"I.2 Môi trường"`, `"II. Yêu cầu bổ sung - Trực tiếp"`.

- [x] **Step 1: Sửa import thêm `act`**

```tsx
import { act, render, screen, within } from "@testing-library/react"
```

- [x] **Step 2: Thêm 2 helper sau khối `initialDraft` (trước `AuthoringHarness`)**

```tsx
type SelectUser = {
  click: (element: Element) => Promise<void>
  keyboard: (text: string) => Promise<void>
}

async function openCriterionOwnerSelect(user: SelectUser, name: string | RegExp) {
  const trigger = screen.getByRole("combobox", { name })
  act(() => trigger.focus())
  await user.keyboard("{ArrowDown}")
}

async function selectCriterionOwnerOption(
  user: SelectUser,
  name: string | RegExp,
  optionName: string
) {
  await openCriterionOwnerSelect(user, name)
  await user.click(await screen.findByRole("option", { name: optionName }))
}
```

- [x] **Step 3: Thay 2 lượt `selectOptions` trong test "moves a criterion between direct and subgroup owners without changing identity"**

Thay block dòng 227–232:

```tsx
await selectCriterionOwnerOption(user, "Chuyển tiêu chí trực tiếp 1 của nhóm I", "I.1 Hạ tầng")
```

Thay block dòng 240–245:

```tsx
await selectCriterionOwnerOption(
  user,
  "Chuyển tiêu chí 2 của nhóm con 1, nhóm I",
  "II. Yêu cầu bổ sung - Trực tiếp"
)
```

- [x] **Step 4: Chạy test xác nhận FAIL (đỏ)**

Run: `node scripts/npm-run.js npx vitest run "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-authoring-controls.test.tsx"`
Expected: test "moves a criterion…" FAIL (native select không mở listbox qua ArrowDown → không tìm thấy `role="option"`); 2 test còn lại PASS.

---

### Task 2: Swap sang Shadcn Select (bước xanh)

**Files:**

- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineCriterionOwnerSelect.tsx` (toàn bộ body render, giữ nguyên type props)

**Interfaces:**

- Consumes: `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` từ `@/components/ui/select`; `getTechnicalConfigurationBaselineCriterionOwnerValue` + type option từ `./TechnicalConfigurationBaselineHierarchyAuthoring` (không đổi).
- Produces: cùng props API như cũ — caller không đổi gì.

- [x] **Step 1: Ghi nội dung mới cho file**

```tsx
"use client"

import type { TechnicalConfigurationBaselineEditorCriterionOwner } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  getTechnicalConfigurationBaselineCriterionOwnerValue,
  type TechnicalConfigurationBaselineCriterionOwnerOption,
} from "./TechnicalConfigurationBaselineHierarchyAuthoring"

type TechnicalConfigurationBaselineCriterionOwnerSelectProps = Readonly<{
  label: string
  owner: TechnicalConfigurationBaselineEditorCriterionOwner
  options: readonly TechnicalConfigurationBaselineCriterionOwnerOption[]
  disabled: boolean
  onMove: (owner: TechnicalConfigurationBaselineEditorCriterionOwner) => void
}>

/** Selects a canonical direct or subgroup owner for one criterion. */
export function TechnicalConfigurationBaselineCriterionOwnerSelect({
  label,
  owner,
  options,
  disabled,
  onMove,
}: TechnicalConfigurationBaselineCriterionOwnerSelectProps): React.JSX.Element {
  return (
    <Select
      value={getTechnicalConfigurationBaselineCriterionOwnerValue(owner)}
      disabled={disabled}
      onValueChange={(value) => {
        const target = options.find((option) => option.value === value)
        if (target) onMove(target.owner)
      }}
    >
      <SelectTrigger aria-label={label} className="h-9 w-full min-w-0 px-2">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [x] **Step 2: Chạy lại test Task 1 xác nhận PASS (xanh)**

Run: `node scripts/npm-run.js npx vitest run "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-authoring-controls.test.tsx"`
Expected: PASS 3/3 (assertion `combobox` ở test thứ 3 vẫn đúng vì Radix trigger có role `combobox`).

- [x] **Step 3: Commit**

```bash
git add src/app/\(app\)/technical-configurations/_components/TechnicalConfigurationBaselineCriterionOwnerSelect.tsx "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-authoring-controls.test.tsx"
git commit -m "refactor(technical-configurations): use shadcn select for baseline criterion owner"
```

(Lefthook sẽ tự chạy Prettier + 2 gate diff-only.)

---

### Task 3: Regression + verification chain

**Files:** không sửa thêm (chỉ chạy kiểm chứng).

- [x] **Step 1: Focused regression cho các test gián tiếp liên quan**

Run: `node scripts/npm-run.js npx vitest run "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-group-section.test.tsx" "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-tab-workflow.test.tsx" "src/app/(app)/technical-configurations/__tests__/TechnicalConfigurationVersionBar.test.tsx"`
Expected: PASS (2 file đầu render component qua editor; VersionBar là sanity check pattern Radix).

- [x] **Step 2: Chain gates theo đúng thứ tự AGENTS.md**

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run react-doctor
```

Expected: tất cả PASS.

---

## Self-review

1. **Spec coverage:** swap UI ✓ · props giữ nguyên ✓ · `h-9` ✓ · portal chống cắt ✓ · test vỡ được cập nhật ✓ · verification chain ✓.
2. **Placeholder scan:** không có TBD/TODO; mọi step đều có code/lệnh cụ thể.
3. **Type consistency:** `SelectUser` khớp cách dùng `user.click/keyboard`; `option.value/label/owner` nhất quán giữa component và helper build options; tên helper thống nhất.
