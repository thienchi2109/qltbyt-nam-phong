# Issue #271: Safe SQL Foundation For Assistant Read-Only Semantic Layer

## Summary
- Repo state: local branch `plan/issue-271-safe-sql-foundation` already exists and currently points at the same commit as `main` / `origin/main` (`8496584`); this plan assumes implementation starts from that base.
- Current production-safe assistant path is `[chat route](/root/qltbyt-nam-phong/src/app/api/chat/route.ts:113) -> [tool registry](/root/qltbyt-nam-phong/src/lib/ai/tools/registry.ts:150) -> [RPC executor](/root/qltbyt-nam-phong/src/lib/ai/tools/rpc-tool-executor.ts:189) -> [RPC proxy](/root/qltbyt-nam-phong/src/app/api/rpc/[fn]/route.ts:239) -> SQL RPCs`. That path already enforces auth, facility selection, JWT claim injection, allowlists, quotas, and error sanitization.
- Scope split is clear from GitHub: `#271` is pre-rollout foundation only; `#272` is runtime `query_database` rollout; `#273` is planner/router hardening. `#271` should therefore land a dormant end-to-end SQL foundation, but must not register `query_database` in `/api/chat` yet.
- Explicit reconciliation with the repo’s RPC-only rule: keep RPC-only as the default app-data rule. The new SQL path is a narrow server-only assistant exception that can read only `ai_readonly` views through a dedicated read-only DB identity. Curated tools stay on the existing RPC path. Any audit write for the SQL path stays on the existing JWT/RPC boundary instead of the read-only DB role.

## Repo Reconnaissance
- Required docs align on the same baseline: assistant reads must remain tenant-safe, server-enforced, and read-only. Relevant references were `docs/PRD-Vercel-AI-SDK.md`, `tasks/prd-vercel-ai-sdk-strategic-spec.md`, `openspec/project.md`, and `docs/RBAC.md`.
- The repo already contains an earlier design document for `query_database` at [docs/plans/2026-03-24-ai-query-database-refactor-plan.md](/root/qltbyt-nam-phong/docs/plans/2026-03-24-ai-query-database-refactor-plan.md:1), but that document mixes foundation and rollout. Issue `#271` should take only the foundation pieces and leave runtime registration to `#272`.
- Existing assistant query-catalog extraction was merged in PR `#274`, which intentionally split follow-up work into `#271`, `#272`, `#273`, and kept charts separate in `#270`.
- Current assistant safety seams to preserve:
  - auth/session gate in [src/app/api/chat/route.ts](/root/qltbyt-nam-phong/src/app/api/chat/route.ts:113)
  - RBAC normalization in [src/lib/rbac.ts](/root/qltbyt-nam-phong/src/lib/rbac.ts:75)
  - facility selection model in [src/contexts/TenantSelectionContext.tsx](/root/qltbyt-nam-phong/src/contexts/TenantSelectionContext.tsx:29)
  - RPC whitelist/JWT signing in [src/app/api/rpc/[fn]/route.ts](/root/qltbyt-nam-phong/src/app/api/rpc/[fn]/route.ts:239)
  - audit helper `public.audit_log(...)` in `supabase/migrations/2025-09-29/20250925_audit_logs_v2_entities_and_helper.sql`

## GitNexus Blast Radius

### Exact Files / Modules / Migrations / Tests Likely Affected
- Assistant orchestration:
  - [src/app/api/chat/route.ts](/root/qltbyt-nam-phong/src/app/api/chat/route.ts:113)
  - [src/lib/ai/prompts/system.ts](/root/qltbyt-nam-phong/src/lib/ai/prompts/system.ts:37)
  - [src/components/assistant/AssistantPanel.tsx](/root/qltbyt-nam-phong/src/components/assistant/AssistantPanel.tsx:30)
- Assistant tool boundary:
  - [src/lib/ai/tools/registry.ts](/root/qltbyt-nam-phong/src/lib/ai/tools/registry.ts:150)
  - [src/lib/ai/tools/rpc-tool-executor.ts](/root/qltbyt-nam-phong/src/lib/ai/tools/rpc-tool-executor.ts:189)
  - new `src/lib/ai/sql/*` modules for dormant SQL foundation
