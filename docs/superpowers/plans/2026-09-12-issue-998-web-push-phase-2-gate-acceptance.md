# Issue #998 Web Push Phase 2 Gate Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Keep each checkbox as a reviewable unit.

**Goal:** Khôi phục acceptance Phase 2 bằng static evidence có phạm vi rõ, nhận diện đúng SQL an toàn, và thay inventory `79` bằng hợp đồng hành vi bảo vệ authorized-user boundary.

**Architecture:** Selector của evidence Phase 2 đã live tách khỏi pending-to-apply. Selector khóa `subjectCommit`, path và SHA-256; thiếu hoặc lệch hash fail closed. Static policy kiểm semantic guard/ACL; SQL gate giữ guard graph và kiểm tra non-vacuity.

**Tech Stack:** TypeScript, Node.js built-ins, Vitest, PostgreSQL/psql SQL gate, Supabase DB Quality Gate static lane, Oracle baseline-forward harness.

**Spec:** `openspec/changes/add-web-push-notifications/specs/notifications/spec.md`, `openspec/changes/add-web-push-notifications/tasks.md`, Issue #998.

## Global Constraints

- Chỉ xử lý Phase 2 và stale authorized-user inventory trong #998.
- Không đụng #997, #999, Phase 3, runtime Web Push, API/UI/Go, hoặc migration đã applied.
- Không live write, không Supabase CLI; lượt lập plan này không chạy SQL, DB, Oracle hay gate.
- Không đổi `79` thành `83`; zero pending/diff không được tạo historical PASS giả.
- Không dùng `--base-ref`; static dùng origin/main hoặc landed exact first parent.
- Applied migrations immutable; the optional reviewed selector is static-only and binds exact `subjectCommit`, `path`, `sha256`.
- Không blanket-waive `BLOCKING`; chỉ DANGEROUS được approval với exact source/finding digest.
- Historical FAILED reports giữ nguyên; task 2.4 chỉ tick sau dual PASS cùng landed SHA.
- Trước mỗi commit chạy `format:check`, `verify:no-explicit-any`, `verify:dedupe`, `typecheck`, focused test và `react-doctor` theo đúng thứ tự.
- Trước helper dùng chung, invoke `code-deduplication`; trước TypeScript, invoke `vercel-react-best-practices` theo repo rule.

## Evidence Baseline

- `supabase/tests/technical_configuration_authorized_user_guard_phase_gate.sql:258-345` tìm authenticated public module RPC và walk tới `_technical_configuration_require_authorized_user`.
- `:347-350` hard-code `v_module_rpc_count = 79`; blame là `38978ddc` ngày 2026-08-24; catalog read-only hiện có 83 signatures.
- Current `HEAD`/`origin/main` snapshot is `015fb3ab`; historical Phase 2 evidence records static digest `15d138c649812f60a36592843336e78c9316ff63bcff48f0a7976c6ee1836902`, Oracle digest `8c10b269fed4b76e35fb8a47a345ebaae17df6b745e06fc037205ea2afa67bef`, 11 BLOCKING and 5 DANGEROUS findings.
- Bốn signature mới đến từ `20260910100000_technical_configuration_dossier_specialty.sql`, `20260910100100_technical_configuration_dossier_specialty_reads.sql`, và `20260910110000_technical_configuration_dossier_specialty_filter.sql`; all three Phase 2 Web Push migration filenames exist at this snapshot.
- `supabase/db-quality-gate-tests.json:558-566` là `default-safe`, `rollback-required`, `core-security`; Web Push entry tách tại `:1222-1235`.
- `phase-2-evidence.md:72-87` giữ stale failure/task 2.4; `phase-2-3-live-apply-evidence.md:30-41` ghi catch-up `b65060ef` làm baseline evidence cũ không reusable.

### Task 1: Scoped Static Evidence Mechanism

**Files:**

- Modify: `scripts/db-quality-gate/static-lane-types.ts`
- Modify: `scripts/db-quality-gate/static-candidate-evidence.ts`
- Modify: `scripts/db-quality-gate/static-lane.ts`
- Modify: `scripts/db-quality-gate/cli.ts`
- Test: `scripts/__tests__/database-quality-gate-static-lane-evidence.test.ts`

