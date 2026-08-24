import { USER_ROLES } from "@/types/database"
import * as rbac from "../rbac"

const {
  canAccessDeviceQuotaModule,
  isDeptScopedRole,
  isEquipmentManagerRole,
  isGlobalRole,
  isPrivilegedRole,
  isRegionalLeaderRole,
  ROLES,
} = rbac

type RolePredicate = (role: string | null | undefined) => boolean

const expertRoleContract = rbac as typeof rbac & {
  canAccessTechnicalConfigurations: RolePredicate
  isTechnicalConfigurationExpertRole: RolePredicate
}

const canonicalRoles = ROLES as typeof ROLES & {
  CHUYEN_GIA: "chuyen_gia"
}

const userRoleLabels = USER_ROLES as typeof USER_ROLES & {
  chuyen_gia: "Chuyên gia"
}

describe("RBAC Utilities", () => {
  const nullishValues = [null, undefined]

  it("should expose the canonical expert role and display label", () => {
    // Role/UserRole derive from these objects, so the runtime keys lock their type sources too.
    expect.soft(canonicalRoles.CHUYEN_GIA).toBe("chuyen_gia")
    expect.soft(userRoleLabels.chuyen_gia).toBe("Chuyên gia")
  })

  it("should enforce the exact Technical Configurations role matrix", () => {
    const isExpert = expertRoleContract.isTechnicalConfigurationExpertRole
    const canAccessTechnicalConfigurations = expertRoleContract.canAccessTechnicalConfigurations

    expect.soft(isExpert).toBeTypeOf("function")
    expect.soft(canAccessTechnicalConfigurations).toBeTypeOf("function")

    if (typeof isExpert !== "function" || typeof canAccessTechnicalConfigurations !== "function") {
      return
    }

    const matrix: Array<{
      role: string | null | undefined
      expert: boolean
      technicalConfigurations: boolean
    }> = [
      { role: ROLES.GLOBAL, expert: false, technicalConfigurations: true },
      { role: ROLES.ADMIN, expert: false, technicalConfigurations: true },
      {
        role: ROLES.REGIONAL_LEADER,
        expert: false,
        technicalConfigurations: false,
      },
      { role: ROLES.TO_QLTB, expert: false, technicalConfigurations: false },
      { role: ROLES.TECHNICIAN, expert: false, technicalConfigurations: false },
      { role: ROLES.QLTB_KHOA, expert: false, technicalConfigurations: false },
      { role: ROLES.USER, expert: false, technicalConfigurations: false },
      { role: "chuyen_gia", expert: true, technicalConfigurations: true },
      { role: " CHUYEN_GIA ", expert: true, technicalConfigurations: true },
      { role: "unknown", expert: false, technicalConfigurations: false },
      { role: "", expert: false, technicalConfigurations: false },
      { role: null, expert: false, technicalConfigurations: false },
      { role: undefined, expert: false, technicalConfigurations: false },
    ]

    matrix.forEach(({ role, expert, technicalConfigurations }) => {
      expect(isExpert(role)).toBe(expert)
      expect(canAccessTechnicalConfigurations(role)).toBe(technicalConfigurations)
    })
  })

  it("should keep the expert role excluded from existing role helpers", () => {
    const existingRolePredicates = [
      isGlobalRole,
      isRegionalLeaderRole,
      isEquipmentManagerRole,
      canAccessDeviceQuotaModule,
      isDeptScopedRole,
      isPrivilegedRole,
    ]

    existingRolePredicates.forEach((predicate) => {
      expect(predicate("chuyen_gia")).toBe(false)
    })
  })

  it("should fail closed for null/undefined", () => {
    nullishValues.forEach((value) => {
      expect(canAccessDeviceQuotaModule(value)).toBe(false)
      expect(isGlobalRole(value)).toBe(false)
      expect(isRegionalLeaderRole(value)).toBe(false)
      expect(isEquipmentManagerRole(value)).toBe(false)
      expect(isDeptScopedRole(value)).toBe(false)
      expect(isPrivilegedRole(value)).toBe(false)
    })
  })

  it("should return false for empty or whitespace-only strings", () => {
    const values = ["", "   ", "\n", "\t"]
    values.forEach((value) => {
      expect(canAccessDeviceQuotaModule(value)).toBe(false)
      expect(isGlobalRole(value)).toBe(false)
      expect(isRegionalLeaderRole(value)).toBe(false)
      expect(isEquipmentManagerRole(value)).toBe(false)
      expect(isDeptScopedRole(value)).toBe(false)
      expect(isPrivilegedRole(value)).toBe(false)
    })
  })

  it("should handle case-insensitivity and whitespace", () => {
    expect(canAccessDeviceQuotaModule(" Admin ")).toBe(true)
    expect(canAccessDeviceQuotaModule(" regional_leader ")).toBe(true)
    expect(canAccessDeviceQuotaModule("  To_QLTB ")).toBe(true)
    expect(isGlobalRole(" GLOBAL ")).toBe(true)
    expect(isGlobalRole("Admin")).toBe(true)
    expect(isEquipmentManagerRole("  To_QLTB ")).toBe(true)
    expect(isRegionalLeaderRole(" regional_leader ")).toBe(true)
    expect(isDeptScopedRole(" QLTB_KHOA ")).toBe(true)
    expect(isPrivilegedRole(" ADMIN ")).toBe(true)
    expect(isPrivilegedRole("  regional_leader  ")).toBe(true)
  })

  it("should identify global roles correctly", () => {
    const allowed = [ROLES.GLOBAL, ROLES.ADMIN]
    const denied = [
      ROLES.REGIONAL_LEADER,
      ROLES.TO_QLTB,
      ROLES.TECHNICIAN,
      ROLES.QLTB_KHOA,
      ROLES.USER,
    ]

    allowed.forEach((role) => {
      expect(isGlobalRole(role)).toBe(true)
    })

    denied.forEach((role) => {
      expect(isGlobalRole(role)).toBe(false)
    })
  })

  it("should identify equipment manager roles correctly", () => {
    const allowed = [ROLES.GLOBAL, ROLES.ADMIN, ROLES.TO_QLTB]
    const denied = [ROLES.REGIONAL_LEADER, ROLES.TECHNICIAN, ROLES.QLTB_KHOA, ROLES.USER]

    allowed.forEach((role) => {
      expect(isEquipmentManagerRole(role)).toBe(true)
    })

    denied.forEach((role) => {
      expect(isEquipmentManagerRole(role)).toBe(false)
    })
  })

  it("should identify regional leader roles correctly", () => {
    const allowed = [ROLES.REGIONAL_LEADER]
    const denied = [
      ROLES.GLOBAL,
      ROLES.ADMIN,
      ROLES.TO_QLTB,
      ROLES.TECHNICIAN,
      ROLES.QLTB_KHOA,
      ROLES.USER,
    ]

    allowed.forEach((role) => {
      expect(isRegionalLeaderRole(role)).toBe(true)
    })

    denied.forEach((role) => {
      expect(isRegionalLeaderRole(role)).toBe(false)
    })
  })

  it("should identify department-scoped roles correctly", () => {
    const allowed = [ROLES.TECHNICIAN, ROLES.QLTB_KHOA]
    const denied = [ROLES.GLOBAL, ROLES.ADMIN, ROLES.REGIONAL_LEADER, ROLES.TO_QLTB, ROLES.USER]

    allowed.forEach((role) => {
      expect(isDeptScopedRole(role)).toBe(true)
    })

    denied.forEach((role) => {
      expect(isDeptScopedRole(role)).toBe(false)
    })
  })

  it("should return false for unknown roles", () => {
    const values = ["super_admin", "unknown", "manager"]
    values.forEach((value) => {
      expect(canAccessDeviceQuotaModule(value)).toBe(false)
      expect(isGlobalRole(value)).toBe(false)
      expect(isRegionalLeaderRole(value)).toBe(false)
      expect(isEquipmentManagerRole(value)).toBe(false)
      expect(isDeptScopedRole(value)).toBe(false)
      expect(isPrivilegedRole(value)).toBe(false)
    })
  })

  it("should identify privileged roles correctly", () => {
    const allowed = [ROLES.GLOBAL, ROLES.ADMIN, ROLES.REGIONAL_LEADER]
    const denied = [ROLES.TO_QLTB, ROLES.TECHNICIAN, ROLES.QLTB_KHOA, ROLES.USER]

    allowed.forEach((role) => {
      expect(isPrivilegedRole(role)).toBe(true)
    })

    denied.forEach((role) => {
      expect(isPrivilegedRole(role)).toBe(false)
    })
  })

  it("should identify device quota module access correctly", () => {
    const allowed = [ROLES.GLOBAL, ROLES.ADMIN, ROLES.REGIONAL_LEADER, ROLES.TO_QLTB]
    const denied = [ROLES.TECHNICIAN, ROLES.QLTB_KHOA, ROLES.USER]

    allowed.forEach((role) => {
      expect(canAccessDeviceQuotaModule(role)).toBe(true)
    })

    denied.forEach((role) => {
      expect(canAccessDeviceQuotaModule(role)).toBe(false)
    })
  })
})
