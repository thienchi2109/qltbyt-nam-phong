# Vercel AI SDK Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate a secure, provider-agnostic Vercel AI SDK assistant into the protected app shell with read-only RPC tools and draft-only repair request generation.

**Architecture:** Add a single authenticated `/api/chat` Node route as orchestration boundary (validation, tenant policy, tool allowlist, streaming), plus a lazy-loaded global chat panel in the protected layout. All domain reads remain RPC-only via existing `/api/rpc/[fn]` gateway; no assistant write actions in v1.

**Tech Stack:** Next.js App Router, React 18, TypeScript strict, NextAuth v4, TanStack Query v5, Vercel AI SDK 6 (`ai@^6`, `@ai-sdk/react@^3`, provider package `@ai-sdk/*@^3`), Zod, Vitest.

---

## Non-Negotiable Constraints

- RPC-only data access for AI tools (`callRpc` or internal `/api/rpc/[fn]` fetch only).
- No direct `supabase.from(...)` in AI tool path.
- No user-uploaded chat attachments/multimodal in v1.
- Read-only attachment lookup is allowed in v1 only via approved RPC tools and must return short-lived signed URLs (never raw storage paths).
- Draft generation is schema-validated output only; no create/update/delete RPC invocation from chat route.
- Auth check must run before model/tool execution.
- Tenant isolation and role behavior must mirror existing app rules.
- Budget and abuse guardrails are mandatory: output token cap, tool-step cap, rate limit, quota checks, and usage telemetry.

---

## Pre-Implementation Setup

### Task 0: Baseline, Dependencies, and Test Harness

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Create: `src/app/api/chat/__tests__/route.setup.test.ts`
- Create: `src/components/assistant/__tests__/AssistantPanel.setup.test.tsx`

**Step 1: Write failing API route smoke test (RED)**

```ts
// src/app/api/chat/__tests__/route.setup.test.ts
import { describe, it, expect } from 'vitest'
import { POST } from '../route'

describe('/api/chat setup', () => {
  it('returns 401 when session missing', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })
})
```

