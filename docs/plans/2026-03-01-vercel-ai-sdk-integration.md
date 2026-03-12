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

**Step 1: Write failing API route smoke test (RED)**

```ts
// src/app/api/chat/__tests__/route.auth-and-schema.test.ts
import { describe, it, expect } from 'vitest'
import { POST } from '../route'

describe('/api/chat', () => {
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
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.auth-and-schema.test.ts"
```
Expected: FAIL (auth gate missing).

**Step 3: Implement minimal secure route (GREEN)**

```ts
// src/app/api/chat/route.ts
import { POST } from 'ai'
import { useServerAuth } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const SYSTEM_PROMPT_VERSION = 'v1.0.0'

const SYSTEM_PROMPT = `
  You are a Vercel AI assistant for a maintenance management system.
  Your role is to provide guidance and recommendations based on the system's current state.
  You have access to read-only tools only and can generate draft repair requests.
  You must always retrieve context before providing guidance.
  You must always label your output as "Draft" or "Inference" or "Fact".
`

const TOOL_ALLOWLIST = [
  'equipmentLookup',
  'maintenanceSummary',
  'maintenancePlanLookup',
  'repairSummary',
]

const TENANT_POLICY = {
  'privileged': {
    'equipmentLookup': true,
    'maintenanceSummary': true,
    'maintenancePlanLookup': true,
    'repairSummary': true,
  },
  'non-privileged': {
    'equipmentLookup': false,
    'maintenanceSummary': false,
    'maintenancePlanLookup': false,
    'repairSummary': false,
  },
}

const buildSystemPrompt = (ctx: any) => {
  const { user, tenant } = ctx
  const { role, selectedFacilityId } = user
  const { id, name } = tenant

  let prompt = SYSTEM_PROMPT

  if (role === 'privileged' && !selectedFacilityId) {
    prompt += `
      IMPORTANT: You must select a facility before providing any guidance.
      You can use the "equipmentLookup" tool to find a facility ID.
    `
  }

  if (role === 'non-privileged') {
    prompt += `
      IMPORTANT: You cannot provide guidance for equipment outside your assigned facilities.
      You can use the "equipmentLookup" tool to find your assigned equipment.
    `
  }

  prompt += `
    Tenant: ${name} (ID: ${id})
    Role: ${role}
    Tool Allowlist: ${TOOL_ALLOWLIST.join(', ')}
  `

  return prompt
}

export default POST({
  async handler(req) {
    const session = await useServerAuth()
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messages } = await req.json()
    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Invalid messages array' }, { status: 400 })
    }

    const ctx = {
      user: session.user,
      tenant: session.tenant,
      messages,
    }

    const prompt = buildSystemPrompt(ctx)

    const result = await streamText({
      model: AI_MODEL,
      messages: await convertToModelMessages(prompt, ctx),
      stopWhen: stepCountIs(AI_MAX_TOOL_STEPS),
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    })

    return result.toUIMessageStreamResponse()
  },
})
```

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

```ts
// src/lib/ai/prompts/__tests__/system.test.ts
import { describe, it, expect } from 'vitest'

describe('system prompt', () => {
  it('includes version', () => {
    expect(SYSTEM_PROMPT_VERSION).toBeDefined()
  })

  it('includes identity and language', () => {
    expect(SYSTEM_PROMPT).toContain('You are a Vercel AI assistant')
    expect(SYSTEM_PROMPT).toContain('maintenance management system')
  })

  it('includes security and tenant boundaries', () => {
    expect(SYSTEM_PROMPT).toContain('You have access to read-only tools only')
    expect(SYSTEM_PROMPT).toContain('You must always retrieve context before providing guidance')
  })

  it('includes tool usage constraints', () => {
    expect(SYSTEM_PROMPT).toContain('You must always label your output as')
    expect(SYSTEM_PROMPT).toContain('You can use the "equipmentLookup" tool to find a facility ID')
  })

  it('includes failure behavior and guidance', () => {
    expect(SYSTEM_PROMPT).toContain('IMPORTANT: You must select a facility')
    expect(SYSTEM_PROMPT).toContain('You can use the "equipmentLookup" tool to find your assigned equipment')
  })
})
```

**Step 2: Run failing prompt tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/lib/ai/prompts/__tests__/system.test.ts"
```
Expected: FAIL.

**Step 3: Implement minimal prompt module (GREEN)**

```ts
// src/lib/ai/prompts/system.ts
export const SYSTEM_PROMPT_VERSION = 'v1.0.0'

export const SYSTEM_PROMPT = `
  You are a Vercel AI assistant for a maintenance management system.
  Your role is to provide guidance and recommendations based on the system's current state.
  You have access to read-only tools only and can generate draft repair requests.
  You must always retrieve context before providing guidance.
  You must always label your output as "Draft" or "Inference" or "Fact".
`

export const TOOL_ALLOWLIST = [
  'equipmentLookup',
  'maintenanceSummary',
  'maintenancePlanLookup',
  'repairSummary',
]

export const TENANT_POLICY = {
  'privileged': {
    'equipmentLookup': true,
    'maintenanceSummary': true,
    'maintenancePlanLookup': true,
    'repairSummary': true,
  },
  'non-privileged': {
    'equipmentLookup': false,
    'maintenanceSummary': false,
    'maintenancePlanLookup': false,
    'repairSummary': false,
  },
}

export const buildSystemPrompt = (ctx: any) => {
  const { user, tenant } = ctx
  const { role, selectedFacilityId } = user
  const { id, name } = tenant

  let prompt = SYSTEM_PROMPT

  if (role === 'privileged' && !selectedFacilityId) {
    prompt += `
      IMPORTANT: You must select a facility before providing any guidance.
      You can use the "equipmentLookup" tool to find a facility ID.
    `
  }

  if (role === 'non-privileged') {
    prompt += `
      IMPORTANT: You cannot provide guidance for equipment outside your assigned facilities.
      You can use the "equipmentLookup" tool to find your assigned equipment.
    `
  }

  prompt += `
    Tenant: ${name} (ID: ${id})
    Role: ${role}
    Tool Allowlist: ${TOOL_ALLOWLIST.join(', ')}
  `

  return prompt
}
```

**Step 4: Re-run prompt tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/lib/ai/prompts/__tests__/system.test.ts"
```
Expected: PASS.

**Step 5: Add prompt change policy document**

