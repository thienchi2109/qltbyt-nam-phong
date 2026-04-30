import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/ai/sql/audited-executor', () => ({
  executeAuditedAssistantSql: ({
    execute,
  }: {
    execute?: (sql: string) => Promise<{ rowCount: number; rows: Array<Record<string, unknown>> }>
    sql: string
  }) => execute?.('SELECT 1'),
}))

import { queryDatabaseTool } from '../query-database'

function buildRequest() {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  })
}

describe('queryDatabaseTool', () => {
  it('wraps grouped department counts into an envelope with a bar reportChart artifact', async () => {
    const execute = vi.fn().mockResolvedValue({
      rowCount: 2,
      rows: [
        { khoa_phong_quan_ly: 'ICU', so_luong: 12 },
        { khoa_phong_quan_ly: 'Xét nghiệm', so_luong: 7 },
      ],
    })

    const toolDef = queryDatabaseTool({
      execute,
      request: buildRequest(),
      scope: { tenantId: 17, userId: 'u1' },
    })

    const result = await toolDef.execute?.({
      reasoning: 'Thống kê số lượng thiết bị theo khoa trong đơn vị hiện tại',
      sql: 'SELECT khoa_phong_quan_ly, COUNT(*) AS so_luong FROM ai_readonly.equipment_search GROUP BY khoa_phong_quan_ly ORDER BY so_luong DESC',
    })

    expect(result).toMatchObject({
      modelSummary: {
        itemCount: 2,
      },
      followUpContext: {
        queryResult: {
          reasoning: 'Thống kê số lượng thiết bị theo khoa trong đơn vị hiện tại',
          rowCount: 2,
          rows: [
            { khoa_phong_quan_ly: 'ICU', so_luong: 12 },
            { khoa_phong_quan_ly: 'Xét nghiệm', so_luong: 7 },
          ],
          truncated: false,
        },
      },
      uiArtifact: {
        rawPayload: {
          kind: 'reportChart',
          version: 1,
          chart: {
            type: 'bar',
            xKey: 'khoa_phong_quan_ly',
            yKey: 'so_luong',
            data: [
              { khoa_phong_quan_ly: 'ICU', so_luong: 12 },
              { khoa_phong_quan_ly: 'Xét nghiệm', so_luong: 7 },
            ],
          },
        },
      },
    })
  })

  it('wraps grouped equipment status counts into an envelope with a pie reportChart artifact', async () => {
    const execute = vi.fn().mockResolvedValue({
      rowCount: 2,
      rows: [
        { tinh_trang_hien_tai: 'Hoạt động', so_luong: 21 },
        { tinh_trang_hien_tai: 'Ngưng sử dụng', so_luong: 4 },
      ],
    })

    const toolDef = queryDatabaseTool({
      execute,
      request: buildRequest(),
      scope: { tenantId: 17, userId: 'u1' },
    })

    const result = await toolDef.execute?.({
      reasoning: 'Thống kê tỷ lệ tình trạng thiết bị trong đơn vị hiện tại',
      sql: 'SELECT tinh_trang_hien_tai, COUNT(*) AS so_luong FROM ai_readonly.equipment_search GROUP BY tinh_trang_hien_tai ORDER BY so_luong DESC',
    })

    expect(result).toMatchObject({
      uiArtifact: {
        rawPayload: {
          kind: 'reportChart',
          version: 1,
          chart: {
            type: 'pie',
            labelKey: 'tinh_trang_hien_tai',
            valueKey: 'so_luong',
            data: [
              { tinh_trang_hien_tai: 'Hoạt động', so_luong: 21 },
              { tinh_trang_hien_tai: 'Ngưng sử dụng', so_luong: 4 },
            ],
          },
        },
      },
    })
  })

  it('accepts stringified SQL count values when building report charts', async () => {
    const execute = vi.fn().mockResolvedValue({
      rowCount: 2,
      rows: [
        { khoa_phong_quan_ly: 'ICU', so_luong: '12' },
        { khoa_phong_quan_ly: 'Xét nghiệm', so_luong: '7' },
      ],
    })

    const toolDef = queryDatabaseTool({
      execute,
      request: buildRequest(),
      scope: { tenantId: 17, userId: 'u1' },
    })

    const result = await toolDef.execute?.({
      reasoning: 'Thống kê số lượng thiết bị theo khoa trong đơn vị hiện tại',
      sql: 'SELECT khoa_phong_quan_ly, COUNT(*) AS so_luong FROM ai_readonly.equipment_search GROUP BY khoa_phong_quan_ly ORDER BY so_luong DESC',
    })

    expect(result).toMatchObject({
      uiArtifact: {
        rawPayload: {
          kind: 'reportChart',
          chart: {
            data: [
              { khoa_phong_quan_ly: 'ICU', so_luong: 12 },
              { khoa_phong_quan_ly: 'Xét nghiệm', so_luong: 7 },
            ],
          },
        },
      },
    })
  })

  it('keeps compact follow-up query rows for later multi-turn reasoning', async () => {
    const execute = vi.fn().mockResolvedValue({
      rowCount: 12,
      rows: Array.from({ length: 12 }, (_, index) => ({
        khoa_phong_quan_ly: `Khoa ${index + 1}`,
        so_luong: index + 1,
      })),
    })

    const toolDef = queryDatabaseTool({
      execute,
      request: buildRequest(),
      scope: { tenantId: 17, userId: 'u1' },
    })

    const result = await toolDef.execute?.({
      reasoning: 'Liệt kê số lượng thiết bị theo khoa',
      sql: 'SELECT khoa_phong_quan_ly, COUNT(*) AS so_luong FROM ai_readonly.equipment_search GROUP BY khoa_phong_quan_ly ORDER BY so_luong DESC',
    })

    expect(result?.followUpContext).toEqual({
      queryResult: {
        reasoning: 'Liệt kê số lượng thiết bị theo khoa',
        rowCount: 12,
        rows: Array.from({ length: 10 }, (_, index) => ({
          khoa_phong_quan_ly: `Khoa ${index + 1}`,
          so_luong: index + 1,
        })),
        truncated: true,
      },
    })
  })

  it('falls back to raw payload when rows are not eligible for chart rendering', async () => {
    const execute = vi.fn().mockResolvedValue({
      rowCount: 2,
      rows: [
        { ten_thiet_bi: 'Máy thở', khoa_phong_quan_ly: 'ICU' },
        { ten_thiet_bi: 'Monitor', khoa_phong_quan_ly: 'ICU' },
      ],
    })

    const toolDef = queryDatabaseTool({
      execute,
      request: buildRequest(),
      scope: { tenantId: 17, userId: 'u1' },
    })

    const result = await toolDef.execute?.({
      reasoning: 'Liệt kê thiết bị trong khoa ICU',
      sql: "SELECT ten_thiet_bi, khoa_phong_quan_ly FROM ai_readonly.equipment_search WHERE khoa_phong_quan_ly = 'ICU'",
    })

    expect(result).toMatchObject({
      uiArtifact: {
        rawPayload: {
          data: [
            { ten_thiet_bi: 'Máy thở', khoa_phong_quan_ly: 'ICU' },
            { ten_thiet_bi: 'Monitor', khoa_phong_quan_ly: 'ICU' },
          ],
          rowCount: 2,
          reasoning: 'Liệt kê thiết bị trong khoa ICU',
        },
      },
      followUpContext: {
        queryResult: {
          rowCount: 2,
          truncated: false,
        },
      },
    })
  })

  it('wraps execution failures with query_database context', async () => {
    const underlyingError = new Error('permission denied')
    const execute = vi.fn().mockRejectedValue(underlyingError)

    const toolDef = queryDatabaseTool({
      execute,
      request: buildRequest(),
      scope: { tenantId: 17, userId: 'u1' },
    })

    await expect(
      toolDef.execute?.({
        reasoning: 'Thử truy vấn lỗi',
        sql: 'SELECT * FROM forbidden_table',
      }),
    ).rejects.toMatchObject({
      message: 'query_database execution failed',
      cause: underlyingError,
    })
  })
})
