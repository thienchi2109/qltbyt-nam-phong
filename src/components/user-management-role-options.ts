import { isGlobalRole, ROLES } from "@/lib/rbac"
import { USER_MANAGEMENT_ROLE_OPTIONS, USER_ROLES, type UserRole } from "@/types/database"

type UserManagementRoleOption = readonly [UserRole, string]

const BASE_ROLE_OPTIONS = Object.entries(USER_MANAGEMENT_ROLE_OPTIONS) as UserManagementRoleOption[]
const EXPERT_ROLE_OPTIONS: UserManagementRoleOption[] = [
  ...BASE_ROLE_OPTIONS,
  [ROLES.CHUYEN_GIA, USER_ROLES.chuyen_gia],
]

/** Returns role choices available to the current user-management operator. */
export function getUserManagementRoleOptions(
  operatorRole: string | null | undefined
): UserManagementRoleOption[] {
  return isGlobalRole(operatorRole) ? EXPERT_ROLE_OPTIONS : BASE_ROLE_OPTIONS
}
