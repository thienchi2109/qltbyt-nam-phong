import type { NextAuthOptions } from "next-auth"

import { recordAuthLifecycleEvent } from "@/auth/observability"

import {
  coerceTenantId,
  isPendingSignoutReason,
  normalizeUsernameForLog,
  readRuntimeRequestContext,
} from "./request-context"

export const authEvents: NonNullable<NextAuthOptions["events"]> = {
  async signIn({ user }) {
    const userId = typeof user.id === "string" ? user.id : user.id != null ? String(user.id) : undefined
    const username = normalizeUsernameForLog(user.username ?? user.name)
    const tenantId = coerceTenantId(user.don_vi)

    void readRuntimeRequestContext().then((requestContext) =>
      recordAuthLifecycleEvent({
        event: "login_success",
        source: "events_signin",
        user_id: userId,
        username,
        tenant_id: tenantId,
        ...requestContext,
      })
    )
  },
  async signOut({ token, session }) {
    const pendingReason = isPendingSignoutReason(token?.pending_signout_reason)
      ? token.pending_signout_reason
      : undefined
    const userId =
      typeof token?.id === "string"
        ? token.id
        : token?.id != null
          ? String(token.id)
          : typeof session?.user?.id === "string"
            ? session.user.id
            : session?.user?.id != null
              ? String(session.user.id)
              : undefined
    const username = normalizeUsernameForLog(token?.username ?? session?.user?.username ?? session?.user?.name)
    const tenantId = coerceTenantId(token?.don_vi ?? session?.user?.don_vi)

    if (!userId && !username && !tenantId && !pendingReason) {
      return
    }

    const metadata: Record<string, unknown> = {}
    if (typeof token?.loginTime === "number") {
      metadata.session_duration_ms = Math.max(0, Date.now() - token.loginTime)
    }

    await recordAuthLifecycleEvent({
      source: "events_signout",
      signout_reason: pendingReason ?? "session_expired",
      user_id: userId,
      username,
      tenant_id: tenantId,
      ...(await readRuntimeRequestContext()),
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    })
  },
}