**Interfaces:**

- Add optional CLI option `--reviewed-migration-selector` for `--lane static` only and wire it through `cli.ts` and lane types. Ordinary static without this option remains unchanged; absence fails only when reviewed-selector mode is requested.
- `validateReviewedMigrationSelector(args)` accepts exactly:

```ts
type ReviewedMigrationSelectorInput = {
  repositoryRoot: string
  subjectCommit: string
  selector: unknown
}
type ReviewedMigrationSelector = {
  subjectCommit: string
  migrations: Array<{ path: string; sha256: string }>
}
type SelectorResult =
  | { ok: true; selector: ReviewedMigrationSelector }
  | { ok: false; outcome: "INCOMPLETE"; reason: string }

function validateReviewedMigrationSelector(args: ReviewedMigrationSelectorInput): SelectorResult
```

- The selector scopes static evidence only; baseline-forward keeps its existing pending migration selection and full registry sweep.

- [x] **Step 1: Write red tests.** Ordinary static without the option remains unchanged; reviewed mode rejects absent/empty selector, subject mismatch, duplicate/untracked path, missing file, malformed SHA, and byte-hash mismatch with `{ ok: false, outcome: "INCOMPLETE" }`.
- [x] **Step 2: Run the red test before implementation.** `node scripts/npm-run.js exec vitest run scripts/__tests__/database-quality-gate-static-lane-evidence.test.ts` must fail on the new selector cases.
- [x] **Step 3: Implement fail-closed validation.** Reuse existing path/hash helpers; resolve inside exact checkout, compare subject/path/file bytes, and reject every mismatch before static policy classification.
- [x] **Step 4: Prove zero pending.** A valid selector for already-live Phase 2 files validates static historical evidence without claiming a pending migration; baseline-forward behavior remains unchanged.
- [x] **Step 5: Run the focused test, shared commit gates, and commit `fix(db-gate): scope historical phase2 static evidence`; pause for explicit user approval before Task 2.**

Task 1 evidence note: the prior interrupted agent left the selector tests and implementation without a recoverable RED log, so no RED is claimed for that inherited portion. A separate behavioral RED was observed for the missing digest-bound `reviewedMigrationIdentities` report evidence (12 tests, 1 expected failure), followed by GREEN and the complete verification recorded in the Task 1 handoff.

### Task 2: Narrow Static SQL Semantics

**Files:**

- Modify: `scripts/db-quality-gate/static-policy.ts`
- Modify: `scripts/db-quality-gate/static-policy-authorization.ts`
- Modify: `scripts/db-quality-gate/static-policy-objects.ts`
- Test: `scripts/__tests__/database-quality-gate-static-policy-rpc.test.ts`
- Test: `scripts/__tests__/database-quality-gate-static-policy-delegation-adversarial.test.ts`
- Test: `scripts/__tests__/database-quality-gate-static-policy-security.test.ts`

**Interfaces:**

- Consume parsed definitions, exact overload identities, ACL statements, and reviewed selector evidence.
- Produce existing finding categories/fingerprints; semantic recognition never erases unresolved security findings.

- [ ] **Step 1: Add red tests for the 11 blockers.** Use `20260911030100_web_push_recipients.sql` and `20260911030200_web_push_subscriptions.sql`; cover public-name internals, argumented `PERFORM`/assignment guards, and the pure key validator.
- [ ] **Step 2: Run the red tests before implementation.** `node scripts/npm-run.js exec vitest run scripts/__tests__/database-quality-gate-static-policy-rpc.test.ts scripts/__tests__/database-quality-gate-static-policy-delegation-adversarial.test.ts scripts/__tests__/database-quality-gate-static-policy-security.test.ts` must fail on the new semantic cases.
- [ ] **Step 3: Add adversarial negatives.** Keep blocking for internal predicate exposure, SQL-before-guard, swallowed guard exceptions, wrong overload/cycle proof, and impure `IMMUTABLE` helpers.
- [ ] **Step 4: Implement exact semantic recognition.** Resolve schema/name/argument types; accept argumented guard calls only when they dominate protected operations. Public naming is not browser exposure proof; `IMMUTABLE` requires a pure body/dependency set.
- [ ] **Step 5: Preserve fail closed.** Missing ACL evidence and unresolved control flow stay `BLOCKING` or `INCOMPLETE`; never create a waiver for the 11 blockers.
- [ ] **Step 6: Run focused policy tests, the shared commit gates, and commit `fix(db-gate): recognize guarded web push SQL semantics`.**