Create:
```markdown
// docs/ai/system-prompt-changelog.md
# AI System Prompt Changelog

## Versioning Rules
- `major`: Safety model or permission-policy changes.
- `minor`: New behavior block (new tool class, new output mode).
- `patch`: Wording/clarity-only changes with no policy shift.

## Required Tests for Each Bump
- Prompt tests must pass before merge.
- Route tests must prove prompt module is actually consumed.

## Date + Rationale Entry Format
- Include date, rationale, and before/after examples.
```

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

```ts
// src/app/api/chat/__tests__/route.limits.test.ts
import { describe, it, expect } from 'vitest'
import { POST } from '../route'

describe('/api/chat limits', () => {
  it('enforces maxOutputTokens', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('enforces maxToolSteps', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('rejects excessive chat history', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: Array(1000).fill({ role: 'user', content: 'test' }) }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('rate-limits users', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(429)
  })

  it('over-quota users receive safe message', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(429)
  })
})
```

**Step 2: Run failing guardrail tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.limits.test.ts" "src/app/api/chat/__tests__/route.rate-limit-and-quota.test.ts"
```
Expected: FAIL.

**Step 3: Implement minimal guardrail layer (GREEN)**

```ts
// src/lib/ai/limits.ts
export const AI_MAX_OUTPUT_TOKENS = 1000
export const AI_MAX_TOOL_STEPS = 5
export const AI_MAX_MESSAGES = 100
export const AI_MAX_INPUT_CHARS = 1000

// src/lib/ai/usage-metering.ts
export const usageMetering = {
  recordRequestUsage: (userId: string, tenantId: string, tokensUsed: number, cost: number) => {
    // Implementation can start in-memory; phase-upgradable.
  },
  checkRequestThrottling: (userId: string, tenantId: string) => {
    // Implementation can start in-memory; phase-upgradable.
    return { allowed: true, waitSeconds?: number }
  },
  checkTenantQuota: (tenantId: string) => {
    // Implementation can start in-memory; phase-upgradable.
    return { allowed: true, remainingTokens?: number }
  },
}

// src/app/api/chat/route.ts
import { POST } from 'ai'
import { useServerAuth } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const SYSTEM_PROMPT_VERSION = 'v1.0.0'

const SYSTEM_PROMPT = `
  You are a Vercel AI assistant for a maintenance management system.
  Your role is to provide guidance and recommendations based on the system's current state.
  You have access to read-only tools only and can generate draft repair requests.
  You must always retrieve context before providing guidance.
  You must always label your output as "Draft" or "Inference" or "Fact".
`

const TOOL_ALLOWLIST = [
  'equipmentLookup',
  'maintenanceSummary',
  'maintenancePlanLookup',
  'repairSummary',
]

const TENANT_POLICY = {
  'privileged': {
    'equipmentLookup': true,
    'maintenanceSummary': true,
    'maintenancePlanLookup': true,
    'repairSummary': true,
  },
  'non-privileged': {
    'equipmentLookup': false,
    'maintenanceSummary': false,
    'maintenancePlanLookup': false,
    'repairSummary': false,
  },
}

const buildSystemPrompt = (ctx: any) => {
  const { user, tenant } = ctx
  const { role, selectedFacilityId } = user
  const { id, name } = tenant

  let prompt = SYSTEM_PROMPT

  if (role === 'privileged' && !selectedFacilityId) {
    prompt += `
      IMPORTANT: You must select a facility before providing any guidance.
      You can use the "equipmentLookup" tool to find a facility ID.
    `
  }

  if (role === 'non-privileged') {
    prompt += `
      IMPORTANT: You cannot provide guidance for equipment outside your assigned facilities.
      You can use the "equipmentLookup" tool to find your assigned equipment.
    `
  }

  prompt += `
    Tenant: ${name} (ID: ${id})
    Role: ${role}
    Tool Allowlist: ${TOOL_ALLOWLIST.join(', ')}
  `

  return prompt
}

export default POST({
  async handler(req) {
    const session = await useServerAuth()
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messages } = await req.json()
    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Invalid messages array' }, { status: 400 })
    }

    const ctx = {
      user: session.user,
      tenant: session.tenant,
      messages,
    }

    const prompt = buildSystemPrompt(ctx)

    const result = await streamText({
      model: AI_MODEL,
      messages: await convertToModelMessages(prompt, ctx),
      stopWhen: stepCountIs(AI_MAX_TOOL_STEPS),
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    })

    return result.toUIMessageStreamResponse()
  },
})
```

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

```ts
// src/app/api/chat/__tests__/route.tools-allowlist.test.ts
import { describe, it, expect } from 'vitest'
import { POST } from '../route'

describe('/api/chat tools allowlist', () => {
  it('unknown tool name blocked', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'tool: unknown' }] }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('tool not in allowlist blocked', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'tool: equipmentUpdate' }] }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('write-intent tool names blocked', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'tool: create' }] }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })
})
```

**Step 2: Write failing tenant policy tests (RED)**

```ts
// src/app/api/chat/__tests__/route.tenant-policy.test.ts
import { describe, it, expect } from 'vitest'
import { POST } from '../route'

describe('/api/chat tenant policy', () => {
  it('privileged role + undefined facility => guidance response', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'tool: equipmentLookup' }] }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      messages: [
        {
          role: 'assistant',
          content: expect.stringContaining('Chọn cơ sở trước'),
        },
      ],
    })
  })

  it('non-privileged role ignores unsafe tenant override attempts', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'tool: equipmentLookup tenant: { id: "unsafe-tenant-id" }' }] }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      messages: [
        {
          role: 'assistant',
          content: expect.stringContaining('không cấp quyền truy cập'),
        },
      ],
    })
  })

  it('privileged + specific facility allows scoped tool execution', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'tool: equipmentLookup tenant: { id: "safe-tenant-id" }' }] }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      messages: [
        {
          role: 'assistant',
          content: expect.stringContaining('Truy cập thành công'),
        },
      ],
    })
  })
})
```

**Step 3: Run both test files to confirm fail**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.tools-allowlist.test.ts" "src/app/api/chat/__tests__/route.tenant-policy.test.ts"
```
Expected: FAIL.

**Step 4: Implement minimal policy layer (GREEN)**

```ts
// src/lib/ai/tools/registry.ts
export const TOOL_ALLOWLIST = [
  'equipmentLookup',
  'maintenanceSummary',
  'maintenancePlanLookup',
  'repairSummary',
]

// src/lib/ai/tools/rpc-tool-executor.ts
import { POST } from 'ai'

export const rpcToolExecutor = {
  execute: async (toolName: string, args: any, session: any) => {
    if (!TOOL_ALLOWLIST.includes(toolName)) {
      return Response.json({ error: 'Tool not allowed' }, { status: 400 })
    }

    const req = new Request(`http://localhost/api/rpc/${toolName}`, {
      method: 'POST',
      body: JSON.stringify(args),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req as never)
    if (!res.ok) {
      return Response.json({ error: 'Tool execution failed' }, { status: 400 })
    }

    return res
  },
}

