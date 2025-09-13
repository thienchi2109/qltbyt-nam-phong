import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

const ENABLED = process.env.AUTH_MIDDLEWARE_ENABLED !== 'false'

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
