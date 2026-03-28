import { describe, expect, it } from 'vitest'

import { wrapRpcResultAsEnvelope } from '../rpc-tool-executor'
import {
  compactToolOutput,
  isToolResponseEnvelope,
} from '../tool-response-envelope'

const SAMPLE_DEPT_PAYLOAD = {
  data: [
    { name: 'Khoa Ngoại', equipment_count: 12 },
    { name: 'Khoa Nội', equipment_count: 8 },
    { name: 'Phòng Xét nghiệm', equipment_count: 25 },
  ],
  total: 3,
}

describe('departmentList envelope contract', () => {
  it('returns a valid ToolResponseEnvelope', () => {
    const envelope = wrapRpcResultAsEnvelope('departmentList', SAMPLE_DEPT_PAYLOAD)
    expect(isToolResponseEnvelope(envelope)).toBe(true)
  })

  it('modelSummary.itemCount matches total', () => {
    const envelope = wrapRpcResultAsEnvelope('departmentList', SAMPLE_DEPT_PAYLOAD)
    expect(envelope.modelSummary.itemCount).toBe(3)
  })

  it('modelSummary.importantFields contains department names', () => {
    const envelope = wrapRpcResultAsEnvelope('departmentList', SAMPLE_DEPT_PAYLOAD)
    expect(envelope.modelSummary.importantFields).toBeDefined()
    expect(envelope.modelSummary.importantFields).toEqual({
      departments: ['Khoa Ngoại', 'Khoa Nội', 'Phòng Xét nghiệm'],
    })
  })

  it('uiArtifact carries rawPayload for UI rendering', () => {
    const envelope = wrapRpcResultAsEnvelope('departmentList', SAMPLE_DEPT_PAYLOAD)
    expect(envelope.uiArtifact).toBeDefined()
    expect(envelope.uiArtifact?.rawPayload).toEqual(SAMPLE_DEPT_PAYLOAD)
  })

  it('compactToolOutput strips uiArtifact but keeps modelSummary', () => {
    const envelope = wrapRpcResultAsEnvelope('departmentList', SAMPLE_DEPT_PAYLOAD)
    const compacted = compactToolOutput('departmentList', envelope)

    expect(compacted).toHaveProperty('modelSummary')
    expect(compacted).not.toHaveProperty('uiArtifact')
    expect((compacted as Record<string, unknown>).modelSummary).toEqual(
      envelope.modelSummary,
    )
  })

  it('handles empty department list gracefully', () => {
    const emptyPayload = { data: [], total: 0 }
    const envelope = wrapRpcResultAsEnvelope('departmentList', emptyPayload)

    expect(envelope.modelSummary.itemCount).toBe(0)
    expect(envelope.modelSummary.importantFields).toEqual({
      departments: [],
    })
  })

  it('filters out non-string department names', () => {
    const mixedPayload = {
      data: [
        { name: 'Khoa Ngoại', equipment_count: 12 },
        { name: null, equipment_count: 5 },
        { equipment_count: 3 },
        { name: '', equipment_count: 1 },
      ],
      total: 4,
    }
    const envelope = wrapRpcResultAsEnvelope('departmentList', mixedPayload)

    // Only non-empty strings should be included
    expect(envelope.modelSummary.importantFields).toEqual({
      departments: ['Khoa Ngoại', ''],
    })
  })
})
