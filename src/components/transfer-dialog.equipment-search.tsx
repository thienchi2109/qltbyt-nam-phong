"use client"

import * as React from "react"
import { Check, Loader2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TransferEquipmentOption } from "@/components/transfer-dialog.shared"

type TransferDialogEquipmentSearchProps = {
  disabled: boolean
  canSearch?: boolean
  required?: boolean
  searchTerm: string
  trimmedSearch: string
  selectedEquipment: TransferEquipmentOption | null
  isEquipmentLoading: boolean
  showResultsDropdown: boolean
  showNoResults: boolean
  showMinCharsHint: boolean
  filteredEquipment: TransferEquipmentOption[]
  noSearchMessage?: string
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onSelectEquipment: (equipment: TransferEquipmentOption) => void
}

export function TransferDialogEquipmentSearch({
  disabled,
  canSearch = true,
  required = false,
  searchTerm,
  trimmedSearch,
  selectedEquipment,
  isEquipmentLoading,
  showResultsDropdown,
  showNoResults,
  showMinCharsHint,
  filteredEquipment,
  noSearchMessage,
  onSearchChange,
  onSelectEquipment,
}: TransferDialogEquipmentSearchProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="equipment">Thiết bị{required ? " *" : ""}</Label>
      <div className="relative">
        <Input
          id="equipment"
          value={searchTerm}
          onChange={onSearchChange}
          placeholder="Tìm kiếm thiết bị..."
          disabled={disabled}
          required={required}
        />
        {canSearch && showMinCharsHint && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover p-3 shadow-lg">
            <div className="text-center text-sm text-muted-foreground">
              Nhập tối thiểu 2 ký tự để tìm kiếm
            </div>
          </div>
        )}
        {canSearch && trimmedSearch.length >= 2 && (
          <>
            {isEquipmentLoading && (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover p-3 shadow-lg">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang tìm kiếm thiết bị...</span>
                </div>
              </div>
            )}
            {showResultsDropdown && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
                <div className="p-1">
                  {filteredEquipment.map((equipment) => (
                    <button
                      type="button"
                      key={equipment.id}
                      className="w-full rounded-sm p-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                      onClick={() => onSelectEquipment(equipment)}
                    >
                      <div className="font-medium">
                        {equipment.ten_thiet_bi} ({equipment.ma_thiet_bi})
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {equipment.model && `Model: ${equipment.model}`}
                        {equipment.khoa_phong_quan_ly && ` • ${equipment.khoa_phong_quan_ly}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showNoResults && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover p-3 shadow-lg">
                <div className="text-center text-sm text-muted-foreground">
                  Không tìm thấy kết quả phù hợp
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {!canSearch && noSearchMessage && (
        <p className="text-xs text-muted-foreground">{noSearchMessage}</p>
      )}
      {selectedEquipment && (
        <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-green-600" />
          <span>
            Đã chọn: {selectedEquipment.ten_thiet_bi} ({selectedEquipment.ma_thiet_bi})
          </span>
        </p>
      )}
    </div>
  )
}
