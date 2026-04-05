"use client"

import * as React from "react"

import { ChangeHistoryTab } from "@/components/change-history/ChangeHistoryTab"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ChangeHistoryEntry } from "@/components/change-history/ChangeHistoryTypes"

import type { RepairRequestWithEquipment } from "@/app/(app)/repair-requests/types"
import { RepairRequestsDetailContent } from "./RepairRequestsDetailContent"

interface RepairRequestsDetailTabsProps {
  request: RepairRequestWithEquipment
  historyEntries: ChangeHistoryEntry[]
  isLoadingHistory: boolean
  isHistoryError: boolean
  historyErrorMessage: string | null
  activeTab: string
  onTabChange: (tab: string) => void
}

export function RepairRequestsDetailTabs({
  request,
  historyEntries,
  isLoadingHistory,
  isHistoryError,
  historyErrorMessage,
  activeTab,
  onTabChange,
}: RepairRequestsDetailTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-4 py-3">
        <TabsList>
          <TabsTrigger value="details">Chi tiết</TabsTrigger>
          <TabsTrigger value="history">Lịch sử</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="details" className="mt-0 min-h-0 flex-1 overflow-hidden px-4">
        <ScrollArea className="h-full">
          <RepairRequestsDetailContent request={request} />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="history" className="mt-0 min-h-0 flex-1 overflow-hidden px-4">
        <ScrollArea className="h-full">
          {isHistoryError ? (
            <div className="py-4">
              <Alert variant="destructive">
                <AlertTitle>Không thể tải lịch sử thay đổi</AlertTitle>
                <AlertDescription>
                  {historyErrorMessage ?? "Đã xảy ra lỗi khi tải dữ liệu lịch sử."}
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <ChangeHistoryTab entries={historyEntries} isLoading={isLoadingHistory} />
          )}
        </ScrollArea>
      </TabsContent>
    </Tabs>
  )
}
