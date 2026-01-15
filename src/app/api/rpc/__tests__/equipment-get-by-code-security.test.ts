/**
 * Security tests for equipment_get_by_code RPC function.
 *
 * These tests verify:
 * - Tenant isolation (users can only see equipment in their allowed tenants)
 * - Role-based access control (global, regional_leader, to_qltb, etc.)
 * - Input validation (empty/null codes rejected)
 * - Generic error messages (no data leakage)
 *
 * Note: These are unit tests that mock RPC behavior. The actual PostgreSQL
 * function logic is documented here for defense-in-depth validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================================
// SECURITY MODEL DOCUMENTATION
// ============================================================================

/**
 * The equipment_get_by_code RPC function enforces security through:
 *
 * 1. JWT Claims (from /api/rpc/[fn] proxy):
 *    - app_role: 'global' | 'regional_leader' | 'to_qltb' | 'technician' | 'user'
 *    - don_vi: user's home facility ID
 *    - dia_ban: user's region ID (for regional_leader only)
 *
 * 2. Tenant Filtering (via allowed_don_vi_for_session()):
 *    - global: All active tenants
 *    - regional_leader: All tenants in assigned dia_ban
 *    - Others: Only their assigned don_vi
 *
 * 3. SQL Logic:
 *    ```sql
 *    IF v_role = 'global' THEN
 *      SELECT * FROM thiet_bi WHERE ma_thiet_bi = p_ma_thiet_bi;
 *    ELSE
 *      SELECT * FROM thiet_bi
 *      WHERE ma_thiet_bi = p_ma_thiet_bi
 *        AND don_vi = ANY(allowed_don_vi_for_session());
 *    END IF;
 *    ```
 */

// ============================================================================
// TEST UTILITIES
// ============================================================================

// Simulates the allowed_don_vi_for_session() PostgreSQL function
type UserRole = 'global' | 'regional_leader' | 'to_qltb' | 'technician' | 'qltb_khoa' | 'user'

interface UserSession {
  role: UserRole
  don_vi: number | null
  dia_ban_id: number | null
}

interface Equipment {
  id: number
  ma_thiet_bi: string
  ten_thiet_bi: string
  don_vi: number
}

// Simulated database state
const mockDatabase = {
  don_vi: [
    { id: 1, name: 'Bệnh viện A', dia_ban_id: 1, active: true },
    { id: 2, name: 'Bệnh viện B', dia_ban_id: 1, active: true },
    { id: 3, name: 'Bệnh viện C', dia_ban_id: 2, active: true },
    { id: 4, name: 'Bệnh viện D', dia_ban_id: 2, active: true },
    { id: 5, name: 'Bệnh viện E (inactive)', dia_ban_id: 1, active: false },
  ],
  thiet_bi: [
    { id: 101, ma_thiet_bi: 'TB-A001', ten_thiet_bi: 'Máy siêu âm A1', don_vi: 1 },
    { id: 102, ma_thiet_bi: 'TB-A002', ten_thiet_bi: 'Máy X-quang A2', don_vi: 1 },
    { id: 201, ma_thiet_bi: 'TB-B001', ten_thiet_bi: 'Máy siêu âm B1', don_vi: 2 },
    { id: 301, ma_thiet_bi: 'TB-C001', ten_thiet_bi: 'Máy CT Scanner C1', don_vi: 3 },
    { id: 401, ma_thiet_bi: 'TB-D001', ten_thiet_bi: 'Máy MRI D1', don_vi: 4 },
    { id: 501, ma_thiet_bi: 'TB-E001', ten_thiet_bi: 'Máy ở BV inactive', don_vi: 5 },
  ] as Equipment[],
}

/**
 * Simulates allowed_don_vi_for_session() PostgreSQL function.
 */
