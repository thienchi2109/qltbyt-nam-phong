# P7 TDD Plan - Reference Products And Baseline Evidence

> **For agentic workers:** REQUIRED: Use `superpowers:test-driven-development`
> for every behavior slice, invoke the required React/Next.js/Postgres skills
> before changing their owned files, and use
> `superpowers:verification-before-completion` before any completion claim.

## Goal

Deliver P7 as four PR-sized leaves:

1. `P7A1`: reference-product database and RPC contracts.
2. `P7A2`: reference-product authoring/comparison workspace.
3. `P7B1`: baseline/reference document and citation database/RPC contracts.
4. `P7B2`: baseline/reference evidence workspace using the P6 shared URL
   primitives.

Each leaf has one issue, one branch, one PR and one independently verifiable
deploy boundary.

## Planning-Only Boundary

This document-planning branch MUST NOT create or modify:

- runtime TypeScript/React source
- SQL migrations or Supabase tests
- generated database types
- package manifests or dependencies
- live Supabase state

Only OpenSpec planning/ownership documents may change. Runtime implementation
starts in the four leaf branches after this plan is reviewed and merged.

## Evidence And Assumptions

- Planning baseline: clean `main` at `d3d26cbd` after P6B.
- Live DB read-only inspection on 2026-07-17 shows only the dossier/baseline
  foundation tables and RPCs. No reference-product, document, citation or
  `_technical_configuration_validate_document_url` object exists.
- `TechnicalConfigurationWorkspaceShell.tsx` is the low-risk composition seam.
- `TechnicalConfigurationBaselineTab.tsx` is about 292 lines and
  `useTechnicalConfigurationBaselineEditor.ts` is about 347 lines. P7 MUST NOT
  add reference/evidence state to either file.
- GitNexus marks `callTechnicalConfigurationRpc` as CRITICAL blast radius with
  24 affected symbols and 18 affected processes. P7 adds leaf-local typed
  wrappers without changing the shared helper signature or behavior.
- P6B leaves `UrlDocumentForm`, `UrlDocumentList`, `parseAbsoluteUrl` and
  `isAllowedDocumentUrl` as controlled persistence-agnostic primitives. P7B2
  adds a consumer; it does not extend their API unless a separately approved
  prerequisite issue proves the current API insufficient.
- P7B1 depends on P7A2 so the default rollout remains
  `P7A1 -> P7A2 -> P7B1 -> P7B2`. The database contract technically needs only
  P7A1, but the stricter dependency avoids parallel branches editing the same
  copy/lock/workspace contracts.

## Alternatives Considered

### Keep The Existing Two-Leaf Split

Rejected. Each leaf combines a migration boundary, RPC allowlisting, live DB
approval, hooks/components, dirty/conflict behavior and unrelated SQL/React
verification.

### Split Backend And Workspace For Each Domain

Selected. Backend leaves can deploy unused before UI activation, while
workspace leaves consume already verified contracts without live DB writes.

### Split P7B2 Again By Baseline Owner And Reference-Product Owner

Rejected unless implementation discovery proves a new independent seam. Both
owners share one aggregate RPC, one hook, one citation editor and one cumulative
URL-document consumer contract. Splitting by owner would introduce temporary
routing branches or duplicate orchestration.

## Dependency Graph

```text
P3A + P4          -> P7A1
P7A1              -> P7A2
P4 + P6B + P7A2  -> P7B1
P7B1              -> P7B2
P7B1 + P8A4 + P9A3 -> P9B1
P6B + P7B2 + P8B2 + P9B1 -> P9B2
P7B2 + P9B2       -> P10A
```

## Cross-Leaf Contracts

### Revision And Lock Ownership

- Every descendant mutation receives `p_expected_revision`.
- Mutations lock the dossier/baseline rows in the existing P4 order.
- A stale request performs no partial write and returns `stale_revision`.
- Archived dossiers and locked versions reject every P7A1/P7B1 mutation.
- P7A2/P7B2 preserve unsaved input on conflict and provide an explicit reload
  path instead of silently overwriting local state.

