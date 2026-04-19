import { tool, type Tool } from 'ai'
import { z } from 'zod'

import { ASSISTANT_SQL_TOOL_NAME } from '@/lib/ai/sql/constants'
import {
  executeAuditedAssistantSql,
  type ExecuteAuditedAssistantSqlParams,
} from '@/lib/ai/sql/audited-executor'
import type { AssistantSqlResult } from '@/lib/ai/sql/executor'
import type { AssistantSqlScope } from '@/lib/ai/sql/scope'

export { ASSISTANT_SQL_TOOL_NAME as QUERY_DATABASE_TOOL_NAME }

const queryDatabaseInputSchema = z
  .object({
    reasoning: z.string().trim().min(1).max(500),
    sql: z.string().trim().min(1).max(20_000),
  })
  .strict()

type QueryDatabaseToolInput = z.infer<typeof queryDatabaseInputSchema>

interface QueryDatabaseToolOutput {
  reasoning: string
  rowCount: number
  rows: Array<Record<string, unknown>>
}

export interface QueryDatabaseToolParams {
  execute?: ExecuteAuditedAssistantSqlParams['execute']
  request: Request
  scope: AssistantSqlScope
}

export function queryDatabaseTool({
  execute,
  request,
  scope,
}: QueryDatabaseToolParams): Tool<QueryDatabaseToolInput, QueryDatabaseToolOutput> {
  return tool<QueryDatabaseToolInput, QueryDatabaseToolOutput>({
    description:
      'Run one read-only SQL query against the ai_readonly semantic layer for the server-injected facility scope.',
    inputSchema: queryDatabaseInputSchema,
    execute: async ({
      reasoning,
      sql,
    }: QueryDatabaseToolInput): Promise<QueryDatabaseToolOutput> => {
      const result = await executeAuditedAssistantSql({
        execute,
        request,
        scope,
        sql,
      })

      return {
        reasoning,
        rowCount: result.rowCount,
        rows: result.rows,
      }
    },
  })
}