```bash
node scripts/npm-run.js exec vitest run scripts/__tests__/database-quality-gate-static-policy-rpc.test.ts scripts/__tests__/database-quality-gate-static-policy-delegation-adversarial.test.ts scripts/__tests__/database-quality-gate-static-policy-security.test.ts
```

### Task 3: Behavioral Replacement for the Stale RPC Count

**Files:**

- Modify: `supabase/tests/technical_configuration_authorized_user_guard_phase_gate.sql`
- Test: the same SQL file through the disposable Oracle baseline-forward runner; no source-string assertion or registry Vitest substitutes for SQL execution
- Reference only: `supabase/db-quality-gate-tests.json:558-566`

**Interfaces:**

- Keep the existing `routines`, `starts`, `walk`, and `target` CTE behavior.
- Keep `v_module_rpc_count`, `v_missing_guard`, and `v_unrelated_reaching_guard`; count is only non-vacuity, never a snapshot contract.

- [ ] **Step 1: Make the checker reusable inside the rollback test.** Extract the graph assertion into one `pg_temp` helper so mutation fixtures exercise the same query and labels without persistent objects.
- [ ] **Step 2: Remove literal equality.** Replace `v_module_rpc_count = 79` with `v_module_rpc_count > 0`; retain `v_missing_guard IS NULL` and `v_unrelated_reaching_guard IS NULL`.

```sql
PERFORM pg_temp.assert_true(
  'at least one authenticated technical-configuration RPC exists',
  v_module_rpc_count > 0
);
PERFORM pg_temp.assert_true(
  'every authenticated module RPC reaches the canonical guard',
  v_missing_guard IS NULL
);
PERFORM pg_temp.assert_true(
  'no unrelated authenticated RPC reaches the canonical guard',
  v_unrelated_reaching_guard IS NULL
);
```

- [ ] **Step 3: Add disposable mutation checks.** An extra authenticated module RPC calling the canonical guard passes; that RPC without a guard fails; an unrelated authenticated RPC calling the canonical guard fails; revoking every module candidate fails the mandatory non-empty assertion. Catch expected failures and rollback every fixture.
- [ ] **Step 4: Verify the four additions.** Cover specialty create/update overloads, specialties read, and six-argument filtered list; preserve authenticated-only grants, canonical guard path, role cases, and internal-helper denial. Do not add an unproven definer/search-path contract.
- [ ] **Step 5: Run the same SQL test through the disposable Oracle baseline-forward runner before accepting the task or making the next commit.** Set `LANDED_SHA` to the exact subject commit and run the full registered suite; do not use a source-string test or `database-quality-gate-registry.test.ts` as SQL verification.

```bash
node scripts/npm-run.js run db:quality-gate -- \
  --lane baseline-forward \
  --run-id "issue-998-inventory-${LANDED_SHA:0:12}" \
  --subject-commit "$LANDED_SHA"
```

- [ ] **Step 6: Run the shared commit gates and commit `test(db): replace stale technical rpc count with behavior`.**

### Task 4: Exact-Commit Validation, Dangerous Review, and Closeout

**Files:**

- Modify after evidence: `openspec/changes/add-web-push-notifications/phase-2-evidence.md`
- Modify after evidence: `openspec/changes/add-web-push-notifications/tasks.md:40`
- Modify only after explicit approval: `supabase/db-quality-gate-waivers.json`
- Reuse: `scripts/db-quality-gate/static-approvals.ts`, `scripts/db-quality-gate/approvals.ts`
- Runbook: `docs/runbooks/db-quality-gate-oracle.md:175-193`, `:351-410`

**Interfaces:**

- Consume landed SHA, selector JSON, candidate static report, Oracle control/candidate reports, and exact finding digests.
- Only the static command receives `--reviewed-migration-selector "$SELECTOR_PATH"`. Baseline-forward keeps its full registry and pending-migration sweep and explicitly executes `supabase/tests/web_push_phase2.sql` even when the pending set is empty; no empty-diff shortcut certifies historical Phase 2.