- Auth / RBAC / scope:
  - [src/lib/rbac.ts](/root/qltbyt-nam-phong/src/lib/rbac.ts:75)
  - [src/contexts/TenantSelectionContext.tsx](/root/qltbyt-nam-phong/src/contexts/TenantSelectionContext.tsx:29)
  - [src/auth/config.ts](/root/qltbyt-nam-phong/src/auth/config.ts:78)
- RPC boundary / audit reuse:
  - [src/app/api/rpc/[fn]/route.ts](/root/qltbyt-nam-phong/src/app/api/rpc/[fn]/route.ts:239)
  - [src/hooks/use-audit-logs.ts](/root/qltbyt-nam-phong/src/hooks/use-audit-logs.ts:1)
  - [src/lib/rpc-client.ts](/root/qltbyt-nam-phong/src/lib/rpc-client.ts:1)
- Likely new migrations:
  - one migration for `ai_readonly` schema/helpers/views/privileges
  - one migration for assistant SQL audit RPC wrapper or related observability support
- Existing migrations/patterns to reuse:
  - `20260303113000_add_ai_assistant_readonly_rpcs.sql`
  - `20260310145700_add_ai_usage_summary_rpc.sql`
  - `20260310173500_add_ai_attachment_metadata_rpc.sql`
  - `20260328113000_add_ai_category_suggestion_rpc.sql`
  - `20250927_regional_leader_schema_foundation.sql`
  - `2025-09-29/20250925_audit_logs_v2_entities_and_helper.sql`
- Tests likely affected:
  - [src/app/api/chat/__tests__/route.tools-allowlist.test.ts](/root/qltbyt-nam-phong/src/app/api/chat/__tests__/route.tools-allowlist.test.ts:1)
  - [src/app/api/chat/__tests__/route.tenant-policy.test.ts](/root/qltbyt-nam-phong/src/app/api/chat/__tests__/route.tenant-policy.test.ts:1)
  - [src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts](/root/qltbyt-nam-phong/src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts:1)
  - [src/lib/ai/tools/__tests__/rpc-tool-executor.test.ts](/root/qltbyt-nam-phong/src/lib/ai/tools/__tests__/rpc-tool-executor.test.ts:1)
  - new `src/lib/ai/sql/__tests__/*`
  - new `supabase/tests/assistant_sql_foundation_smoke.sql`

### Upstream / Downstream Dependencies
- GitNexus upstream impact on `buildToolRegistry` is low and direct only from chat route. That means the current tool-registration surface is concentrated and safe to keep unchanged in `#271`.
- GitNexus upstream impact on `executeRpcTool` is also low and limited to `registry.ts` and then chat route. That confirms the existing curated tool path can remain untouched while the dormant SQL path is built separately.
- GitNexus upstream impact on `isPrivilegedRole` shows it is shared by both [chat route](/root/qltbyt-nam-phong/src/app/api/chat/route.ts:177) and [TenantSelectionProvider](/root/qltbyt-nam-phong/src/contexts/TenantSelectionContext.tsx:35). Any single-facility scope contract should therefore reuse current role resolution instead of inventing a parallel privilege model.
- SQL function names are not indexed by GitNexus in this repo; SQL blast radius must continue to use grep/manual review for migrations and smoke tests.

### Trust Boundaries And Security-Sensitive Integration Points
- `/api/chat` is the assistant request boundary. It already owns session validation, facility resolution, quota checks, and safe error handling. `#271` may extract reusable scope resolution, but must not change public behavior.
- `/api/rpc/[fn]` is the current trusted JWT-signing boundary. The new SQL execution path must not be allowed to look like just another unvetted RPC call.
- Supabase migrations are the data boundary. `ai_readonly` must be the only surface exposed to the SQL identity.
- `public.audit_log(...)` is the established audit write seam. The SQL path should reuse it through an authenticated server-side wrapper, not invent a second audit table or write through the read-only DB role.
- `isGlobalRole()` / `isPrivilegedRole()` remain mandatory for admin/global normalization; direct string checks against `'global'` would be a regression.

