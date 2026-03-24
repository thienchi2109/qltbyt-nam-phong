"use client"

import * as React from "react"
import { FormProvider, type UseFormReturn } from "react-hook-form"

import type { Attachment, HistoryItem } from "@/app/(app)/equipment/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Equipment } from "@/types/database"

import type { EquipmentFormValues } from "./EquipmentDetailTypes"
import { EquipmentDetailConfigTab } from "./EquipmentDetailConfigTab"
import { EquipmentDetailDetailsTab } from "./EquipmentDetailDetailsTab"
import { EquipmentDetailEditForm } from "./EquipmentDetailEditForm"
import { EquipmentDetailFilesTab } from "./EquipmentDetailFilesTab"
import { EquipmentDetailHistoryTab } from "./EquipmentDetailHistoryTab"
import { EquipmentDetailUsageTab } from "./EquipmentDetailUsageTab"

interface EquipmentDetailTabsAttachmentsProps {
  addAttachment: (params: { name: string; url: string }) => Promise<void>
  attachments: Attachment[]
  deleteAttachment: (attachmentId: string) => Promise<void>
  googleDriveFolderUrl: Equipment["google_drive_folder_url"]
  isAddingAttachment: boolean
  isDeletingAttachment: boolean
  isLoadingAttachments: boolean
}

interface EquipmentDetailTabsDetailProps {
  currentTab: string
  displayEquipment: Equipment
  editForm: UseFormReturn<EquipmentFormValues>
  isEditingDetails: boolean
  onSubmitInlineEdit: (values: EquipmentFormValues) => Promise<void>
  onTabChange: (value: string) => void
  tabsScrollRef: React.MutableRefObject<HTMLDivElement | null>
}

interface EquipmentDetailTabsHistoryProps {
  history: HistoryItem[]
  isLoadingHistory: boolean
}

interface EquipmentDetailTabsProps {
  attachments: EquipmentDetailTabsAttachmentsProps
  detail: EquipmentDetailTabsDetailProps
  history: EquipmentDetailTabsHistoryProps
  usageEquipment: Equipment
}

export function EquipmentDetailTabs({
  attachments,
  detail,
  history,
  usageEquipment,
}: EquipmentDetailTabsProps): React.ReactNode {
  return (
    <Tabs
      value={detail.currentTab}
      onValueChange={detail.onTabChange}
      className="flex-grow flex flex-col overflow-hidden"
    >
      <div ref={detail.tabsScrollRef} className="overflow-x-auto flex-shrink-0">
        <TabsList className="w-max">
          <TabsTrigger value="details">Thông tin chi tiết</TabsTrigger>
          <TabsTrigger value="config">Cấu hình & Phụ kiện</TabsTrigger>
          <TabsTrigger value="files">File đính kèm</TabsTrigger>
          <TabsTrigger value="history">Lịch sử</TabsTrigger>
          <TabsTrigger value="usage">Nhật ký sử dụng</TabsTrigger>
        </TabsList>
      </div>

      <FormProvider {...detail.editForm}>
        <TabsContent
          value="details"
          className={`flex-grow overflow-hidden ${detail.currentTab !== "details" && detail.isEditingDetails ? "hidden" : ""}`}
          forceMount={detail.isEditingDetails ? true : undefined}
        >
          <EquipmentDetailDetailsTab
            displayEquipment={detail.displayEquipment}
            isEditing={detail.isEditingDetails}
          >
            <EquipmentDetailEditForm
              formId="equipment-inline-edit-form"
              initialStatus={detail.displayEquipment.tinh_trang_hien_tai ?? null}
              onSubmit={detail.onSubmitInlineEdit}
            />
          </EquipmentDetailDetailsTab>
        </TabsContent>

        <TabsContent value="config" className="flex-grow overflow-hidden">
          <EquipmentDetailConfigTab
            displayEquipment={detail.displayEquipment}
            isEditing={detail.isEditingDetails}
          />
        </TabsContent>
      </FormProvider>

      <TabsContent value="files" className="flex-grow overflow-hidden">
        <EquipmentDetailFilesTab
          attachments={attachments.attachments}
          isLoading={attachments.isLoadingAttachments}
          googleDriveFolderUrl={attachments.googleDriveFolderUrl}
          onAddAttachment={attachments.addAttachment}
          onDeleteAttachment={attachments.deleteAttachment}
          isAdding={attachments.isAddingAttachment}
          isDeleting={attachments.isDeletingAttachment}
        />
      </TabsContent>

      <TabsContent value="history" className="flex-grow overflow-hidden">
        <EquipmentDetailHistoryTab
          history={history.history}
          isLoading={history.isLoadingHistory}
        />
      </TabsContent>

      <TabsContent value="usage" className="flex-grow overflow-hidden">
        <EquipmentDetailUsageTab equipment={usageEquipment} />
      </TabsContent>
    </Tabs>
  )
}
