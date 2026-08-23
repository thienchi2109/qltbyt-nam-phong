import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

import {
  ACCESS_DENIED_PATH,
  canAccessAppRoute,
  getAppRouteAccessPolicy,
} from "@/lib/app-route-access"

const IS_PRODUCTION = process.env.NODE_ENV === "production"
const FLAG_DISABLES = process.env.AUTH_MIDDLEWARE_ENABLED === "false"
const STATIC_ASSET_EXTENSION =
  /\.(?:png|jpg|jpeg|webp|svg|gif|ico|css|js|map|json|txt|xml|woff2?|ttf|otf|mp4|webm|pdf)$/i

function isUnmappedStaticAssetPath(pathname: string): boolean {
  return (
    !pathname.startsWith("/_next/") &&
    getAppRouteAccessPolicy(pathname) === null &&
    STATIC_ASSET_EXTENSION.test(pathname)
  )
}

// AUTH_MIDDLEWARE_ENABLED is honored ONLY outside production (dev/test/E2E).
// In production the kill switch is ignored and route protection is always on;
// any attempt to disable it logs a loud error so ops can investigate.
const ENABLED = IS_PRODUCTION ? true : !FLAG_DISABLES

if (IS_PRODUCTION && FLAG_DISABLES) {
  console.error(
    "[auth-middleware] AUTH_MIDDLEWARE_ENABLED=false is ignored in production — route protection remains enforced."
  )
} else if (!IS_PRODUCTION && FLAG_DISABLES) {
  console.warn(
    "[auth-middleware] AUTH_MIDDLEWARE_ENABLED=false detected in non-production — route protection is disabled."
  )
}

export default ENABLED
  ? withAuth(
      function middleware(req) {
        if (isUnmappedStaticAssetPath(req.nextUrl.pathname)) {
          return NextResponse.next()
        }

        // If no valid user id (unauthenticated), redirect to custom sign-in page '/'
        // @ts-ignore - token added by withAuth
        if (!req.nextauth?.token?.id) {
          const url = req.nextUrl.clone()
          url.pathname = "/"
          url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search)
          return NextResponse.redirect(url)
        }

        if (!canAccessAppRoute(req.nextUrl.pathname, req.nextauth.token.role)) {
          const url = req.nextUrl.clone()
          url.pathname = ACCESS_DENIED_PATH
          url.search = ""
          return NextResponse.redirect(url)
        }

        return NextResponse.next()
      },
      {
        callbacks: {
          authorized: ({ req, token }) =>
            isUnmappedStaticAssetPath(req.nextUrl.pathname) || Boolean(token?.id),
        },
        pages: {
          signIn: "/",
        },
      }
    )
  : function noopMiddleware() {
      return NextResponse.next()
    }

/** Next.js matcher configuration for application authentication and route RBAC. */
export const config = {
  matcher: [
    /*
     * Protect every request path EXCEPT:
     *  - "/"                              the public login page
     *  - "/api/*"                         API routes handle auth themselves
     *  - "/_next/*"                       Next.js internals, including image/data fetches
     *  - static metadata and worker files
     *  - known public asset folders
     *  - extension-looking paths are matched, then bypassed at runtime only
     *    when they are outside the declared application route map
     *
     * Next.js route groups like "(app)" are file-system only and do NOT
     * appear in request URLs, so a matcher like "/(app)/(.*)" never matches
     * real routes such as /dashboard or /equipment. Use path-based exclusion
     * via a negative-lookahead so every new page under src/app/(app)/** is
     * covered automatically.
     */
    "/((?!api|_next|favicon\\.ico|manifest\\.json|assets|icons|screenshots|sw\\.js|workbox-.*\\.js|$).*)",
  ],
}
