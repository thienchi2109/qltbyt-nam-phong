import Link from "next/link"
import { ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Renders the shared destination for authenticated users denied by route policy. */
export default function AccessDeniedPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center px-4 py-10 sm:px-6">
      <section className="w-full border-y py-10 text-center">
        <ShieldAlert className="mx-auto size-10 text-destructive" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">Truy cập bị hạn chế</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Tài khoản của bạn không có quyền truy cập khu vực này. Liên hệ quản trị viên nếu bạn cần
          được cấp thêm quyền.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Về trang tổng quan</Link>
        </Button>
      </section>
    </main>
  )
}