// src/app/api/chat/route.ts
import { POST } from 'ai'
import { useServerAuth } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const SYSTEM_PROMPT_VERSION = 'v1.0.0'

const SYSTEM_PROMPT = `
  You are a Vercel AI assistant for a maintenance management system.
  Your role is to provide guidance and recommendations based on the system's current state.
  You have access to read-only tools only and can generate draft repair requests.
  You must always retrieve context before providing guidance.
  You must always label your output as "Draft" or "Inference" or "Fact".
`

const TOOL_ALLOWLIST = [
  'equipmentLookup',
  'maintenanceSummary',
  'maintenancePlanLookup',
  'repairSummary',
]

const TENANT_POLICY = {
  'privileged': {
    'equipmentLookup': true,
    'maintenanceSummary': true,
    'maintenancePlanLookup': true,
    'repairSummary': true,
  },
  'non-privileged': {
    'equipmentLookup': false,
    'maintenanceSummary': false,
    'maintenancePlanLookup': false,
    'repairSummary': false,
  },
}

const buildSystemPrompt = (ctx: any) => {
  const { user, tenant } = ctx
  const { role, selectedFacilityId } = user
  const { id, name } = tenant

  let prompt = SYSTEM_PROMPT

  if (role === 'privileged' && !selectedFacilityId) {
    prompt += `
      IMPORTANT: You must select a facility before providing any guidance.
      You can use the "equipmentLookup" tool to find a facility ID.
    `
  }

  if (role === 'non-privileged') {
    prompt += `
      IMPORTANT: You cannot provide guidance for equipment outside your assigned facilities.
      You can use the "equipmentLookup" tool to find your assigned equipment.
    `
  }

  prompt += `
    Tenant: ${name} (ID: ${id})
    Role: ${role}
    Tool Allowlist: ${TOOL_ALLOWLIST.join(', ')}
  `

  return prompt
}

export default POST({
  async handler(req) {
    const session = await useServerAuth()
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messages } = await req.json()
    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Invalid messages array' }, { status: 400 })
    }

    const ctx = {
      user: session.user,
      tenant: session.tenant,
      messages,
    }

    const prompt = buildSystemPrompt(ctx)

    const result = await streamText({
      model: AI_MODEL,
      messages: await convertToModelMessages(prompt, ctx),
      stopWhen: stepCountIs(AI_MAX_TOOL_STEPS),
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    })

    return result.toUIMessageStreamResponse()
  },
})
```

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

> **Audit update (2026-03-10):** Phase 3 is now **partially implemented**. The current codebase already has `equipmentLookup`, `maintenanceSummary`, `maintenancePlanLookup`, and `repairSummary` wired in `src/lib/ai/tools/registry.ts`; the RPC proxy whitelist includes the AI read-only RPCs in `src/app/api/rpc/[fn]/route.ts`; and Supabase migrations for `ai_equipment_lookup`, `ai_maintenance_summary`, `ai_repair_summary`, and `ai_maintenance_plan_lookup` already exist, with follow-up correctness fixes in `supabase/migrations/20260303155700_fix_ai_rpc_totalplans_and_date_filter.sql` and `supabase/migrations/20260303152500_ai_equipment_lookup_add_so_luu_hanh.sql`. The remaining Phase 3 work is to close the gaps: add explicit tests for read-only tool execution, extract registry definitions into dedicated tool modules only if that improves clarity, add usage-history and attachment capabilities, harden prompt/tests around factual tool outputs, and implement the draft-generation flow.

### Task 3A: Lock in the current read-only tool baseline with regression tests

**Audit note (2026-03-10):** The current baseline is broader than the existing tests capture. The shipped read-only AI tool surface is `equipmentLookup`, `maintenanceSummary`, `maintenancePlanLookup`, and `repairSummary`, but current regression coverage does not explicitly lock all four tools, all four RPC whitelist entries, or the exact tool→RPC mapping contract.

**Files:**
- Modify: `src/app/api/chat/__tests__/route.tools-allowlist.test.ts`
- Modify: `src/app/api/chat/__tests__/route.tenant-policy.test.ts`
- Modify: `src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts`
- Create or modify: focused tests for AI tool registry/tool→RPC mapping if missing

**Step 1: Write the missing baseline regression tests (RED)**
Add tests for:
- all four currently shipped read-only tools (`equipmentLookup`, `maintenanceSummary`, `maintenancePlanLookup`, `repairSummary`) are explicitly accepted when requested.
- all four approved AI RPCs (`ai_equipment_lookup`, `ai_maintenance_summary`, `ai_maintenance_plan_lookup`, `ai_repair_summary`) are explicitly covered by whitelist tests.
- the current tool→RPC mapping contract is locked, so a future registry drift fails tests instead of silently changing behavior.
- facility-selection policy still gates tool execution for privileged roles across the shipped tool set.
- known-but-blocked tools and write-intent tool names remain rejected.

**Step 2: Run the focused tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.tools-allowlist.test.ts" "src/app/api/chat/__tests__/route.tenant-policy.test.ts" "src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts"
```
Expected: FAIL.

**Step 3: Implement the minimal test additions (GREEN)**
- Extend the allowlist and tenant-policy tests to cover the full shipped read-only tool surface, not just one representative tool.
- Add or extend focused assertions that lock the registry contract between tool names and approved RPC function names.
- Keep the tests narrow and behavior-focused: do not add implementation-coupled assertions beyond the approved tool/RPC contract and tenant policy.

