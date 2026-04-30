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
      uiArtifact: {
        rawPayload: {
          kind: 'reportChart',
          version: 1,
          chart: {
            type: 'bar',
            xKey: 'khoa_phong_quan_ly',
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
            data: [
              { tinh_trang_hien_tai: 'Hoạt động', so_luong: 21 },
              { tinh_trang_hien_tai: 'Ngưng sử dụng', so_luong: 4 },
            ],
          },
        },
      },
    })
  })
})