### Existing Abstractions To Reuse Instead Of Bypassing
- Reuse current facility-selection semantics from [src/app/api/chat/route.ts](/root/qltbyt-nam-phong/src/app/api/chat/route.ts:172) for privileged vs local roles.
- Reuse `sanitizeErrorForClient()` from [src/lib/ai/errors.ts](/root/qltbyt-nam-phong/src/lib/ai/errors.ts:101) for surfaced SQL path failures.
- Reuse query-catalog as the source of truth for curated tools; `#271` should not merge SQL capability into catalog metadata yet unless needed for dormant contract tests.
- Reuse `public.allowed_don_vi_for_session()` / `allowed_don_vi_for_session_safe()` patterns as the model for future richer scope, but keep `#271` single-facility only.
- Reuse audit-log UI/read paths rather than adding dedicated assistant-observability UI in this issue.

## Risks / Open Questions / Architectural Conflicts
- Main architectural conflict: the repo rule is “RPC-only / no direct table access in app code,” while `query_database` requires direct SQL execution. Resolution: treat assistant SQL as a server-only exception with its own identity and semantic layer, while preserving RPC-only as the default rule for all app/business reads and writes.
- `#271` must not silently absorb `#272`. If `/api/chat` exposes `query_database` in this issue, the scope boundary between issues is broken.
- Dedicated login credentials for the SQL role cannot be fully encoded in git migrations; the migration can create grants/roles, but login password creation and `AI_DATABASE_URL` provisioning remain an ops step that must be documented.
- Audit writes cannot be performed by the read-only SQL identity. This requires a separate server-side audit write path, ideally via a thin RPC wrapper over `public.audit_log(...)`.
- Future cross-facility SQL is intentionally out of scope. Do not design the single-facility v1 contract as if it already solves `regional_leader` multi-facility ad-hoc access.

## Phase 0: Discovery / Invariants
- Target files:
  - [src/app/api/chat/route.ts](/root/qltbyt-nam-phong/src/app/api/chat/route.ts:113)
  - [src/app/api/rpc/[fn]/route.ts](/root/qltbyt-nam-phong/src/app/api/rpc/[fn]/route.ts:239)
  - [src/lib/rbac.ts](/root/qltbyt-nam-phong/src/lib/rbac.ts:75)
  - [src/contexts/TenantSelectionContext.tsx](/root/qltbyt-nam-phong/src/contexts/TenantSelectionContext.tsx:29)
  - [docs/plans/2026-03-24-ai-query-database-refactor-plan.md](/root/qltbyt-nam-phong/docs/plans/2026-03-24-ai-query-database-refactor-plan.md:1)
- Test strategy:
  - Add a red regression test proving `#271` does not expose `query_database` in `/api/chat`.
  - Add a red regression test proving the RPC proxy allowlist still excludes any direct SQL execution entrypoint.
- Expected artifacts:
  - one short architecture note or plan note codifying the assistant-only SQL exception
  - frozen invariants for single-facility scope, no runtime registration, and audit fail-closed behavior
- Dependency ordering:
  - must happen first so later phases do not accidentally turn `#271` into `#272`

## Phase 1: Tests / Verification Harness
- Target files:
  - new `src/lib/ai/sql/__tests__/query-database-guard.test.ts`
  - new `src/lib/ai/sql/__tests__/query-database-executor.test.ts`
  - new `src/lib/ai/sql/__tests__/query-database-audit.test.ts`
  - [src/app/api/chat/__tests__/route.tools-allowlist.test.ts](/root/qltbyt-nam-phong/src/app/api/chat/__tests__/route.tools-allowlist.test.ts:1)
  - [src/app/api/chat/__tests__/route.tenant-policy.test.ts](/root/qltbyt-nam-phong/src/app/api/chat/__tests__/route.tenant-policy.test.ts:1)
  - [src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts](/root/qltbyt-nam-phong/src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts:1)
  - new `supabase/tests/assistant_sql_foundation_smoke.sql`
