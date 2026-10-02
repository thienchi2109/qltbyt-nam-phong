# Phase 8.4 Runtime Quota and SQL Audit Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the production Go runtime to the existing durable quota lifecycle so each accepted AI request reserves and finalizes through the allowlisted RPCs while `query_database` keeps its sanitized audit contract.

**Architecture:** Keep the existing capability and broker boundaries. Replace only the runtime's `usage.NewMemory` with `usage.NewQuotaBook`, configure its journal directory, and expose the quota book through the runtime construction seam for focused regression tests. `NewQuotaBook` is constructed with a nil static caller; the verified per-request `quotaCaller` is supplied through `Prepared.QuotaCaller` on every `Reserve` and is the only caller used for live identity-scoped RPCs. No credentials are persisted in the journal.

**Tech Stack:** Go 1.26, existing `internal/usage.QuotaBook`, QLTBYT broker/audit adapter, Docker Compose bind mount, focused Go tests.

## Scope boundary

- In scope: runtime wiring, journal directory configuration, deployment artifact validation, regression coverage, focused verification, and candidate-only health/readiness checks.
- In scope for evidence: the existing `ai_quota_reserve`, `ai_quota_finalize`, and `assistant_query_database_audit_log` adapter tests, a runner test proving the per-request caller reaches `QuotaBook`, and a runtime assertion that the binary uses `QuotaBook`.
- Code/test lane out of scope: SQL migrations or ad-hoc live DB writes, Phase 8.2/8.5/8.6, Phase 9, UI changes, provider changes, and redesigning restart recovery. Production 8.4 acceptance still requires a separately authorized same-subject smoke that naturally invokes the three intended RPC writes; until that evidence exists, 8.4 remains `BLOCKING / INCOMPLETE`.
- Restart recovery is explicitly not claimed: `QuotaBook.Recover` cannot reconstruct a per-user broker caller from the current journal without storing sensitive identity material. This plan does not add that storage, does not call `Recover` at startup, and must not describe readiness as “replay quarantine passed.”

## Task 1: Lock the runtime wiring failure with a regression test

**Files:**

- Modify: `services/ai-service/cmd/ai-service/main_test.go`
- Modify: `services/ai-service/cmd/ai-service/main.go` only after the red test

- [x] **Step 1: Add a red test for runtime quota-book type and default journal path.**

  Add a dedicated `quotaBook usage.Lifecycle` field to `serviceRuntime` for the construction seam. Use `validRuntimeEnv`, provide a syntactically valid `AI_DATABASE_URL`, construct the runtime, and assert that the field is a `*usage.QuotaBook` and that config uses the neutral container path `/var/lib/ai-service/usage`. Do not inspect `serviceRuntime.lifecycle`; that field is the ingress drain lifecycle.

- [x] **Step 2: Run only the new test.**

  Run: `cd services/ai-service && go test ./cmd/ai-service -run TestRuntimeUsesDurableQuotaBook -count=1`

  Expected before the implementation: compile failure or an assertion showing the runtime still uses `usage.NewMemory`.

## Task 2: Wire `QuotaBook` into the service runtime

**Files:**

- Modify: `services/ai-service/cmd/ai-service/main.go`
- Modify: `services/ai-service/cmd/ai-service/main_test.go`

- [x] **Step 1: Add `usageDir` to `runtimeConfig`.**

  Parse `AI_SERVICE_USAGE_DIR`, default to `/var/lib/ai-service/usage`, require an absolute non-root path, and keep the error redacted. The production Compose/env contract will always set the fixed neutral container target; custom overrides are test/operator-only and must not silently point into the read-only root.

- [x] **Step 2: Construct `usage.NewQuotaBook` during runtime creation.**

  Use `usage.NewQuotaBook(config.usageDir, time.Now, nil)`. Store the quota book in the runtime test seam and pass the same instance to `orchestration.Runner`; `Runner` already forwards `Prepared.QuotaCaller` in each `ReserveRequest`. Do not invent a global QLTBYT caller. If the directory cannot be created/opened, keep health available but readiness false and do not construct a runner with nil usage.

- [x] **Step 3: Keep the existing QLTBYT capability wiring unchanged.**

  Do not create a second broker or alter the `quotaCaller`; it already invokes `ai_quota_reserve` and `ai_quota_finalize` with the request's verified claims. Do not alter the existing query audit ordering or payload validation.

- [x] **Step 4: Add config and fail-closed tests.**

  Cover the default path, a valid absolute override, rejection of a relative/root path, and an unwritable journal path. Assert that `ConfigReady` is false and no runner is installed when journal initialization fails; do not expose any secret.

