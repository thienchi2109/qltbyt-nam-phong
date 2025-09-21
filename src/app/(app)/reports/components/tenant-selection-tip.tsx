"use client"

import { Card, CardContent } from "@/components/ui/card"
import { FileText } from "lucide-react"

export function TenantSelectionTip() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-8">
        <div className="text-center space-y-2">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            Vui lòng chọn đơn vị cụ thể ở bộ lọc để xem dữ liệu báo cáo
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