- Test strategy:
  - Write failing tests first for:
    - single-statement enforcement
    - `SELECT` / `WITH ... SELECT` only
    - forbidden schema access
    - row limit and payload limit
    - timeout mapping to a safe error class
    - facility scope injection contract
    - audit logging on success/failure
    - non-registration in current assistant runtime
- Expected artifacts:
  - unit-level harness for SQL guardrails
  - DB smoke harness for semantic-layer and role permissions
  - explicit note that `assistant_sql_foundation_smoke.sql` is a local/DB-admin verification artifact, not a CI gate
- Dependency ordering:
  - all implementation phases should advance these tests from red to green incrementally

## Phase 2: DB Semantic Layer + Identity
- Target files:
  - one new migration for `ai_readonly` schema, scope helpers, and first approved views
  - docs/env/runbook update for `AI_DATABASE_URL` and role provisioning
- Test strategy:
  - DB smoke verifies:
    - `ai_readonly` views can be selected by the assistant SQL identity
    - raw schemas cannot be read
    - mutation attempts fail under the read-only role
    - missing session scope fails
- Expected artifacts:
  - `ai_readonly` schema
  - helper functions like `ai_readonly.current_facility_id()` or equivalent fail-closed scope resolver
  - security-barrier views for first approved semantic surface
  - `ai_query_reader` role/grants/default privileges
  - documented manual step for the passworded login role and env var provisioning
- Dependency ordering:
  - before executor implementation, because TS code should target a fixed DB contract
- Default semantic seed:
  - provisional until Phase 3 executor validation confirms the query contract; freeze the approved view list before Phase 4
  - include facility-scoped views for:
    - `equipment_search`
    - `maintenance_facts`
    - `repair_facts`
    - `usage_facts`
    - `quota_facts`
  - keep `attachmentLookup`, `categorySuggestion`, and `departmentList` on curated RPCs because their current contracts are intentionally bespoke

## Phase 3: Execution Guardrails
- Target files:
  - new `src/lib/ai/sql/client.ts`
  - new `src/lib/ai/sql/constants.ts`
  - new `src/lib/ai/sql/guardrails.ts`
  - new `src/lib/ai/sql/executor.ts`
  - new dormant `src/lib/ai/tools/query-database.ts`
  - `.env.example`
  - `package.json`
- Test strategy:
  - unit tests first for lexical guards and normalization
  - mocked executor tests for transaction-local settings and result caps
  - assert `prepare: false` and server-only import discipline
- Expected artifacts:
  - server-only `postgres` / postgres.js client
  - `AI_DATABASE_URL` contract documented as Supabase transaction-pooler connection for serverless runtime:
    - port `6543`
    - SSL required
    - dedicated login role password supplied outside git
  - prepared statements disabled with `prepare: false`
  - transaction-local hardening includes `SET LOCAL search_path = ai_readonly, pg_catalog`
  - executor with these defaults:
    - `statement_timeout = 5s`
    - `maxRows = 100`
    - `maxPayloadBytes = 64 KiB`
    - one statement only
    - `SELECT` / `WITH ... SELECT` only
    - explicit forbidden keyword/schema checks
    - sanitized SQL shape for logs
  - dormant tool wrapper that is not yet registered into `/api/chat`
- Dependency ordering:
  - after Phase 2 because the executor depends on the semantic-layer contract

## Phase 4: Scoped Server Contract
- Target files:
  - extract shared scope resolution from [src/app/api/chat/route.ts](/root/qltbyt-nam-phong/src/app/api/chat/route.ts:172)
  - small shared helper module in `src/lib/ai/` or `src/lib/ai/sql/`
- Test strategy:
  - preserve existing [route.tenant-policy.test.ts](/root/qltbyt-nam-phong/src/app/api/chat/__tests__/route.tenant-policy.test.ts:1)
  - add unit tests for:
    - local roles use session `don_vi`
    - privileged roles require selected facility
    - `admin` normalizes to global semantics
    - no caller/model-provided tenant override is accepted
- Expected artifacts:
  - one typed `AssistantSqlScope` contract carrying:
    - `effectiveFacilityId`
    - normalized role
    - user id
    - selected facility provenance
  - no duplicated privilege logic between current chat route and future SQL rollout
