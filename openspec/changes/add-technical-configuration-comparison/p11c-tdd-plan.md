# P11C Manual Assessment Client Contract Implementation Plan

> **For agentic workers:** REQUIRED: Use
> `superpowers:subagent-driven-development` or `superpowers:executing-plans` to
> implement this plan. Steps use checkbox syntax for tracking.

**Goal:** Expose the applied P11B manual-assessment RPC contract through the
existing RPC proxy, a typed module-local client, bounded TanStack Query keys and
a dormant hook for future P12A manual evaluation.

**Architecture:** Freeze the two P11B RPC names in a dedicated shared manifest,
append them to the existing proxy allowlist, and call them through the unchanged
`callTechnicalConfigurationRpc()` transport. The assessment hook reuses the
P8A4 nullable comparison-set read and the P8B2 first-save get-or-create path, so
opening a manual-evaluation context remains read-only and the first explicit
save does not introduce another comparison-set mutation adapter.

**Tech Stack:** Next.js App Router RPC proxy, TypeScript, React, TanStack Query
v5, Vitest, Testing Library.

---

## Scope And Frozen Inputs

- Start from `main` commit `eb2baae46a0333c44eb085e5de2d4ccd32d84f01`.
- P11B migrations are applied on live Supabase as registry versions
  `20260729144351` and `20260729155147`.
- Live read-only inspection on 2026-07-30 confirmed:
  - `technical_configuration_assessments_list(uuid, integer, integer)`
  - `technical_configuration_assessment_upsert(uuid, uuid, text, text, text, bigint)`
  - both functions are `SECURITY DEFINER` with
    `search_path=public, pg_temp`
  - `authenticated` and `service_role` have execute privilege
  - direct `anon`/`authenticated` table access remains denied by RLS and grants
  - upsert conflicts remain `PT409/stale_revision`
- Reuse:
  - `useTechnicalConfigurationOptionResponsesQuery()` for the P8A4 nullable
    comparison-set read
  - `getOrCreateTechnicalConfigurationComparisonSet()` from
    `technical-configuration-option-response-operations.ts` for first save
  - `callTechnicalConfigurationRpc()` for error-preserving transport
- Do not change P11B migrations, SQL tests, grants, policies or live DB state.
- Do not add P12A controls, navigation, dirty drafts, progress, ranking or AI
  runtime artifacts.

## Planned Files

