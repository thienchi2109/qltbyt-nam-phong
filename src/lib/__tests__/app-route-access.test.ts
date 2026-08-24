import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  ACCESS_DENIED_PATH,
  APP_ROUTE_ACCESS_RULES,
  canAccessAppRoute,
  getDefaultAppRoute,
  getAppRouteAccessPolicy,
} from "../app-route-access"

const GLOBAL_ONLY_ROUTES = ["/activity-logs", "/tenants", "/users"] as const

const DEVICE_QUOTA_ROUTES = [
  "/device-quota",
  "/device-quota/categories",
  "/device-quota/decisions/123",
] as const

const AUTHENTICATED_ROUTES = [
  "/access-denied",
  "/dashboard",
  "/equipment",
  "/forms/handover",
  "/maintenance",
  "/qr-scanner",
  "/repair-requests",
  "/reports",
  "/transfers",
] as const

const EXISTING_ROLES = [
  "global",
  "admin",
  "regional_leader",
  "to_qltb",
  "technician",
  "qltb_khoa",
  "user",
] as const

function collectPageFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory() ? collectPageFiles(entryPath) : [entryPath]
  })
}

function pageFileToRoute(appRoot: string, pageFile: string): string {
  const relativeDirectory = path.relative(appRoot, path.dirname(pageFile))
  const routeSegments = relativeDirectory
    .split(path.sep)
    .filter((segment) => segment && !segment.startsWith("(") && !segment.startsWith("_"))

  return `/${routeSegments.join("/")}`
}

describe("app route access policy", () => {
  it("declares every current application page in the route policy map", () => {
    const appRoot = path.resolve(process.cwd(), "src/app/(app)")
    const pageRoutes = collectPageFiles(appRoot)
      .filter((file) => file.endsWith(`${path.sep}page.tsx`))
      .map((file) => pageFileToRoute(appRoot, file))

    expect(APP_ROUTE_ACCESS_RULES.length).toBeGreaterThan(0)
    expect(pageRoutes.filter((route) => getAppRouteAccessPolicy(route) === null)).toEqual([])
  })

  it.each(GLOBAL_ONLY_ROUTES)("restricts %s to global-equivalent roles", (route) => {
    expect(canAccessAppRoute(route, "global")).toBe(true)
    expect(canAccessAppRoute(route, " Admin ")).toBe(true)
    expect(canAccessAppRoute(route, "chuyen_gia")).toBe(false)
    expect(canAccessAppRoute(route, "regional_leader")).toBe(false)
    expect(canAccessAppRoute(route, "to_qltb")).toBe(false)
    expect(canAccessAppRoute(route, "user")).toBe(false)
    expect(canAccessAppRoute(route, undefined)).toBe(false)
  })

  it("allows only the Technical Configurations route family to module-capable roles", () => {
    for (const route of [
      "/technical-configurations",
      "/technical-configurations/dossiers",
      "/technical-configurations/dossiers/123.pdf",
    ]) {
      expect(canAccessAppRoute(route, "global")).toBe(true)
      expect(canAccessAppRoute(route, " Admin ")).toBe(true)
      expect(canAccessAppRoute(route, " CHUYEN_GIA ")).toBe(true)
      expect(canAccessAppRoute(route, "regional_leader")).toBe(false)
      expect(canAccessAppRoute(route, "to_qltb")).toBe(false)
      expect(canAccessAppRoute(route, "user")).toBe(false)
      expect(canAccessAppRoute(route, undefined)).toBe(false)
    }
  })

  it("restricts experts to Technical Configurations and the shared denial route", () => {
    expect(canAccessAppRoute("/technical-configurations", "chuyen_gia")).toBe(true)
    expect(canAccessAppRoute("/technical-configurations/dossiers", "chuyen_gia")).toBe(true)
    expect(canAccessAppRoute(ACCESS_DENIED_PATH, "chuyen_gia")).toBe(true)

    for (const rule of APP_ROUTE_ACCESS_RULES) {
      if (
        rule.pathPrefix !== "/technical-configurations" &&
        rule.pathPrefix !== ACCESS_DENIED_PATH
      ) {
        expect(canAccessAppRoute(rule.pathPrefix, "chuyen_gia")).toBe(false)
      }
    }
  })

  it.each(DEVICE_QUOTA_ROUTES)("uses the device quota module policy for %s", (route) => {
    for (const role of ["global", "admin", "regional_leader", "to_qltb"]) {
      expect(canAccessAppRoute(route, role)).toBe(true)
    }

    for (const role of ["chuyen_gia", "user", "qltb_khoa", "technician", undefined]) {
      expect(canAccessAppRoute(route, role)).toBe(false)
    }
  })

  it.each(AUTHENTICATED_ROUTES)(
    "leaves authentication-only route %s to the existing auth gate",
    (route) => {
      expect(canAccessAppRoute(route, undefined)).toBe(true)
      for (const role of EXISTING_ROLES) {
        expect(canAccessAppRoute(route, role)).toBe(true)
      }
    }
  )

  it("matches descendants and trailing slashes without matching similar prefixes", () => {
    expect(getAppRouteAccessPolicy("/users/42")).toBe("global")
    expect(getAppRouteAccessPolicy("/users/")).toBe("global")
    expect(getAppRouteAccessPolicy("/users-archive")).toBeNull()
    expect(canAccessAppRoute("/users-archive", "user")).toBe(true)
  })

  it("allows unmatched paths through so Next.js can render its normal 404", () => {
    expect(getAppRouteAccessPolicy("/not-a-real-page")).toBeNull()
    expect(canAccessAppRoute("/not-a-real-page", undefined)).toBe(true)
    expect(canAccessAppRoute("/not-a-real-page", "chuyen_gia")).toBe(true)
  })

  it("keeps the denial destination outside restricted policies", () => {
    expect(ACCESS_DENIED_PATH).toBe("/access-denied")
    expect(getAppRouteAccessPolicy(ACCESS_DENIED_PATH)).toBe("authenticated")
    expect(canAccessAppRoute(ACCESS_DENIED_PATH, "user")).toBe(true)
  })

  it("selects the role-aware default authenticated route", () => {
    expect(getDefaultAppRoute("chuyen_gia")).toBe("/technical-configurations")
    expect(getDefaultAppRoute(" CHUYEN_GIA ")).toBe("/technical-configurations")

    for (const role of [...EXISTING_ROLES, undefined]) {
      expect(getDefaultAppRoute(role)).toBe("/dashboard")
    }
  })
})
