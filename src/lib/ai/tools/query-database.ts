import { tool, type Tool } from 'ai'
import { z } from 'zod'

import { ASSISTANT_SQL_TOOL_NAME } from '@/lib/ai/sql/constants'
import { QUERY_DATABASE_TOOL_DESCRIPTION } from '@/lib/ai/sql/schema-cheatsheet'
import {
  executeAuditedAssistantSql,
  type ExecuteAuditedAssistantSqlParams,
} from '@/lib/ai/sql/audited-executor'
import type { AssistantSqlScope } from '@/lib/ai/sql/scope'
import type {
  ReportChartArtifact,
  ToolResponseEnvelope,
} from '@/lib/ai/tools/tool-response-envelope'
import { isReportChartArtifact } from '@/lib/ai/tools/tool-response-envelope'

export { ASSISTANT_SQL_TOOL_NAME as QUERY_DATABASE_TOOL_NAME }

const queryDatabaseInputSchema = z
  .object({
    reasoning: z.string().trim().min(1).max(500),
    sql: z.string().trim().min(1).max(20_000),
  })
  .strict()

type QueryDatabaseToolInput = z.infer<typeof queryDatabaseInputSchema>

const GROUPED_REPORT_DIMENSIONS = [
  {
    key: 'khoa_phong_quan_ly',
    title: 'Số lượng thiết bị theo khoa',
    chartType: 'bar' as const,
  },
  {
    key: 'vi_tri_lap_dat',
    title: 'Số lượng thiết bị theo vị trí lắp đặt',
    chartType: 'bar' as const,
  },
  {
    key: 'nguoi_dang_truc_tiep_quan_ly',
    title: 'Số lượng thiết bị theo người quản lý trực tiếp',
    chartType: 'bar' as const,
  },
  {
    key: 'tinh_trang_hien_tai',
    title: 'Tỷ lệ tình trạng thiết bị',
    chartType: 'pie' as const,
  },
] as const

const COUNT_KEYS = ['so_luong', 'count', 'total'] as const

function isRecordRow(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumericValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function findCountKey(
  rows: Array<Record<string, unknown>>,
): string | undefined {
  return COUNT_KEYS.find((candidate) =>
    rows.every((row) => isNumericValue(row[candidate])),
  )
}

function buildReportChartArtifact(
  rows: Array<Record<string, unknown>>,
): ReportChartArtifact | undefined {
  if (rows.length === 0 || rows.length > 20) {
    return undefined
  }

  const countKey = findCountKey(rows)
  if (!countKey) {
    return undefined
  }

  for (const dimension of GROUPED_REPORT_DIMENSIONS) {
    const matchesDimension = rows.every((row) => {
      const label = row[dimension.key]
      return (
        (typeof label === 'string' && label.trim().length > 0) ||
        typeof label === 'number'
      )
    })

    if (!matchesDimension) {
      continue
    }

    const base = {
      kind: 'reportChart' as const,
      version: 1 as const,
      title: dimension.title,
      table: {
        columns: Object.keys(rows[0] ?? {}),
        rows,
      },
    }

    if (dimension.chartType === 'pie') {
      return {
        ...base,
        chart: {
          type: 'pie',
          labelKey: dimension.key,
          valueKey: countKey,
          data: rows,
          innerRadius: 56,
        },
      }
    }

    return {
      ...base,
      chart: {
        type: 'bar',
        xKey: dimension.key,
        yKey: countKey,
        data: rows,
      },
    }
  }

  return undefined
}

function buildQueryDatabaseEnvelope(
  reasoning: string,
  rowCount: number,
  rows: Array<Record<string, unknown>>,
): ToolResponseEnvelope {
  const chartArtifact = buildReportChartArtifact(rows)
  const rawPayload = chartArtifact ?? {
    data: rows,
    rowCount,
    reasoning,
  }

  return {
    modelSummary: {
      summaryText: `query_database: ${rowCount} row(s).`,
      itemCount: rowCount,
      ...(chartArtifact && {
        importantFields: {
          chartTitle: chartArtifact.title,
        },
      }),
    },
    uiArtifact: { rawPayload },
  }
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
}: QueryDatabaseToolParams): Tool<QueryDatabaseToolInput, ToolResponseEnvelope> {
  return tool<QueryDatabaseToolInput, ToolResponseEnvelope>({
    description: QUERY_DATABASE_TOOL_DESCRIPTION,
    inputSchema: queryDatabaseInputSchema,
    execute: async ({
      reasoning,
      sql,
    }: QueryDatabaseToolInput): Promise<ToolResponseEnvelope> => {
      const result = await executeAuditedAssistantSql({
        execute,
        request,
        scope,
        sql,
      })

      const rows = result.rows.filter(isRecordRow)
      const envelope = buildQueryDatabaseEnvelope(reasoning, result.rowCount, rows)

      if (
        envelope.uiArtifact &&
        isReportChartArtifact(envelope.uiArtifact.rawPayload)
      ) {
        return envelope
      }

      return envelope
    },
  })
}
