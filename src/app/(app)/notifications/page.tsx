"use client"

import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSkeletonFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"
import type { Session } from "next-auth"
import { NotificationsPushOptIn } from "./NotificationsPushOptIn"
import { NotificationsRecipientPicker } from "./NotificationsRecipientPicker"

/** Renders authenticated notification settings. */
export default function NotificationsPage() {
  return (
    <AuthenticatedPageBoundary fallback={<AuthenticatedPageSkeletonFallback />}>
      {(user) => <NotificationsPageContent user={user} />}
    </AuthenticatedPageBoundary>
  )
}

function NotificationsPageContent({ user }: { user: Session["user"] }) {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <section className="space-y-2">
        <h1 className="text-[28px] leading-9 font-semibold tracking-tight">
          Cài đặt nhận thông báo
        </h1>
        <p className="text-muted-foreground">
          Quản lý thông báo trên trình duyệt và danh sách người nhận của đơn vị.
        </p>
      </section>

      <NotificationsPushOptIn userId={String(user.id)} />

      <NotificationsRecipientPicker user={user} />
    </main>
  )
}