- [x] **Step 5: Run the focused runtime package tests.**

  Run: `cd services/ai-service && go test ./cmd/ai-service -count=1`

  Expected: PASS, with assertions proving the runtime no longer uses `usage.Memory` and fails closed on journal initialization errors.

- [x] **Step 6: Add one disposable behavioral runner test.**

  In `services/ai-service/internal/orchestration`, run a request with a prepared fake caller through a real `usage.QuotaBook` and assert one reserve and one finalize call. Keep this mock-only test separate from live evidence; the existing QLTBYT query broker tests remain the proof for sanitized SQL audit ordering and failure behavior.

## Task 3: Preserve the container's read-only security model while persisting the journal

**Files:**

- Modify: `ops/ai-service/docker-compose.yml`
- Modify: `ops/ai-service/ai-service.env.example`
- Modify: `ops/ai-service/validate-config.mjs`
- Modify: `ops/ai-service/artifact-contract.mjs`
- Modify: `ops/ai-service/rollback-runbook.vi.md`

- [x] **Step 1: Add the non-secret usage directory configuration.**

  Add `AI_SERVICE_USAGE_DIR=/var/lib/ai-service/usage` and `AI_SERVICE_USAGE_HOST_DIR=/var/lib/qltbyt-ai/usage` to the non-secret env template. Bind-mount the host directory at the fixed neutral container target. Keep the root filesystem read-only; prepare the host directory with `install -d -o 65532 -g 65532 -m 700` and verify it is not a symlink and is outside the repository. The bind mount does not enforce ownership by itself.

- [x] **Step 2: Update the disposable candidate command.**

  Add the host directory preparation/read-back and a read-write bind mount for the journal only. Preserve the existing previous-container rename/rollback sequence, record the previous container/image before mutation, and document restoration if `docker run` fails after the rename. Never remove the previous container before health/readiness pass.

- [x] **Step 3: Extend artifact/config validators.**

  Require the host usage directory variable, verify it is outside the repository, regular/non-symlink, and mode/ownership-safe; assert the Compose target and runtime env agree. Add artifact assertions for the volume, fixed target, and read-only root. Run `docker compose --env-file "$AI_SERVICE_OPERATOR_ENV" -f ops/ai-service/docker-compose.yml config --quiet` on the deployment host. Do not print secret values.

## Task 4: Verify the contract and build a candidate

**Files:**

- Modify: `openspec/changes/refactor-ai-into-shared-go-service/phase-8/phase-8-evidence.md` only after evidence is collected
- Modify: `openspec/changes/refactor-ai-into-shared-go-service/tasks.md` only if the exact acceptance evidence is complete

- [x] **Step 1: Run the required Go checks in repository order.**

  Run focused `go test ./cmd/ai-service`, `go test ./internal/usage`, and `go test ./internal/qltbyt` first, then `go test ./...`, `go vet ./...`, and `gofmt -d` checks. Run `node ops/ai-service/validate-config.mjs` and `node ops/ai-service/artifact-contract.mjs`. Run the repository's required TypeScript gates only if the diff touches TypeScript. No live SQL or Supabase CLI.

- [ ] **Step 2: Build an ARM64 image from the exact commit.**

  From `services/ai-service`, use `docker build --platform linux/arm64 --pull=false --no-cache --build-arg TARGETARCH=arm64 --build-arg VCS_REF=<clean-commit> -t qltbyt/ai-service:<clean-commit> .`; verify the clean source SHA, image digest, ARM64 binary/image architecture, and revision label with `docker inspect`. Keep the current candidate image/container as rollback.

- [ ] **Step 3: Deploy dark candidate only.**

  Candidate deployment is a separate external-operation gate: before running Docker/Oracle commands, obtain explicit authorization naming the candidate container, image, and disposable journal host path. Use the documented rename-preserving procedure and verify `/healthz=200` and `/readyz=200`; readiness proves journal initialization only, not replay recovery. Do not cut over production during this plan.

- [ ] **Step 4: Run contract tests and inspect redacted logs.**

  Confirm the existing quota and audit tests pass. A real UI smoke that invokes `ai_quota_reserve`, `ai_quota_finalize`, or the audit RPC requires a separate explicit operation-specific authorization before execution; without it, report candidate-only evidence and leave 8.4 `BLOCKING / INCOMPLETE`.

- [ ] **Step 5: Update evidence conservatively.**

  Record source/config/fixture hashes, commit, image digest, ARM64 architecture/revision label, journal mount ownership/config hash, test output, and explicit evidence status (`DISPOSABLE ONLY` or `PRODUCTION-CANDIDATE`). Production 8.4 requires post-cutover signed evidence for all three RPC behaviors on the same subject; do not infer it from a build, health probe, candidate test, or cross-subject evidence.