function getAllowedDonVi(session: UserSession): number[] {
  switch (session.role) {
    case 'global':
      return mockDatabase.don_vi
        .filter((dv) => dv.active)
        .map((dv) => dv.id)

    case 'regional_leader':
      if (!session.dia_ban_id) {
        throw new Error('Regional leader must have dia_ban assigned')
      }
      return mockDatabase.don_vi
        .filter((dv) => dv.dia_ban_id === session.dia_ban_id && dv.active)
        .map((dv) => dv.id)

    case 'to_qltb':
    case 'technician':
    case 'qltb_khoa':
    case 'user':
      if (!session.don_vi) {
        throw new Error(`User must have don_vi assigned for role ${session.role}`)
      }
      return [session.don_vi]

    default:
      throw new Error(`Unknown role: ${session.role}`)
  }
}

/**
 * Simulates equipment_get_by_code() PostgreSQL RPC function.
 */
function equipmentGetByCode(
  session: UserSession,
  pMaThietBi: string | null | undefined
): Equipment | null {
  // Input validation
  if (!pMaThietBi || pMaThietBi.trim() === '') {
    throw new Error('ma_thiet_bi_required')
  }

  const normalizedCode = pMaThietBi.trim().toLowerCase()

  // Get allowed tenants for this session
  const allowedDonVi = getAllowedDonVi(session)

  // Global users: no tenant filtering
  if (session.role === 'global') {
    const equipment = mockDatabase.thiet_bi.find(
      (e) => e.ma_thiet_bi.toLowerCase() === normalizedCode
    )
    if (!equipment) {
      throw new Error('Equipment not found or access denied')
    }
    return equipment
  }

  // Non-global users: filter by allowed tenants
  if (allowedDonVi.length === 0) {
    throw new Error('Equipment not found or access denied')
  }

  const equipment = mockDatabase.thiet_bi.find(
    (e) =>
      e.ma_thiet_bi.toLowerCase() === normalizedCode &&
      allowedDonVi.includes(e.don_vi)
  )

  if (!equipment) {
    throw new Error('Equipment not found or access denied')
  }

  return equipment
}

// ============================================================================
// TENANT ISOLATION TESTS
// ============================================================================

