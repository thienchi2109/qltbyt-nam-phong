"use client"

import * as React from "react"
import { AlertTriangle, Clock, Eye } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type {
  TransferOverdueSummary,
  TransferOverdueSummaryItem,
} from "@/types/transfers-data-grid"

interface OverdueTransfersAlertProps {
  overdueSummary?: TransferOverdueSummary | null
  isLoading?: boolean
  onViewTransfer?: (transfer: TransferOverdueSummaryItem) => void
}

export function OverdueTransfersAlert({
  overdueSummary,
  isLoading = false,
  onViewTransfer,
}: OverdueTransfersAlertProps) {
  const [isOpen, setIsOpen] = React.useState(() => Boolean(overdueSummary?.overdue))

  React.useEffect(() => {
    if (overdueSummary?.overdue) {
      setIsOpen(true)
    }
  }, [overdueSummary?.overdue])

  if (isLoading || !overdueSummary || overdueSummary.total === 0) {
    return null
  }

  const overdueTransfers = overdueSummary.items.filter((transfer) => transfer.days_difference < 0)
  const upcomingTransfers = overdueSummary.items.filter((transfer) => transfer.days_difference >= 0)
  const upcomingCount = overdueSummary.due_today + overdueSummary.due_soon

  return (
    <Card className="mb-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {overdueSummary.overdue > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                ) : (
                  <Clock className="h-5 w-5 text-orange-500" />
                )}
                <div>
                  <CardTitle className="text-base">
                    Cảnh báo thiết bị cần hoàn trả
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {overdueSummary.overdue > 0 && (
                      <span className="text-destructive font-medium">
                        {overdueSummary.overdue} thiết bị quá hạn
                      </span>
                    )}
                    {overdueSummary.overdue > 0 && upcomingCount > 0 && " • "}
                    {upcomingCount > 0 && (
                      <span className="text-orange-600 font-medium">
                        {upcomingCount} thiết bị sắp tới hạn
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Badge variant={overdueSummary.overdue > 0 ? "destructive" : "secondary"}>
                {overdueSummary.total}
              </Badge>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Overdue transfers */}
            {overdueTransfers.length > 0 && (
              <div>
                <h4 className="font-medium text-destructive mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Thiết bị quá hạn hoàn trả ({overdueSummary.overdue})
                </h4>
                <div className="space-y-2">
                  {overdueTransfers.map((transfer) => (
                    <Alert key={transfer.id} variant="destructive">
                      <AlertDescription className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {transfer.thiet_bi?.ma_thiet_bi} - {transfer.thiet_bi?.ten_thiet_bi}
                          </p>
                          <p className="text-sm">
                            Đơn vị: {transfer.don_vi_nhan} • 
                            Quá hạn {Math.abs(transfer.days_difference)} ngày
                          </p>
                        </div>
                        {onViewTransfer && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewTransfer(transfer)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Xem
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming transfers */}
            {upcomingTransfers.length > 0 && (
              <div>
                <h4 className="font-medium text-orange-600 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Thiết bị sắp tới hạn hoàn trả ({upcomingCount})
                </h4>
                <div className="space-y-2">
                  {upcomingTransfers.map((transfer) => (
                    <Alert key={transfer.id}>
                      <AlertDescription className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {transfer.thiet_bi?.ma_thiet_bi} - {transfer.thiet_bi?.ten_thiet_bi}
                          </p>
                          <p className="text-sm">
                            Đơn vị: {transfer.don_vi_nhan} • 
                            Còn {transfer.days_difference} ngày
                          </p>
                        </div>
                        {onViewTransfer && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewTransfer(transfer)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Xem
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