- Dependency ordering:
  - before future runtime registration, but included in `#271` so scope semantics are fixed before `#272`

## Phase 5: Audit / Observability
- Target files:
  - one new migration for assistant SQL audit wrapper or helper RPC
  - [src/app/api/rpc/[fn]/route.ts](/root/qltbyt-nam-phong/src/app/api/rpc/[fn]/route.ts:239)
  - new server helper for audit writes
  - [src/hooks/use-audit-logs.ts](/root/qltbyt-nam-phong/src/hooks/use-audit-logs.ts:1) for label/entity typing
- Test strategy:
  - red tests for:
    - sanitized SQL audit payload
    - latency capture
    - row count capture
    - effective scope capture
    - error-class capture
    - audit failure causing SQL path failure
  - SQL smoke proves logs show up through `audit_logs_list_v2`
- Expected artifacts:
  - dedicated authenticated audit write RPC for assistant SQL path, wrapping `public.audit_log(...)`
  - new audit action type such as `assistant_query_database`
  - structured `action_details` like:
    - `tool_path`
    - `sql_shape`
    - `latency_ms`
    - `row_count`
    - `payload_bytes`
    - `effective_facility_id`
    - `error_class`
- Dependency ordering:
  - after executor contract exists, because audit payload depends on executor outcomes

## Test Matrix
- Read-only enforcement:
  - assistant SQL identity cannot `INSERT/UPDATE/DELETE/ALTER/DROP`
  - read-only transaction default remains active even if lexical guards miss something
- Schema boundary enforcement:
  - `ai_readonly.*` succeeds
  - `public.*`, `auth.*`, `storage.*`, `graphql_public.*`, `extensions.*`, `pg_temp.*` fail before execution
- Timeout / row / payload limits:
  - long-running query maps to timeout error class
  - queries returning more than `100` rows fail with `row_limit_exceeded`
  - oversized JSON payload fails with `payload_limit_exceeded`
- Facility scope injection:
  - missing scope fails
  - local roles are pinned to session `don_vi`
  - privileged roles require selected facility
  - model/caller tenant overrides are ignored or rejected
- Forbidden statements / multi-statement rejection:
  - `select 1; select 2`
  - `set ...`
  - `copy`
  - `explain analyze`
  - `with x as (delete ...)`
  - comment-obfuscated mutations
  - all must fail guard tests
- Audit logging:
  - successful queries and rejected executions both emit sanitized audit records
  - audit record includes scope, row count, latency, and error class
  - audit failure aborts the SQL path

## Execution Batches
This plan should be executed as four small sequential batches under the same umbrella issue `#271`.

Do not open more follow-up issues unless one batch is blocked by an external dependency. Use the batches below as the working order and review checkpoints.

### Batch 1: Lock Scope And Red Tests
- Includes:
  - Phase 0
  - Phase 1, but only the regression and red-test harness portions
- Goal:
  - prove `#271` does not change current `/api/chat` runtime exposure
  - lock the safety invariants in tests before any SQL implementation begins
- Deliverables:
  - regression tests showing `query_database` is not registered
  - RPC-whitelist tests proving no accidental SQL runtime path was exposed
  - red unit tests for statement/schema/limit/scope/audit guardrails
  - placeholder or first version of `assistant_sql_foundation_smoke.sql`
- Stop condition:
  - the team can point to failing tests that define the contract, while runtime behavior is still unchanged
- Why this batch stands alone:
  - if this batch is skipped or mixed with implementation, review becomes noisy and scope drift becomes easy

### Batch 2: DB Semantic Layer And Identity
- Includes:
  - Phase 2
- Goal:
  - establish the only approved SQL-readable surface before any executor code is allowed to use it
- Deliverables:
  - migration for `ai_readonly` schema, scope helpers, grants, and first approved views
  - documented provisioning steps for the dedicated login role and `AI_DATABASE_URL`
  - local DB smoke proving read-only behavior, schema boundary enforcement, and fail-closed scope
- Stop condition:
  - the read-only SQL identity can query only the semantic layer and cannot touch raw schemas or mutate data
