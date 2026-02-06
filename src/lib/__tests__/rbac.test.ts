import {
  isGlobalRole,
  isRegionalLeaderRole,
  isEquipmentManagerRole,
  isDeptScopedRole,
  ROLES,
} from '../rbac'

describe('RBAC Utilities', () => {
  const nullishValues = [null, undefined]

  it('should fail closed for null/undefined', () => {
    nullishValues.forEach(value => {
      expect(isGlobalRole(value)).toBe(false)
      expect(isRegionalLeaderRole(value)).toBe(false)
      expect(isEquipmentManagerRole(value)).toBe(false)
      expect(isDeptScopedRole(value)).toBe(false)
    })
  })

  it('should return false for empty or whitespace-only strings', () => {
    const values = ['', '   ', '\n', '\t']
    values.forEach(value => {
      expect(isGlobalRole(value)).toBe(false)
      expect(isRegionalLeaderRole(value)).toBe(false)
      expect(isEquipmentManagerRole(value)).toBe(false)
      expect(isDeptScopedRole(value)).toBe(false)
    })
  })

  it('should handle case-insensitivity and whitespace', () => {
    expect(isGlobalRole(' GLOBAL ')).toBe(true)
    expect(isGlobalRole('Admin')).toBe(true)
    expect(isEquipmentManagerRole('  To_QLTB ')).toBe(true)
    expect(isRegionalLeaderRole(' regional_leader ')).toBe(true)
    expect(isDeptScopedRole(' QLTB_KHOA ')).toBe(true)
  })

  it('should identify global roles correctly', () => {
    const allowed = [ROLES.GLOBAL, ROLES.ADMIN]
    const denied = [
      ROLES.REGIONAL_LEADER,
      ROLES.TO_QLTB,
      ROLES.TECHNICIAN,
      ROLES.QLTB_KHOA,
      ROLES.USER,
    ]

    allowed.forEach(role => {
      expect(isGlobalRole(role)).toBe(true)
    })

    denied.forEach(role => {
      expect(isGlobalRole(role)).toBe(false)
    })
  })

  it('should identify equipment manager roles correctly', () => {
    const allowed = [ROLES.GLOBAL, ROLES.ADMIN, ROLES.TO_QLTB]
    const denied = [
      ROLES.REGIONAL_LEADER,
      ROLES.TECHNICIAN,
      ROLES.QLTB_KHOA,
      ROLES.USER,
    ]

    allowed.forEach(role => {
      expect(isEquipmentManagerRole(role)).toBe(true)
    })

    denied.forEach(role => {
      expect(isEquipmentManagerRole(role)).toBe(false)
    })
  })

  it('should identify regional leader roles correctly', () => {
    const allowed = [ROLES.REGIONAL_LEADER]
    const denied = [
      ROLES.GLOBAL,
      ROLES.ADMIN,
      ROLES.TO_QLTB,
      ROLES.TECHNICIAN,
      ROLES.QLTB_KHOA,
      ROLES.USER,
    ]

    allowed.forEach(role => {
      expect(isRegionalLeaderRole(role)).toBe(true)
    })

    denied.forEach(role => {
      expect(isRegionalLeaderRole(role)).toBe(false)
    })
  })

  it('should identify department-scoped roles correctly', () => {
    const allowed = [ROLES.TECHNICIAN, ROLES.QLTB_KHOA]
    const denied = [
      ROLES.GLOBAL,
      ROLES.ADMIN,
      ROLES.REGIONAL_LEADER,
      ROLES.TO_QLTB,
      ROLES.USER,
    ]

    allowed.forEach(role => {
      expect(isDeptScopedRole(role)).toBe(true)
    })

    denied.forEach(role => {
      expect(isDeptScopedRole(role)).toBe(false)
    })
  })

  it('should return false for unknown roles', () => {
    const values = ['super_admin', 'unknown', 'manager']
    values.forEach(value => {
      expect(isGlobalRole(value)).toBe(false)
      expect(isRegionalLeaderRole(value)).toBe(false)
      expect(isEquipmentManagerRole(value)).toBe(false)
      expect(isDeptScopedRole(value)).toBe(false)
    })
  })
})
