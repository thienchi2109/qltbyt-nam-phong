"use client"

import * as React from "react"

import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSkeletonFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"

import { UsersPageContent } from "./_components/UsersPageContent"

export default function UsersPage() {
  return (
    <AuthenticatedPageBoundary fallback={<AuthenticatedPageSkeletonFallback />}>
      {(user) => <UsersPageContent user={user} />}
    </AuthenticatedPageBoundary>
  )
}
