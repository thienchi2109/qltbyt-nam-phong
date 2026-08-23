import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  ACCESS_DENIED_PATH,
  APP_ROUTE_ACCESS_RULES,
  canAccessAppRoute,
  getAppRouteAccessPolicy,
} from "../app-route-access"

const GLOBAL_ONLY_ROUTES = [
  "/activity-logs",
  "/technical-configurations",
  "/tenants",
  "/users",
] as const

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
    expect(canAccessAppRoute(route, "regional_leader")).toBe(false)
    expect(canAccessAppRoute(route, "to_qltb")).toBe(false)
    expect(canAccessAppRoute(route, "user")).toBe(false)
    expect(canAccessAppRoute(route, undefined)).toBe(false)
  })

  it.each(DEVICE_QUOTA_ROUTES)("uses the device quota module policy for %s", (route) => {
    for (const role of ["global", "admin", "regional_leader", "to_qltb"]) {
      expect(canAccessAppRoute(route, role)).toBe(true)
    }

    for (const role of ["user", "qltb_khoa", "technician", undefined]) {
      expect(canAccessAppRoute(route, role)).toBe(false)
    }
  })

  it.each(AUTHENTICATED_ROUTES)(
    "leaves authentication-only route %s to the existing auth gate",
    (route) => {
      expect(canAccessAppRoute(route, undefined)).toBe(true)
      expect(canAccessAppRoute(route, "user")).toBe(true)
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
  })

  it("keeps the denial destination outside restricted policies", () => {
    expect(ACCESS_DENIED_PATH).toBe("/access-denied")
    expect(getAppRouteAccessPolicy(ACCESS_DENIED_PATH)).toBe("authenticated")
    expect(canAccessAppRoute(ACCESS_DENIED_PATH, "user")).toBe(true)
  })
})
