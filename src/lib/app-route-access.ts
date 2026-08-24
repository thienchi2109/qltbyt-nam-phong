import {
  canAccessDeviceQuotaModule,
  canAccessTechnicalConfigurations,
  isGlobalRole,
  isTechnicalConfigurationExpertRole,
} from "@/lib/rbac"

export type AppRouteAccessPolicy =
  "authenticated" | "global" | "deviceQuota" | "technicalConfigurations"

/** Shared redirect destination for authenticated users denied by route policy. */
export const ACCESS_DENIED_PATH = "/access-denied"

export type AppRouteAccessRule = Readonly<{
  pathPrefix: string
  policy: AppRouteAccessPolicy
}>

/** Declarative access policies for every page family under src/app/(app). */
export const APP_ROUTE_ACCESS_RULES = [
  { pathPrefix: ACCESS_DENIED_PATH, policy: "authenticated" },
  { pathPrefix: "/activity-logs", policy: "global" },
  { pathPrefix: "/technical-configurations", policy: "technicalConfigurations" },
  { pathPrefix: "/tenants", policy: "global" },
  { pathPrefix: "/users", policy: "global" },
  { pathPrefix: "/device-quota", policy: "deviceQuota" },
  { pathPrefix: "/dashboard", policy: "authenticated" },
  { pathPrefix: "/equipment", policy: "authenticated" },
  { pathPrefix: "/forms", policy: "authenticated" },
  { pathPrefix: "/maintenance", policy: "authenticated" },
  { pathPrefix: "/qr-scanner", policy: "authenticated" },
  { pathPrefix: "/repair-requests", policy: "authenticated" },
  { pathPrefix: "/reports", policy: "authenticated" },
  { pathPrefix: "/transfers", policy: "authenticated" },
] as const satisfies readonly AppRouteAccessRule[]

function matchesPathPrefix(pathname: string, pathPrefix: string): boolean {
  return pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`)
}

/** Resolves the most-specific declared policy for a pathname. */
export function getAppRouteAccessPolicy(pathname: string): AppRouteAccessPolicy | null {
  let matchedRule: AppRouteAccessRule | null = null

  for (const rule of APP_ROUTE_ACCESS_RULES) {
    if (!matchesPathPrefix(pathname, rule.pathPrefix)) continue
    if (!matchedRule || rule.pathPrefix.length > matchedRule.pathPrefix.length) {
      matchedRule = rule
    }
  }

  return matchedRule?.policy ?? null
}

/** Checks page-entry access while leaving authentication to the existing auth gate. */
export function canAccessAppRoute(pathname: string, role: string | null | undefined): boolean {
  const policy = getAppRouteAccessPolicy(pathname)

  if (policy === null) {
    return true
  }

  if (policy === "technicalConfigurations") {
    return canAccessTechnicalConfigurations(role)
  }

  if (isTechnicalConfigurationExpertRole(role)) {
    return pathname === ACCESS_DENIED_PATH
  }

  if (policy === "global") {
    return isGlobalRole(role)
  }

  if (policy === "deviceQuota") {
    return canAccessDeviceQuotaModule(role)
  }

  return true
}

/** Returns the authoritative landing route for an authenticated application role. */
export function getDefaultAppRoute(
  role: string | null | undefined
): "/dashboard" | "/technical-configurations" {
  return isTechnicalConfigurationExpertRole(role) ? "/technical-configurations" : "/dashboard"
}
