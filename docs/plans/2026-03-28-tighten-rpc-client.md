# Tighten `callRpc` TDD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tighten `callRpc` in `src/lib/rpc-client.ts` so `args` only accepts object-shaped payloads, remove the local `as any` in RPC error parsing, and keep runtime behavior stable.

**Architecture:** Drive the type change with compile-time assertions plus focused runtime tests. Implement the `rpc-client` changes first, then fix only first-wave fallout that `typecheck` proves is caused by the new arg constraint. Use GitNexus blast radius data to prioritize any downstream fixes without expanding into a broader DTO cleanup.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, GitNexus CLI, ripgrep

---

## Context

- `callRpc` is currently the highest-leverage `any` boundary in the repo:
  - file: `src/lib/rpc-client.ts`
  - current problems:
    - `TArgs = any`
    - `(data && (data.error ?? data)) as any`
- GitNexus current blast radius for `callRpc`:
  - risk: `CRITICAL`
  - impacted symbols: `36`
  - direct callers: `26`
  - affected processes: `20`
  - affected modules: `4`
- GitNexus direct callers are concentrated in:
  - repair requests
  - device quota categories / decisions / mapping
  - reports hooks
  - transfer hooks / dialogs
  - cached equipment mutations
- Current repo inspection found no production callers passing scalar or array `args`; runtime call sites pass object payloads or omit `args`.
- `/api/rpc/[fn]` currently returns either:
  - a successful JSON payload, or
  - `{ error: ... }` where `error` may be a string or object carrying `message`, `hint`, or `details`

## Commit Checkpoint Rule

- After the RED state is confirmed, commit only once the minimal GREEN implementation is complete.
- If fallout fixes are needed after `typecheck`, commit again after the final verification pass.
- Use commit messages with rollback clarity:
  - `test: lock rpc-client arg and error behavior`
  - `refactor: tighten rpc-client arg typing`

## Task 1: Add the TDD harness for `callRpc`

**Files:**
- Create: `src/lib/__tests__/rpc-client.test.ts`
- Create: `src/lib/rpc-client.types.assert.ts`

**Step 1: Write the compile-time assertions**

In `src/lib/rpc-client.types.assert.ts`, add direct call-site assertions:

```ts
import { callRpc } from "@/lib/rpc-client"

void callRpc({ fn: "ok" })
void callRpc({ fn: "ok", args: { p_id: 1 } })

// @ts-expect-error args must be object-shaped
void callRpc({ fn: "bad-number", args: 123 })

// @ts-expect-error args must be object-shaped
void callRpc({ fn: "bad-array", args: ["x"] })
```

This file is the RED driver for the type-level change.

**Step 2: Write the focused runtime tests**

In `src/lib/__tests__/rpc-client.test.ts`, add fetch-mocked tests that prove:

- omitted `args` serializes to `{}`
- object `args` serializes unchanged
- success responses return parsed JSON
- string error payloads become the thrown message
- object error payloads prefer `message`, then `hint`, then `details`
- invalid JSON error bodies fall back to `RPC <fn> failed (<status>)`

Use `vi.stubGlobal("fetch", ...)` or equivalent repo-standard fetch mocking in the file. Reset mocks after each test.

**Step 3: Run the RED checks**

Run:

```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- src/lib/__tests__/rpc-client.test.ts
```

Expected:
- `typecheck` fails because the `@ts-expect-error` lines are currently unused while `args` still accepts `any`
- the runtime test file should either pass already or expose any missing error-parsing coverage; do not proceed until the type RED is confirmed

## Task 2: Implement the minimal `rpc-client` change

**Files:**
- Modify: `src/lib/rpc-client.ts`

**Step 1: Tighten the public type contract**

Change the file to use:

```ts
type RpcArgs = Record<string, unknown> | undefined

export type RpcOptions<TArgs extends RpcArgs = RpcArgs> = {
  fn: string
  args?: TArgs
  headers?: Record<string, string>
  signal?: AbortSignal
}

export async function callRpc<TRes = unknown, TArgs extends RpcArgs = RpcArgs>(...)
```