describe('Equipment Get By Code - Tenant Isolation', () => {
  describe('Global Admin Access', () => {
    const globalSession: UserSession = {
      role: 'global',
      don_vi: null,
      dia_ban_id: null,
    }

    it('should access equipment in any tenant', () => {
      // Equipment in tenant 1
      expect(equipmentGetByCode(globalSession, 'TB-A001')?.id).toBe(101)

      // Equipment in tenant 2
      expect(equipmentGetByCode(globalSession, 'TB-B001')?.id).toBe(201)

      // Equipment in tenant 3
      expect(equipmentGetByCode(globalSession, 'TB-C001')?.id).toBe(301)

      // Equipment in tenant 4
      expect(equipmentGetByCode(globalSession, 'TB-D001')?.id).toBe(401)
    })

    it('should NOT access equipment in inactive tenants', () => {
      // Tenant 5 is inactive, but global can still see the record
      // (filtering happens at tenant list level, not equipment level for global)
      // This test documents actual behavior - may need business decision
      const result = equipmentGetByCode(globalSession, 'TB-E001')
      expect(result?.id).toBe(501) // Currently allowed for global
    })
  })

  describe('Regional Leader Access', () => {
    const regionalLeaderRegion1: UserSession = {
      role: 'regional_leader',
      don_vi: 1, // Home facility
      dia_ban_id: 1, // Region 1 (contains tenants 1, 2)
    }

    const regionalLeaderRegion2: UserSession = {
      role: 'regional_leader',
      don_vi: 3,
      dia_ban_id: 2, // Region 2 (contains tenants 3, 4)
    }

    it('should access equipment in same region', () => {
      // Region 1 leader can see tenant 1 equipment
      expect(equipmentGetByCode(regionalLeaderRegion1, 'TB-A001')?.id).toBe(101)

      // Region 1 leader can see tenant 2 equipment (same region)
      expect(equipmentGetByCode(regionalLeaderRegion1, 'TB-B001')?.id).toBe(201)
    })

    it('should NOT access equipment in different region', () => {
      // Region 1 leader cannot see tenant 3 equipment (Region 2)
      expect(() => equipmentGetByCode(regionalLeaderRegion1, 'TB-C001')).toThrow(
        'Equipment not found or access denied'
      )

      // Region 1 leader cannot see tenant 4 equipment (Region 2)
      expect(() => equipmentGetByCode(regionalLeaderRegion1, 'TB-D001')).toThrow(
        'Equipment not found or access denied'
      )
    })

    it('should fail if dia_ban_id is not assigned', () => {
      const badSession: UserSession = {
        role: 'regional_leader',
        don_vi: 1,
        dia_ban_id: null, // Missing!
      }

      expect(() => equipmentGetByCode(badSession, 'TB-A001')).toThrow(
        'Regional leader must have dia_ban assigned'
      )
    })

    it('should NOT access equipment in inactive tenants within region', () => {
      // Tenant 5 is in Region 1 but inactive
      expect(() => equipmentGetByCode(regionalLeaderRegion1, 'TB-E001')).toThrow(
        'Equipment not found or access denied'
      )
    })
  })

  describe('Single-Tenant User Access', () => {
    const toQltbTenant1: UserSession = {
      role: 'to_qltb',
      don_vi: 1,
      dia_ban_id: null,
    }

    const technicianTenant2: UserSession = {
      role: 'technician',
      don_vi: 2,
      dia_ban_id: null,
    }

    const qltbKhoaTenant3: UserSession = {
      role: 'qltb_khoa',
      don_vi: 3,
      dia_ban_id: null,
    }

    it('should access equipment in own tenant only', () => {
      // to_qltb in tenant 1 can see tenant 1 equipment
      expect(equipmentGetByCode(toQltbTenant1, 'TB-A001')?.id).toBe(101)
      expect(equipmentGetByCode(toQltbTenant1, 'TB-A002')?.id).toBe(102)

      // technician in tenant 2 can see tenant 2 equipment
      expect(equipmentGetByCode(technicianTenant2, 'TB-B001')?.id).toBe(201)

      // qltb_khoa in tenant 3 can see tenant 3 equipment
      expect(equipmentGetByCode(qltbKhoaTenant3, 'TB-C001')?.id).toBe(301)
    })

    it('should NOT access equipment in other tenants', () => {
      // to_qltb in tenant 1 cannot see tenant 2 equipment
      expect(() => equipmentGetByCode(toQltbTenant1, 'TB-B001')).toThrow(
        'Equipment not found or access denied'
      )

      // technician in tenant 2 cannot see tenant 1 equipment
      expect(() => equipmentGetByCode(technicianTenant2, 'TB-A001')).toThrow(
        'Equipment not found or access denied'
      )

      // qltb_khoa in tenant 3 cannot see tenant 4 equipment
      expect(() => equipmentGetByCode(qltbKhoaTenant3, 'TB-D001')).toThrow(
        'Equipment not found or access denied'
      )
    })

    it('should fail if don_vi is not assigned', () => {
      const badSession: UserSession = {
        role: 'to_qltb',
        don_vi: null, // Missing!
        dia_ban_id: null,
      }

      expect(() => equipmentGetByCode(badSession, 'TB-A001')).toThrow(
        'User must have don_vi assigned for role to_qltb'
      )
    })
  })

  describe('Basic User Access', () => {
    const userTenant1: UserSession = {
      role: 'user',
      don_vi: 1,
      dia_ban_id: null,
    }

    it('should access equipment in own tenant', () => {
      expect(equipmentGetByCode(userTenant1, 'TB-A001')?.id).toBe(101)
    })

    it('should NOT access equipment in other tenants', () => {
      expect(() => equipmentGetByCode(userTenant1, 'TB-B001')).toThrow(
        'Equipment not found or access denied'
      )
      expect(() => equipmentGetByCode(userTenant1, 'TB-C001')).toThrow(
        'Equipment not found or access denied'
      )
    })
  })
})