**Step 2: Run test to confirm fail**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.setup.test.ts"
```
Expected: FAIL (route does not exist yet).

**Step 3: Add dependencies and env placeholders**
- Add runtime deps pinned for AI SDK 6 line:
  - `ai@^6.0.0`
  - `@ai-sdk/react@^3.0.0`
  - `@ai-sdk/google@^3.0.0` (or chosen first provider package in `@ai-sdk/*@^3.0.0`)
- Add env keys:
  - `AI_PROVIDER=google`
  - `AI_MODEL=gemini-2.5-flash`
  - `GOOGLE_GENERATIVE_AI_API_KEY=`
  - optional future provider placeholders (anthropic/gateway).

**Step 4: Add minimal route stub to satisfy setup test (GREEN)**
- Implement temporary `/api/chat` route with auth gate returning 401 if unauthenticated.

**Step 5: Re-run setup test**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.setup.test.ts"
```
Expected: PASS.

**Step 6: Commit**

```bash
git add package.json .env.example src/app/api/chat/route.ts src/app/api/chat/__tests__/route.setup.test.ts
git commit -m "feat: [US-002] - establish /api/chat scaffold and AI SDK dependencies"
```

---

## Phase 1 (US-002, US-007): Secure Chat API + Provider-Agnostic Contract

### Task 1: Auth, Request Schema, and Streaming Route

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Create: `src/lib/ai/chat-request-schema.ts`
- Create: `src/lib/ai/provider.ts`
- Create: `src/lib/ai/prompts/system.ts`
- Create: `src/lib/ai/prompts/__tests__/system.test.ts`
- Create: `src/app/api/chat/__tests__/route.auth-and-schema.test.ts`

**Step 1: Write failing auth test (RED)**
- Add test cases:
  - missing session => `401`
  - malformed payload => `400`
  - malformed messages item => `400`
  - valid payload with authenticated session reaches model call path.
  - route uses prompt from `src/lib/ai/prompts/system.ts` (versioned prompt wiring).

**Step 2: Run failing auth/schema tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.auth-and-schema.test.ts"
```
Expected: FAIL for missing validation/auth behavior.

**Step 3: Implement minimal secure route (GREEN)**
- In `route.ts`:
  - `export const runtime = 'nodejs'`
  - `export const maxDuration = 30`
  - `getServerSession(authOptions)` before any AI SDK call.
  - parse and validate body using `chat-request-schema.ts`.
  - load system prompt via `buildSystemPrompt(...)` from `src/lib/ai/prompts/system.ts`.
  - call `streamText({ model, messages: await convertToModelMessages(...) })`.
  - return `result.toUIMessageStreamResponse()`.
- In `provider.ts`:
  - resolve model from env (`AI_PROVIDER`, `AI_MODEL`) server-side only.
  - no provider-specific code in UI.

**Step 4: Re-run tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.auth-and-schema.test.ts"
```
Expected: PASS.

**Step 5: Refactor + static checks**

Run:
```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run lint -- --file "src/app/api/chat/route.ts"
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/app/api/chat/route.ts src/lib/ai/chat-request-schema.ts src/lib/ai/provider.ts src/lib/ai/prompts/system.ts src/lib/ai/prompts/__tests__/system.test.ts src/app/api/chat/__tests__/route.auth-and-schema.test.ts
git commit -m "feat: [US-002][US-007] - secure schema-validated provider-agnostic chat route"
```

---

### Task 1A: Versioned System Prompt Module (Explicit, Testable, Changeable)

**Files:**
- Create: `src/lib/ai/prompts/system.ts`
- Create: `src/lib/ai/prompts/types.ts`
- Create: `src/lib/ai/prompts/__tests__/system.test.ts`
- Create: `docs/ai/system-prompt-changelog.md`
- Modify: `src/app/api/chat/route.ts`

**Step 1: Write failing prompt module tests (RED)**
- `SYSTEM_PROMPT_VERSION` exists and matches `v<major>.<minor>.<patch>`.
- `buildSystemPrompt(ctx)` includes:
  - read-only policy
  - tenant-safety policy
  - no user-upload/multimodal policy (attachment lookup allowed only via read-only signed-URL tool outputs)
  - clear "Fact vs Inference vs Draft" response contract
  - Vietnamese-first response requirement.
- prompt builder is deterministic for same input context.
- route consumes `buildSystemPrompt` (not inline hard-coded prompt text).

**Step 2: Run failing prompt tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/lib/ai/prompts/__tests__/system.test.ts"
```
Expected: FAIL.

**Step 3: Implement minimal prompt module (GREEN)**
- Add `SYSTEM_PROMPT_VERSION = 'v1.0.0'`.
- Add `buildSystemPrompt(context)` with sectioned blocks:
  - Identity and language
  - Security and tenant boundaries
  - Tool usage constraints
  - Output contract and tone
  - Failure behavior and guidance.
- Update `/api/chat` to use prompt module output.

**Step 4: Re-run prompt tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/lib/ai/prompts/__tests__/system.test.ts"
```
Expected: PASS.

**Step 5: Add prompt change policy document**
- In `docs/ai/system-prompt-changelog.md`, define:
  - version bump rules (`major` policy change, `minor` behavior expansion, `patch` wording fix),
  - required tests for each bump,
  - date + rationale entry format.

**Step 6: Commit**

```bash
git add src/lib/ai/prompts/system.ts src/lib/ai/prompts/types.ts src/lib/ai/prompts/__tests__/system.test.ts docs/ai/system-prompt-changelog.md src/app/api/chat/route.ts
git commit -m "feat: [US-002] - add versioned system prompt module with tests and changelog"
```

---

### Task 1B: Budget and Abuse Guardrails (Token/Cost/Rate)

**Files:**
- Create: `src/lib/ai/limits.ts`
- Create: `src/lib/ai/usage-metering.ts`
- Modify: `src/app/api/chat/route.ts`
- Create: `src/app/api/chat/__tests__/route.limits.test.ts`
- Create: `src/app/api/chat/__tests__/route.rate-limit-and-quota.test.ts`

**Step 1: Write failing guardrail tests (RED)**
- route enforces `maxOutputTokens` on model call.
- route enforces max tool-step count (`stopWhen: stepCountIs(...)`).
- route rejects excessive chat history/input size with safe `400`.
- rate-limited users receive `429`.
- over-quota users/tenants receive `429` and safe budget message.

**Step 2: Run failing guardrail tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.limits.test.ts" "src/app/api/chat/__tests__/route.rate-limit-and-quota.test.ts"
```
Expected: FAIL.

**Step 3: Implement minimal guardrail layer (GREEN)**
- Add `limits.ts` defaults (env-configurable):
  - `AI_MAX_OUTPUT_TOKENS`
  - `AI_MAX_TOOL_STEPS`
  - `AI_MAX_MESSAGES`
  - `AI_MAX_INPUT_CHARS`
- In `route.ts`, apply:
  - `maxOutputTokens`
  - `stopWhen: stepCountIs(AI_MAX_TOOL_STEPS)`
  - bounded/truncated/validated input.
- Add `usage-metering.ts` hook points:
  - record request token usage and estimated cost.
  - enforce per-user/tenant request throttling and quota checks (implementation can start in-memory; phase-upgradable).

**Step 4: Re-run tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.limits.test.ts" "src/app/api/chat/__tests__/route.rate-limit-and-quota.test.ts"
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/limits.ts src/lib/ai/usage-metering.ts src/app/api/chat/route.ts src/app/api/chat/__tests__/route.limits.test.ts src/app/api/chat/__tests__/route.rate-limit-and-quota.test.ts
git commit -m "feat: [US-002] - add AI token, rate, and quota guardrails"
```

---

## Phase 2 (US-003, US-004): RPC-Only Tooling and Tenant Context Policy

### Task 2: Tool Allowlist and Tenant Context Enforcement

**Files:**
- Create: `src/lib/ai/tools/registry.ts`
- Create: `src/lib/ai/tools/rpc-tool-executor.ts`
- Modify: `src/app/api/chat/route.ts`
- Create: `src/app/api/chat/__tests__/route.tools-allowlist.test.ts`
- Create: `src/app/api/chat/__tests__/route.tenant-policy.test.ts`

**Step 1: Write failing allowlist tests (RED)**
- unknown tool name blocked.
- tool not in allowlist blocked.
- write-intent tool names (`create`, `update`, `delete`) blocked.

**Step 2: Write failing tenant policy tests (RED)**
- privileged role + `selectedFacilityId: undefined` => guidance response (no tool execution).
- non-privileged role ignores unsafe tenant override attempts.
- privileged + specific facility allows scoped tool execution.

**Step 3: Run both test files to confirm fail**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.tools-allowlist.test.ts" "src/app/api/chat/__tests__/route.tenant-policy.test.ts"
```
Expected: FAIL.

**Step 4: Implement minimal policy layer (GREEN)**
- `registry.ts`: static tool map (read-only v1).
- `rpc-tool-executor.ts`: only call internal `/api/rpc/[fn]` with forwarded cookie/session context.
- `route.ts`: enforce tenant policy before tool execution.

**Step 5: Re-run tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.tools-allowlist.test.ts" "src/app/api/chat/__tests__/route.tenant-policy.test.ts"
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/lib/ai/tools/registry.ts src/lib/ai/tools/rpc-tool-executor.ts src/app/api/chat/route.ts src/app/api/chat/__tests__/route.tools-allowlist.test.ts src/app/api/chat/__tests__/route.tenant-policy.test.ts
git commit -m "feat: [US-003][US-004] - enforce RPC-only AI tools with tenant-aware policy"
```

---

## Phase 3 (US-005, US-006): Read-Only Domain Tools + Draft Generator

### Task 3: Read-Only Domain Toolset

**Files:**
- Create: `src/lib/ai/tools/equipment-tools.ts`
- Create: `src/lib/ai/tools/maintenance-tools.ts`
- Create: `src/lib/ai/tools/repair-tools.ts`
- Create: `src/lib/ai/tools/usage-tools.ts`
- Create: `src/lib/ai/tools/attachment-tools.ts`
- Modify: `src/lib/ai/tools/registry.ts`
- Modify: `src/lib/ai/prompts/system.ts`
- Modify: `src/lib/ai/prompts/__tests__/system.test.ts`
- Create: `src/app/api/chat/__tests__/route.readonly-tools.test.ts`
- Create: Supabase RPC function `ai_maintenance_plan_lookup` (migration)

**Step 1: Write failing read-only tool tests (RED)**
- equipment lookup uses approved RPC fn only.
- maintenance summary uses approved RPC fn only.
- **maintenance plan lookup** uses new `ai_maintenance_plan_lookup` RPC fn only.
- repair summary uses approved RPC fn only.
- usage history lookup uses approved RPC fn only.
- attachment retrieval only provides secured short-lived signed URLs + file metadata from `file_dinh_kem` via approved read-only RPC (no direct Storage API calls in AI tool path).
- tool responses are tagged/structured as factual retrieval outputs.
- AI utilizes equipment usage frequency (from `nhat_ky_su_dung` via RPC) to correctly advocate maintenance cycle changes.

**Step 2: Run failing read-only tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.readonly-tools.test.ts"
```
Expected: FAIL.

**Step 3: Implement all tool execute functions + deploy `ai_maintenance_plan_lookup` RPC (GREEN)**

**3a. Deploy `ai_maintenance_plan_lookup` RPC migration**

Create a new Supabase read-only RPC function that JOINs `cong_viec_bao_tri` with `ke_hoach_bao_tri` and `thiet_bi` tables. This is the dedicated AI tool data source for maintenance plan queries.

**Database tables involved:**
- `ke_hoach_bao_tri` — plan header: `id`, `ten_ke_hoach`, `nam`, `loai_cong_viec`, `trang_thai` (Bản nháp / Đã duyệt / Không duyệt), `khoa_phong`, `don_vi`, `ngay_phe_duyet`, `nguoi_duyet`.
- `cong_viec_bao_tri` — task detail per equipment: `id`, `ke_hoach_id` → `ke_hoach_bao_tri.id`, `thiet_bi_id` → `thiet_bi.id`, `loai_cong_viec`, `don_vi_thuc_hien`, `diem_hieu_chuan`, `thang_1..12` (boolean scheduled), `thang_1_hoan_thanh..12` (boolean completed), `ngay_hoan_thanh_1..12` (timestamptz), `ghi_chu`.

**RPC signature:**

```sql
CREATE OR REPLACE FUNCTION public.ai_maintenance_plan_lookup(
  p_thiet_bi_id  bigint,
  p_nam          integer  DEFAULT NULL,   -- filter by year; NULL = all years
  p_don_vi       bigint   DEFAULT NULL    -- tenant filter; overridden by JWT for non-privileged roles
)
RETURNS TABLE (
  plan_id            bigint,
  ten_ke_hoach       text,
  nam                integer,
  loai_cong_viec     text,
  plan_trang_thai    text,
  ngay_phe_duyet     timestamptz,
  task_id            bigint,
  don_vi_thuc_hien   text,
  diem_hieu_chuan    text,
  thang_1            boolean, thang_2  boolean, thang_3  boolean,
  thang_4            boolean, thang_5  boolean, thang_6  boolean,
  thang_7            boolean, thang_8  boolean, thang_9  boolean,
  thang_10           boolean, thang_11 boolean, thang_12 boolean,
  thang_1_hoan_thanh  boolean, thang_2_hoan_thanh  boolean, thang_3_hoan_thanh  boolean,
  thang_4_hoan_thanh  boolean, thang_5_hoan_thanh  boolean, thang_6_hoan_thanh  boolean,
  thang_7_hoan_thanh  boolean, thang_8_hoan_thanh  boolean, thang_9_hoan_thanh  boolean,
  thang_10_hoan_thanh boolean, thang_11_hoan_thanh boolean, thang_12_hoan_thanh boolean,
  ghi_chu            text,
  -- equipment context (denormalized for AI convenience)
  ma_thiet_bi        text,
  ten_thiet_bi       text,
  model              text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
BEGIN
  -- Tenant isolation: non-privileged roles forced to their own tenant
  IF v_role NOT IN ('global', 'admin', 'regional_leader') THEN
    p_don_vi := v_don_vi::bigint;
  END IF;

  RETURN QUERY
  SELECT
    kh.id        AS plan_id,
    kh.ten_ke_hoach,
    kh.nam,
    kh.loai_cong_viec,
    kh.trang_thai AS plan_trang_thai,
    kh.ngay_phe_duyet,
    cv.id        AS task_id,
    cv.don_vi_thuc_hien,
    cv.diem_hieu_chuan,
    cv.thang_1,  cv.thang_2,  cv.thang_3,
    cv.thang_4,  cv.thang_5,  cv.thang_6,
    cv.thang_7,  cv.thang_8,  cv.thang_9,
    cv.thang_10, cv.thang_11, cv.thang_12,
    cv.thang_1_hoan_thanh,  cv.thang_2_hoan_thanh,  cv.thang_3_hoan_thanh,
    cv.thang_4_hoan_thanh,  cv.thang_5_hoan_thanh,  cv.thang_6_hoan_thanh,
    cv.thang_7_hoan_thanh,  cv.thang_8_hoan_thanh,  cv.thang_9_hoan_thanh,
    cv.thang_10_hoan_thanh, cv.thang_11_hoan_thanh, cv.thang_12_hoan_thanh,
    cv.ghi_chu,
    tb.ma_thiet_bi,
    tb.ten_thiet_bi,
    tb.model
  FROM cong_viec_bao_tri cv
  JOIN ke_hoach_bao_tri  kh ON kh.id = cv.ke_hoach_id
  JOIN thiet_bi          tb ON tb.id = cv.thiet_bi_id
  WHERE cv.thiet_bi_id = p_thiet_bi_id
    AND (p_nam IS NULL OR kh.nam = p_nam)
    AND (p_don_vi IS NULL OR kh.don_vi = p_don_vi)
  ORDER BY kh.nam DESC, kh.loai_cong_viec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ai_maintenance_plan_lookup TO authenticated;
```

**Design notes:**
- `SECURITY DEFINER` + `SET search_path = public` + `STABLE`: read-only, follows the project's mandated RPC security model (no RLS; tenant isolation via JWT-claim enforcement).
- Non-privileged roles have `p_don_vi` forcibly overridden from `request.jwt.claims->>'don_vi'`, matching the standard RPC template.
- `GRANT EXECUTE ... TO authenticated` restricts access to authenticated callers only.

**3b. Implement all tool execute functions**

- Each tool has explicit `inputSchema` (Zod) and deterministic RPC mapping.
- No tool may call mutation RPCs.
- Equipment lookup, repair summary, usage history, and attachment retrieval tools each use their respective approved read-only RPC functions.

`maintenance-tools.ts` specifically must expose **three** AI tool capabilities:

| Tool name | RPC | Purpose |
|---|---|---|
| `maintenanceSummary` | `maintenance_tasks_list_with_equipment` (existing) | General overview of all maintenance tasks at the current facility (supports filter by `p_loai_cong_viec`). |
| `maintenancePlanLookup` | `ai_maintenance_plan_lookup` (**new**) | Look up the yearly maintenance/calibration/inspection plan for a **specific equipment** (`p_thiet_bi_id`), returning 12-month scheduled vs. completed status per plan type. |
| `maintenanceUpcoming` | Equipment-level fields on `thiet_bi` table via `equipmentLookup` | Check `ngay_bt_tiep_theo`, `ngay_hc_tiep_theo`, `ngay_kd_tiep_theo` deadlines for upcoming maintenance. This reuses equipment lookup data, no separate RPC needed. |

**AI prompt guidance for `maintenancePlanLookup`:**
- When the user asks about a specific equipment's maintenance/calibration/inspection schedule → call `maintenancePlanLookup` with the equipment ID.
- Present results as a readable table: plan name, type (`bảo trì` / `hiệu chuẩn` / `kiểm định`), year, and a 12-column month grid showing ✅ (completed) / 🔲 (scheduled but pending) / ─ (not scheduled).
- If a scheduled month is overdue (current month has passed but `thang_X_hoan_thanh = false`), flag it with ⚠️.

**3c. Update system prompt**

Update `system.ts` tool-instruction block to describe the expanded read-only toolset, factual citation behavior, and predictive maintenance suggestions (i.e. if usage frequency is exceptionally high, proactively recommend shortening the maintenance cycle); bump prompt version if behavior changes.

**Step 4: Re-run tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.readonly-tools.test.ts"
```
Expected: PASS.

**Step 5: Refactor + static checks**

Run:
```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run lint -- --file "src/lib/ai/tools/maintenance-tools.ts"
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/lib/ai/tools/equipment-tools.ts src/lib/ai/tools/maintenance-tools.ts src/lib/ai/tools/repair-tools.ts src/lib/ai/tools/usage-tools.ts src/lib/ai/tools/attachment-tools.ts src/lib/ai/tools/registry.ts src/lib/ai/prompts/system.ts src/lib/ai/prompts/__tests__/system.test.ts src/app/api/chat/__tests__/route.readonly-tools.test.ts
git commit -m "feat: [US-005] - add read-only AI tools with maintenance plan lookup and usage/attachment features"
```

### Task 4: AI Diagnostic & Remediation Generation (Troubleshooting Assistant)

**Files:**
- Create: `src/lib/ai/draft/troubleshooting-schema.ts`
- Create: `src/lib/ai/draft/troubleshooting-tool.ts`
- Modify: `src/lib/ai/tools/registry.ts`
- Modify: `src/lib/ai/prompts/system.ts`

**Step 1: Write failing diagnostic tests (RED)**
- generated diagnostic plan validates against Zod schema (problem context, potential causes, step-by-step remediation).
- tool correctly correlates equipment model/type from context if available.
- **Context Dependency Test**: ensure diagnostic tool is only processed if RAG context has been retrieved first.

**Step 2: Implement minimal diagnostic tool & RAG Instructions (GREEN)**
- Return typed object with structured troubleshooting steps:
  - `equipment_context` (chủng loại, model)
  - `probable_causes` (danh sách nguyên nhân có thể xảy ra)
  - `remediation_steps` (các bước khắc phục)
- **RAG System Prompt Update (`system.ts`)**: 
  - Strictly instruct the AI that it **MUST NOT** hallucinate medical equipment repairs based on general knowledge.
  - Instruct the AI to explicitly execute `equipmentLookup` and `repairSummary` tools FIRST, specifically searching for historical solutions to similar issues.
  - Only after gathering internal historical context, invoke the `troubleshooting-tool` to map `probable_causes` and `remediation_steps`.

**Step 3: Commit**

```bash
git add src/lib/ai/draft/troubleshooting-schema.ts src/lib/ai/draft/troubleshooting-tool.ts src/lib/ai/tools/registry.ts src/lib/ai/prompts/system.ts
git commit -m "feat: [US-009] - add schema-validated AI diagnostic and remediation tool"
```

### Task 4.5: Draft Repair Request Object Generation (No Submission)

**Files:**
- Create: `src/lib/ai/draft/repair-request-draft-schema.ts`
- Create: `src/lib/ai/draft/repair-request-draft-tool.ts`
- Modify: `src/lib/ai/tools/registry.ts`
- Modify: `src/lib/ai/prompts/system.ts`
- Modify: `src/lib/ai/prompts/__tests__/system.test.ts`
- Create: `src/app/api/chat/__tests__/route.draft-output.test.ts`

**Step 1: Write failing draft tests (RED)**
- generated draft validates against strict Zod schema.
- missing required draft fields => schema failure.
- draft flow never calls create/update/delete RPCs.

**Step 2: Run failing draft tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.draft-output.test.ts"
```
Expected: FAIL.

**Step 3: Implement minimal draft tool (GREEN)**
- Return typed object aligned with repair form fields:
  - `thiet_bi_id?`
  - `mo_ta_su_co`
  - `hang_muc_sua_chua`
  - `ngay_mong_muon_hoan_thanh?`
  - `don_vi_thuc_hien?`
  - `ten_don_vi_thue?`
- Attach `draftOnly: true` metadata.
- Update `system.ts` output-contract section to enforce "Draft does not submit" language and explicit `Fact/Inference/Draft` labels; bump version when behavior changes.

**Step 4: Re-run tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.draft-output.test.ts"
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/draft/repair-request-draft-schema.ts src/lib/ai/draft/repair-request-draft-tool.ts src/lib/ai/tools/registry.ts src/lib/ai/prompts/system.ts src/lib/ai/prompts/__tests__/system.test.ts src/app/api/chat/__tests__/route.draft-output.test.ts
git commit -m "feat: [US-006] - add schema-validated repair-request draft generation tool"
```

---

## Phase 4 (US-001): Global Protected Chat UI

### Task 5: Assistant Panel UI + Layout Integration

> **See dedicated Design Plan:** `docs/plans/2026-03-01-assistant-chat-ui-design.md` for complete UI/UX specifications, styling, and micro-interactions.

**Files:**
- Create: `src/components/assistant/AssistantTriggerButton.tsx`
- Create: `src/components/assistant/AssistantPanel.tsx`
- Create: `src/components/assistant/AssistantComposer.tsx`
- Create: `src/components/assistant/AssistantMessageList.tsx`
- Create: `src/components/assistant/AssistantSuggestedQuestions.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Create: `src/components/assistant/__tests__/AssistantPanel.ui.test.tsx`
- Create: `src/app/(app)/__tests__/layout.assistant-integration.test.tsx`

**Step 1: Write failing UI behavior tests (RED)**
- assistant trigger visible only in authenticated protected layout.
- panel opens/closes.
- input/send disabled whenever status is not `ready`.
- no user attachment controls rendered.
- exactly 3 suggested question chips render in chat UI.
- clicking a suggested question sends a user message immediately (quick ask).
- suggested question chips are disabled while status is not `ready`.

**Step 2: Run failing UI tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/components/assistant/__tests__/AssistantPanel.ui.test.tsx" "src/app/(app)/__tests__/layout.assistant-integration.test.tsx"
```
Expected: FAIL.

**Step 3: Implement minimal UI (GREEN)**
- Use `useChat` from `@ai-sdk/react`.
- Pass tenant metadata from `useTenantSelection()`.
- Lazy-load panel (`next/dynamic`) to keep initial bundle lean.
- Respect existing overlay layering contract in `docs/frontend/layering.md`.
- Add `AssistantSuggestedQuestions` with 3 default Vietnamese prompts:
  - `Thiết bị nào sắp đến hạn bảo trì trong 30 ngày tới?`
  - `Có bao nhiêu yêu cầu sửa chữa đang chờ xử lý tại cơ sở hiện tại?`
  - `Tóm tắt các thiết bị đang cần ưu tiên xử lý hôm nay.`
- Wire chip click to quick-send via chat action (not just prefill input).
- Show chips when conversation is empty (or until first user message), then hide.

**Step 4: Re-run tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/components/assistant/__tests__/AssistantPanel.ui.test.tsx" "src/app/(app)/__tests__/layout.assistant-integration.test.tsx"
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/assistant src/app/(app)/layout.tsx src/components/assistant/__tests__/AssistantPanel.ui.test.tsx src/app/(app)/__tests__/layout.assistant-integration.test.tsx
git commit -m "feat: [US-001] - add global protected assistant panel with status-aware composer"
```

---

## Phase 5 (US-008): Error Safety, Guidance, and Retry UX

### Task 6: Safe Error Surface and User Guidance

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Create: `src/lib/ai/errors.ts`
- Modify: `src/components/assistant/AssistantPanel.tsx`
- Create: `src/app/api/chat/__tests__/route.error-safety.test.ts`
- Create: `src/components/assistant/__tests__/AssistantPanel.error-state.test.tsx`

**Step 1: Write failing error safety tests (RED)**
- server returns sanitized messages only (no keys, secrets, stack internals).
- missing tenant selection returns explicit Vietnamese guidance.
- retry action visible and re-submits failed request.

**Step 2: Run failing tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.error-safety.test.ts" "src/components/assistant/__tests__/AssistantPanel.error-state.test.tsx"
```
Expected: FAIL.

**Step 3: Implement minimal safe error and retry handling (GREEN)**
- normalize route exceptions into public-safe envelopes.
- render retry state in panel composer/history region.

**Step 4: Re-run tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.error-safety.test.ts" "src/components/assistant/__tests__/AssistantPanel.error-state.test.tsx"
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/chat/route.ts src/lib/ai/errors.ts src/components/assistant/AssistantPanel.tsx src/app/api/chat/__tests__/route.error-safety.test.ts src/components/assistant/__tests__/AssistantPanel.error-state.test.tsx
git commit -m "feat: [US-008] - add safe error handling, tenant guidance, and retry UX"
```

---

## Phase 6: Full Verification, Browser Validation, and Documentation

### Task 7: End-to-End Quality Gates and Manual Verification

**Files:**
- Modify: `docs/PRD-Vercel-AI-SDK.md` (checkboxes/status notes if required by process)
- Modify: `tasks/prd-vercel-ai-sdk-strategic-spec.md` (implementation status updates if needed)
- Create: `docs/testing/2026-03-01-vercel-ai-sdk-manual-verification.md`

**Step 1: Run full test suite**

Run:
```bash
node scripts/npm-run.js run test:run
```
Expected: PASS.

**Step 2: Run typecheck + lint**

Run:
```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run lint
```
Expected: PASS.

**Step 3: Manual browser verification checklist**
- Authenticated user sees AI trigger in protected layout.
- Unauthenticated user cannot access `/api/chat`.
- Composer disabled during streaming.
- No user attachment upload UI.
- Three suggested question chips are visible on first open.
- Clicking a suggested chip submits a user question immediately.
- Requests exceeding limits return safe message (no internal details).
- Rapid repeated requests hit rate limit with predictable UX state.
- Tenant-missing privileged scenario shows Vietnamese guidance.
- Draft response appears as structured draft and is not auto-submitted.

**Step 4: Record verification evidence**
- Save screenshots/log notes in `docs/testing/2026-03-01-vercel-ai-sdk-manual-verification.md`.

**Step 5: Final commit**

```bash
git add docs/testing/2026-03-01-vercel-ai-sdk-manual-verification.md docs/PRD-Vercel-AI-SDK.md tasks/prd-vercel-ai-sdk-strategic-spec.md
git commit -m "feat: [US-001..US-008] - finalize verification and documentation for Vercel AI SDK integration"
```

---

## Vercel React/Next Performance Rules Applied in This Plan

- `async-api-routes`: start independent route operations early, await late.
- `server-auth-actions` (applies equivalently to route handlers): authenticate/authorize in the route itself.
- `bundle-dynamic-imports`: lazy-load assistant panel and heavy chat UI.
- `bundle-conditional`: only load optional tool UI/renderers when feature active.
- `server-serialization`: pass minimal props to client chat components.

---

## AI SDK 6 Compatibility Guardrails (Critical)

- Use route-handler/UI patterns that are valid in AI SDK 6:
  - `streamText(...)`
  - `convertToModelMessages(...)`
  - `result.toUIMessageStreamResponse(...)`
  - `useChat` from `@ai-sdk/react` (transport-based architecture).
- Do not use legacy 4.x streaming helpers in new code:
  - `toDataStreamResponse`
  - `pipeDataStreamToResponse`
  - old data-stream adapter response helpers.
- If implementation starts from existing 4.x/5.x snippets, run codemod guidance before merge:
  - `npx @ai-sdk/codemod v6` (review output before commit).

---

## System Prompt Versioning Rules (Critical)

- Single source of truth: `src/lib/ai/prompts/system.ts`.
- Never inline the full system prompt directly inside `route.ts`.
- Every semantic behavior change to assistant policy requires:
  - prompt version bump in `SYSTEM_PROMPT_VERSION`,
  - updated tests in `src/lib/ai/prompts/__tests__/system.test.ts`,
  - changelog entry in `docs/ai/system-prompt-changelog.md`.
- Version bump policy:
  - `major`: safety model or permission-policy changes.
  - `minor`: new behavior block (new tool class, new output mode).
  - `patch`: wording/clarity-only changes with no policy shift.
- CI/test gate for prompt changes:
  - prompt tests must pass before merge.
  - route tests must prove prompt module is actually consumed.

---

## Risk Controls

- Keep AI tool registry closed-by-default.
- Keep v1 tools read-only; block write RPCs via tests and explicit guard.
- Keep prompt/system policy explicit about factual vs inference vs draft output.
- Keep route runtime Node-only to match current secure API patterns.
- Apply hard caps on output tokens and tool steps.
- Enforce per-user and per-tenant rate/quota checks before model execution.
- Capture usage telemetry for budget monitoring and emergency kill-switch response.

---

## Definition of Done

- All US-001..US-008 acceptance criteria are satisfied.
- Typecheck, lint, tests pass.
- Manual browser verification completed and documented.
- No tenant boundary regressions in test matrix.
- No assistant-initiated write path exists in v1.
- Suggested-question quick asks (3 chips) work and respect disabled/loading states.
- Token/rate/quota guardrail tests pass and prevent accidental budget overrun.