**Step 4: Re-run the focused tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.tools-allowlist.test.ts" "src/app/api/chat/__tests__/route.tenant-policy.test.ts" "src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts"
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/chat/__tests__/route.tools-allowlist.test.ts src/app/api/chat/__tests__/route.tenant-policy.test.ts src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts
git commit -m "test: [US-005] - lock shipped AI tool baseline and RPC mappings"
```

### Task 3B: Align prompt, registry, and RPC whitelist with the shipped AI read-only surface

**Audit note (2026-03-10):** This task is not just wording cleanup. It is a contract-alignment pass across `src/lib/ai/prompts/system.ts`, `src/lib/ai/tools/registry.ts`, and `src/app/api/rpc/[fn]/route.ts`. Current drift exists where the prompt implies capabilities (for example usage-history-backed maintenance guidance and signed-URL-only attachment access) that are not yet fully implemented in the shipped tool surface.

**Files:**
- Modify: `src/lib/ai/prompts/system.ts`
- Modify: `src/lib/ai/prompts/__tests__/system.test.ts`
- Modify: `src/lib/ai/tools/registry.ts`
- Modify: `src/app/api/rpc/[fn]/route.ts`
- Review: existing AI read-only RPC migrations for parity with current registry entries

**Step 1: Write failing alignment tests (RED)**
Add tests for:
- the prompt only claims read-only capabilities that are actually backed by the shipped tool/whitelist surface.
- the prompt accurately describes attachment access boundaries for the current implementation stage.
- the prompt does not imply usage-history evidence is available until the usage-history tool from Task 3C is implemented.
- the registry and whitelist remain aligned with the currently shipped read-only AI RPC set.

**Step 2: Run the focused tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/lib/ai/prompts/__tests__/system.test.ts" "src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts"
```
Expected: FAIL.

**Step 3: Implement the minimal alignment changes (GREEN)**
- Update prompt wording so it does not over-claim unavailable capabilities.
- Keep troubleshooting guidance aligned with the actually shipped tools (`equipmentLookup`, `repairSummary`, and other existing read-only tools) while explicitly deferring usage-history-backed guidance until Task 3C is complete.
- Keep attachment wording aligned with the current safe-access contract, not an assumed universal signed-URL storage model.
- Confirm registry and whitelist continue to match the shipped AI RPC set exactly.

**Step 4: Re-run the focused tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/lib/ai/prompts/__tests__/system.test.ts" "src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts"
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/prompts/system.ts src/lib/ai/prompts/__tests__/system.test.ts src/lib/ai/tools/registry.ts src/app/api/rpc/[fn]/route.ts
git commit -m "feat: [US-005] - align AI prompt, registry, and RPC whitelist contract"
```

### Task 3C: Add missing usage-history tool needed by predictive maintenance guidance

**Files:**
- Create: `src/app/api/chat/__tests__/route.usage-tools.test.ts`
- Modify: `src/lib/ai/tools/registry.ts`
- Modify: `src/lib/ai/prompts/system.ts`
- Modify: `src/lib/ai/prompts/__tests__/system.test.ts`
- Create: Supabase RPC migration for AI-specific usage-summary lookup (name explicitly chosen during implementation)
- Modify: `src/app/api/rpc/[fn]/route.ts`
- Modify: `src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts`

**Step 1: Write the failing usage-history tool tests (RED)**
Add tests for:
- a new read-only tool (for example `usageHistory` or `equipmentUsageHistory`) is allowed by the registry.
- the tool calls only the approved usage-summary RPC through `/api/rpc/[fn]`.
- prompt guidance about high usage shortening maintenance cycles is backed by an actual tool path.
- no direct `supabase.from(...)`, ad hoc SQL, or reuse of broad raw usage-log payloads is introduced.

**Step 2: Run the focused tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.usage-tools.test.ts" "src/lib/ai/prompts/__tests__/system.test.ts" "src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts"
```
Expected: FAIL.

**Step 3: Implement the minimal usage-history read path (GREEN)**
- Add one dedicated AI-specific read-only RPC that returns bounded aggregate evidence from `nhat_ky_su_dung` (for example frequency, recency, duration, post-use condition counts) rather than exposing raw usage-log rows.
- Enforce the same JWT claim checks, tenant scoping, `SECURITY DEFINER`, pinned `search_path`, and authenticated-only grants as the existing AI RPCs.
- Keep the response shape narrow and evidence-ready: avoid `SELECT *`, bound result size, and return only the fields needed for predictive maintenance reasoning.
- Add the RPC to the proxy whitelist and the AI tool registry.
- Update prompt wording so predictive maintenance recommendations only reference evidence returned by this tool.

**Step 4: Re-run the focused tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.usage-tools.test.ts" "src/lib/ai/prompts/__tests__/system.test.ts" "src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts"
```
Expected: PASS.

**Step 5: Refactor + static checks**

Run:
```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run lint -- --file "src/lib/ai/tools/registry.ts"
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/app/api/chat/__tests__/route.usage-tools.test.ts src/lib/ai/tools/registry.ts src/lib/ai/prompts/system.ts src/lib/ai/prompts/__tests__/system.test.ts src/app/api/rpc/[fn]/route.ts src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts supabase/migrations
git commit -m "feat: [US-005] - add usage-history AI tool for evidence-based maintenance guidance"
```

### Task 3D: Add missing attachment lookup tool with safe access contracts

**Audit note (2026-03-10):** Live DB inspection shows `file_dinh_kem.duong_dan_luu_tru` is currently populated with external absolute URLs (for example Google Docs links), not a normalized Supabase Storage object key. Phase 3 should therefore implement a safe attachment metadata/access tool first, rather than assuming all attachments can be converted into signed storage URLs.

**Files:**
- Create: `src/app/api/chat/__tests__/route.attachment-tools.test.ts`
- Modify: `src/lib/ai/tools/registry.ts`
- Modify: `src/lib/ai/prompts/system.ts`
- Modify: `src/lib/ai/prompts/__tests__/system.test.ts`
- Create: Supabase RPC migration for attachment metadata lookup
- Modify: `src/app/api/rpc/[fn]/route.ts`
- Modify: `src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts`
- Modify: trusted server-side AI tool execution path only if storage-backed signing is actually supported by the returned attachment type

**Step 1: Write failing attachment tool tests (RED)**
Add tests for:
- attachment retrieval returns only safe metadata plus an explicit access contract.
- raw table rows and unsafe internal storage details are never returned to the model.
- the tool uses only the approved attachment metadata RPC.
- the tool is blocked without facility context.
- storage-backed attachments may return short-lived signed URLs, but external absolute URLs are handled as external links instead of being forced through a signing path.

**Step 2: Run the focused tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.attachment-tools.test.ts" "src/lib/ai/prompts/__tests__/system.test.ts" "src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts"
```
Expected: FAIL.