- [ ] **Step 1: Create candidate evidence before approval.** Refresh `origin/main`, bind `LANDED_SHA`, and preserve historical FAILED reports; do not reuse `7e3c8347`, `219d5518`, or pre-catch-up evidence.

```bash
git pull --rebase
LANDED_SHA="$(git rev-parse HEAD)"
test "$(git rev-parse origin/main)" = "$LANDED_SHA"
SELECTOR_PATH="$(pwd)/.tmp/issue-998-reviewed-selector.json"
```

- [ ] **Step 2: Build selector from exact bytes.** Include all three Phase 2 migrations: `20260911030000_web_push_schema.sql`, `20260911030100_web_push_recipients.sql`, and `20260911030200_web_push_subscriptions.sql`. Bind paths and computed SHA-256 to `LANDED_SHA`; missing, extra, or mismatched entries fail closed. Keep selector separate from possibly empty pending-to-apply.
- [ ] **Step 3: Run candidate static with selector and no `--base-ref`.** Use landed first parent only for landed-diff certification; require `subjectCommit == LANDED_SHA`, `requiredChecksComplete=true`, and `evidenceAvailable=true`.

```bash
node scripts/npm-run.js run db:quality-gate -- \
  --landed-parent-commit "$(git rev-parse "${LANDED_SHA}^1")" \
  --lane static --run-id "issue-998-static-${LANDED_SHA:0:12}" \
  --subject-commit "$LANDED_SHA" \
  --reviewed-migration-selector "$SELECTOR_PATH"
```

- [ ] **Step 4: Approve only DANGEROUS, then make the approval commit.** Bind five DANGEROUS findings (tenant DELETE and four intentional grants) to exact source SHA, finding digest, protected objects, rationale, reviewer, expiry/revocation, validation, and recovery via existing approvals. Never waive the 11 BLOCKING findings; approval commit is the direct child of the candidate.
- [ ] **Step 5: Checkout and run fresh Oracle baseline-forward.** Follow `docs/runbooks/db-quality-gate-oracle.md:175-193`, including existing `scripts/db-quality-gate/oracle-checkout.sh`; use disposable control/candidate clones and keep the full registry/pending sweep, including explicit execution of `supabase/tests/web_push_phase2.sql` when pending is empty. Old evidence is invalid after `b65060ef` catch-up.

```bash
ssh -i /root/Oracle/ssh-key-2026-05-13.key ubuntu@149.118.148.179 "bash -s -- $LANDED_SHA" < scripts/db-quality-gate/oracle-checkout.sh
node scripts/npm-run.js run db:quality-gate -- \
  --lane baseline-forward --run-id "issue-998-oracle-${LANDED_SHA:0:12}" \
  --subject-commit "$LANDED_SHA"
```

- [ ] **Step 6: Recapture the final exact commit and selector after approval lands.** Set `LANDED_SHA="$(git rev-parse HEAD)"`, verify it is the direct approval child, regenerate `SELECTOR_PATH` from that commit's bytes, and discard the old subject-bound selector; candidate/approval evidence does not certify the final SHA.
- [ ] **Step 7: Rerun both lanes after recapture.** Run static with the regenerated selector and baseline-forward without a selector, both with fresh provenance and digests.
- [ ] **Step 8: Close only on meaningful dual PASS.** Require both lanes `PASS`, readable digest-bearing reports, valid non-empty selector, same `LANDED_SHA`, and no infrastructure/parser/timeout/cleanup failure. Append evidence without rewriting historical FAILED records; tick task 2.4 only then.
- [ ] **Step 9: Run the shared commit gates and commit docs.** If any blocker remains, record it and leave task 2.4 unchecked; do not apply live SQL or broaden scope.

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js exec vitest run scripts/__tests__/database-quality-gate-static-lane-evidence.test.ts
node scripts/npm-run.js run react-doctor
git add openspec/changes/add-web-push-notifications/phase-2-evidence.md openspec/changes/add-web-push-notifications/tasks.md
git commit -m "docs(web-push): record issue 998 gate evidence"
```
