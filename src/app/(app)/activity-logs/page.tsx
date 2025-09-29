'use client'

import React from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Activity, Shield, AlertTriangle } from 'lucide-react'

import { ActivityLogsViewer } from '@/components/activity-logs/activity-logs-viewer'
import { Card, CardContent } from '@/components/ui/card'

export default function ActivityLogsPage() {
  const { data: session, status } = useSession()

  const router = useRouter()

  React.useEffect(() => {
    if (status !== 'loading' && !session) {
      router.replace('/auth/signin')
    }
  }, [status, session, router])

  // Redirect if not authenticated
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  // Check if user is global admin
  const userRole = (session.user as any)?.role?.toLowerCase()
  const isGlobalUser = userRole === 'admin' || userRole === 'global'

  if (!isGlobalUser) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-3 bg-red-100 rounded-full">
                  <Shield className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Truy cập bị hạn chế
                </h2>
                <p className="text-gray-600 text-sm">
                  Tính năng "Nhật ký hoạt động" chỉ dành cho quản trị viên hệ thống. 
                  Bạn không có quyền truy cập vào trang này.
                </p>
              </div>
              <div className="flex items-center justify-center text-xs text-gray-500 mt-4">
                <AlertTriangle className="h-4 w-4 mr-1" />
                <span>Liên hệ quản trị viên nếu bạn cần hỗ trợ</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Activity className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Nhật ký hoạt động
            </h1>
            <p className="text-gray-600 mt-1">
              Theo dõi và quản lý tất cả hoạt động của người dùng trong hệ thống
            </p>
          </div>
        </div>
        
        {/* Security Badge */}
        <div className="flex items-center space-x-2 mt-4">
          <div className="flex items-center space-x-1 bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm">
            <Shield className="h-4 w-4" />
            <span>Chỉ dành cho quản trị viên hệ thống</span>
          </div>
          <div className="text-sm text-gray-500">
            Phiên của bạn: {(session.user as any)?.username || 'N/A'}
          </div>
        </div>
      </div>

      {/* Main Activity Logs Viewer */}
      <ActivityLogsViewer />
    </div>
  )
}