**Step 3: Implement the minimal attachment read path (GREEN)**
- Add one dedicated read-only RPC that returns only safe attachment metadata and a normalized access contract for each record.
- Do **not** assume every attachment is a signable storage object. The RPC/tool result must distinguish at least between external absolute URLs and future storage-backed attachments.
- For external links, return only the safe external URL metadata path needed by the assistant contract.
- For storage-backed attachments, short-lived signed URLs may be generated in the trusted server/tool layer only if the underlying record format actually supports signing.
- Add the RPC to the whitelist and registry.
- Ensure the tool output never exposes raw table rows, bucket internals, or direct table access.
- Update prompt wording to explain attachment lookup boundaries and the distinction between external links vs storage-backed files.

**Step 4: Re-run the focused tests**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.attachment-tools.test.ts" "src/lib/ai/prompts/__tests__/system.test.ts" "src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts"
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/chat/__tests__/route.attachment-tools.test.ts src/lib/ai/tools/registry.ts src/lib/ai/prompts/system.ts src/lib/ai/prompts/__tests__/system.test.ts src/app/api/rpc/[fn]/route.ts src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts supabase/migrations
git commit -m "feat: [US-005] - add safe attachment lookup tool for AI assistant"
```

### Task 3E: Add narrowly scoped quota-aware AI support for starter prompts and read-only device quota lookup

**Audit note (2026-03-10):** Device-quota changes no longer stay purely out of scope for Phase 3. They justify a **narrow read-only quota-aware AI slice** in Phase 3: expose quota-related starter prompts when the user opens AI chat, and support quota lookup for a specific device the user asks about. This must preserve the project security model exactly: RPC-only access through the trusted `/api/rpc/[fn]` gateway, no direct table reads from AI tools, no write-capable quota RPCs in the AI registry, and no model-side inference from raw category listings alone. The current device-quota module still proves that privileged users must select a specific facility before scoped reads, confirms `tinh_trang_hien_tai` as the canonical equipment status field, and shows that category/mapping RPCs alone are not sufficient evidence for reliable quota reasoning. Any answer about “còn bao nhiêu” must be backed by active decision + line-item/compliance data, not category listings by themselves. Live DB review also shows current quota coverage is incomplete (for example, active decisions are sparse and device-to-category mapping coverage is still limited), so the contract must explicitly support `notMapped`, `notInApprovedCatalog`, and `insufficientEvidence` as first-class outcomes.

**Files:**
- Review: `src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingContext.tsx`
- Review: `src/app/(app)/device-quota/mapping/_components/DeviceQuotaUnassignedList.tsx`
- Review: `src/app/(app)/device-quota/mapping/page.tsx`
- Review: `supabase/migrations/20260131_device_quota_schema.sql`
- Review: `supabase/migrations/20260201_device_quota_rpc_categories.sql`
- Review: `supabase/migrations/20260201_device_quota_rpc_decisions.sql`
- Review: `supabase/migrations/20260201_device_quota_rpc_line_items.sql`
- Review: `supabase/migrations/20260201_device_quota_rpc_mapping.sql`
- Review: `supabase/migrations/20260206_fix_device_quota_rpc_tinh_trang_column.sql`
- Future modify: AI chat starter prompt source/config for welcome suggestions
- Future modify: AI tool registry / prompt contract for quota-aware read-only lookup
- Future create: AI-specific read-only quota lookup RPC migration (via `/api/rpc/[fn]` allowlist only)

**Step 1: Add an audit note to this plan (no code yet)**
Document these decisions explicitly:
- device-quota now affects Phase 3 in a **limited read-only way**, not as a blocker.
- the facility-selection pattern in device-quota confirms that privileged AI tool usage must keep the current facility-scoping behavior.
- `tinh_trang_hien_tai` is the canonical equipment status field and should be preferred in quota-aware AI lookups.
- quota/category RPCs are not a substitute for maintenance/repair/usage RPCs and are also not enough by themselves for quota conclusions.
- if AI answers whether a device is within quota or how much quota remains, it must use decision detail data (`dinh_muc_chi_tiet_list` / compliance RPCs or equivalent evidence-ready data), not category listings alone.
- existing quota RPCs are useful source data, but they are **not** the final AI contract; Phase 3 should add a dedicated AI-specific read-only quota RPC that returns a bounded, evidence-ready result for one device at a time.
- the AI quota RPC must remain behind the same trusted RPC gateway and follow the same pattern as other AI read-only RPCs: `SECURITY DEFINER`, pinned `search_path`, JWT claim checks, tenant/facility scoping, authenticated-only execution grant, and explicit whitelist registration.
- the device-quota write RPCs (`dinh_muc_thiet_bi_link`, `dinh_muc_thiet_bi_unlink`, and other mutation paths) remain strictly out of scope for the v1 AI registry.

**Step 2: Add quota-aware starter prompts to AI chat scope**
- When the user opens the AI chat UI, include visible starter questions that make quota support discoverable.
- Add at least one quota-related suggestion group, for example:
  - “Thiết bị này có nằm trong định mức hiện hành không?”
  - “Định mức còn lại của thiết bị này là bao nhiêu?”
  - “Thiết bị này đã được gán vào danh mục định mức chưa?”
- Treat these as discovery/UX affordances only; they do not change the read-only boundary.
- If the user asks a quota question without sufficient scope context, the assistant must ask for the missing scope before attempting lookup.
- If a local/single-facility user asks a broad quota question such as “Tiêu chuẩn, định mức sử dụng thiết bị y tế của đơn vị tôi như thế nào?”, the assistant should treat it as a request for a facility-scoped quota/compliance summary, not as a device-specific lookup and not as a free-form policy explanation.
- In that case, the assistant should first return a short evidence-based summary of the current effective quota context for the user’s facility (for example active decision context, counts of compliant / under-quota / over-quota categories, and number of unmapped devices if available), then ask a clarifying follow-up to drill into category-level or device-level details.
- The assistant must not claim the facility is “đạt chuẩn”, “đủ định mức”, or “không có định mức” unless the returned evidence explicitly supports that conclusion.

**Step 3: Define the quota-aware lookup contract as a narrow read-only feature**
- Add a dedicated quota-aware AI lookup path for a specific user-supplied device.
- Implement this as **one AI-specific read-only RPC**, not as model-driven orchestration over multiple existing quota RPCs.
- The AI quota RPC must return a bounded result for one device at a time and must not expose raw quota tables or broad decision/category payloads to the model.
- The lookup must answer one of these evidence-backed states:
  1. `inQuotaCatalog`
  2. `notMapped`
  3. `notInApprovedCatalog`
  4. `insufficientEvidence`
- If the result is `inQuotaCatalog`, return:
  - the applicable quota category / approved decision context
  - the quota amount
  - the current counted amount used for comparison
  - the remaining amount
  - the scope used to compute the result
- If the result is `notMapped`, clearly state that the device has not yet been assigned to a quota catalog/category.
- If the result is `notInApprovedCatalog`, clearly state that the device is not present in the currently approved/effective quota catalog.
- If the result is `insufficientEvidence`, clearly state that available mapping/category data is not enough to conclude current quota status.
- Derive quota status from active/effective decision data plus line-item/compliance evidence; do **not** infer quota membership from category listings alone.
- Mini response contract examples (pseudo-JSON only; implementation may rename fields but must preserve semantics):

```json
// A. Facility-scoped quota summary for broad questions from local users
{
  "kind": "quotaSummary",
  "scope": {
    "mode": "facility",
    "don_vi_id": 17,
    "label": "Đơn vị hiện tại"
  },
  "decision": {
    "id": 22,
    "so_quyet_dinh": "289/QĐ-SYT",
    "trang_thai": "active",
    "ngay_hieu_luc": "2026-02-27"
  },
  "summary": {
    "total_categories": 284,
    "dat_count": 210,
    "thieu_count": 40,
    "vuot_count": 34,
    "unmapped_equipment": 120
  },
  "evidence_status": "complete",
  "suggested_follow_ups": [
    "Xem các nhóm đang thiếu định mức",
    "Xem các nhóm đang vượt định mức",
    "Xem thiết bị chưa được gán danh mục",
    "Kiểm tra một thiết bị cụ thể"
  ]
}

