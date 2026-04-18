import { describe, expect, it } from 'vitest'

import { resolveAssistantScope } from '../scope'

const FACILITY_REQUIRED_MESSAGE =
  'Anh/chị vui lòng chọn cơ sở y tế tại bộ lọc đơn vị trên thanh điều hướng (phía trên bên trái màn hình) trước khi sử dụng trợ lý tra cứu.'

describe('AssistantSqlScope resolver', () => {
  it('pins non-privileged roles to the session facility and ignores selected facility overrides', () => {
    const result = resolveAssistantScope({
      user: { id: 'u1', role: 'technician', don_vi: 2 },
      requestedFacilityId: 999,
      requireFacilityScope: true,
    })

    expect(result).toEqual({
      ok: true,
      promptUserId: 'u1',
      usageUserId: 'u1',
      selectedFacilityId: 2,
      assistantSqlScope: {
        effectiveFacilityId: 2,
        facilitySource: 'session',
        normalizedRole: 'technician',
        rawRole: 'technician',
        sessionFacilityId: 2,
        selectedFacilityId: 999,
        userId: 'u1',
      },
    })
  })

  it('requires privileged roles to choose a facility before scoped tool execution', () => {
    const result = resolveAssistantScope({
      user: { id: 'u1', role: 'global', don_vi: null },
      requestedFacilityId: undefined,
      requireFacilityScope: true,
    })

    expect(result).toEqual({
      ok: false,
      message: FACILITY_REQUIRED_MESSAGE,
    })
  })

  it('uses selected facility provenance for privileged roles', () => {
    const result = resolveAssistantScope({
      user: { id: 'u1', role: 'regional_leader', don_vi: null },
      requestedFacilityId: 7,
      requireFacilityScope: true,
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        selectedFacilityId: 7,
        assistantSqlScope: expect.objectContaining({
          effectiveFacilityId: 7,
          facilitySource: 'selected',
          normalizedRole: 'regional_leader',
          selectedFacilityId: 7,
          userId: 'u1',
        }),
      }),
    )
  })

  it('normalizes raw admin sessions to global semantics without losing raw role', () => {
    const result = resolveAssistantScope({
      user: { id: 'u1', role: 'admin', don_vi: null },
      requestedFacilityId: 11,
      requireFacilityScope: true,
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        selectedFacilityId: 11,
        assistantSqlScope: expect.objectContaining({
          effectiveFacilityId: 11,
          normalizedRole: 'global',
          rawRole: 'admin',
        }),
      }),
    )
  })

  it('does not require a facility when no scoped tool execution is requested', () => {
    const result = resolveAssistantScope({
      user: { id: 'u1', role: 'global', don_vi: null },
      requestedFacilityId: undefined,
      requireFacilityScope: false,
    })

    expect(result).toEqual({
      ok: true,
      promptUserId: 'u1',
      usageUserId: 'u1',
      selectedFacilityId: undefined,
      assistantSqlScope: undefined,
    })
  })
})
