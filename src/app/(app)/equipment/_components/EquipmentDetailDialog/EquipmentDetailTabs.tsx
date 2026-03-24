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

interface EquipmentDetailTabsProps {
  addAttachment: (params: { name: string; url: string }) => Promise<void>
  attachments: Attachment[]
  currentTab: string
  deleteAttachment: (attachmentId: string) => Promise<void>
  displayEquipment: Equipment
  editForm: UseFormReturn<EquipmentFormValues>
  equipment: Equipment
  history: HistoryItem[]
  isAddingAttachment: boolean
  isDeletingAttachment: boolean
  isEditingDetails: boolean
  isLoadingAttachments: boolean
  isLoadingHistory: boolean
  onSubmitInlineEdit: (values: EquipmentFormValues) => Promise<void>
  onTabChange: (value: string) => void
  tabsScrollRef: React.RefObject<HTMLDivElement | null>
}

export function EquipmentDetailTabs({
  addAttachment,
  attachments,
  currentTab,
  deleteAttachment,
  displayEquipment,
  editForm,
  equipment,
  history,
  isAddingAttachment,
  isDeletingAttachment,
  isEditingDetails,
  isLoadingAttachments,
  isLoadingHistory,
  onSubmitInlineEdit,
  onTabChange,
  tabsScrollRef,
}: EquipmentDetailTabsProps): React.ReactNode {
  return (
    <Tabs
      value={currentTab}
      onValueChange={onTabChange}
      className="flex-grow flex flex-col overflow-hidden"
    >
      <div ref={tabsScrollRef} className="overflow-x-auto flex-shrink-0">
        <TabsList className="w-max">
          <TabsTrigger value="details">Thông tin chi tiết</TabsTrigger>
          <TabsTrigger value="config">Cấu hình & Phụ kiện</TabsTrigger>
          <TabsTrigger value="files">File đính kèm</TabsTrigger>
          <TabsTrigger value="history">Lịch sử</TabsTrigger>
          <TabsTrigger value="usage">Nhật ký sử dụng</TabsTrigger>
        </TabsList>
      </div>

      <FormProvider {...editForm}>
        <TabsContent
          value="details"
          className={`flex-grow overflow-hidden ${currentTab !== "details" && isEditingDetails ? "hidden" : ""}`}
          forceMount={isEditingDetails ? true : undefined}
        >
          <EquipmentDetailDetailsTab
            displayEquipment={displayEquipment}
            isEditing={isEditingDetails}
          >
            <EquipmentDetailEditForm
              formId="equipment-inline-edit-form"
              initialStatus={displayEquipment.tinh_trang_hien_tai ?? null}
              onSubmit={onSubmitInlineEdit}
            />
          </EquipmentDetailDetailsTab>
        </TabsContent>

        <TabsContent value="config" className="flex-grow overflow-hidden">
          <EquipmentDetailConfigTab
            displayEquipment={displayEquipment}
            isEditing={isEditingDetails}
          />
        </TabsContent>
      </FormProvider>

      <TabsContent value="files" className="flex-grow overflow-hidden">
        <EquipmentDetailFilesTab
          attachments={attachments}
          isLoading={isLoadingAttachments}
          googleDriveFolderUrl={equipment.google_drive_folder_url}
          onAddAttachment={addAttachment}
          onDeleteAttachment={deleteAttachment}
          isAdding={isAddingAttachment}
          isDeleting={isDeletingAttachment}
        />
      </TabsContent>

      <TabsContent value="history" className="flex-grow overflow-hidden">
        <EquipmentDetailHistoryTab history={history} isLoading={isLoadingHistory} />
      </TabsContent>

      <TabsContent value="usage" className="flex-grow overflow-hidden">
        <EquipmentDetailUsageTab equipment={equipment} />
      </TabsContent>
    </Tabs>
  )
}