### Copy Ownership

- P7A1 extends `technical_configuration_baseline_copy` for reference products
  and responses with new IDs and remapped criterion links.
- P7B1 extends the same function for baseline/reference documents and citations
  with new IDs and remapped owner/criterion links.
- Neither extension copies supplier, option, comparison-set, assessment or
  option-evidence data.

### RPC Client Boundary

- Keep `callTechnicalConfigurationRpc` unchanged.
- Add RPC name constants in domain-specific `src/lib` modules.
- Add domain wire types and typed wrappers in the technical-configurations
  module.
- Add only leaf-owned RPC names to
  `src/app/api/rpc/[fn]/allowed-functions.ts`.
- Keep query keys in `technical-configuration-query-keys.ts`; hooks own cache
  invalidation.

### File-Size Boundary

- `TechnicalConfigurationWorkspaceShell.tsx` remains composition-only.
- Do not add P7 state or handlers to `TechnicalConfigurationBaselineTab.tsx`.
- Do not add P7 mutations to `useTechnicalConfigurationBaselineEditor.ts`.
- Extract any new source file before it reaches the 350-line threshold.
- No source file may exceed the 450-line hard ceiling.

### URL Contract

- P7B1 owns exactly one
  `public._technical_configuration_validate_document_url(text) RETURNS void`.
- Accepted values require lexical `^https?://`, no raw backslash, successful URL
  parsing and parsed HTTP(S) protocol.
- Accepted raw input is stored and returned unchanged.
- Only baseline/reference document create/update RPCs call the validator in
  P7B1. List/delete/citation RPCs are non-callers.
- P9B1 later expands the exact caller set from four to six and reruns the P7B1
  SQL phase gate.

## P7A1 - Reference Product Data Contracts

**Issue goal:** Deploy reference-product persistence and RPC contracts with no
new workspace UI.

**Branch:** `feat/technical-config-p7a1-reference-contracts`

### Planned Files

- Create:
  `supabase/migrations/<ordered_timestamp>_technical_configuration_reference_products.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-reference-products-migration.test.ts`
- Create:
  `supabase/tests/technical_configuration_reference_products_phase_gate.sql`
