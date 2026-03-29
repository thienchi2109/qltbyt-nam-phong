# Issue #159 `callRpc` Response Typing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove response-side `callRpc<any>` usage from the scoped runtime paths by replacing it with concrete DTOs or `unknown` plus explicit narrowing, without changing the RPC wire contract.

**Architecture:** Keep `callRpc` caller-driven on the response side, but stop using `any` as the escape hatch. For simple RPCs, use existing domain types directly. For unstable or mixed-shape payloads, receive `unknown` and map through small local narrowers. Apply changes in waves so GitNexus blast radius stays controlled.

**Tech Stack:** Next.js App Router, React Query, TypeScript, Vitest, GitNexus CLI, React Doctor.

---

## Context

- Issue: [#159](https://github.com/thienchi2109/qltbyt-nam-phong/issues/159)
- Branch/worktree: `issue-159-callrpc-response-typing`
- `callRpc` blast radius from GitNexus: `CRITICAL`, `36` impacted symbols, `26` direct callers, `20` processes, `4` modules.
- Highest-value runtime hotspots still using `callRpc<any>` are:
  - `src/hooks/use-cached-equipment.ts`
  - `src/app/(app)/reports/hooks/use-inventory-data.ts`
  - `src/hooks/use-cached-maintenance.ts`
- File-size rule matters here: `src/hooks/use-cached-maintenance.ts` is already over the repo hard ceiling, so type and mapper extraction is mandatory in that area.

## TDD Rules For This Branch

- `NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`.
- For every task below, follow this exact loop:
  1. Write one focused failing test or compile-time assertion.
  2. Run it and confirm the failure is for the expected reason.
  3. Write the minimal production code to make that test pass.
  4. Re-run the focused test and confirm green.
  5. Refactor only after green, then re-run the same test.
  6. Commit once the task is green and stable.
- If a change is type-only and the best executable check is `typecheck`, the RED step is a failing compile-time assertion file or a failing typecheck in the touched test/mocked caller.
- Do not batch multiple behaviors into a single red-green cycle.

## Scope Guardrails

- Only remove response-side `callRpc<any>` usage and the minimum adjacent `any` needed to make those sites type-safe.
- Do not change the request-side `callRpc` signature again in this branch.
- Do not broaden into unrelated auth/session typing, generic React Query cleanup, or UI refactors.
- Prefer extraction over growing already-large files.
- After each wave, re-run GitNexus impact mentally against touched symbols and keep diffs narrow.

### Task 1: Type `use-cached-equipment` Responses

**Files:**
- Modify: `src/hooks/use-cached-equipment.ts`
- Test: `src/app/(app)/equipment/__tests__/useEquipmentData.test.ts`
- Test: `src/app/(app)/equipment/__tests__/equipmentMutations.test.ts`
- Optional create: `src/hooks/use-cached-equipment.types.ts`

**Step 1: Write the failing tests**
- Add or tighten tests that prove the equipment hooks accept typed RPC results without `any`-shaped mocks.
- Replace `callRpc` mocks typed as `(args: any) => ...` with concrete typed payloads or `unknown` payload factories.
- Add one focused expectation per RPC family:
  - `equipment_list` returns an `Equipment[]`
  - `equipment_get` returns a nullable `Equipment`
  - `equipment_update` / `equipment_create` return `Equipment`

**Step 2: Run tests to verify RED**

Run:
```bash
node scripts/npm-run.js run test:run -- src/app/(app)/equipment/__tests__/useEquipmentData.test.ts src/app/(app)/equipment/__tests__/equipmentMutations.test.ts
```
Expected: fail in mocks/types because the tests still rely on `callRpc<any>` assumptions.

**Step 3: Write minimal implementation**
- In `src/hooks/use-cached-equipment.ts`, replace `callRpc<any[]>` / `callRpc<any>` with existing domain types:
  - `callRpc<Equipment[]>('equipment_list', ...)`
  - `callRpc<Equipment | null>('equipment_get', ...)`
  - `callRpc<Equipment>('equipment_update', ...)`
  - `callRpc<Equipment>('equipment_create', ...)`
- If needed, create a tiny local response alias file rather than adding inline complex generic noise.

**Step 4: Run tests to verify GREEN**

Run the same focused tests and confirm pass.

**Step 5: Refactor**
- Remove leftover mock-level `any` only where it blocks the typed response contract.
- Keep function behavior unchanged.

**Step 6: Commit**

```bash
git add src/hooks/use-cached-equipment.ts src/app/(app)/equipment/__tests__/useEquipmentData.test.ts src/app/(app)/equipment/__tests__/equipmentMutations.test.ts
git commit -m "refactor: type equipment rpc responses"
```

### Task 2: Type Inventory Report RPC Responses

**Files:**
- Modify: `src/app/(app)/reports/hooks/use-inventory-data.ts`
- Create: `src/app/(app)/reports/hooks/use-inventory-data.types.ts`
- Create/Test: `src/app/(app)/reports/hooks/__tests__/use-inventory-data.types.test.ts`
- Test: `src/app/(app)/reports/__tests__/ReportsPage.auth-and-hooks.test.tsx`

**Step 1: Write the failing tests**
- Create a focused mapper test file for inventory response shaping.
- Add red tests for each unstable payload currently hidden behind `callRpc<any>`:
  - facilities payload maps to facility options/counts
  - aggregates payload maps to `InventorySummary`
  - equipment rows payload maps to `InventoryItem[]`
  - transfer rows handle `404` fallback as empty list
- Use `unknown` fixtures that reflect the real payload shapes now seen in the hook.

**Step 2: Run tests to verify RED**

Run:
```bash
node scripts/npm-run.js run test:run -- src/app/(app)/reports/hooks/__tests__/use-inventory-data.types.test.ts src/app/(app)/reports/__tests__/ReportsPage.auth-and-hooks.test.tsx
```
Expected: fail because mapper helpers/types do not exist yet or current implementation still relies on `any`.

**Step 3: Write minimal implementation**
- Extract inventory RPC response DTOs and narrowers into `use-inventory-data.types.ts`.
- Replace `callRpc<any>` / `callRpc<any[]>` in `use-inventory-data.ts` with:
  - concrete DTO generics where payload shape is stable
  - `unknown` plus small mapper helpers where shape is mixed or loosely structured
- Replace `(item: any)` and `catch (e: any)` with specific DTO inputs and `unknown` error narrowing.

**Step 4: Run tests to verify GREEN**

Run the same focused tests and confirm pass.

**Step 5: Refactor**
- Keep mapping logic out of the hook body where possible.
- Do not broaden into unrelated report-hook cleanup.

**Step 6: Commit**

```bash
git add src/app/(app)/reports/hooks/use-inventory-data.ts src/app/(app)/reports/hooks/use-inventory-data.types.ts src/app/(app)/reports/hooks/__tests__/use-inventory-data.types.test.ts src/app/(app)/reports/__tests__/ReportsPage.auth-and-hooks.test.tsx
git commit -m "refactor: type inventory report rpc responses"
```

### Task 3: Type Maintenance RPC Responses And Split The Oversized File

**Files:**
- Modify: `src/hooks/use-cached-maintenance.ts`
- Create: `src/hooks/use-cached-maintenance.types.ts`
- Create: `src/hooks/use-cached-maintenance.rpc.ts`
- Create/Test: `src/hooks/__tests__/use-cached-maintenance-rpc.test.ts`

**Step 1: Write the failing tests**
- Add focused tests for the response mapping now hidden behind `callRpc<any[]>`, especially:
  - schedules list normalization
  - maintenance history/detail task mapping
  - null/empty payload handling
- Use `unknown` fixtures rather than `any` fixtures.

**Step 2: Run tests to verify RED**

Run:
```bash
node scripts/npm-run.js run test:run -- src/hooks/__tests__/use-cached-maintenance-rpc.test.ts
```
Expected: fail because extracted mapper/types files do not exist yet and the current code still depends on `callRpc<any[]>`.

**Step 3: Write minimal implementation**
- Extract response DTOs and mapping helpers into `use-cached-maintenance.types.ts` and `use-cached-maintenance.rpc.ts`.
- Replace response-side `callRpc<any[]>` usage in `use-cached-maintenance.ts` with typed DTOs or `unknown` plus mapper helpers.
- Reduce `src/hooks/use-cached-maintenance.ts` back under the repo file-size ceiling by moving pure typing/mapping code out.

**Step 4: Run tests to verify GREEN**

Run the same focused maintenance tests and confirm pass.

**Step 5: Refactor**
- Keep hook behavior and React Query keys stable.
- Only extract pure helpers; do not rewrite the surrounding hook architecture.

**Step 6: Commit**

```bash
git add src/hooks/use-cached-maintenance.ts src/hooks/use-cached-maintenance.types.ts src/hooks/use-cached-maintenance.rpc.ts src/hooks/__tests__/use-cached-maintenance-rpc.test.ts
git commit -m "refactor: type maintenance rpc responses"
```

### Task 4: Remove Remaining Leaf `callRpc<any>` Usage

**Files:**
- Modify as needed:
  - `src/hooks/use-dashboard-stats.ts`
  - `src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts`
  - `src/components/edit-equipment-dialog.tsx`
  - `src/app/(app)/repair-requests/_components/RepairRequestsCreateSheet.tsx`
  - `src/components/add-maintenance-plan-dialog.tsx`
  - `src/components/add-user-dialog.tsx`
  - `src/components/qr-action-sheet.tsx`
- Test likely touched behavior in:
  - `src/components/__tests__/qr-action-sheet.test.tsx`
  - `src/app/(app)/repair-requests/__tests__/useRepairRequestsDeepLink.test.ts`
  - `src/components/__tests__/equipment-dialogs.crud.test.tsx`

**Step 1: Write the failing tests**
- For each touched leaf site, update or add a focused test before changing production code.
- Each test should prove one typed response contract at that leaf, not a broad integration rewrite.

**Step 2: Run tests to verify RED**
- Run only the focused tests for the leaf sites being changed in that subtask.
- Confirm failure comes from the old `callRpc<any>` assumption or missing mapper.

**Step 3: Write minimal implementation**
- Replace `callRpc<any>` with concrete result types where obvious.
- Otherwise receive `unknown` and narrow locally with the smallest possible helper.

**Step 4: Run tests to verify GREEN**
- Re-run the focused leaf tests and confirm pass.

**Step 5: Refactor**
- Deduplicate tiny helpers only if multiple leaf sites now share the exact same shape.
- Do not centralize prematurely.

**Step 6: Commit**

```bash
git add src/hooks/use-dashboard-stats.ts src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts src/components/edit-equipment-dialog.tsx src/app/(app)/repair-requests/_components/RepairRequestsCreateSheet.tsx src/components/add-maintenance-plan-dialog.tsx src/components/add-user-dialog.tsx src/components/qr-action-sheet.tsx
git commit -m "refactor: remove leaf callRpc any responses"
```

### Task 5: Final Verification And Issue Handoff

**Files:**
- Review all touched files
- Update issue/PR metadata if execution happens in this session

**Step 1: Verify no scoped response-side `callRpc<any>` remains**

Run:
```bash
rg -n "callRpc<\\s*any|callRpc<any|callRpc<[^>]*any" src
```
Expected: no remaining runtime matches in the scoped production paths for this issue. If any remain, either fix them in-scope or explicitly document why they are deferred.

**Step 2: Run repo verification in required order**

Run:
```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- src/app/(app)/equipment/__tests__/useEquipmentData.test.ts src/app/(app)/equipment/__tests__/equipmentMutations.test.ts src/app/(app)/reports/hooks/__tests__/use-inventory-data.types.test.ts src/app/(app)/reports/__tests__/ReportsPage.auth-and-hooks.test.tsx src/hooks/__tests__/use-cached-maintenance-rpc.test.ts src/components/__tests__/qr-action-sheet.test.tsx src/app/(app)/repair-requests/__tests__/useRepairRequestsDeepLink.test.ts src/components/__tests__/equipment-dialogs.crud.test.tsx
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```
Expected: all green.

**Step 3: Commit final cleanups if needed**
- Only after all checks pass.

**Step 4: Push and update GitHub**
- Push branch.
- Open/update PR.
- Close Issue `#159` only if the scoped runtime `callRpc<any>` work is fully resolved.

## Notes For The Implementer

- Start each code-editing task with fresh GitNexus context if a symbol boundary is unclear.
- If GitNexus misses a React symbol, fall back to `rg` plus direct code reading and note the limitation.
- Prefer `unknown` over inventing false certainty. If the RPC payload is structurally messy, a narrow mapper is safer than a broad DTO lie.
- Preserve current runtime behavior, especially empty-state handling and `404`-to-empty-list fallbacks.
- Keep commits small and scoped to one wave.
