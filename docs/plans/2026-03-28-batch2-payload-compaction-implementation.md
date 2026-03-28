# Batch 2 Payload Compaction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete Batch 2 of `refactor-assistant-tool-payload-compaction` by finishing the pass-1 migrations for `categorySuggestion` and `departmentList`, and by aligning the system prompt with the envelope contract.

**Architecture:** Keep Batch 2 scoped to two read-only / RPC tools. `categorySuggestion` moves from full-catalog retrieval to bounded candidate retrieval via a new RPC plus required `device_name`. `departmentList` stays on the shared envelope contract but does not carry `uiArtifact`. The system prompt must teach the model how to read current-turn envelope outputs without referring to legacy `{ data, total }` fields.

**Tech Stack:** Next.js App Router, AI SDK tool registry, Vitest, Supabase/Postgres SQL migrations, OpenSpec.

---

### Task 1: Lock red tests for the remaining Batch 2 gaps

**Files:**
- Modify: `src/lib/ai/tools/__tests__/category-suggestion-registry.test.ts`
- Modify: `src/lib/ai/tools/__tests__/category-suggestion-envelope.test.ts`
- Modify: `src/lib/ai/tools/__tests__/department-list-envelope.test.ts`
- Modify: `src/lib/ai/prompts/__tests__/system.test.ts`
- Modify: `src/lib/ai/prompts/__tests__/system-prompt-envelope.test.ts`
- Modify: `src/app/api/chat/__tests__/route.tool-rpc-mapping.test.ts`

**Step 1: Write failing tests**

- `categorySuggestion` must map to `ai_category_suggestion`
- `categorySuggestion` must require `device_name`
- `departmentList` must omit `uiArtifact`
- Prompt must stop teaching `total` and must teach `modelSummary.itemCount` / `uiArtifact.rawPayload.data`
- Prompt must require asking for `device_name` before `categorySuggestion`

**Step 2: Run focused tests to verify they fail**

Run:

```bash
node scripts/npm-run.js run test:run -- src/lib/ai/tools/__tests__/category-suggestion-envelope.test.ts src/lib/ai/tools/__tests__/category-suggestion-registry.test.ts src/lib/ai/tools/__tests__/department-list-envelope.test.ts src/lib/ai/prompts/__tests__/system-prompt-envelope.test.ts src/lib/ai/prompts/__tests__/system.test.ts src/app/api/chat/__tests__/route.tool-rpc-mapping.test.ts
```

Expected: failures for the old RPC name, old prompt wording, and `departmentList` `uiArtifact`.

### Task 2: Implement `categorySuggestion` pass-1 migration

**Files:**
- Modify: `src/lib/ai/tools/registry.ts`
- Modify: `src/app/api/rpc/[fn]/route.ts`
- Create: `supabase/migrations/20260328113000_add_ai_category_suggestion_rpc.sql`
- Optional modify: `src/lib/ai/tools/rpc-tool-executor.ts`

**Step 1: Write / keep migration contract test failing first**

- Add a migration-source assertion that the new SQL defines `ai_category_suggestion`
- Assert `device_name` is required and candidate retrieval is top-k bounded

**Step 2: Implement minimal code**

- Change registry mapping from `ai_category_list` to `ai_category_suggestion`
- Require `device_name` in the tool input schema
- Allow `ai_category_suggestion` through the RPC proxy
- Add the SQL migration with JWT guards, `search_path`, tenant scoping, FTS + trigram fallback, and bounded top-k candidate output

**Step 3: Run focused tests**

Run:

```bash
node scripts/npm-run.js run test:run -- src/lib/ai/tools/__tests__/category-suggestion-envelope.test.ts src/lib/ai/tools/__tests__/category-suggestion-registry.test.ts src/app/api/chat/__tests__/route.tool-rpc-mapping.test.ts
```

Expected: green for `categorySuggestion` contract and RPC mapping.

### Task 3: Finish `departmentList` envelope alignment and prompt guidance

**Files:**
- Modify: `src/lib/ai/tools/rpc-tool-executor.ts`
- Modify: `src/lib/ai/prompts/system.ts`
- Modify: `src/lib/ai/prompts/__tests__/system.test.ts`
- Modify: `src/lib/ai/prompts/__tests__/system-prompt-envelope.test.ts`
- Modify: `src/lib/ai/tools/__tests__/department-list-envelope.test.ts`

**Step 1: Keep failing tests in place**

- `departmentList` should not include `uiArtifact`
- Prompt should reference envelope access rules, not legacy `{ data, total }`

**Step 2: Implement minimal code**

- Omit `uiArtifact` for `departmentList`
- Update prompt section 4 to use `modelSummary.itemCount` for counts and `uiArtifact.rawPayload.data` for current-turn list inspection
- Update prompt section 5.3 so the assistant asks for the device name first and no longer claims access to the full category catalog

**Step 3: Run focused tests**

Run:

```bash
node scripts/npm-run.js run test:run -- src/lib/ai/tools/__tests__/department-list-envelope.test.ts src/lib/ai/prompts/__tests__/system-prompt-envelope.test.ts src/lib/ai/prompts/__tests__/system.test.ts
```

Expected: green for prompt and `departmentList` contract.

### Task 4: Verify and close Batch 2 scope

**Files:**
- Modify if needed: `openspec/changes/refactor-assistant-tool-payload-compaction/tasks.md`

**Step 1: Run required TS/React verification in order**

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- src/lib/ai/tools/__tests__/category-suggestion-envelope.test.ts src/lib/ai/tools/__tests__/category-suggestion-registry.test.ts src/lib/ai/tools/__tests__/department-list-envelope.test.ts src/lib/ai/prompts/__tests__/system-prompt-envelope.test.ts src/lib/ai/prompts/__tests__/system.test.ts src/app/api/chat/__tests__/route.tool-rpc-mapping.test.ts
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

**Step 2: Update OpenSpec tracking**

- Mark Batch 2 tasks complete only if code and focused verification are green

**Step 3: Commit**

```bash
git add src/lib/ai/tools src/lib/ai/prompts src/app/api/rpc/[fn]/route.ts supabase/migrations openspec/changes/refactor-assistant-tool-payload-compaction/tasks.md docs/plans/2026-03-28-batch2-payload-compaction-implementation.md
git commit -m "feat: complete Batch 2 assistant payload compaction"
```
