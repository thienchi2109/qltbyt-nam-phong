import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'

import {
  getRepairRequestDraftSessionState,
  hasRepairRequestDraftStartIntent,
} from '../repair-request-draft-session'

function makeUserMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
  } as UIMessage
}

function makeAssistantMessage(
  id: string,
  parts: Array<Record<string, unknown>>,
): UIMessage {
  return {
    id,
    role: 'assistant',
    parts,
  } as UIMessage
}

describe('repair-request-draft session state', () => {
  it('recognizes the shipped starter-chip phrase as explicit draft intent', () => {
    expect(
      hasRepairRequestDraftStartIntent('Tạo phiếu yêu cầu sửa chữa thiết bị'),
    ).toBe(true)
  })

  it('does not treat a cancel phrase as draft-start intent when the phrases overlap', () => {
    expect(hasRepairRequestDraftStartIntent('Hủy tạo phiếu sửa chữa')).toBe(
      false,
    )
  })

  it('keeps the session active across follow-up turns without repeating the start phrase', () => {
    const result = getRepairRequestDraftSessionState([
      makeUserMessage('u1', 'Tạo phiếu yêu cầu sửa chữa thiết bị'),
      makeAssistantMessage('a1', [
        { type: 'text', text: 'Anh/chị cho tôi mã thiết bị và mô tả sự cố.' },
      ]),
      makeUserMessage('u2', 'Máy X bị mất nguồn, cần kiểm tra bo nguồn'),
    ])

    expect(result).toEqual({
      status: 'active',
      startMessageIndex: 0,
    })
  })

  it('cancels an active session when the user opts out', () => {
    const result = getRepairRequestDraftSessionState([
      makeUserMessage('u1', 'Tạo phiếu sửa chữa cho thiết bị X'),
      makeAssistantMessage('a1', [
        { type: 'text', text: 'Anh/chị cho tôi mô tả sự cố.' },
      ]),
      makeUserMessage('u2', 'Thôi không tạo nữa'),
    ])

    expect(result).toEqual({ status: 'inactive' })
  })

  it('does not activate a session for a cancel phrase when no session is active', () => {
    const result = getRepairRequestDraftSessionState([
      makeUserMessage('u1', 'Hủy tạo phiếu sửa chữa'),
    ])

    expect(result).toEqual({ status: 'inactive' })
  })

  it('closes the session after a repair draft tool output is present', () => {
    const result = getRepairRequestDraftSessionState([
      makeUserMessage('u1', 'Tạo phiếu sửa chữa cho thiết bị X'),
      makeAssistantMessage('a1', [
        {
          type: 'tool-generateRepairRequestDraft',
          toolCallId: 'tc-1',
          toolName: 'generateRepairRequestDraft',
          state: 'output-available',
          output: { kind: 'repairRequestDraft' },
        },
      ]),
      makeUserMessage('u2', 'Bổ sung thêm ghi chú'),
    ])

    expect(result).toEqual({ status: 'inactive' })
  })
})