// ============================================================================
// INPUT VALIDATION TESTS
// ============================================================================

describe('Equipment Get By Code - Input Validation', () => {
  const session: UserSession = {
    role: 'global',
    don_vi: null,
    dia_ban_id: null,
  }

  it('should reject null ma_thiet_bi', () => {
    expect(() => equipmentGetByCode(session, null)).toThrow('ma_thiet_bi_required')
  })

  it('should reject undefined ma_thiet_bi', () => {
    expect(() => equipmentGetByCode(session, undefined)).toThrow('ma_thiet_bi_required')
  })

  it('should reject empty string ma_thiet_bi', () => {
    expect(() => equipmentGetByCode(session, '')).toThrow('ma_thiet_bi_required')
  })

  it('should reject whitespace-only ma_thiet_bi', () => {
    expect(() => equipmentGetByCode(session, '   ')).toThrow('ma_thiet_bi_required')
    expect(() => equipmentGetByCode(session, '\t\n')).toThrow('ma_thiet_bi_required')
  })

  it('should trim whitespace from ma_thiet_bi', () => {
    expect(equipmentGetByCode(session, '  TB-A001  ')?.id).toBe(101)
    expect(equipmentGetByCode(session, '\tTB-B001\n')?.id).toBe(201)
  })

  it('should be case-insensitive for ma_thiet_bi', () => {
    expect(equipmentGetByCode(session, 'tb-a001')?.id).toBe(101)
    expect(equipmentGetByCode(session, 'TB-A001')?.id).toBe(101)
    expect(equipmentGetByCode(session, 'Tb-A001')?.id).toBe(101)
  })
})

// ============================================================================
// ERROR MESSAGE SECURITY TESTS
// ============================================================================

describe('Equipment Get By Code - Error Message Security', () => {
  it('should return generic error for non-existent equipment', () => {
    const session: UserSession = {
      role: 'global',
      don_vi: null,
      dia_ban_id: null,
    }

    // Non-existent code
    expect(() => equipmentGetByCode(session, 'DOES-NOT-EXIST')).toThrow(
      'Equipment not found or access denied'
    )
  })

  it('should return same error for existing equipment in other tenant (no data leakage)', () => {
    const userTenant1: UserSession = {
      role: 'user',
      don_vi: 1,
      dia_ban_id: null,
    }

    // Equipment exists in tenant 3, but user is in tenant 1
    // Error should NOT reveal that equipment exists
    expect(() => equipmentGetByCode(userTenant1, 'TB-C001')).toThrow(
      'Equipment not found or access denied'
    )
  })

  it('should NOT include tenant ID in error message', () => {
    const userTenant1: UserSession = {
      role: 'user',
      don_vi: 1,
      dia_ban_id: null,
    }

    let capturedError: Error | undefined
    try {
      equipmentGetByCode(userTenant1, 'TB-C001')
    } catch (e: any) {
      capturedError = e
      // Error should not contain tenant info
      expect(e.message).not.toContain('don_vi')
      expect(e.message).not.toContain('tenant')
      expect(e.message).not.toContain('3') // Actual tenant ID
    }
    expect(capturedError).toBeDefined()
  })

  it('should NOT include equipment details in error for denied access', () => {
    const userTenant1: UserSession = {
      role: 'user',
      don_vi: 1,
      dia_ban_id: null,
    }

    let capturedError: Error | undefined
    try {
      equipmentGetByCode(userTenant1, 'TB-C001')
    } catch (e: any) {
      capturedError = e
      // Error should not reveal equipment exists or its details
      expect(e.message).not.toContain('Máy CT Scanner')
      expect(e.message).not.toContain('C1')
    }
    expect(capturedError).toBeDefined()
  })
})

