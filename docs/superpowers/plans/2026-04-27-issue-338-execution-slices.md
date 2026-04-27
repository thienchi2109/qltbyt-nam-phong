# Issue #338 — Execution Slices (5 PRs, deploy-independent)

**Date:** 2026-04-27 (revised same day after PR-2a merge to pivot to in-row icon)
**Source plan:** `docs/superpowers/plans/2026-04-26-issue-207-phase1-equipment-deeplink-active-repair.md` (revision header added 2026-04-27)
**Source spec:** `docs/superpowers/specs/2026-04-26-issue-207-phase1-equipment-deeplink-active-repair-design.md` (revision history added 2026-04-27)
**Pre-applied (already on `main`):** commit `66bb762` (`useUpdateRepairRequest` invalidation alignment + invalidation contract test). **Not part of any slice below.** Restore from `66bb762` if missing.

## Revision history

### 2026-04-27 — Pivot to in-row icon (PR-2b slim + PR-3 split)

After PR-1a, PR-1b, PR-2a all merged to `main`, the strategy pivoted from "chip in `EquipmentDetailDialog`" to "icon in equipment list rows". Throw-away cost was ~80 LOC of unbuilt `LinkedRequestButton` plan; PR-1a/1b/2a deliverables (helper rename, RPC, composite index, provider, resolver hook, types, strings, test-utils) all reused fully.

**Changes vs original 5-slice plan:**

- PR-1a: **MERGED** as planned. No change.
- PR-1b: **MERGED** as planned. No change.
- PR-2a: **MERGED** as planned. No change.
- PR-2b: **SLIMMED** — drops `LinkedRequestButton` (Task 2.4 removed). Ships only adapter + SheetHost + barrel. ~250 LOC instead of ~450.
- ~~PR-3 (single)~~: **SPLIT** into PR-3a (backend) + PR-3b (frontend).
  - PR-3a: extend `equipment_list_enhanced` with `active_repair_request_id` column + `equipment_list_enhanced_active_repair_smoke.sql` + RealtimeProvider cross-cache invalidation + `Equipment` type update.
  - PR-3b: `LinkedRequestRowIndicator` component + provider hoist + sheet host mount + wire into `equipment-table-columns` and `mobile-equipment-list-item` + integration tests + adoption test inversion + `CLAUDE.md` update.

Total slice count stays at 5; PR-3 becomes PR-3a + PR-3b. Merge order changes only at the tail (see "Merge order" below). The deploy-independence guarantee survives unchanged.

---

> This document is **execution metadata only**. The TDD steps, file lists, exact code blocks, and acceptance criteria stay in the source plan. Each PR below executes a contiguous range of tasks from the plan; all per-task verification gates listed in the plan are **mandatory** for the PR they belong to.

---

## Why slices

The umbrella plan is one feature delivered in 3 chunks. Slicing into 5 smaller PRs reduces review surface to ≤300 LOC/PR, allows merge-by-merge rollback, and lets each slice deploy to production independently without exposing partial UI to users.

**Deploy-independence guarantee:** PRs 1a, 1b, 2a, 2b are all *additive* — they merge to `main` and ship to production with **zero user-visible change** because the new helper exports / RPC / component package are not imported by any production UI surface until PR-3. PR-3 is the only slice that "lights up" the feature.

**No feature-flag infrastructure** is added. The repo has no current flag system; introducing one for one feature would be needless complexity (Karpathy: simplest sufficient).

---

## Slice → Task mapping

