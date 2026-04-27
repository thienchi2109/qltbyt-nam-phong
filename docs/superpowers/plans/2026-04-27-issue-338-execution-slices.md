# Issue #338 — Execution Slices (5 PRs, deploy-independent)

**Date:** 2026-04-27
**Source plan:** `docs/superpowers/plans/2026-04-26-issue-207-phase1-equipment-deeplink-active-repair.md` (commit `d27b8bb`)
**Source spec:** `docs/superpowers/specs/2026-04-26-issue-207-phase1-equipment-deeplink-active-repair-design.md` (commits `9a1c1c1 → 1144fb4 → 30c25e2 → af37131`)
**Pre-applied (already on `main`):** commit `66bb762` (`useUpdateRepairRequest` invalidation alignment + invalidation contract test). **Not part of any slice below.** Restore from `66bb762` if missing.

> This document is **execution metadata only**. The TDD steps, file lists, exact code blocks, and acceptance criteria stay in the source plan. Each PR below executes a contiguous range of tasks from the plan; all per-task verification gates listed in the plan are **mandatory** for the PR they belong to.

---

## Why slices

The umbrella plan is one feature delivered in 3 chunks. Slicing into 5 smaller PRs reduces review surface to ≤300 LOC/PR, allows merge-by-merge rollback, and lets each slice deploy to production independently without exposing partial UI to users.

**Deploy-independence guarantee:** PRs 1a, 1b, 2a, 2b are all *additive* — they merge to `main` and ship to production with **zero user-visible change** because the new helper exports / RPC / component package are not imported by any production UI surface until PR-3. PR-3 is the only slice that "lights up" the feature.

**No feature-flag infrastructure** is added. The repo has no current flag system; introducing one for one feature would be needless complexity (Karpathy: simplest sufficient).

---

## Slice → Task mapping

| PR | Branch | Plan tasks | Scope (one line) | LOC est. | Deploy-safe? | User-visible? |
|----|--------|-----------|-------------------|----------|--------------|---------------|
| **PR-1a** | `feat/338-1a-helper-rename` | 1.1, 1.2 | Rename `repair-request-create-intent` → `repair-request-deep-link` + 3 new exports + update 8 importers + rename adoption test | ~150 | ✅ Yes — pure refactor, all old exports preserved | ❌ No |
| **PR-1b** | `feat/338-1b-rpc-active-for-equipment` | 1.3, 1.4, 1.5 | New RPC `repair_request_active_for_equipment` + composite index migration + smoke SQL (6 scenarios) + RPC whitelist | ~250 (incl. SQL) | ✅ Yes — RPC unused by UI; index additive | ❌ No |
| **PR-2a** | `feat/338-2a-linked-request-core` | 2.1, 2.2, 2.3 | Package foundations: `types.ts`, `strings.ts`, `useActiveRepairRequest` resolver hook, `LinkedRequestContext` + unit tests | ~350 | ✅ Yes — package not imported anywhere; tree-shakable | ❌ No |
| **PR-2b** | `feat/338-2b-linked-request-shell` | 2.4, 2.5, 2.6, 2.7 | `LinkedRequestButton`, `repairRequestSheetAdapter`, `LinkedRequestSheetHost`, barrel `index.ts` + unit tests | ~450 | ✅ Yes — same as 2a (still no imports) | ❌ No |
| **PR-3** | `feat/338-3-equipment-integration` | 3.1, 3.2, 3.3, 3.4, 3.5, 3.6 | Mount `LinkedRequestProvider` on page client, place `LinkedRequestSheetHost`, render button in `EquipmentDetailStatusSection`, 7 integration tests (incl. race + N+1 guard), adoption-test extension, `CLAUDE.md` N+1 rule | ~250 | ⚠️ Lights up feature — revert PR to disable | ✅ Yes |

**Total** ≈ 1450 LOC across 5 PRs (matches plan estimate of "3 chunks / 18 TDD tasks").

---

## Merge order & dependencies