- Create: `src/lib/technical-configuration-reference-rpcs.ts`
- Create:
  `src/app/(app)/technical-configurations/reference-product-types.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-reference-rpc.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify:
  `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`

### TDD Sequence

- [ ] Write migration/source tests for two tables, exact keys, ownership,
      cascade, deny-by-default grants, RLS posture and five RPC signatures.
- [ ] Add RED allowlist tests for only the P7A1 RPC names.
- [ ] Add RED wire/adapter tests for paginated list and mutation response shapes.
- [ ] Add the migration with `SECURITY DEFINER`, pinned
      `search_path = public, pg_temp`, JWT claim guards and exact version scope.
- [ ] Implement create/update/delete/upsert revision guards with one revision
      increment per successful mutation.
- [ ] Extend locked-baseline copy with deterministic ID remapping.
- [ ] Prove reference products remain absent from option, assessment and ranking
      contracts.
- [ ] Run focused local tests before requesting any live DB write.
- [ ] Ask for explicit permission before applying the migration through Supabase
      MCP.
- [ ] After approved apply, run the phase gate plus security/performance
      advisors.

### Focused Gate

```bash
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/technical-configuration-reference-products-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts
```

Expected:

- migration/source and allowlist tests pass
- live phase gate covers role/claim, ownership, cascade, stale revision,
  archive/lock and copy remapping
- no reference-product component or hook exists

## P7A2 - Reference Product Workspace

**Issue goal:** Add optional reference-product authoring and criterion
comparison over the verified P7A1 contracts.

**Branch:** `feat/technical-config-p7a2-reference-workspace`

### Planned Files

- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationReferenceProducts.ts`
- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceProducts.tsx`
- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceComparison.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/reference-products.test.tsx`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`

### TDD Sequence

- [ ] Write RED hook tests for list/create/update/delete/response-upsert,
      invalidation and conflict preservation.
- [ ] Write RED React tests for zero, one and many reference products.
- [ ] Add RED cases for sticky baseline requirements, dynamic selected columns,
      horizontal scrolling and long Vietnamese text.
- [ ] Add RED dirty/save/reload/locked tests with no mutation before explicit
      save.
- [ ] Implement the smallest hook over P7A1 typed wrappers.
- [ ] Implement separate product-management and comparison components.
- [ ] Compose the surface through `TechnicalConfigurationWorkspaceShell`.
- [ ] Keep evidence columns absent; P7B2 owns evidence indicators/detail.
- [ ] Run file-size and dependency checks proving no P7 state entered the
      baseline tab/editor hook.

### Focused Gate

```bash
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/reference-products.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-shell.test.tsx"
```

Expected:

- reference-product CRUD and criterion responses are user-visible
- dirty/conflict/locked behavior passes
- no document/citation UI exists

## P7B1 - Baseline And Reference Evidence Contracts

**Issue goal:** Deploy baseline/reference document and citation persistence,
authoritative URL validation and aggregate reads without activating evidence UI.

**Branch:** `feat/technical-config-p7b1-evidence-contracts`

### Planned Files

- Create:
  `supabase/migrations/<ordered_timestamp>_technical_configuration_baseline_documents.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-baseline-documents-migration.test.ts`
- Create:
  `supabase/tests/technical_configuration_baseline_documents_phase_gate.sql`
- Create: `src/lib/technical-configuration-document-rpcs.ts`
- Create: `src/app/(app)/technical-configurations/document-types.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-document-rpc.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify:
  `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`

### TDD Sequence

- [ ] Write migration/source tests for four tables, exact-version foreign keys,
      owner isolation, cascade, grants and eleven RPC signatures.
- [ ] Add RED allowlist and typed-wrapper tests for only the P7B1 RPC names.
- [ ] Write the SQL phase gate before implementation, including rollback-safe
      fixtures and revision snapshots.
- [ ] Add RED URL cases for malformed, relative, scheme-relative,
      protocol-only, single-slash, backslash and non-HTTP(S) values.
- [ ] Add RED mixed-case HTTP(S) tests proving exact raw create/update/list
      equality and no write/revision change on rejection.
- [ ] Add RED aggregate tests for discriminated owner type/ID, pagination and
      same-version nested citations.
- [ ] Add RED affected-link, stale-revision, archived/locked and copy-remapping
      tests.
- [ ] Implement the four tables, validator, aggregate list and ten mutation
      RPCs.
- [ ] Inspect `pg_get_functiondef` and prove exactly four validator callers
      before P9B1; list/delete/citation RPCs remain non-callers.
- [ ] Ask for explicit permission before applying the migration through Supabase
      MCP.
- [ ] After approved apply, run the phase gate plus security/performance
      advisors.

### Focused Gate

```bash
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/technical-configuration-baseline-documents-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts \
  src/components/url-documents/__tests__/url-document-utils.test.ts
```

Expected:

- four tables, one validator and eleven RPCs satisfy source contracts
- SQL gate passes exact owner/citation/revision/lock/copy behavior
- no new URL-document production consumer exists

## P7B2 - Baseline And Reference Evidence Workspace

**Issue goal:** Activate baseline/reference URL evidence and citation editing
through the P6 controlled primitives and P7B1 aggregate contract.

**Branch:** `feat/technical-config-p7b2-evidence-workspace`

### Planned Files

- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineDocuments.tsx`
- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationCitationEditor.tsx`
- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDocuments.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/baseline-evidence.test.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/baseline-evidence-delegation.test.tsx`
- Modify:
  `src/components/url-documents/__tests__/url-document-source-contract.test.ts`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceComparison.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`

