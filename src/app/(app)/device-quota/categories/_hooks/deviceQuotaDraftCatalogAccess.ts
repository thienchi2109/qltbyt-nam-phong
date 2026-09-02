import { isEquipmentManagerRole } from "@/lib/rbac"

export type DeviceQuotaDraftCatalogStatus =
  "blocked" | "loading" | "ready" | "conflict" | "error" | "unavailable"

/** Resolves the authenticated session unit used by the draft catalog. */
export function toDeviceQuotaDraftCatalogUnitId(
  user: { current_don_vi?: number | string | null; don_vi?: number | string | null } | undefined
) {
  const value = user?.current_don_vi ?? user?.don_vi
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

/** Checks whether a session role may access the draft catalog workspace. */
export function isDeviceQuotaDraftCatalogRoleSupported(role: string | undefined): boolean {
  return isEquipmentManagerRole(role)
}
