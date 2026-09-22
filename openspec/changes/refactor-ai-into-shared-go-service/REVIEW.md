# Review: Refactor AI into a shared Go service

**Date:** 2026-09-22
**Change:** `openspec/changes/refactor-ai-into-shared-go-service/`
**Status:** Not approved for implementation
**Scope of this review:** Proposal, design, tasks, and `specs/shared-ai-service/spec.md`, checked against the current chat route, quota SQL, SQL audit RPC, and the existing Oracle VM client. No runtime or production code was changed.

`openspec validate refactor-ai-into-shared-go-service --strict` could not be run in this environment. The OpenSpec CLI is not installed and the repo has no `openspec` package script. The change directory itself has the expected shape: `proposal.md`, `design.md`, `tasks.md`, and one delta under `specs/shared-ai-service/spec.md`. That delta uses `## ADDED Requirements`, and every requirement has at least one `#### Scenario:`.

## Verdict

The target architecture is sound, and the quota gates match the current database functions. The change is not ready to approve as an implementation contract. Several normative requirements disagree with `/api/chat` and with `assistant_query_database_audit_log`, which the QLTBYT adapter is supposed to keep.

Fix the five items under "Required before approval" in the proposal, design, tasks, and spec so they describe one behavior. The confirmation items can stay as written once they are explicitly accepted.

## What holds up

- The shared core stays app-neutral. QLTBYT keeps prompts, tools, tenant and facility scope, `ai_quota_*`, and repair-draft orchestration. Next.js remains the browser-facing authentication and stream boundary.
- Cloudflare Access credentials stay on the Next.js side. The Go service verifies HMAC over a canonical request string. That is a stronger credential than the existing device-quota VM client, which uses Access plus a static `DQSS_INTERNAL_TOKEN` (`src/app/api/device-quota/mapping/suggest/suggestion-vm-client.ts`).
- The quota analysis matches `supabase/migrations/20260521154307_ai_quota_review_hardening.sql`:
  - The expiry loop clears `reserved`, marks the reservation `expired`, and does not increment `count`.
  - `ai_quota_finalize` accepts only `success`, `error_with_usage`, and `error_no_usage`.
  - Null token and cost inputs become `0` through `COALESCE`.
  - Finalize returns immediately when the reservation is no longer `reserved`, so an expired row cannot be recovered by retrying finalize.
- Phase 0.7 and 0.8 are the right gate. Detached cleanup and the reservation TTL do not recover usage after `SIGKILL` or OOM.
- Live SQL, a Next.js runtime fallback after cutover, and edits to the predecessor checklist are correctly out of scope.
- There is no `MODIFIED` delta for `assistant-repair-drafts`. That capability is still only the pending change `add-assistant-repair-request-draft-orchestration`; it is not yet under `openspec/specs/`. After that change is archived, its route-owned wording has to be updated at cutover. Editing it inside this change would rewrite a spec that is not yet the source of truth.

## Required before approval

### 1. The SQL audit contract does not match the function that exists today

`public.assistant_query_database_audit_log` (`supabase/migrations/20260419023000_add_assistant_sql_audit_rpc.sql`) requires:

- `p_sql_shape` as text, non-empty, at most 1000 characters
- `p_tool_path` exactly `query_database`
- a numeric `user_id` claim
- `p_effective_facility_id`
- `p_facility_source` of `selected` or `session`
- `p_latency_ms`
- `p_error_class` when status is `failure`

`src/lib/ai/sql/audited-executor.ts` sends those fields by copying the browser `cookie` onto `POST /api/rpc/assistant_query_database_audit_log`.

The spec instead describes a protected audit record of request ID, capability, SQL shape or hash, scope, and outcome. The unsafe-input scenario says the record stores only those fields. A hash-only record would be rejected by the current function. Forwarding the browser cookie also conflicts with the requirement that the cookie is not Go service authentication.

Phase 0.9 should name this RPC. The decision has to choose a new caller credential for the existing function. Copying `SUPABASE_JWT_SECRET` into the shared core remains unacceptable. `src/lib/ai/server-rpc.ts` already mints a 120-second HS256 JWT with that secret for other AI RPCs. The audit path does not use that helper.

The two current audit outcomes also need to be specified separately:

- Success path: execute, write the audit, then release rows. Audit failure blocks release.
- Failure path: audit failure is swallowed and the original SQL error is rethrown. The caller still does not receive an empty successful result.

### 2. "Keep current behavior" and the unknown-usage rule cannot both be implemented

`src/lib/ai/usage-metering.ts` `classifyStreamFailure` always returns `error_with_usage` and turns missing token counts into `0`. `error_with_usage` increments the quota count. `error_no_usage` does not, which releases the reservation.

`/api/chat` also finalizes the primary stream from `onFinish`. The secondary repair-draft model call runs later in `onAfterBaseStream`, so its provider usage is outside today's reservation lifecycle.

The proposal asks to preserve assistant behavior and also forbids treating unknown usage as zero or refunding it. None of the three existing statuses can represent "unknown" without either counting fabricated zeros or releasing the reservation.