- Create: `src/lib/technical-configuration-assessment-rpcs.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-assessment-rpc-whitelist.test.ts`
- Create:
  `src/app/(app)/technical-configurations/assessment-types.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-assessment-rpc.ts`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationAssessments.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/assessment-contract.test.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/assessment-hook-contract.test.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/assessment-test-fixtures.ts`
- Modify:
  `openspec/changes/add-technical-configuration-comparison/tasks.md`

## Frozen Client Contract

### Manifest

```text
technical_configuration_assessments_list
technical_configuration_assessment_upsert
```

No create/delete/bulk/ranking/AI name is added.

### Wire And Request Shapes

The assessment row preserves these exact P11B fields:

```text
id
comparison_set_id
baseline_version_id
criterion_id
technical_axis
evidence_axis
notes
revision
created_by
created_at
updated_by
updated_at
```

- `technical_axis` is
  `TechnicalConfigurationTechnicalAxis | null`.
- `evidence_axis` is
  `TechnicalConfigurationEvidenceAxis | null`.
- `notes` is the non-null string returned by P11B.
- `revision` is the assessment row revision and is never remapped to dossier or
  comparison-set revision.
- The typed adapter forwards exact `p_*` names and returns the P11B envelopes.

### Hook Contract

`useTechnicalConfigurationAssessments()` accepts:

- `optionId`
- nullable `baselineVersionId`
- `page`
- `pageSize`

The hook returns:

- the reused nullable comparison-set query
- the bounded assessment query and its exact key
- one assessment upsert mutation

Opening behavior:

- read the nullable comparison set only
- do not call list when no comparison set exists
- never call get-or-create or assessment upsert on mount

Explicit mutation input contains:

- `criterionId`
- nullable canonical `technicalAxis`
- nullable canonical `evidenceAxis`
- nullable `notes`
- assessment `expectedRevision`
- dossier `expectedDossierRevision`, used only if the comparison set is absent

First-save behavior:

1. Read the latest P8A4 query cache and, when absent, reuse the existing P8A3
   get-or-create adapter with `expectedDossierRevision`.
2. Deduplicate an in-flight comparison-set acquisition per query client,
   option and baseline so simultaneous first saves share one lifecycle call.
3. Publish the returned comparison set into the existing P8A4 query cache.
4. Call P11B assessment upsert with the returned comparison-set ID and the
   assessment row revision supplied by the caller.
5. Invalidate every bounded assessment page for the affected comparison set.
6. Return both the comparison set and saved assessment so P12A can adopt
   revisions without another read.

Existing-set behavior skips get-or-create.

Validation, authorization, archived-dossier and stale-revision failures pass
through unchanged as `TechnicalConfigurationRpcError`; the hook does not replace
their message, status or code.

## Chunk 1: RED - Manifest And Proxy Boundary

- [x] Add failing tests that require one dedicated assessment RPC manifest.
- [x] Freeze the exact two ordered names and assert no unrelated RPC names.
- [x] Require both names in `ALLOWED_FUNCTIONS`.
- [x] Require both names to reach the existing proxy boundary.
- [x] Run the focused whitelist test and confirm RED because the manifest and
      allowlist entries do not exist.

## Chunk 2: RED - Types And Adapter

- [x] Add failing contract tests for exact request and wire fields.
- [x] Require canonical P11A axis types instead of duplicated string unions.
- [x] Require exact list arguments and `AbortSignal` forwarding.
- [x] Require exact upsert arguments without renaming or normalization.
- [x] Require list and upsert errors to preserve object identity.
- [x] Run the focused assessment contract test and confirm RED.

## Chunk 3: RED - Query Key And Hook

- [x] Require the bounded key to include comparison-set ID, page and page size.
- [x] Require invalid or missing comparison-set contexts to keep list disabled.
- [x] Prove opening a missing context performs only the nullable P8A4 read.
- [x] Prove an existing context loads the bounded list with the query signal.
- [x] Prove simultaneous first saves share the existing get-or-create path
      exactly once.
- [x] Prove existing-set save skips get-or-create.
- [x] Prove the comparison-set cache is populated before assessment upsert.
- [x] Prove every bounded assessment page for the comparison set is invalidated
      after success.
- [x] Prove `PT422`, `42501`, `PT409/archived_dossier` and
      `PT409/stale_revision` errors are not caught or remapped.
- [x] Confirm RED because the key and hook do not exist.

## Chunk 4: GREEN - Minimal Implementation

- [x] Add the manifest and append its names to the proxy allowlist.
- [x] Add typed P11B request/response contracts.
- [x] Add the thin module-local assessment RPC adapter.
- [x] Add the bounded assessment query-key factory.
- [x] Add the dormant assessment hook using the existing nullable read and
      get-or-create capabilities.
- [x] Keep all production UI and workspace files unchanged.
- [x] Run focused tests until GREEN.

## Chunk 5: REFACTOR And Boundary Audit

- [x] Remove test-only duplication without adding a new shared abstraction.
- [x] Keep new source files below the 350-line extraction threshold.
- [x] Use Code Review Graph and GitNexus on the final diff.
- [x] Audit the diff for P11B persistence changes, P12A UI, ranking or AI
      artifacts.
- [x] Mark only P11C tasks complete in `tasks.md`.

## Verification

Run in this order:

1. `node scripts/npm-run.js run format:check`
2. `node scripts/npm-run.js run verify:no-explicit-any`
3. `node scripts/npm-run.js run verify:dedupe`
4. `node scripts/npm-run.js run typecheck`
5. `node scripts/npm-run.js run test -- src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`
6. `node scripts/npm-run.js run test -- src/app/api/rpc/__tests__/technical-configuration-assessment-rpc-whitelist.test.ts`
7. `node scripts/npm-run.js run test -- src/app/(app)/technical-configurations/__tests__/assessment-contract.test.ts src/app/(app)/technical-configurations/__tests__/assessment-hook-contract.test.ts`
8. `node scripts/npm-run.js run test -- src/lib/__tests__/technical-configuration-evaluation.test.ts`
9. `node scripts/npm-run.js run react-doctor`
10. `npx openspec validate add-technical-configuration-comparison --strict`

Then dispatch a subagent review for specification compliance and code quality,
address valuable findings, and rerun the affected gates.

## Exit Gate

The two applied P11B RPCs are reachable only through the existing authenticated
proxy and a typed, tested P11C client/hook surface. Opening the future
manual-evaluation context remains side-effect-free, first save reuses the
existing comparison-set lifecycle without concurrent acquisition races, all
affected assessment pages are invalidated, server errors and row revisions
remain intact, and no P11B persistence or P12A UI behavior changes.