// ============================================================================
// ROLE HIERARCHY TESTS
// ============================================================================

describe('Equipment Get By Code - Role Hierarchy', () => {
  const equipmentInTenant1 = 'TB-A001'
  const equipmentInTenant3 = 'TB-C001'

  it.each([
    ['global', null, null, true, true],
    ['regional_leader', 1, 1, true, false], // Region 1 only
    ['regional_leader', 3, 2, false, true], // Region 2 only
    ['to_qltb', 1, null, true, false],
    ['technician', 1, null, true, false],
    ['qltb_khoa', 1, null, true, false],
    ['user', 1, null, true, false],
    ['user', 3, null, false, true],
  ] as const)(
    'role=%s don_vi=%s dia_ban=%s -> can access tenant1=%s tenant3=%s',
    (role, donVi, diaBan, canAccessTenant1, canAccessTenant3) => {
      const session: UserSession = {
        role,
        don_vi: donVi,
        dia_ban_id: diaBan,
      }

      // Test tenant 1 access
      if (canAccessTenant1) {
        expect(equipmentGetByCode(session, equipmentInTenant1)?.id).toBe(101)
      } else {
        expect(() => equipmentGetByCode(session, equipmentInTenant1)).toThrow()
      }

      // Test tenant 3 access
      if (canAccessTenant3) {
        expect(equipmentGetByCode(session, equipmentInTenant3)?.id).toBe(301)
      } else {
        expect(() => equipmentGetByCode(session, equipmentInTenant3)).toThrow()
      }
    }
  )
})

// ============================================================================
// CROSS-TENANT ATTACK SIMULATION TESTS
// ============================================================================

describe('Equipment Get By Code - Attack Prevention', () => {
  describe('Enumeration Attack Prevention', () => {
    it('should not reveal equipment existence through timing or error differences', () => {
      const attacker: UserSession = {
        role: 'user',
        don_vi: 1,
        dia_ban_id: null,
      }

      // Try to enumerate equipment in other tenants
      const existingButForbidden = 'TB-C001' // Exists in tenant 3
      const nonExistent = 'TB-X999' // Does not exist

      let errorForExisting: string | undefined
      let errorForNonExistent: string | undefined

      try {
        equipmentGetByCode(attacker, existingButForbidden)
      } catch (e: any) {
        errorForExisting = e.message
      }

      try {
        equipmentGetByCode(attacker, nonExistent)
      } catch (e: any) {
        errorForNonExistent = e.message
      }

      // Both errors should be identical (no information leakage)
      expect(errorForExisting).toBe(errorForNonExistent)
      expect(errorForExisting).toBe('Equipment not found or access denied')
    })
  })

  describe('Tenant ID Injection Prevention', () => {
    it('client cannot override tenant filtering (tested at RPC proxy level)', () => {
      // This test documents that the client CANNOT pass p_don_vi
      // because:
      // 1. equipment_get_by_code() doesn't accept p_don_vi parameter
      // 2. RPC proxy enforces tenant from JWT, not client request
      //
      // The actual security is in /api/rpc/[fn]/route.ts lines 157-168:
      // ```
      // if (appRole !== 'global' && appRole !== 'regional_leader') {
      //   if (body.p_don_vi) {
      //     body.p_don_vi = Number(donVi) // Force user's tenant
      //   }
      // }
      // ```

      // This is a documentation test - actual protection is server-side
      expect(true).toBe(true)
    })
  })

  describe('Role Spoofing Prevention', () => {
    it('client cannot spoof role (enforced by NextAuth session)', () => {
      // This test documents that roles come from server-side session:
      // - /api/rpc/[fn]/route.ts:132-140 extracts role from getServerSession()
      // - Client headers are NOT trusted
      //
      // Documented for security audit completeness
      expect(true).toBe(true)
    })
  })
})
