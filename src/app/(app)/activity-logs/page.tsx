"use client"

import * as React from "react"
import type { Session } from "next-auth"
import { Activity, Shield } from "lucide-react"

import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSpinnerFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"
import { ActivityLogsViewer } from "@/components/activity-logs/activity-logs-viewer"

/** Renders the authenticated activity-log workspace. */
export default function ActivityLogsPage() {
  return (
    <AuthenticatedPageBoundary fallback={<AuthenticatedPageSpinnerFallback />}>
      {(user) => <ActivityLogsPageContent user={user} />}
    </AuthenticatedPageBoundary>
  )
}

type ActivityLogsPageContentProps = {
  user: Session["user"]
}

function ActivityLogsPageContent({ user }: ActivityLogsPageContentProps) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-x-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Activity className="size-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Nhật ký hoạt động</h1>
            <p className="text-gray-600 mt-1">
              Theo dõi và quản lý tất cả hoạt động của người dùng trong hệ thống
            </p>
          </div>
        </div>

        {/* Security Badge */}
        <div className="flex items-center gap-x-2 mt-4">
          <div className="flex items-center gap-x-1 bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm">
            <Shield className="size-4" />
            <span>Chỉ dành cho quản trị viên hệ thống</span>
          </div>
          <div className="text-sm text-gray-500">Phiên của bạn: {user.username || "N/A"}</div>
        </div>
      </div>

      {/* Main Activity Logs Viewer */}
      <ActivityLogsViewer />
    </div>
  )
}
