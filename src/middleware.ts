import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const FLAG_DISABLES = process.env.AUTH_MIDDLEWARE_ENABLED === 'false'

// AUTH_MIDDLEWARE_ENABLED is honored ONLY outside production (dev/test/E2E).
// In production the kill switch is ignored and route protection is always on;
// any attempt to disable it logs a loud error so ops can investigate.
const ENABLED = IS_PRODUCTION ? true : !FLAG_DISABLES

if (IS_PRODUCTION && FLAG_DISABLES) {
  console.error(
    "[auth-middleware] AUTH_MIDDLEWARE_ENABLED=false is ignored in production — route protection remains enforced.",
  )
} else if (!IS_PRODUCTION && FLAG_DISABLES) {
  console.warn(
    "[auth-middleware] AUTH_MIDDLEWARE_ENABLED=false detected in non-production — route protection is disabled.",
  )
}

export default ENABLED ? withAuth(
  function middleware(req) {
    // If no token (unauthenticated), redirect to custom sign-in page '/'
    // @ts-ignore - token added by withAuth
    if (!req.nextauth?.token) {
      const url = req.nextUrl.clone()
      url.pathname = "/"
      url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/",
    },
  }
) : function noopMiddleware() { return NextResponse.next() }

export const config = {
  matcher: [
  // Protect all routes under /(app) but exclude API auth and static assets
  "/(app)/(.*)",
  // Exclusions handled implicitly by NextAuth; avoid matching:
  // - /api/auth
  // - /_next/static, /_next/image
  // - /favicon.ico, /assets
  ],
}
