"use client"

import * as React from "react"
import { AlertTriangle, Clock, Eye } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { callRpc } from "@/lib/rpc-client"
import { TransferRequest } from "@/types/database"

interface OverdueTransfersAlertProps {
  onViewTransfer?: (transfer: TransferRequest) => void
}

export function OverdueTransfersAlert({ onViewTransfer }: OverdueTransfersAlertProps) {
  const [overdueTransfers, setOverdueTransfers] = React.useState<TransferRequest[]>([])
  const [upcomingTransfers, setUpcomingTransfers] = React.useState<TransferRequest[]>([])
  const [isOpen, setIsOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const isMountedRef = React.useRef(true)

  React.useEffect(() => {
    isMountedRef.current = true
    fetchOverdueTransfers()
    
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fetchOverdueTransfers = async () => {
    try {
      const today = new Date()
      const nextWeek = new Date()
      nextWeek.setDate(today.getDate() + 7)

      const transfers = await callRpc<TransferRequest[]>({ fn: 'transfer_request_external_pending_returns' })
      
      // Prevent setState on unmounted component
      if (!isMountedRef.current) return
      
      const overdue = transfers.filter(t => 
        new Date(t.ngay_du_kien_tra!) < today
      )
      
      const upcoming = transfers.filter(t => {
        const dueDate = new Date(t.ngay_du_kien_tra!)
        return dueDate >= today && dueDate <= nextWeek
      })

      setOverdueTransfers(overdue)
      setUpcomingTransfers(upcoming)
      
      // Auto-open if there are overdue transfers
      if (overdue.length > 0) {
        setIsOpen(true)
      }
    } catch (error) {
      console.error('Error fetching overdue transfers:', error)
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }

  const getDaysOverdue = (dueDate: string) => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = today.getTime() - due.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (isLoading || (overdueTransfers.length === 0 && upcomingTransfers.length === 0)) {
    return null
  }

  const totalAlerts = overdueTransfers.length + upcomingTransfers.length

  return (
    <Card className="mb-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {overdueTransfers.length > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                ) : (
                  <Clock className="h-5 w-5 text-orange-500" />
                )}
                <div>
                  <CardTitle className="text-base">
                    Cảnh báo thiết bị cần hoàn trả
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {overdueTransfers.length > 0 && (
                      <span className="text-destructive font-medium">
                        {overdueTransfers.length} thiết bị quá hạn
                      </span>
                    )}
                    {overdueTransfers.length > 0 && upcomingTransfers.length > 0 && " • "}
                    {upcomingTransfers.length > 0 && (
                      <span className="text-orange-600 font-medium">
                        {upcomingTransfers.length} thiết bị sắp tới hạn
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Badge variant={overdueTransfers.length > 0 ? "destructive" : "secondary"}>
                {totalAlerts}
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
                  Thiết bị quá hạn hoàn trả ({overdueTransfers.length})
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
                            Quá hạn {getDaysOverdue(transfer.ngay_du_kien_tra!)} ngày
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
                  Thiết bị sắp tới hạn hoàn trả ({upcomingTransfers.length})
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
                            Còn {getDaysUntilDue(transfer.ngay_du_kien_tra!)} ngày
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