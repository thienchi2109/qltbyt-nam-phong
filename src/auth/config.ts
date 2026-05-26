import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { createClient } from "@supabase/supabase-js"

import { recordAuthLifecycleEvent } from "@/auth/observability"
import {
  checkAuthLoginThrottle,
  recordAuthLoginThrottleFailure,
  recordAuthLoginThrottleSuccess,
} from "@/auth/throttle"

import { authCallbacks } from "./next-auth-callbacks"
import { authEvents } from "./next-auth-events"
import {
  normalizeUsernameForLog,
  readAuthorizeRequestContext,
} from "./request-context"
import {
  buildAuthUserFromRpcResult,
  type AuthRpcUserRow,
} from "./types"

/** NextAuth configuration for credentials login, JWT sessions, and auth lifecycle hooks. */
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 3 * 60 * 60, // 3 hours
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/", // reuse existing login page for now
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const username = credentials?.username?.toString().trim()
        const password = credentials?.password?.toString() || ""
        const requestContext = readAuthorizeRequestContext(req)
        const normalizedUsername = normalizeUsernameForLog(username)

        if (!username || !password) return null

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          console.error("Supabase env not configured")
          await recordAuthLifecycleEvent({
            source: "authorize",
            reason_code: "config_error",
            username: normalizedUsername,
            ...requestContext,
          })
          return null
        }

        const supabase = createClient(supabaseUrl, serviceKey)

        try {
          const throttleDecision = await checkAuthLoginThrottle(
            supabase,
            normalizedUsername,
            requestContext.ip_address,
          ).catch((error: unknown) => {
            console.warn("Login throttle check failed", { error })
            return null
          })

          if (throttleDecision?.allowed === false) {
            await recordAuthLifecycleEvent({
              source: "authorize",
              reason_code: "rate_limited",
              username: normalizedUsername,
              ...requestContext,
              metadata: {
                blocked_scope: throttleDecision.blocked_scope,
                blocked_until: throttleDecision.blocked_until,
                retry_after_seconds: throttleDecision.retry_after_seconds,
              },
            })
            throw new Error("rate_limited")
          }

          const { data, error } = await supabase.rpc("authenticate_user_dual_mode", {
            p_username: username,
            p_password: password,
          })

          if (error) {
            console.error("RPC auth error:", error)
            await recordAuthLifecycleEvent({
              source: "authorize",
              reason_code: "rpc_error",
              username: normalizedUsername,
              ...requestContext,
            })
            throw new Error("rpc_error")
          }

          if (data && Array.isArray(data) && data.length > 0) {
            const authResult = data[0] as AuthRpcUserRow
            if (authResult?.is_authenticated) {
              await recordAuthLoginThrottleSuccess(
                supabase,
                normalizedUsername,
                requestContext.ip_address,
              ).catch((error: unknown) => {
                console.warn("Login throttle success reset failed", { error })
              })
              return buildAuthUserFromRpcResult(authResult)
            }

            if (authResult?.authentication_mode === "tenant_inactive") {
              console.warn("Login blocked because tenant is inactive", { username })
              await recordAuthLifecycleEvent({
                source: "authorize",
                reason_code: "tenant_inactive",
                username: normalizedUsername,
                ...requestContext,
              })
              throw new Error("tenant_inactive")
            }
          }

          await recordAuthLoginThrottleFailure(
            supabase,
            normalizedUsername,
            requestContext.ip_address,
          ).catch((error: unknown) => {
            console.warn("Login throttle failure record failed", { error })
          })
          await recordAuthLifecycleEvent({
            source: "authorize",
            reason_code: "invalid_credentials",
            username: normalizedUsername,
            ...requestContext,
          })
          throw new Error("invalid_credentials")
        } catch (e) {
          if (
            e instanceof Error &&
            (
              e.message === "rpc_error" ||
              e.message === "tenant_inactive" ||
              e.message === "invalid_credentials" ||
              e.message === "rate_limited"
            )
          ) {
            throw e
          }

          console.error("Authorize exception:", e)
          await recordAuthLifecycleEvent({
            source: "authorize",
            reason_code: "authorize_exception",
            username: normalizedUsername,
            ...requestContext,
            metadata: e instanceof Error
              ? {
                  error_message: e.message,
                }
              : undefined,
          })
          throw e instanceof Error ? e : new Error("authorize_exception")
        }
      },
    }),
  ],
  callbacks: authCallbacks,
  events: authEvents,
}