### TDD Sequence

- [ ] Extend the cumulative consumer source-contract test first and confirm RED
      because only the Equipment consumer exists.
- [ ] Write RED runtime-delegation tests that mock exact form/list/utility
      modules and capture active props/callbacks.
- [ ] Write RED hook tests for aggregate owner routing, mutations, invalidation
      and stale-conflict preservation.
- [ ] Write RED React tests for exact raw create/update/list/render behavior,
      citations, document reuse and owner isolation.
- [ ] Add RED editable-delete affected-link confirmation and locked-delete
      no-confirmation cases.
- [ ] Add RED reference evidence indicator/detail-panel cases without permanent
      evidence columns.
- [ ] Implement the hook over P7B1 typed wrappers.
- [ ] Implement separate document and citation components using the unchanged P6
      primitives.
- [ ] Compose baseline evidence through the workspace and reference evidence
      through the reference comparison surface.
- [ ] Run long-text and responsive browser checks only after focused React tests
      pass.

### Focused Gate

```bash
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/baseline-evidence.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/baseline-evidence-delegation.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/reference-products.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx" \
  src/components/url-documents/__tests__/url-document-utils.test.ts \
  src/components/url-documents/__tests__/UrlDocumentForm.test.tsx \
  src/components/url-documents/__tests__/UrlDocumentList.test.tsx \
  src/components/url-documents/__tests__/url-document-source-contract.test.ts \
  src/components/url-documents/__tests__/url-document-source-contract-extractor.test.ts
```

Expected:

- cumulative consumer manifest is exactly Equipment + baseline
- baseline/reference owner routing and citations pass
- shared primitive APIs and Equipment behavior remain unchanged
- no source file reaches the 350-line extraction threshold
- no live DB write is required in P7B2

## Per-Leaf Quality Gate

For every TypeScript/React leaf, run in one `ctx_batch_execute` and in repository
order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
# leaf-focused Vitest command from the relevant section
node scripts/npm-run.js run react-doctor
openspec validate add-technical-configuration-comparison --type change --strict --no-interactive
git diff --check
```

For SQL leaves:

- invoke `supabase-postgres-best-practices` before migration edits
- compare migration ordering against every local migration redefining
  `technical_configuration_baseline_copy`, lock guards or related grants
- use Supabase MCP only
- stop before any live write until the user explicitly approves that exact
  migration apply
- run security and performance advisors after apply

For React/Next.js leaves:

- invoke `next-best-practices`, then `react-best-practices`
- invoke `code-deduplication` before adding shared hooks, mappers or validators
- run React Doctor after focused tests

## Delivery And Review

For each leaf:

- [ ] Create a GitHub issue with exact scope, non-goals and acceptance gate.
- [ ] Branch from clean, synchronized `main`.
- [ ] Keep the diff limited to that leaf and explicitly approved prerequisites.
- [ ] Run Code Review Graph before broad reading and GitNexus impact before
      editing selected symbols.
- [ ] Use TDD and preserve RED evidence in the handoff.
- [ ] Run the leaf gate and review the final diff.
- [ ] Dispatch one review subagent; triage findings by correctness, not by count.
- [ ] Update only that leaf's tasks after verification.
- [ ] Commit, pull with rebase, push and open a PR.
- [ ] Merge only after checks/review are resolved, then synchronize local
      `main`.
- [ ] Save one durable AgentMemory entry only for non-obvious decisions or
      findings not already captured in code/OpenSpec.

## Planning PR Verification

The current documentation-only branch is complete when:

- P7 ownership is consistently renamed to P7A1/P7A2/P7B1/P7B2 across OpenSpec
- downstream dependencies point to the correct completion leaf
- backend entities/RPCs/copy/validator belong only to P7A1/P7B1
- workspace/source-contract behavior belongs only to P7A2/P7B2
- strict OpenSpec validation passes
- formatting and `git diff --check` pass
- diff contains only OpenSpec markdown files
