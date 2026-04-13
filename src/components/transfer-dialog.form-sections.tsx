"use client"

import * as React from "react"

import {
  TRANSFER_PURPOSES,
  TRANSFER_TYPES,
  type TransferPurpose,
  type TransferType,
} from "@/types/database"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { TransferDialogFormData } from "@/components/transfer-dialog.shared"

type SetFormData = React.Dispatch<React.SetStateAction<TransferDialogFormData>>

function updateCurrentDepartmentFields(
  previous: TransferDialogFormData,
  currentDepartment: string,
): TransferDialogFormData {
  return {
    ...previous,
    khoa_phong_hien_tai: currentDepartment,
    khoa_phong_nhan:
      previous.khoa_phong_nhan === currentDepartment ? "" : previous.khoa_phong_nhan,
  }
}

export function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function TransferTypeField({
  disabled,
  formData,
  setFormData,
  includeDisposalStyle = false,
}: {
  disabled: boolean
  formData: TransferDialogFormData
  setFormData: SetFormData
  includeDisposalStyle?: boolean
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="type">Loại hình luân chuyển *</Label>
      <Select
        value={formData.loai_hinh}
        onValueChange={(value: TransferType) =>
          setFormData((previous) => ({ ...previous, loai_hinh: value }))
        }
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Chọn loại hình" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(TRANSFER_TYPES).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    key === "noi_bo"
                      ? "default"
                      : includeDisposalStyle && key === "thanh_ly"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {label}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function TransferInternalSelectFields({
  departments,
  disabled,
  formData,
  setFormData,
  lockCurrentDepartment,
}: {
  departments: string[]
  disabled: boolean
  formData: TransferDialogFormData
  setFormData: SetFormData
  lockCurrentDepartment: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="khoa_phong_hien_tai">Khoa/Phòng hiện tại</Label>
        <Select
          value={formData.khoa_phong_hien_tai}
          onValueChange={(value) =>
            setFormData((previous) => updateCurrentDepartmentFields(previous, value))
          }
          disabled={lockCurrentDepartment || disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn khoa/phòng hiện tại" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((department) => (
              <SelectItem key={department} value={department}>
                {department}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="khoa_phong_nhan">Khoa/Phòng nhận</Label>
        <Select
          value={formData.khoa_phong_nhan}
          onValueChange={(value) =>
            setFormData((previous) => ({ ...previous, khoa_phong_nhan: value }))
          }
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn khoa/phòng nhận" />
          </SelectTrigger>
          <SelectContent>
            {departments
              .filter((department) => department !== formData.khoa_phong_hien_tai)
              .map((department) => (
                <SelectItem key={department} value={department}>
                  {department}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function TransferInternalInputFields({
  disabled,
  formData,
  setFormData,
}: {
  disabled: boolean
  formData: TransferDialogFormData
  setFormData: SetFormData
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="current_dept">Khoa/Phòng hiện tại *</Label>
        <Input
          id="current_dept"
          value={formData.khoa_phong_hien_tai}
          onChange={(event) =>
            setFormData((previous) =>
              updateCurrentDepartmentFields(previous, event.target.value),
            )
          }
          placeholder="Khoa/phòng hiện tại quản lý"
          disabled={disabled}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="receiving_dept">Khoa/Phòng nhận *</Label>
        <Input
          id="receiving_dept"
          value={formData.khoa_phong_nhan}
          onChange={(event) =>
            setFormData((previous) => ({
              ...previous,
              khoa_phong_nhan: event.target.value,
            }))
          }
          placeholder="Khoa/phòng sẽ nhận thiết bị"
          disabled={disabled}
          required
        />
      </div>
    </div>
  )
}

export function TransferExternalFields({
  disabled,
  formData,
  setFormData,
}: {
  disabled: boolean
  formData: TransferDialogFormData
  setFormData: SetFormData
}) {
  const minimumReturnDate = React.useMemo(() => toLocalDateInputValue(new Date()), [])

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="purpose">Mục đích *</Label>
        <Select
          value={formData.muc_dich}
          onValueChange={(value: TransferPurpose) =>
            setFormData((previous) => ({ ...previous, muc_dich: value }))
          }
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn mục đích luân chuyển" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TRANSFER_PURPOSES).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="external_org">Đơn vị nhận *</Label>
        <Input
          id="external_org"
          value={formData.don_vi_nhan}
          onChange={(event) =>
            setFormData((previous) => ({ ...previous, don_vi_nhan: event.target.value }))
          }
          placeholder="Tên đơn vị/tổ chức nhận thiết bị"
          disabled={disabled}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="address">Địa chỉ đơn vị</Label>
        <Textarea
          id="address"
          value={formData.dia_chi_don_vi}
          onChange={(event) =>
            setFormData((previous) => ({ ...previous, dia_chi_don_vi: event.target.value }))
          }
          placeholder="Địa chỉ của đơn vị nhận"
          disabled={disabled}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="contact_person">Người liên hệ</Label>
          <Input
            id="contact_person"
            value={formData.nguoi_lien_he}
            onChange={(event) =>
              setFormData((previous) => ({ ...previous, nguoi_lien_he: event.target.value }))
            }
            placeholder="Tên người liên hệ"
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Số điện thoại</Label>
          <Input
            id="phone"
            value={formData.so_dien_thoai}
            onChange={(event) =>
              setFormData((previous) => ({ ...previous, so_dien_thoai: event.target.value }))
            }
            placeholder="Số điện thoại liên hệ"
            disabled={disabled}
          />
        </div>
      </div>

      {(formData.muc_dich === "sua_chua" || formData.muc_dich === "cho_muon") && (
        <div className="grid gap-2">
          <Label htmlFor="expected_return">Ngày dự kiến trả về</Label>
          <Input
            id="expected_return"
            type="date"
            value={formData.ngay_du_kien_tra}
            onChange={(event) =>
              setFormData((previous) => ({ ...previous, ngay_du_kien_tra: event.target.value }))
            }
            disabled={disabled}
            min={minimumReturnDate}
          />
        </div>
      )}
    </>
  )
}

export function TransferReasonField({
  disabled,
  formData,
  setFormData,
  allowDisposalCopy = false,
}: {
  disabled: boolean
  formData: TransferDialogFormData
  setFormData: SetFormData
  allowDisposalCopy?: boolean
}) {
  const isDisposal = allowDisposalCopy && formData.loai_hinh === "thanh_ly"

  return (
    <div className="grid gap-2">
      <Label htmlFor="reason">{isDisposal ? "Lý do thanh lý *" : "Lý do luân chuyển *"}</Label>
      <Textarea
        id="reason"
        value={formData.ly_do_luan_chuyen}
        onChange={(event) =>
          setFormData((previous) => ({
            ...previous,
            ly_do_luan_chuyen: event.target.value,
          }))
        }
        placeholder={
          isDisposal
            ? "Mô tả lý do cần thanh lý thiết bị (ví dụ: hỏng không thể sửa chữa, lỗi thời...)"
            : "Mô tả lý do cần luân chuyển thiết bị"
        }
        disabled={disabled}
        required
        rows={3}
      />
    </div>
  )
}
