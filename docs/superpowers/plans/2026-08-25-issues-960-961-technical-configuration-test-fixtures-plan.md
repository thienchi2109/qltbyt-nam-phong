# Issues 960 and 961 Technical Configuration Test Fixtures Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the five stale Technical Configurations regression suites pass without changing production behavior.

**Architecture:** Keep the repair test-only. Align queries and fixtures with the current accessible UI and dependency contracts, and make the source threshold measure physical lines consistently.

**Tech Stack:** TypeScript, React Testing Library, Vitest, TanStack Query.

---

## Chunk 1: Issue 960 Matchers

### Task 1: Refresh baseline locking queries

**Files:**

- Modify: `src/app/(app)/technical-configurations/__tests__/baseline-locking.test.tsx`

- [ ] **Step 1: Verify the existing RED baseline**

Run:

```bash
node scripts/npm-run.js exec vitest run 'src/app/(app)/technical-configurations/__tests__/baseline-locking.test.tsx' --reporter=verbose
```

Expected: 6 failures caused by stale `Phiên bản 1`, `Phiên bản 2`, or
`Đã khóa` text queries.

- [ ] **Step 2: Replace stale text queries with the current accessible contract**

Use the existing version-selection test helper where interaction is required.
For selected-state assertions, query the visible `button` whose accessible
name starts with `Lịch sử phiên bản` and assert its exact combined label, such as
`Phiên bản 1 · Đã khóa` or `Phiên bản 2 · Bản nháp`. Options may support
interaction but must not replace the selected-trigger assertion. Preserve
every non-rendering assertion in the affected tests.

- [ ] **Step 3: Verify GREEN**

Run the focused file again. Expected: 12/12 tests pass.

## Chunk 2: Issue 961 Fixtures

### Task 2: Refresh the RPC contract fixture

**Files:**

- Modify: `src/app/(app)/technical-configurations/__tests__/baseline-contract.test.ts`

- [ ] **Step 1: Confirm the RPC mapping assertion is RED**

Run the focused file. Expected: one mapping failure for the three existing
cross-dossier copy functions.

```bash
node scripts/npm-run.js exec vitest run 'src/app/(app)/technical-configurations/__tests__/baseline-contract.test.ts' --reporter=verbose
```

- [ ] **Step 2: Add the current function mappings to the expected contract**

Do not change the production RPC map or any backend behavior.

- [ ] **Step 3: Verify GREEN**

Run the focused file. Expected: 5/5 tests pass.

```bash
node scripts/npm-run.js exec vitest run 'src/app/(app)/technical-configurations/__tests__/baseline-contract.test.ts' --reporter=verbose
```

### Task 3: Provide an isolated QueryClient to inline workflow tests

**Files:**

- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-inline-workflow.test.tsx`

- [ ] **Step 1: Confirm the provider failure is RED**

Run the focused file. Expected: 9 failures with `No QueryClient set`.

```bash
node scripts/npm-run.js exec vitest run 'src/app/(app)/technical-configurations/__tests__/technical-configuration-inline-workflow.test.tsx' --reporter=verbose
```

- [ ] **Step 2: Add a local render helper**

Create a fresh `QueryClient` per render with retries disabled, wrap
`TechnicalConfigurationBaselineTab` in `QueryClientProvider`, and replace the
nine direct render calls. Keep the helper local to this suite.

- [ ] **Step 3: Verify GREEN**

Run the focused file. Expected: 9/9 tests pass.

```bash
node scripts/npm-run.js exec vitest run 'src/app/(app)/technical-configurations/__tests__/technical-configuration-inline-workflow.test.tsx' --reporter=verbose
```

### Task 4: Refresh version workflow queries and source threshold

**Files:**

- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-version-workflow-review.test.tsx`
- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-workspace-shell-source.test.ts`

- [ ] **Step 1: Confirm both suites are RED**

Expected: four stale version/status matcher failures and one line-count
failure reporting 351 for a 350-line file.

```bash
node scripts/npm-run.js exec vitest run \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-version-workflow-review.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-workspace-shell-source.test.ts' \
  --reporter=verbose
```

- [ ] **Step 2: Align version queries with the accessible selector contract**

Preserve the dirty-discard, pending-bulk, copied-lineage, and creation-alert
behavioral assertions.

- [ ] **Step 3: Count physical lines**

Remove one trailing empty split segment before comparing and use
`toBeLessThanOrEqual(350)`. Do not edit the production component to satisfy the
test.

- [ ] **Step 4: Verify GREEN**

Run both focused files. Expected: 8/8 tests pass.

```bash
node scripts/npm-run.js exec vitest run \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-version-workflow-review.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-workspace-shell-source.test.ts' \
  --reporter=verbose
```

## Chunk 3: Integration And Delivery

### Task 5: Run required verification and deliver the PR

**Files:**

- Verify all files changed by Tasks 1-4.

- [ ] **Step 1: Run the five focused suites together**

Expected: 34/34 tests pass.

```bash
node scripts/npm-run.js exec vitest run \
  'src/app/(app)/technical-configurations/__tests__/baseline-locking.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/baseline-contract.test.ts' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-inline-workflow.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-version-workflow-review.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-workspace-shell-source.test.ts' \
  --reporter=verbose
```

- [ ] **Step 2: Run the required TypeScript/React gate chain**

Run formatting, `verify:no-explicit-any`, `verify:dedupe`, typecheck, the
focused Vitest command, and React Doctor through one context-mode batch.

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js exec vitest run \
  'src/app/(app)/technical-configurations/__tests__/baseline-locking.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/baseline-contract.test.ts' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-inline-workflow.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-version-workflow-review.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-workspace-shell-source.test.ts'
node scripts/npm-run.js run react-doctor
```

- [ ] **Step 3: Review the final diff**

Confirm the change is test-only and does not weaken behavioral assertions.

- [ ] **Step 4: Commit and push**

Use issue-aligned commits, push the feature branch, and open one PR containing
`Closes #960` and `Closes #961`.

```bash
git pull --rebase
git push -u origin test/960-961-technical-configuration-fixtures
gh pr create --title "test: refresh technical configuration regression fixtures" --body-file <pr-body-file>
gh issue comment 960 --body "Đang xử lý trong PR #<number>."
gh issue comment 961 --body "Đang xử lý trong PR #<number>."
git status --short --branch
```

The final status must show the branch is up to date with its remote. File a
follow-up issue before handoff if review or verification finds remaining work;
otherwise leave both issues open for the PR's `Closes` directives to close on
merge.