- Why this batch stands alone:
  - DB safety needs isolated review; mixing it with TS executor code makes privilege mistakes harder to spot

### Batch 3: Dormant Executor And Shared Scope Contract
- Includes:
  - Phase 3
  - Phase 4
- Goal:
  - build the server-side SQL executor and the shared `AssistantSqlScope` contract, but keep the tool dormant
- Deliverables:
  - `postgres` / postgres.js client wired to Supabase transaction pooler contract
  - lexical guards, result caps, timeout mapping, payload limit handling
  - extracted shared scope resolver so SQL execution cannot drift from existing `/api/chat` semantics
  - dormant `query_database` tool module that is still not registered into `/api/chat`
- Stop condition:
  - unit tests pass for guardrails and scope resolution, and the dormant tool remains unreachable from runtime chat
- Why these phases stay together:
  - splitting executor logic from scope extraction would create duplicate privilege logic and invite security drift

### Batch 4: Audit Seam And Final Hardening
- Includes:
  - Phase 5
  - final verification gates from this plan
- Goal:
  - make the dormant SQL path observable, fail-closed, and fully verified without rolling it out
- Deliverables:
  - authenticated audit RPC/helper wrapping `public.audit_log(...)`
  - audit payload coverage for success/failure/scope/latency/row-count/error-class
  - final verification proof that `#271` is still dormant at runtime and safe to hand off to `#272`
- Stop condition:
  - all non-rollout checks pass, audit behavior is covered, and runtime registration is still absent
- Why this is last:
  - audit payload shape depends on the executor outputs and final scope contract

## Recommended Implementation Order
1. Batch 1: lock scope and red tests.
2. Batch 2: build the DB semantic layer and dedicated identity.
3. Batch 3: build the dormant executor together with the shared scope contract.
4. Batch 4: add audit seam and run final verification.

## Suggested Review Rhythm
- Review Batch 1 for scope discipline and non-rollout guarantees.
- Review Batch 2 separately for grants, schema exposure, and fail-closed DB behavior.
- Review Batch 3 for server/runtime boundaries, role normalization, and guardrail correctness.
- Review Batch 4 for observability, audit completeness, and release gating into `#272`.

## Issue/PR Mapping
- Keep `#271` as the single umbrella implementation issue for these four batches.
- `#272` should not start until Batch 4 is complete, because it depends on the dormant foundation being proven safe.
- `#273` remains separate; planner/runtime selection work should not be mixed into these batches.
- If implementation is split into PRs, prefer `3` or `4` PRs that map directly to these batches rather than creating more GitHub issues.

## Do First Next
- Batch 1:
  - add route and RPC-whitelist regression tests proving `query_database` is still not live
  - add red tests for forbidden statements, schema boundaries, limits, and scope contract
- Batch 2:
  - draft the migration that creates `ai_readonly` helpers/views plus the nologin grant role
  - add the SQL smoke file before any TS executor code depends on it
- Batch 3:
  - freeze the first approved view list in tests/docs before implementing the executor
  - add `postgres` dependency and the dormant server-only executor only after the DB contract is stable
- Batch 4:
  - add the audit RPC/helper only after executor result shape and scope contract are fixed

## Must Validate Before Any Production Rollout
- The dedicated SQL identity exists in the real Supabase project and cannot read raw schemas.
- `assistant_sql_foundation_smoke.sql` passes against the linked DB.
- `node scripts/npm-run.js run verify:no-explicit-any`, `node scripts/npm-run.js run typecheck`, targeted Vitest, and `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main` all pass.
- `get_advisors(security)` is clean after migrations.
- `/api/chat` still uses curated tools only in `#271`; actual runtime registration waits for `#272`.

## Sources
- `gh issue view 271 --repo thienchi2109/qltbyt-nam-phong`
- `gh issue view 223 --repo thienchi2109/qltbyt-nam-phong`
- `gh issue view 272 --repo thienchi2109/qltbyt-nam-phong`
- `gh issue view 273 --repo thienchi2109/qltbyt-nam-phong`
- `gh pr view 274 --repo thienchi2109/qltbyt-nam-phong`