| PR | Branch | Plan tasks | Scope (one line) | LOC est. | Deploy-safe? | User-visible? | Status |
|----|--------|-----------|-------------------|----------|--------------|---------------|---|
| **PR-1a** | `feat/338-1a-helper-rename` | 1.1, 1.2 | Rename `repair-request-create-intent` → `repair-request-deep-link` + 3 new exports + update 8 importers + rename adoption test | ~150 | ✅ Yes — pure refactor, all old exports preserved | ❌ No | ✅ MERGED `f1c7489` |
| **PR-1b** | `feat/338-1b-rpc-active-for-equipment` | 1.3, 1.4 | New RPC `repair_request_active_for_equipment` + composite index migration + smoke SQL + RPC whitelist | ~250 (incl. SQL) | ✅ Yes — RPC unused by UI; index additive | ❌ No | ✅ MERGED |
| **PR-2a** | `feat/338-2a-linked-request-core` | 2.1, 2.2, 2.3 | Package foundations: `types.ts`, `strings.ts`, `useResolveActiveRepair` resolver hook, `LinkedRequestContext` + unit tests + test-utils | ~350 | ✅ Yes — package not imported anywhere; tree-shakable | ❌ No | ✅ MERGED `6739109` |
| **PR-2b (revised)** | `feat/338-2b-linked-request-shell` | ~~2.4~~, 2.5, 2.6, 2.7 | `repairRequestSheetAdapter`, `LinkedRequestSheetHost`, barrel `index.ts` (no `LinkedRequestButton` export) + unit tests | ~250 | ✅ Yes — package not imported anywhere; tree-shakable | ❌ No | ⏳ Up next |
| **PR-3a** (NEW) | `feat/338-3a-list-enhanced-active-repair` | 3.0a, 3.0b, 3.0c | Migration extending `equipment_list_enhanced` with `active_repair_request_id` (LATERAL JOIN, reuses PR-1b's composite index) + `equipment_list_enhanced_active_repair_smoke.sql` (6 scenarios) + RealtimeProvider extension (invalidate `equipmentKeys.all` + `repairKeys.all`) + `Equipment` type update + staleTime tighten | ~400 (incl. SQL) | ✅ Yes — column additive in JSONB; type field optional; UI not yet using it | ❌ No | 📅 Planned |
| **PR-3b** (NEW) | `feat/338-3b-row-icon-integration` | 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9 | `LinkedRequestRowIndicator` component + tests + provider hoist (`EquipmentPageClient`) + `LinkedRequestSheetHost` mount + wire into `equipment-table-columns.tsx` + `mobile-equipment-list-item.tsx` + 8-scenario integration test + adoption-test inversion + `CLAUDE.md` update + final gates | ~400 | ⚠️ Lights up feature — revert PR to disable | ✅ Yes | 📅 Planned |

**Total** ≈ 1500 LOC across 6 (originally 5) PRs. The PR count change is one extra PR (PR-3a / PR-3b) for safer deploy independence between backend column extension and frontend wiring.

> **Note**: the original "PR-3 single" row is replaced. Original wording referenced Tasks `3.1–3.7` rendering button in `EquipmentDetailStatusSection`. After 2026-04-27 pivot, those tasks no longer exist — see `2026-04-26-issue-207-phase1-equipment-deeplink-active-repair.md` "Chunk 3 (revised 2026-04-27)" for the new task list.

---

## Merge order & dependencies

```
main
 │
 ├── PR-1a   ──▶ merge ──▶ main' (✅ DONE: f1c7489)
 │                            │
 │                            ├── PR-1b   ──▶ merge ──▶ main'' (✅ DONE)
 │                            │                            │
 │                            │                            ├── PR-2a   ──▶ merge ──▶ main''' (✅ DONE: 6739109)
 │                            │                            │                            │
 │                            │                            │                            ├── PR-2b   ──▶ merge ──▶ main'''' (⏳ NEXT)
 │                            │                            │                            │                            │
 │                            │                            │                            │                            ├── PR-3a ──▶ merge ──▶ main''''' (📅 backend ready)
 │                            │                            │                            │                            │                            │
 │                            │                            │                            │                            │                            └── PR-3b ──▶ merge ──▶ feature live
```

**Hard dependencies (revised 2026-04-27):**
- PR-1a → unblocks PR-2a (resolver hook + adapter import from `@/lib/repair-request-deep-link`)
- PR-1b → unblocks PR-2a (resolver hook calls `repair_request_active_for_equipment` via `callRpc`); also enables PR-3a (composite index reused by `equipment_list_enhanced` LATERAL)
- PR-2a → unblocks PR-2b (host wires resolver into provider)
- PR-2b → unblocks PR-3b (page imports the barrel)
- PR-3a → unblocks PR-3b (frontend reads `equipment.active_repair_request_id` from list response and depends on `Equipment` type update)

**Independence between PR-1a and PR-1b:** none of PR-1a's files overlap with PR-1b's. They can be authored in parallel and merged in either order; the doc fixes order PR-1a → PR-1b only because PR-1b's smoke-test prep is easier once helper renames are settled.

**PR-3a deploy-safety**: the new column on `equipment_list_enhanced` is additive in the JSONB output. Frontend consumers (`useEquipmentData`, `transfer-dialog.data`, etc.) ignore unknown keys and stay green. RealtimeProvider extension fires invalidations on a key (`equipmentKeys.all`) that already exists; no consumer breaks.

**PR-3b deploy-safety**: once `LinkedRequestRowIndicator` is added but the indicator's gating predicate (`active_repair_request_id != null`) is false for all rows during early rollout (because PR-3a wasn't yet deployed), the icon never renders and the page behaves as before. If PR-3a ships first (recommended), the icon renders normally.

**Rebase discipline:** rebase each PR onto `main` immediately after the previous merge. No long-lived branches.

---

## Verification gates per PR (mandatory)

All TS/TSX-touching PRs run **in this exact order** before merge (per `CLAUDE.md`):

1. `node scripts/npm-run.js run verify:no-explicit-any`
2. `node scripts/npm-run.js run typecheck`
3. `node scripts/npm-run.js run test:run -- <focused-paths>` (per-task focused tests defined in plan)
4. `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`