```
main
 │
 ├── PR-1a ──▶ merge ──▶ main'
 │                         │
 │                         ├── PR-1b ──▶ merge ──▶ main''
 │                         │                          │
 │                         │                          ├── PR-2a ──▶ merge ──▶ main'''
 │                         │                          │                         │
 │                         │                          │                         ├── PR-2b ──▶ merge ──▶ main''''
 │                         │                          │                         │                          │
 │                         │                          │                         │                          └── PR-3 ──▶ merge ──▶ feature live
```

**Hard dependencies:**
- PR-1a → unblocks PR-2a (resolver hook + adapter import from `@/lib/repair-request-deep-link`)
- PR-1b → unblocks PR-2a (resolver hook calls `repair_request_active_for_equipment` via `callRpc`)
- PR-2a → unblocks PR-2b (button consumes `LinkedRequestContext`, host wires resolver into provider)
- PR-2b → unblocks PR-3 (page imports the barrel)

**Independence between PR-1a and PR-1b:** none of PR-1a's files overlap with PR-1b's. They can be authored in parallel and merged in either order; the doc fixes order PR-1a → PR-1b only because PR-1b's smoke-test prep is easier once helper renames are settled.

**Rebase discipline:** rebase each PR onto `main` immediately after the previous merge. No long-lived branches.

---

## Verification gates per PR (mandatory)

All TS/TSX-touching PRs run **in this exact order** before merge:

1. `node scripts/npm-run.js run verify:no-explicit-any`
2. `node scripts/npm-run.js run typecheck`
3. `node scripts/npm-run.js run test:run -- <focused-paths>` (per-task focused tests defined in plan)

PR-3 additionally runs:

4. `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`

**DB-touching PRs (PR-1b only):**
- All DDL via Supabase MCP `apply_migration` (project `cdthersvldpnlbvpufrr`). **Never** Supabase CLI.
- All smoke SQL via Supabase MCP `execute_sql`. Smoke must pass all 6 scenarios from the plan before opening the PR.

---

## Per-PR PR description checklist (template)

Each PR opened against `main` must include:

```markdown
## Summary
<one-paragraph what + why>

## Tasks delivered (from plan d27b8bb)
- [ ] Task X.Y — <name>
- [ ] Task X.Z — <name>

## Test plan
- [ ] verify:no-explicit-any green
- [ ] typecheck green
- [ ] focused test:run green: <list test files>
- [ ] (PR-1b only) smoke SQL passes 6/6 scenarios on live DB
- [ ] (PR-3 only) react-doctor --diff main green
- [ ] Manual browser verification (PR-3 only): button visible iff `tinh_trang_hien_tai === 'Chờ sửa chữa'` AND active request exists; sheet opens read-only `RepairRequestsDetailView`; auto-close on equipment change

## Deploy-safety reasoning
<why this slice ships safely without lighting up the feature; PR-3 explains rollback strategy>

## Refs
- Closes #338 (PR-3 only); refs #338 (others)
- Refs #207 (umbrella)
- Plan: docs/superpowers/plans/2026-04-26-issue-207-phase1-equipment-deeplink-active-repair.md
- Slices: docs/superpowers/plans/2026-04-27-issue-338-execution-slices.md

Generated with [Devin](https://cli.devin.ai/docs)
```

---

## Commit convention reminder

Conventional Commits per task. Each TDD red→green→refactor cycle ends in a commit. Devin co-author footer required:

```
Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
```

No `// eslint-disable`. Tests are contracts. Helper invocation: `node scripts/npm-run.js …` for npm/npx.

---

## Out of scope for #338 (per spec)

- Hardening of insecure `repair_request_get` — tracked by **#342** (separate PR, independent).
- Transfer / maintenance / calibration / inspection deep-links — Phase 2/3 (`#339`, `#340`); depend on #338 landing first.
- AI-readonly equipment surface — `#341` (independent).

---

## Stop / resume rules

- One PR open at a time (this branch). Do **not** start the next PR until the previous is merged to `main`.
- After each merge, append a `## Progress Log` entry to `progress.txt` per Ralph contract (Codebase Patterns first, Progress Log appends).
- If blocked, stop and report; do not skip slices.