// B. Device-specific quota lookup
{
  "kind": "deviceQuotaLookup",
  "scope": {
    "mode": "facility",
    "don_vi_id": 17,
    "label": "Đơn vị hiện tại"
  },
  "device": {
    "id": 123,
    "ma_thiet_bi": "TB-001",
    "ten_thiet_bi": "Máy siêu âm A"
  },
  "status": "inQuotaCatalog",
  "decision": {
    "id": 22,
    "so_quyet_dinh": "289/QĐ-SYT",
    "trang_thai": "active"
  },
  "category": {
    "id": 45,
    "ma_nhom": "CDHA-001",
    "ten_nhom": "Thiết bị chẩn đoán hình ảnh"
  },
  "quota": {
    "quota_amount": 5,
    "current_count": 3,
    "remaining_amount": 2
  },
  "evidence_status": "complete"
}
```

- For `quotaSummary`, prefer a short summary payload that supports a concise assistant answer plus follow-up prompts.
- For `deviceQuotaLookup`, `status` must be one of `inQuotaCatalog | notMapped | notInApprovedCatalog | insufficientEvidence`.
- If `status != inQuotaCatalog`, the payload may omit `category` or `quota`, but it must still include enough evidence/context for the assistant to explain the outcome clearly and safely.

**Step 4: Lock scope rules for local vs privileged users**
- For local/single-facility users (`to_qltb`, `technician`, `qltb_khoa`, `user`), quota answers must be computed within the currently selected facility.
- For `regional_leader`, `global`, and `admin`, quota answers may be computed more flexibly across a wider allowed scope, but the assistant must explicitly state whether the answer is based on one facility, multiple facilities, or a wider regional/system scope.
- Prefer a single-facility answer whenever the user has already selected a facility; do not silently widen scope.
- Do not silently collapse multi-facility results into a single-facility answer.
- If no valid scope is available, ask the user to choose or clarify the scope before lookup.
- The AI quota RPC must validate scope server-side; do not rely on client-supplied tenant/facility scope for non-global users.

**Step 5: Keep quota-aware AI intentionally narrow in Phase 3**
- Do **not** add auto-mapping, auto-classification, or quota write actions into the Phase 3 AI registry as part of US-005/US-006.
- Do **not** conflate quota lookup with category suggestion / mapping assistance; those remain separate future work.
- Treat this Phase 3 addition as an evidence-backed read-only lookup plus discoverability improvement, not a full quota decision engine.

### Task 4: AI Diagnostic & Remediation Draft Generation

**Goal:** Add a schema-validated troubleshooting draft path for a specific equipment item. This path produces inference-only advisory output from existing factual evidence and must never trigger navigation, mutation, or repair-request creation.

**Files:**
- Create: `src/lib/ai/draft/troubleshooting-schema.ts`
- Create: `src/lib/ai/draft/troubleshooting-tool.ts`
- Modify: `src/lib/ai/tools/registry.ts`
- Modify: `src/lib/ai/prompts/system.ts`
- Modify: `src/lib/ai/prompts/__tests__/system.test.ts`
- Create: `src/app/api/chat/__tests__/route.troubleshooting.test.ts`

**Architecture note:**
- Keep factual RPC-backed tools in `READ_ONLY_TOOL_DEFINITIONS`.
- Introduce a separate `DRAFT_TOOL_DEFINITIONS` registry for schema-validated draft artifacts.
- Draft tools do **not** call `executeRpcTool(...)` directly; they consume existing approved factual context and return structured output only.
- Draft tools do **not** access tables directly, do **not** bypass the RPC proxy, and do **not** perform mutations.

**Task contract:**
- The draft path returns a `troubleshootingDraft` artifact, not a factual tool result and not a repair-request draft.
- The draft path may run only when the conversation already contains sufficient factual evidence from approved read-only tools.
- Minimum required evidence:
  - `equipmentLookup` for the target device.
  - At least one relevant operational evidence source:
    - `repairSummary` for repair-history / fault-pattern questions.
    - `maintenanceSummary` or `maintenancePlanLookup` for maintenance-cycle questions.
    - `usageHistory` if the answer depends on usage-based wear or frequency.
- If sufficient evidence is missing, the assistant must not generate a troubleshooting draft. It must ask for clarification or retrieve the missing context first.
- The troubleshooting draft remains advisory only; no create/update/delete RPC path is allowed.

**Output contract (semantic shape; field names may vary only if tests preserve semantics):**
```ts
{
  kind: 'troubleshootingDraft'
  draftOnly: true
  basedOnEvidence: true
  evidenceRefs: string[]
  equipment_context: {
    thiet_bi_id?: number
    ma_thiet_bi?: string
    ten_thiet_bi?: string
    model?: string | null
    khoa_phong?: string | null
    tinh_trang_hien_tai?: string | null
  }
  probable_causes: Array<{
    label: string
    confidence: 'low' | 'medium' | 'high'
    rationale: string
  }>
  remediation_steps: Array<{
    step: string
    type: 'inspection' | 'configuration' | 'maintenance' | 'escalation'
  }>
  limitations?: string[]
}
```

**Behavioral rules:**
- All non-factual guidance must be labeled as `Inference` or `Draft`, never `Fact`.
- The tool may summarize factual context, but all root-cause hypotheses remain inference.
- The tool must not invent vendor details, spare parts, service units, fault codes, or unsupported repair procedures.
- The tool must not imply that a repair request has been created.

**Step 1: Write the first failing diagnostic contract test (RED)**
- Add a test that asserts a generated `troubleshootingDraft` validates against the Zod schema.
- Keep it focused on one behavior: valid draft shape.

**Step 2: Run the first test and verify it fails for the right reason**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.troubleshooting.test.ts"
```
Expected: FAIL because the schema/tool path does not exist yet, not because of a typo or broken test setup.

