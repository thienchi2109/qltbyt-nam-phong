"use client"

import { Bell } from "lucide-react"
import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSkeletonFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Session } from "next-auth"
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
        <h1 className="text-3xl font-semibold tracking-tight">Cài đặt nhận thông báo</h1>
        <p className="text-muted-foreground">
          Quản lý thông báo trên trình duyệt và danh sách người nhận của đơn vị.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5" aria-hidden="true" />
            Thông báo trên trình duyệt
          </CardTitle>
          <CardDescription>
            Bật thông báo trên trình duyệt không tự thêm bạn vào danh sách người nhận.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p role="status" className="text-sm text-muted-foreground">
            Trạng thái: Chưa bật. Tùy chọn bật thông báo sẽ được cung cấp trong bước đăng ký riêng.
          </p>
        </CardContent>
      </Card>

      <NotificationsRecipientPicker user={user} />
    </main>
  )
}