Keep:

```ts
body: JSON.stringify(args ?? {})
```

unchanged so runtime behavior does not move.

**Step 2: Replace the local `as any`**

Add small internal helpers in `src/lib/rpc-client.ts` only:

- `isRecord(value: unknown): value is Record<string, unknown>`
- `getRpcErrorPayload(data: unknown): unknown`
- `getRpcErrorMessage(fn: string, status: number, data: unknown): string`

Required precedence inside `getRpcErrorMessage`:

1. string payload
2. object payload `message`
3. object payload `hint`
4. object payload `details`
5. `JSON.stringify(payload)`
6. fallback `RPC <fn> failed (<status>)`

Preserve existing `console.error` logging semantics.

**Step 3: Run GREEN on the direct harness**

Run:

```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- src/lib/__tests__/rpc-client.test.ts
```

Expected:
- the compile-time assertion file now passes because numeric and array args are rejected
- the runtime test file passes

**Step 4: Commit the first green state**

Run:

```bash
git add src/lib/rpc-client.ts src/lib/__tests__/rpc-client.test.ts src/lib/rpc-client.types.assert.ts
git commit -m "refactor: tighten rpc-client arg typing"
```

## Task 3: Fix first-wave fallout only if `typecheck` proves it exists

**Files:**
- Modify only files reported by `typecheck`
- Priority inspection order:
  - `src/app/(app)/repair-requests/**`
  - `src/app/(app)/device-quota/**`
  - `src/app/(app)/reports/**`
  - `src/hooks/useTransfersKanban.ts`
  - `src/hooks/useTransferActions.ts`
  - `src/hooks/use-cached-equipment.ts`

**Step 1: Re-run `typecheck` immediately after the `rpc-client` change**

Run:

```bash
node scripts/npm-run.js run typecheck
```

Expected:
- either clean pass, or a narrow set of compile errors caused by the new `args` constraint

**Step 2: Fix only the reported arg-shape fallout**

Allowed fixes in this task:

- add explicit object arg types where inference is too weak
- change test mock wrappers from `any` to `unknown` or a compatible object-shaped options type
- keep caller payloads object-shaped without changing response typing

Do **not** do any of the following in this branch:

- replace downstream `callRpc<any>` response sites with DTOs
- refactor unrelated session or hook typing
- clean unrelated `any` usage outside direct fallout

**Step 3: Run focused tests for any touched fallout file**

For every touched caller or test file, run its nearest focused test command before moving on.

Examples if these files are touched:

```bash
node scripts/npm-run.js run test:run -- src/app/(app)/repair-requests/__tests__/useRepairRequestsDeepLink.test.ts
node scripts/npm-run.js run test:run -- src/app/(app)/equipment/__tests__/useEquipmentData.test.ts
```

Only run the tests relevant to files actually changed.

## Task 4: Final verification

**Files:**
- Existing

**Step 1: Run explicit-any guard**

```bash
node scripts/npm-run.js run verify:no-explicit-any
```

Expected: PASS

**Step 2: Run full typecheck**

```bash
node scripts/npm-run.js run typecheck
```

Expected: PASS

**Step 3: Run focused tests**

Minimum required:

```bash
node scripts/npm-run.js run test:run -- src/lib/__tests__/rpc-client.test.ts
```

Plus:
- every focused test corresponding to touched fallout files from Task 3

**Step 4: Run React Doctor on the diff**

```bash
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Expected: no new warnings introduced by the diff

## Task 5: Final commit and handoff

**Files:**
- All touched files

**Step 1: Review final status**

```bash
git status -sb
```

Expected:
- only the intentional `rpc-client`, type-assert, test, and fallout files are modified

**Step 2: Commit final fallout fixes if Task 3 changed anything**

```bash
git add <all touched files>
git commit -m "test: lock rpc-client arg and error behavior"
```

Use this second commit only if there were post-green fallout fixes after the first `rpc-client` commit.

**Step 3: Ready for execution**

Hand off to `superpowers:executing-plans` or implement directly in the current session.
