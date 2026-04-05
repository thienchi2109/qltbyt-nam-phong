"use client"

import * as React from "react"

import { ChangeHistoryTab } from "@/components/change-history/ChangeHistoryTab"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ChangeHistoryEntry } from "@/components/change-history/ChangeHistoryTypes"

import type { RepairRequestWithEquipment } from "../types"
import { RepairRequestsDetailContent } from "./RepairRequestsDetailContent"

interface RepairRequestsDetailTabsProps {
  request: RepairRequestWithEquipment
  historyEntries: ChangeHistoryEntry[]
  isLoadingHistory: boolean
}

export function RepairRequestsDetailTabs({
  request,
  historyEntries,
  isLoadingHistory,
}: RepairRequestsDetailTabsProps) {
  return (
    <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-4 py-3">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="details" className="mt-0 min-h-0 flex-1 overflow-hidden px-4">
        <ScrollArea className="h-full">
          <RepairRequestsDetailContent request={request} />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="history" className="mt-0 min-h-0 flex-1 overflow-hidden px-4">
        <ScrollArea className="h-full">
          <ChangeHistoryTab entries={historyEntries} isLoading={isLoadingHistory} />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  )
}
