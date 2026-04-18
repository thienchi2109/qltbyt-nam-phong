import { tool } from 'ai'
import { z } from 'zod'

import { ASSISTANT_SQL_TOOL_NAME } from '@/lib/ai/sql/constants'
import { executeAssistantSql, type AssistantSqlResult } from '@/lib/ai/sql/executor'
import type { AssistantSqlScope } from '@/lib/ai/sql/scope'

export const QUERY_DATABASE_TOOL_NAME = ASSISTANT_SQL_TOOL_NAME

const queryDatabaseInputSchema = z
  .object({
    reasoning: z.string().trim().min(1).max(500),
    sql: z.string().trim().min(1).max(20_000),
  })
  .strict()

export interface QueryDatabaseToolParams {
  execute?: (params: {
    scope: AssistantSqlScope
    sql: string
  }) => Promise<AssistantSqlResult>
  scope: AssistantSqlScope
}

export function queryDatabaseTool({
  execute = executeAssistantSql,
  scope,
}: QueryDatabaseToolParams) {
  return tool({
    description:
      'Run one read-only SQL query against the ai_readonly semantic layer for the server-injected facility scope.',
    inputSchema: queryDatabaseInputSchema,
    execute: async ({ reasoning, sql }) => {
      const result = await execute({ scope, sql })

      return {
        reasoning,
        rowCount: result.rowCount,
        rows: result.rows,
      }
    },
  })
}