Phase 0.7 and 0.8 should be written as an intentional quota-semantics change. The approved mapping has to be added to the normative requirement before Phase 3. Parity fixtures should cover the current UI and tool behavior. They should not freeze this accounting behavior as the target contract.

### 3. The Phase 0 exit gate is ambiguous and disagrees with later phases

The Phase 0 stop line in `tasks.md` says that missing proofs, or decisions 0.7, 0.8, and 0.9 being reviewed, blocks Phase 1. Read literally, a completed review prevents the next phase.

The design and spec block Phase 2 on the data-access authentication decision and Phase 3 on the two quota decisions. Phase 1's dependency list does not include those three decisions.

One sentence needs to state which missing review blocks which phase. The current wording can be implemented in opposite ways.

### 4. The canonical `POST /v1/chat` body drops current request semantics

- `selectedFacilityName` is accepted by `src/lib/ai/chat-request-schema.ts` and rendered by `src/lib/ai/prompts/system.ts`. It is absent from the canonical body.
- Quota's `p_tenant_id` is the selected facility id. In `src/app/api/chat/route.ts`, `usageContext.tenantId` is `selectedFacilityId`. Filling `identity.tenant` from session `don_vi` would split quota counters. Phase 0 has to record which value is the quota tenant.
- A clarification response returns before `reserveUsage`. The spec says clarification skips compaction. It also needs to say that this path reserves no quota.
- `src/lib/ai/config.ts` can select `gateway`, `google`, or `openai-compatible`. The default provider is `gateway` and the default Gateway model is `google/gemini-3.1-flash-lite-preview`. The Google path also uses an in-process key pool, an hourly exhaustion reset, and pre-stream key rotation (`src/lib/ai/provider.ts`, `getKeyPoolSize` in the chat route). None of that is named. Phase 0 should list those transports and the key pool as parity scope, or explicitly retire the unused branches.

### 5. Replay protection has no numeric bounds, and it allows a snapshot with no store

The canonical HMAC string `ai-service-v1\nPOST\n/v1/chat\n<timestamp>\n<request-id>\n<key-id>\n<sha256(raw-body)>` is specified. These are not:

- MAC algorithm and signature encoding
- header names
- timestamp unit
- allowed clock skew
- replay window
- nonce-map capacity

Readiness stays false for "maximum prior-request validity plus clock skew" after every restart that has no verified snapshot. Without numbers, that outage can be arbitrarily long, and it stacks on the 60–90 second drain.

The same section allows a verified replay snapshot while saying a durable replay store is out of scope. Phase 0 should set the numbers and remove the snapshot exception, or define the snapshot without adding a database.

The 55-second Go work cap and 5-second cleanup budget are new. Today's route has one `maxDuration = 60` (`src/app/api/chat/route.ts`). Five seconds is tight for a bounded finalize retry against Supabase. Those values belong in the Phase 0 decision, with the same status as the quota gates.

## Confirm explicitly

These points match the written design. They need a direct acceptance because they change availability and operations:

- The first Go release has no previous image to roll back to. A failed candidate leaves chat unavailable. There is no return to the current Next.js orchestrator.
- One active instance means every deploy is the drain window plus the full replay quarantine.
- The Oracle VM already runs the device-quota suggestion service and the private test database. The runbook should keep this container off `qltbyt_test` credentials and give it CPU and memory limits that leave those workloads intact. HMAC should remain the chat credential. The static device-quota token should not be reused.
- Kill-switch cache times in `src/lib/ai/kill-switch.ts` are 8 seconds after a successful database read and 2 seconds after a database error. The spec only says "short".
- `src/app/api/chat/route.ts` already calls `maybeBuildRepairRequestDraftArtifact`. The open predecessor change is context. The Phase 0 baseline is the current route, not only the unarchived predecessor text.
- The plan does not pin a Go version, add a CI test and image job, or state that Vercel does not build `services/ai-service`.

## Evidence checked

| Claim in the change                                                    | Current code or SQL                                            | Result                                      |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------- |
| Expiry does not account usage                                          | `20260521154307_ai_quota_review_hardening.sql` expiry loop     | Matches                                     |
| Finalize ignores a non-`reserved` row and coerces null usage to 0      | Same migration, `ai_quota_finalize`                            | Matches                                     |
| Unknown usage must not become zero while current behavior is preserved | `classifyStreamFailure` and the three finalize statuses        | Conflict                                    |
| Audit record is request ID, capability, and SQL shape/hash             | `assistant_query_database_audit_log` and `audited-executor.ts` | Conflict                                    |
| Browser cookie is not service authentication                           | Audit writer forwards the request cookie to `/api/rpc/...`     | Current path cannot be copied as-is         |
| Draft orchestration still lives only in the predecessor proposal       | `route.ts` `onAfterBaseStream`                                 | Code already runs the draft builder         |
| 55-second work budget is the current route budget                      | `export const maxDuration = 60`                                | New split of the current 60-second budget   |
| Quota tenant is the signed generic tenant                              | `usageContext.tenantId = selectedFacilityId`                   | Must be recorded before implementation      |
| Kill switch is fail-closed with a short cache                          | Env override, then 8s / 2s cache                               | Behavior matches; durations are unspecified |