**Step 3: Implement the minimal schema to satisfy the first test (GREEN)**
- Create `src/lib/ai/draft/troubleshooting-schema.ts` with the minimal `troubleshootingDraft` Zod contract.
- Do not add extra fields beyond the documented contract.

**Step 4: Re-run the test and verify it passes**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.troubleshooting.test.ts"
```
Expected: PASS for the schema-shape assertion.

**Step 5: Write the next failing guardrail test (RED)**
- Add a test that troubleshooting generation is blocked unless sufficient factual context has already been retrieved.
- Keep this separate from schema validation.

**Step 6: Run the test and verify it fails for the expected missing-guard reason**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.troubleshooting.test.ts"
```
Expected: FAIL because prerequisite evidence enforcement is not implemented yet.

**Step 7: Implement the minimal diagnostic tool and prompt guard (GREEN)**
- Create `src/lib/ai/draft/troubleshooting-tool.ts`.
- Return a typed `troubleshootingDraft` object with:
  - `equipment_context`
  - `probable_causes`
  - `remediation_steps`
  - evidence metadata (`draftOnly`, `basedOnEvidence`, `evidenceRefs`)
- Update `src/lib/ai/tools/registry.ts` to register the draft path in `DRAFT_TOOL_DEFINITIONS`, separate from `READ_ONLY_TOOL_DEFINITIONS`.
- Update `src/lib/ai/prompts/system.ts` to enforce prerequisite evidence before troubleshooting.
- Keep the tool advisory only and keep all output clearly outside the mutation path.

**Step 8: Re-run the troubleshooting tests and verify they pass**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.troubleshooting.test.ts"
```
Expected: PASS.

**Step 9: Write the final failing safety/regression tests (RED)**
- Add tests that:
  - equipment context is correlated only from approved factual tool outputs,
  - output is explicitly marked as draft/inference guidance and distinguishable from factual tool results,
  - troubleshooting flow never calls create/update/delete RPCs.

**Step 10: Run the regression tests and verify they fail for missing behavior**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.troubleshooting.test.ts"
```
Expected: FAIL on the newly added regression assertions.

**Step 11: Implement the minimal fixes for the regression tests (GREEN)**
- Tighten prompt text and draft-tool behavior only where required by the failing tests.
- Do not add extra orchestration or UI behavior.

**Step 12: Re-run the full troubleshooting test file**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.troubleshooting.test.ts"
```
Expected: PASS.

**Step 13: Refactor and run static checks**

Run:
```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run lint -- --file "src/lib/ai/draft/troubleshooting-tool.ts" --file "src/lib/ai/tools/registry.ts" --file "src/lib/ai/prompts/system.ts"
```
Expected: PASS.

**Step 14: Commit**

```bash
git add src/lib/ai/draft/troubleshooting-schema.ts src/lib/ai/draft/troubleshooting-tool.ts src/lib/ai/tools/registry.ts src/lib/ai/prompts/system.ts src/lib/ai/prompts/__tests__/system.test.ts src/app/api/chat/__tests__/route.troubleshooting.test.ts
git commit -m "feat: [US-009] - add schema-validated AI troubleshooting draft tool"
```

### Task 4.5: Draft Repair Request Artifact Generation (No Submission)

**Goal:** Add a draft-only repair request generator that transforms explicit user draft intent plus existing factual context into a schema-validated, UI-consumable repair-request draft. The output is a draft artifact only and must not create or submit a repair request.

**Files:**
- Create: `src/lib/ai/draft/repair-request-draft-schema.ts`
- Create: `src/lib/ai/draft/repair-request-draft-tool.ts`
- Modify: `src/lib/ai/tools/registry.ts`
- Modify: `src/lib/ai/prompts/system.ts`
- Modify: `src/lib/ai/prompts/__tests__/system.test.ts`
- Create: `src/app/api/chat/__tests__/route.draft-output.test.ts`
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsCreateSheet.tsx`

**Architecture note:**
- Keep factual RPC-backed tools in `READ_ONLY_TOOL_DEFINITIONS`.
- Register draft artifact builders separately in `DRAFT_TOOL_DEFINITIONS`.
- The repair-request draft path must **not** be modeled as an RPC-backed factual lookup and must **not** call `executeRpcTool(...)`.
- The repair-request draft path must consume explicit user intent plus already-approved factual context, then return schema-validated output only.
- The draft path must not read tables directly, bypass the RPC proxy, or perform mutations.
- Prefer orchestration-driven invocation for `repairRequestDraft` so generation happens only after explicit draft intent and sufficient evidence are both present.

**Task contract:**
- The draft path returns a `repairRequestDraft` artifact, not a troubleshooting artifact and not a persisted request.
- The draft path may run only when:
  1. the user explicitly expresses create/draft intent (for example: “tạo yêu cầu sửa chữa nháp”, “soạn giúp tôi phiếu sửa chữa”, “điền trước form sửa chữa”), and
  2. the conversation already contains sufficient factual context for the selected equipment.
- Minimum required evidence:
  - `equipmentLookup` for the target equipment.
  - Optional supporting evidence from `repairSummary`, `maintenanceSummary`, or `usageHistory` if referenced in the draft rationale.
- Any field not grounded in factual evidence or explicit user input must remain blank / null in the draft.
- The draft path must never call `repair_request_create`, `repair_request_update`, or any other mutation RPC.

**Output contract (semantic shape; field names may vary only if tests preserve semantics):**
```ts
{
  kind: 'repairRequestDraft'
  draftOnly: true
  source: 'assistant'
  confidence: 'low' | 'medium' | 'high'
  equipment: {
    thiet_bi_id?: number
    ma_thiet_bi?: string
    ten_thiet_bi?: string
  }
  formData: {
    thiet_bi_id?: number
    mo_ta_su_co: string
    hang_muc_sua_chua: string
    ngay_mong_muon_hoan_thanh?: string | null
    don_vi_thuc_hien?: 'noi_bo' | 'thue_ngoai' | null
    ten_don_vi_thue?: string | null
  }
  missingFields?: string[]
  reviewNotes?: string[]
}
```

