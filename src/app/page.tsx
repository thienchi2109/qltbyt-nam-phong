import * as React from "react"
import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/auth/config"
import { LoginForm } from "./_components/login-form"

export const metadata: Metadata = {
  title: "Đăng nhập | CVMEMS",
  description: "Đăng nhập vào hệ thống quản lý thiết bị y tế CVMEMS",
}

export default async function LoginPage() {
  const session = await getServerSession(authOptions)

  if (session?.user) {
    redirect("/dashboard")
  }

  return <LoginForm />
}
