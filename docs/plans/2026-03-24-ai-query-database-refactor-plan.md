# AI `query_database` Refactor Plan

## Summary

This plan replaces the current AI read-only RPC tool set with a single `query_database` tool that allows the model to issue raw SQL against a dedicated read-only PostgreSQL connection. The app remains a Next.js App Router app on Vercel, uses Vercel AI SDK v6, and continues to keep quota limits, auth checks, and facility-selection checks in the chat route.

The key architectural constraint from the existing codebase is that tenant isolation currently happens in the RPC proxy by injecting JWT claims and overriding `p_don_vi`. If the AI is moved to raw SQL without a new isolation boundary, it will be able to read across facilities. The recommended replacement is to expose only curated `ai_readonly` views plus per-request session context set inside a transaction.

Relevant references:

- [AI SDK tools and tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [AI SDK loop control](https://ai-sdk.dev/docs/agents/loop-control)
- [AI SDK `streamText`](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [Supabase: connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: Postgres roles](https://supabase.com/docs/guides/database/postgres/roles)
- [postgres.js README](https://github.com/porsager/postgres)
- [PostgreSQL `CREATE VIEW`](https://www.postgresql.org/docs/current/sql-createview.html)

## 1. Supabase Setup Steps

Create a dedicated read-only schema for AI access instead of granting the tool direct access to `public`.

```sql
-- 1) Create a dedicated schema for AI-readable views.
create schema if not exists ai_readonly;

-- 2) Create a group role that only receives read permissions.
create role ai_query_reader nologin;

grant usage on schema ai_readonly to ai_query_reader;
grant select on all tables in schema ai_readonly to ai_query_reader;

-- Run this as the same role that will create future ai_readonly views.
alter default privileges in schema ai_readonly
  grant select on tables to ai_query_reader;

-- 3) Create the login role used by Vercel.
create role ai_query_tool
  login
  password 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD'
  in role ai_query_reader;

grant connect on database postgres to ai_query_tool;

-- 4) Harden the login role for serverless read-only usage.
alter role ai_query_tool set default_transaction_read_only = on;
alter role ai_query_tool set statement_timeout = '5s';
alter role ai_query_tool set idle_in_transaction_session_timeout = '5s';

-- Optional hardening to prevent accidental object creation if defaults change later.
revoke create on schema public from ai_query_tool;
revoke usage on schema public from ai_query_tool;

-- 5) Important: do NOT grant SELECT on base tables in public/auth/storage.
-- The AI role should only see curated views in ai_readonly.
```

Use the Supabase **Transaction** pooler for Vercel serverless, not Session mode.

```text
AI_DATABASE_URL=postgres://ai_query_tool:<URL_ENCODED_PASSWORD>@db.<project-ref>.supabase.co:6543/postgres?sslmode=require
```

Connection mode guidance:

- Use **Transaction mode** because Vercel serverless is stateless and short-lived.
- Do **not** use Session mode for the AI tool.
- In `postgres` / postgres.js, disable prepared statements with `prepare: false` because Supabase’s transaction pooler sits behind PgBouncer-style pooling behavior.

Gotcha from the docs: the safe boundary is not the prompt or regex guard. The real safety boundary is a dedicated login role, `default_transaction_read_only = on`, curated `ai_readonly` views, and a transaction-scoped `search_path`.

## 2. `queryDatabaseTool` Implementation

Add a dedicated tool module such as `src/lib/ai/tools/query-database.ts`.

```ts
import { tool } from 'ai'
import postgres from 'postgres'
import { z } from 'zod'

const QUERY_DATABASE_INPUT = z
  .object({
    reasoning: z.string().trim().min(1).max(500),
    sql: z.string().trim().min(1).max(20_000),
  })
  .strict()

const MAX_RESULT_ROWS = 200
const STATEMENT_TIMEOUT_MS = 5_000
const FORBIDDEN_SQL_RE =
  /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|comment|copy|merge|call|vacuum|analyze|refresh|reindex|cluster|listen|notify)\b/i
const FORBIDDEN_SCHEMA_RE = /\b(public|auth|storage|graphql_public|extensions)\s*\./i

const globalForDb = globalThis as typeof globalThis & {
  __aiQueryDatabaseClient?: ReturnType<typeof postgres>
}

const db =
  globalForDb.__aiQueryDatabaseClient ??
  postgres(process.env.AI_DATABASE_URL!, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__aiQueryDatabaseClient = db
}

export interface QueryDatabaseToolContext {
  role?: string
  userId: string
  selectedFacilityId: number
}

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .trim()
}

function assertSelectOnly(sql: string): string {
  const withoutComments = stripSqlComments(sql)
  const normalized = withoutComments.replace(/\s+/g, ' ').trim()

  if (!normalized) {
    throw new Error('SQL is required.')
  }

  const semicolonCount = (normalized.match(/;/g) ?? []).length
  if (semicolonCount > 1 || (semicolonCount === 1 && !normalized.endsWith(';'))) {
    throw new Error('Only a single SQL statement is allowed.')
  }

  const statement = normalized.replace(/;$/, '')

  if (!/^(select|with)\b/i.test(statement)) {
    throw new Error('Only SELECT statements are allowed.')
  }

  if (FORBIDDEN_SQL_RE.test(statement)) {
    throw new Error('Mutation and DDL keywords are not allowed.')
  }

  if (FORBIDDEN_SCHEMA_RE.test(statement)) {
    throw new Error('Query only the ai_readonly schema.')
  }

  return statement
}

export function queryDatabaseTool(context: QueryDatabaseToolContext) {
  return tool({
    description:
      'Run one read-only SQL query against the ai_readonly schema. Use this for factual database lookups, counts, summaries, and joins. Prefer explicit columns and LIMIT for row queries.',
    inputSchema: QUERY_DATABASE_INPUT,
    execute: async ({ reasoning, sql }) => {
      const statement = assertSelectOnly(sql)

      const rows = await db.begin(async tx => {
        await tx`select set_config('statement_timeout', ${`${STATEMENT_TIMEOUT_MS}ms`}, true)`
        await tx`select set_config('search_path', 'ai_readonly,pg_catalog', true)`
        await tx`select set_config('app.current_role', ${context.role ?? 'unknown'}, true)`
        await tx`select set_config('app.current_user_id', ${context.userId}, true)`
        await tx`select set_config('app.current_facility_id', ${String(context.selectedFacilityId)}, true)`

        return tx.unsafe<Record<string, unknown>[]>(statement)
      })

      if (rows.length > MAX_RESULT_ROWS) {
        throw new Error(
          `Query returned ${rows.length} rows. Add a tighter WHERE clause or LIMIT ${MAX_RESULT_ROWS}.`,
        )
      }

      return {
        reasoning,
        rowCount: rows.length,
        rows,
      }
    },
  })
}
```

Gotcha from the docs: postgres.js only remains compatible with transaction pooling if prepared statements are disabled. The SQL guard is defense-in-depth only; the real enforcement is the read-only role, restricted schema exposure, and transaction-local session settings.

## 3. `streamText` Route Handler

The existing route already uses `streamText`, `stepCountIs`, quota checks, auth checks, and facility-selection logic. Keep those behaviors and swap the old read-RPC tool registry for a single `query_database` tool.

```ts
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
  validateUIMessages,
} from 'ai'
import type { GoogleLanguageModelOptions } from '@ai-sdk/google'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth/config'
import { chatRequestSchema } from '@/lib/ai/chat-request-schema'
import {
  AI_MAX_INPUT_CHARS,
  AI_MAX_MESSAGES,
  AI_MAX_OUTPUT_TOKENS,
} from '@/lib/ai/limits'
import { getChatModel } from '@/lib/ai/provider'
import { buildSystemPrompt } from '@/lib/ai/prompts/system'
import { DB_SCHEMA } from '@/lib/ai/prompts/db-schema'
import { queryDatabaseTool } from '@/lib/ai/tools/query-database'
import {
  checkUsageLimits,
  confirmUsage,
  recordUsage,
} from '@/lib/ai/usage-metering'
import { isPrivilegedRole, ROLES } from '@/lib/rbac'

const MAX_DB_TOOL_STEPS = 3
const ALLOWED_CHAT_ROLES = new Set<string>(Object.values(ROLES))

function plainError(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

function hasAllowedChatRole(value: unknown): boolean {
  return typeof value === 'string' && ALLOWED_CHAT_ROLES.has(value)
}

function toFacilityId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return undefined
}

function calculateInputChars(messages: unknown[]): number {
  return JSON.stringify(messages).length
}

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return plainError('Unauthorized', 401)
  }

  const user = session.user as Record<string, unknown>
  if (!hasAllowedChatRole(user.role)) {
    return plainError('Forbidden', 403)
  }

  const payload = await request.json().catch(() => null)
  const parsedRequest = chatRequestSchema.safeParse(payload)
  if (!parsedRequest.success) {
    return plainError('Invalid request payload', 400)
  }

  if (parsedRequest.data.messages.length > AI_MAX_MESSAGES) {
    return plainError('Request exceeds message limit', 400)
  }

  const inputChars = calculateInputChars(parsedRequest.data.messages)
  if (inputChars > AI_MAX_INPUT_CHARS) {
    return plainError('Request exceeds input size limit', 400)
  }

  let validatedMessages: UIMessage[]
  try {
    validatedMessages = await validateUIMessages({
      messages: parsedRequest.data.messages as UIMessage[],
    })
  } catch {
    return plainError('Invalid messages payload', 400)
  }

  const role = typeof user.role === 'string' ? user.role : undefined
  const sessionFacilityId = toFacilityId(user.don_vi)
  const requestedFacilityId = parsedRequest.data.selectedFacilityId
  let selectedFacilityId = sessionFacilityId

  if (isPrivilegedRole(role)) {
    if (requestedFacilityId === undefined) {
      return plainError(
        'Facility selection is required before using database lookup.',
        400,
      )
    }

    selectedFacilityId = requestedFacilityId
  }

  if (selectedFacilityId === undefined) {
    return plainError('Unable to resolve facility context for database access.', 400)
  }

  const promptUserId =
    typeof user.id === 'string' || typeof user.id === 'number'
      ? String(user.id)
      : undefined
  const usageUserId = promptUserId ?? 'unknown-session'
  const usageContext = { userId: usageUserId, tenantId: selectedFacilityId }

  const usageLimit = checkUsageLimits(usageContext)
  if (!usageLimit.allowed) {
    return plainError(usageLimit.message ?? 'AI usage limit exceeded.', 429)
  }

  recordUsage(usageContext)

  const modelMessages = await convertToModelMessages(validatedMessages)
  const systemPrompt = [
    buildSystemPrompt({
      role,
      userId: promptUserId,
      selectedFacilityId,
      selectedFacilityName: parsedRequest.data.selectedFacilityName ?? undefined,
    }),
    'When you need factual database information, use the `query_database` tool.',
    DB_SCHEMA,
  ].join('\n\n')

  const chatModel = getChatModel()
  const googleProviderOptions = {
    google: {
      thinkingConfig: { thinkingLevel: 'medium' },
    } satisfies GoogleLanguageModelOptions,
  }

  const result = streamText({
    model: chatModel.model,
    system: systemPrompt,
    messages: modelMessages,
    maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    stopWhen: stepCountIs(MAX_DB_TOOL_STEPS),
    tools: {
      query_database: queryDatabaseTool({
        role,
        userId: usageUserId,
        selectedFacilityId,
      }),
    },
    providerOptions: googleProviderOptions,
    onFinish({ usage, finishReason }) {
      if (finishReason !== 'error') {
        confirmUsage(usageContext, {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        })
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
```

Gotcha from the docs: in AI SDK v6 the loop is controlled with `stopWhen`, and the helper to cap steps is `stepCountIs(n)`. Keep this at `3` or less. Also, this repo already has a custom stream wrapper for post-processing draft outputs; if that behavior still matters, preserve the wrapper and only replace the `tools` object plus loop cap.

## 4. Schema Context Template

Add a dedicated prompt module such as `src/lib/ai/prompts/db-schema.ts`.

```ts
export const DB_SCHEMA = String.raw`
You can query only the read-only schema exposed to the AI.

Connection rules
- Query only views in ai_readonly.
- The server sets session context before each query:
  - app.current_role
  - app.current_user_id
  - app.current_facility_id
- Tenant filtering is enforced by the database views. Do not try to bypass it.
- Write one SQL statement only. Use SELECT or WITH ... SELECT.
- Never use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, or REVOKE.
- Prefer explicit columns; never use SELECT *.
- For row-returning queries, include a LIMIT unless you are returning a small, known result set.
- Do not reference public.*, auth.*, storage.*, or extensions.*.
- The tool does not support bind parameters; write complete SQL text.

Views

1. ai_readonly.equipment
- Purpose: equipment lookup, counts, status summaries
- Primary key: equipment_id
- Columns:
  - equipment_id integer
  - facility_id integer
  - equipment_code text
  - equipment_name text
  - status text
  - department_name text
  - location_name text
  - model text
  - serial_number text
  - last_maintenance_at timestamptz
- Relationships:
  - equipment.facility_id -> ai_readonly.facilities.facility_id

2. ai_readonly.repair_requests
- Purpose: repair workload, open tickets, turnaround time
- Primary key: repair_request_id
- Columns:
  - repair_request_id integer
  - equipment_id integer
  - facility_id integer
  - request_status text
  - priority text
  - requested_at timestamptz
  - resolved_at timestamptz
- Relationships:
  - repair_requests.equipment_id -> ai_readonly.equipment.equipment_id

3. ai_readonly.facilities
- Purpose: facility metadata already scoped for the current user/session
- Primary key: facility_id
- Columns:
  - facility_id integer
  - facility_name text
  - region_name text

Query patterns
- Equipment by code:
  select equipment_id, equipment_code, equipment_name, status
  from ai_readonly.equipment
  where equipment_code = 'TB-001'
  limit 1

- Open repair count:
  select count(*) as open_repairs
  from ai_readonly.repair_requests
  where request_status in ('open', 'in_progress')

- Latest maintenance-ready list:
  select equipment_id, equipment_name, last_maintenance_at
  from ai_readonly.equipment
  where last_maintenance_at is not null
  order by last_maintenance_at desc
  limit 20
`
```

Gotcha from the docs: prompt schema context improves model reliability but it is not a security control. Keep the prompt limited to the curated AI surface and do not expose the full `public` schema.

## 5. Migration Checklist

Use this order so the rollout remains safe and reversible.

```text
1. Create curated `ai_readonly` views for the data shapes the AI actually needs.
2. Add the dedicated Supabase login role and confirm it can only `SELECT` those views.
3. Add `AI_DATABASE_URL` to Vercel using the Supabase Transaction pooler URI.
4. Set `AI_MAX_TOOL_STEPS=3` in Vercel, or clamp the route to `Math.min(AI_MAX_TOOL_STEPS, 3)`.
5. Install `postgres` if it is not already present.
6. Add `src/lib/ai/tools/query-database.ts`.
7. Add `src/lib/ai/prompts/db-schema.ts`.
8. In `src/app/api/chat/route.ts`, remove the old read-RPC tool wiring and register only `query_database` for factual DB access.
9. Keep non-RPC draft tools if they still matter; this refactor only replaces read-RPC tools.
10. Delete `src/lib/ai/tools/rpc-tool-executor.ts` once nothing imports it.
11. Remove read-only RPC definitions from `src/lib/ai/tools/registry.ts`; if draft tools remain, split the file so draft orchestration is separate from database querying.
12. Remove AI-only intent routing that existed only to choose among old RPC tools; keep auth, quota, and selected-facility checks.
13. Stop sending read-tool-specific `requestedTools` from the client once the frontend is updated.
14. Add tests for:
    - rejection of INSERT / UPDATE / DELETE / DROP / ALTER / multi-statement SQL
    - rejection of `public.*`, `auth.*`, and `storage.*`
    - `prepare: false` client configuration
    - route-level `stopWhen: stepCountIs(3)`
    - tenant isolation through scoped views and session context
    - no remaining imports of the old AI RPC executor
15. Deploy to a Vercel preview and verify:
    - exact equipment lookup
    - aggregate counts
    - join across two `ai_readonly` views
    - empty-result behavior
    - over-broad result rejection
```

Gotcha from the docs: remove only the AI-facing RPC tools. The broader app still uses `/api/rpc/[fn]`, so this is not a full RPC-platform migration.

## Repo Integration Notes

Current relevant files discovered during research:

- `src/app/api/chat/route.ts` already uses `streamText`, `stepCountIs`, usage metering, and facility checks.
- `src/lib/ai/tools/registry.ts` currently defines many read-only RPC-backed tools and validates `requestedTools`.
- `src/lib/ai/tools/rpc-tool-executor.ts` currently forwards tool calls to `/api/rpc/[fn]`.
- `src/app/api/rpc/[fn]/route.ts` currently enforces tenant isolation by signing JWT claims and overriding `p_don_vi`.

This means the highest-risk part of the refactor is not AI SDK wiring. It is preserving tenant isolation after removing the RPC proxy from the AI path.

## Test Scenarios

- `select equipment_name from ai_readonly.equipment limit 5` succeeds.
- `with recent as (...) select * from recent limit 10` succeeds.
- `insert into ...`, `drop table ...`, and `select 1; select 2` are rejected before execution.
- A query referencing `public.thiet_bi` or `auth.users` is rejected before execution.
- A non-global user cannot read another facility’s rows even if the SQL tries.
- A privileged user without `selectedFacilityId` still fails with the route’s facility precheck.
- The route never exceeds 3 tool steps.
- Large result sets trigger the row limit error and force narrower queries.
