import * as React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

import type { HandoverData, HandoverField } from "./handover-preview-dialog.types"

type HandoverPreviewFormProps = Readonly<{
  data: HandoverData
  onFieldChange: (field: HandoverField, value: string) => void
}>

export function HandoverPreviewForm({ data, onFieldChange }: HandoverPreviewFormProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="department">Khoa/Phòng lập</Label>
          <Input
            id="department"
            value={data.department}
            onChange={(event) => onFieldChange("department", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="handoverDate">Ngày bàn giao</Label>
          <Input
            id="handoverDate"
            value={data.handoverDate}
            onChange={(event) => onFieldChange("handoverDate", event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Lý do bàn giao</Label>
        <Textarea
          id="reason"
          value={data.reason}
          onChange={(event) => onFieldChange("reason", event.target.value)}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="giverName">Đại diện bên giao</Label>
          <Input
            id="giverName"
            value={data.giverName}
            onChange={(event) => onFieldChange("giverName", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="directorName">Ban Giám đốc</Label>
          <Input
            id="directorName"
            value={data.directorName}
            onChange={(event) => onFieldChange("directorName", event.target.value)}
            placeholder="Tên Ban Giám đốc (tùy chọn)"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="receiverName">Đại diện bên nhận</Label>
          <Input
            id="receiverName"
            value={data.receiverName}
            onChange={(event) => onFieldChange("receiverName", event.target.value)}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="font-medium">Thông tin thiết bị</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="accessories">Tài liệu/Phụ kiện kèm theo</Label>
            <Textarea
              id="accessories"
              value={data.device.accessories}
              onChange={(event) => onFieldChange("device.accessories", event.target.value)}
              placeholder="Nhập tài liệu, phụ kiện kèm theo…"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea
              id="note"
              value={data.device.note}
              onChange={(event) => onFieldChange("device.note", event.target.value)}
              placeholder="Nhập ghi chú…"
              rows={3}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
