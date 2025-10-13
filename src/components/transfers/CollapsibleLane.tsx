"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight } from "lucide-react"
import { ReactNode } from "react"

export type TransferStatus = 'cho_duyet' | 'da_duyet' | 'dang_luan_chuyen' | 'da_ban_giao' | 'hoan_thanh'

interface CollapsibleLaneProps {
  status: TransferStatus
  title: string
  description: string
  color: string
  totalCount: number
  visibleCount: number
  isCollapsed: boolean
  onToggleCollapse: () => void
  onShowMore: () => void
  children: ReactNode
  isLoading?: boolean
}

export function CollapsibleLane({
  status,
  title,
  description,
  color,
  totalCount,
  visibleCount,
  isCollapsed,
  onToggleCollapse,
  onShowMore,
  children,
  isLoading = false
}: CollapsibleLaneProps) {
  const hasMore = visibleCount < totalCount

  return (
    <Card className={`${color} min-h-[200px]`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onToggleCollapse}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <CardTitle className="text-sm font-medium">
              {title}
            </CardTitle>
          </div>
          <Badge variant="secondary" className="ml-2">
            {totalCount}
          </Badge>
        </div>
        <CardDescription className="text-xs ml-8">
          {description}
        </CardDescription>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              Đang tải...
            </div>
          ) : totalCount === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              Không có yêu cầu nào
            </div>
          ) : (
            <>
              {children}
              
              {/* Show More Button */}
              {hasMore && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={onShowMore}
                  >
                    Hiện thêm ({totalCount - visibleCount} còn lại)
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}