> **Correction (2026-04-27):** an earlier draft of this section said gate 4 ran on PR-3 only. That was wrong — `CLAUDE.md` makes all four gates mandatory for any `.ts`/`.tsx` change. Pre-existing warnings on lines a PR did not touch are acceptable; new findings on changed lines block merge.

**DB-touching PRs (PR-1b + PR-3a):**
- All DDL via Supabase MCP `apply_migration` (project `cdthersvldpnlbvpufrr`). **Never** Supabase CLI.
- All smoke SQL via Supabase MCP `execute_sql`. Smoke must pass all 6 scenarios from the plan before opening the PR.
- PR-3a additionally requires `generate_typescript_types` from MCP and a typecheck on the regenerated types in the same commit chain as the `Equipment` type update.

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
- [ ] react-doctor --diff main green (or: only pre-existing warnings on lines this PR did not touch)
- [ ] (PR-1b only) smoke SQL passes 6/6 scenarios on live DB
- [ ] (PR-3 only) Manual browser verification: button visible iff `tinh_trang_hien_tai === 'Chờ sửa chữa'` AND active request exists; sheet opens read-only `RepairRequestsDetailView`; auto-close on equipment change

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

---

## Memori checkpoint protocol (MANDATORY for #338)

Per session policy: **save a Memori MCP note via `advanced_augmentation` at every checkpoint** so progress survives context compaction, session restarts, and fresh-agent handoff. Memori is durable progress control; `progress.txt` and PR descriptions are the immutable audit trail.

### Checkpoint trigger matrix

| # | Trigger | Note title pattern | Required content |
|---|---------|---------------------|--------------------|
| 1 | **PR branch created + first commit pushed** | `#338 PR-Xx start: <branch>` | Branch name; tasks in scope; first commit SHA; verification gates planned |
| 2 | **PR opened on GitHub** | `#338 PR-Xx open: <url>` | PR URL; tasks completed in branch; verify-gate results; reviewer asks (if any) |
| 3 | **PR merged to main** | `#338 PR-Xx merged: <merge SHA>` | Merge SHA on main; commits range merged; tasks ticked; `progress.txt` entry; next PR to start |
| 4 | **Blocker hit** (verify fail, smoke red, review push-back, infra issue) | `#338 PR-Xx blocked: <one-line reason>` | What blocked; reproduce command/log; current branch HEAD; proposed resolution; whether human input needed |
| 5 | **Session-end mid-PR** (compact, /clear, manual stop) | `#338 PR-Xx WIP: <branch> @ <HEAD>` | Branch + HEAD SHA; last completed task/step; next step verbatim; uncommitted-files list (must be empty — commit before save) |

### Note shape (REQUIRED — follow `CLAUDE.md` Memori convention)

```md
# #338 PR-Xx <state>: <slug>

## Context
- Issue #338 Phase 1 deep-link active repair. Slice PR-Xx of 5.
- Source plan: docs/superpowers/plans/2026-04-26-issue-207-phase1-equipment-deeplink-active-repair.md (d27b8bb)
- Slices doc: docs/superpowers/plans/2026-04-27-issue-338-execution-slices.md (e431b33)

## Decision / Finding
- <what was just achieved or decided at this checkpoint>

## Evidence
- Branch: <name>
- HEAD: <SHA short>
- Tasks ticked: <X.Y, X.Z>
- Commits: <SHA1..SHA2>
- Verify gates: verify:no-explicit-any=<pass|fail>, typecheck=<pass|fail>, test:run=<pass|fail>[, react-doctor=...]
- PR: <url or N/A>

## Actionable Follow-up
- Next: <exact next step verbatim, e.g., "Open PR-1a draft" / "Start PR-1b Task 1.3 Step 1.3.1">
- Avoid: <known traps for next agent>

## Metadata
- Date: <YYYY-MM-DD>
- Confidence: high
```

### Rules

1. **One save per checkpoint, never silent.** Skipping a checkpoint = breaking progress control.
2. **Commit before save.** A WIP/session-end note with uncommitted files is invalid; always `git status` and commit (or stash with note) first.
3. **Trust file > memory.** If a memori note conflicts with `git log` / `progress.txt` / PR state, trust the repo and update the note via a fresh checkpoint save.
4. **Recall at fresh-session start.** Before resuming work, call `memori.recall` with query `Issue #338 PR progress` to find the most recent checkpoint.
5. **No silent merges.** A merged PR without a corresponding checkpoint #3 note is treated as not-completed by future agents.

### Fresh-session resume sequence

```text
1. memori.recall("Issue #338 PR progress")           # find latest checkpoint
2. git fetch origin && git log --oneline -10         # verify checkpoint matches main
3. cat progress.txt                                   # confirm Progress Log entries
4. cat docs/superpowers/plans/2026-04-27-issue-338-execution-slices.md  # re-read slicing
5. resume from "Actionable Follow-up: Next" of latest checkpoint
```
