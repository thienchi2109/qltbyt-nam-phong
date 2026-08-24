import * as React from "react"
import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/auth/config"
import { LoginForm } from "@/app/_components/LoginForm"
import { getDefaultAppRoute } from "@/lib/app-route-access"

/** Login page metadata. */
export const metadata: Metadata = {
  title: "Đăng nhập | CVMEMS",
  description: "Đăng nhập vào hệ thống quản lý thiết bị y tế CVMEMS",
}

/** Renders the login form or redirects authenticated users to their role landing route. */
export default async function LoginPage() {
  const session = await getServerSession(authOptions)

  if (session?.user?.id) {
    redirect(getDefaultAppRoute(session.user.role))
  }

  return <LoginForm />
}