**Phase boundary + deferred UI handoff:**
- In Phase 3, Task 4.5 implements only:
  - backend draft-generation contract,
  - prompt/tool contract updates,
  - repair-request context + create-sheet hydration support.
- Draft card rendering in chat and the explicit CTA (`Dùng bản nháp này`) are deferred to Phase 4, when the assistant message rendering layer exists.
- Phase 3 must not introduce a dependency on a chat message renderer component that does not yet exist.

**Hydration contract for existing repair-request UI (implemented in Phase 3):**
- Add assistant-draft state to `RepairRequestsContext` (or equivalent context) so the create sheet can consume a pending draft.
- Expose an explicit context action to apply a repair-request draft into repair-request UI state.
- Hydrate create-sheet fields on first open using the draft payload:
  - `formData.thiet_bi_id` → selected equipment
  - `formData.mo_ta_su_co` → issue description
  - `formData.hang_muc_sua_chua` → repair items
  - `formData.ngay_mong_muon_hoan_thanh` → desired date
  - `formData.don_vi_thuc_hien` → repair unit
  - `formData.ten_don_vi_thue` → external company name
- If the draft references equipment that cannot be resolved in the current tenant scope, open the create sheet without selected equipment and show a safe warning.
- If the user closes the sheet without submitting, the draft is cleared from the active form state.

**Phase 4 UI handoff contract (deferred implementation):**
- Once the assistant message rendering layer exists, the repair-request draft must be rendered as a structured draft card in chat.
- That draft card must include:
  - a visible draft label,
  - a warning that the draft has not been submitted,
  - a primary CTA such as `Dùng bản nháp này`.
- Only when the user explicitly clicks `Dùng bản nháp này` may the app:
  1. store/apply the draft in repair-request UI state/context,
  2. open `RepairRequestsCreateSheet`, and
  3. hydrate the form with draft-backed values.
- Final submission must still go through the existing repair-request create flow and user click on `Gửi yêu cầu`.

**Behavioral rules:**
- Any field not grounded in evidence must remain unset rather than inferred.
- `ten_don_vi_thue` must remain null unless the user explicitly indicates outsourced repair.
- The chat artifact must clearly state that the draft is reviewable/editable and has not been sent.
- The assistant must not imply that a repair request already exists in the system.

**Step 1: Write the first failing draft artifact test (RED)**
- Add a test that asserts `repairRequestDraft` validates against the strict Zod schema.
- Keep it focused on one behavior: valid artifact shape.

**Step 2: Run the first test and verify it fails for the right reason**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.draft-output.test.ts"
```
Expected: FAIL because the draft schema/tool path does not exist yet, not because of test setup problems.

**Step 3: Implement the minimal draft schema (GREEN)**
- Create `src/lib/ai/draft/repair-request-draft-schema.ts` with only the documented artifact fields.
- Do not add UI-handoff behavior here.

**Step 4: Re-run the test and verify it passes**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.draft-output.test.ts"
```
Expected: PASS for the schema-shape assertion.

**Step 5: Write the next failing generation guard tests (RED)**
- Add tests that:
  - the draft path requires explicit draft intent,
  - missing factual data leaves optional or unresolved fields unset,
  - the draft path never calls create/update/delete RPCs,
  - output carries explicit draft metadata and is distinguishable from factual tool output and troubleshooting drafts.

**Step 6: Run the generation tests and verify they fail for the expected missing behavior**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.draft-output.test.ts"
```
Expected: FAIL because draft-generation guardrails are not implemented yet.

**Step 7: Implement the minimal draft generator path (GREEN)**
- Create `src/lib/ai/draft/repair-request-draft-tool.ts`.
- Return a typed `repairRequestDraft` object aligned with the repair-request create form.
- Attach explicit `draftOnly: true` metadata and review guidance.
- Update `src/lib/ai/tools/registry.ts` to register the draft path in `DRAFT_TOOL_DEFINITIONS`, separate from `READ_ONLY_TOOL_DEFINITIONS`.
- Update `src/lib/ai/prompts/system.ts` output-contract section to enforce “Draft does not submit” language and explicit `Fact/Inference/Draft` labels; bump version when behavior changes.
- Defer chat draft-card rendering and CTA wiring to Phase 4.

**Step 8: Re-run the draft-generation tests and verify they pass**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.draft-output.test.ts"
```
Expected: PASS for artifact-generation behavior.

**Step 9: Write the failing UI hydration tests (RED)**
- Add tests that:
  - applying a repair-request draft through repair-request UI state hydrates the expected create-sheet fields,
  - unresolved equipment does not auto-select an invalid device,
  - the create sheet still requires explicit user submission; draft application alone does not call create RPC,
  - no dependency on chat draft-card rendering is introduced in Phase 3 tests.

**Step 10: Run the hydration tests and verify they fail for the right reason**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.draft-output.test.ts"
```
Expected: FAIL because context/sheet hydration support is not implemented yet.

**Step 11: Implement the minimal context + sheet hydration support (GREEN)**
- Add repair-request context support for storing/applying a pending assistant draft.
- Wire the existing create sheet to hydrate form state from the pending repair-request draft.
- Clear draft-backed form state safely when the sheet closes without submission.

**Step 12: Re-run the full draft-output test file**

Run:
```bash
node scripts/npm-run.js run test:run -- "src/app/api/chat/__tests__/route.draft-output.test.ts"
```
Expected: PASS.

**Step 13: Refactor and run static checks**

Run:
```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run lint -- --file "src/lib/ai/draft/repair-request-draft-tool.ts" --file "src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx" --file "src/app/(app)/repair-requests/_components/RepairRequestsCreateSheet.tsx"
```
Expected: PASS.

**Step 14: Commit**

```bash
git add src/lib/ai/draft/repair-request-draft-schema.ts src/lib/ai/draft/repair-request-draft-tool.ts src/lib/ai/tools/registry.ts src/lib/ai/prompts/system.ts src/lib/ai/prompts/__tests__/system.test.ts src/app/api/chat/__tests__/route.draft-output.test.ts src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx src/app/(app)/repair-requests/_components/RepairRequestsCreateSheet.tsx
git commit -m "feat: [US-006] - add schema-validated repair-request draft artifact and sheet hydration"
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
