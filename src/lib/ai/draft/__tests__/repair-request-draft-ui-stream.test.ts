import { createUIMessageStream, readUIMessageStream } from 'ai'
import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'

import { writeRepairRequestDraftToolResult } from '../repair-request-draft-ui-stream'

describe('repair-request-draft UI stream contract', () => {
  it('turns synthetic tool chunks into a tool-generateRepairRequestDraft message part', async () => {
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: 'start' })
        writeRepairRequestDraftToolResult(writer, {
          toolCallId: 'repair-request-draft-42',
          input: {
            draftIntent: true,
            evidenceRefs: ['equipmentLookup'],
            thiet_bi_id: 42,
            mo_ta_su_co: 'Thiết bị mất nguồn',
            hang_muc_sua_chua: 'Kiểm tra bo nguồn',
          },
          output: {
            kind: 'repairRequestDraft',
            draftOnly: true,
            source: 'assistant',
            confidence: 'medium',
            equipment: { thiet_bi_id: 42 },
            formData: {
              thiet_bi_id: 42,
              mo_ta_su_co: 'Thiết bị mất nguồn',
              hang_muc_sua_chua: 'Kiểm tra bo nguồn',
              ngay_mong_muon_hoan_thanh: null,
              don_vi_thuc_hien: null,
              ten_don_vi_thue: null,
            },
            missingFields: [],
            reviewNotes: [],
          },
        })
        writer.write({ type: 'finish', finishReason: 'stop' })
      },
    })

    let latestMessage: UIMessage | undefined
    for await (const message of readUIMessageStream({ stream })) {
      latestMessage = message
    }

    expect(latestMessage?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-generateRepairRequestDraft',
          state: 'output-available',
          output: expect.objectContaining({ kind: 'repairRequestDraft' }),
        }),
      ]),
    )
  })
})
