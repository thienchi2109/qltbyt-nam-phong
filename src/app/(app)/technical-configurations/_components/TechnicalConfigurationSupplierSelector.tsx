"use client"

import * as React from "react"
import { Loader2, Save, Trash2 } from "lucide-react"

import type { useTechnicalConfigurationOptions } from "../_hooks/useTechnicalConfigurationOptions"
import type { TechnicalConfigurationSupplierWire } from "../supplier-option-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type TechnicalConfigurationOptionsState = ReturnType<typeof useTechnicalConfigurationOptions>

type TechnicalConfigurationSupplierSelectorProps = {
  state: TechnicalConfigurationOptionsState
  selectedSupplier: TechnicalConfigurationSupplierWire | null
  isLoadingDeleteCount: boolean
  isMutationBlocked: boolean
  requestIdentityChange: (description: React.ReactNode, action: () => void) => void
  onDeleteSupplier: () => void
}

/** Renders grouped supplier/option selection plus the supplier identity form. */
export function TechnicalConfigurationSupplierSelector({
  state,
  selectedSupplier,
  isLoadingDeleteCount,
  isMutationBlocked,
  requestIdentityChange,
  onDeleteSupplier,
}: Readonly<TechnicalConfigurationSupplierSelectorProps>) {
  return (
    <aside className="min-w-0 space-y-4 border-r-0 lg:border-r lg:pr-6">
      {state.suppliers.length === 0 && !state.isCreatingSupplier ? (
        <div className="border-y py-8 text-center text-sm text-muted-foreground">
          Chưa có nhà cung cấp.
        </div>
      ) : (
        <div className="space-y-4">
          {state.suppliers.map((supplier) => {
            const supplierOptions = state.options.filter(
              (option) => option.supplier_id === supplier.id
            )
            const isSelected = supplier.id === state.selectedSupplierId
            return (
              <section key={supplier.id} className="min-w-0 border-b pb-4">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-auto w-full justify-start whitespace-normal px-2 py-2 text-left",
                    isSelected && "bg-muted"
                  )}
                  aria-pressed={isSelected}
                  onClick={() =>
                    requestIdentityChange("Thay đổi phương án hiện tại chưa được lưu.", () =>
                      state.selectSupplier(supplier.id)
                    )
                  }
                  disabled={
                    state.isPending || state.isConflict || isLoadingDeleteCount || isMutationBlocked
                  }
                >
                  <span className="break-words font-medium">{supplier.name}</span>
                </Button>
                <div className="mt-1 space-y-1 pl-3">
                  {supplierOptions.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant="ghost"
                      className={cn(
                        "h-auto w-full justify-start whitespace-normal px-2 py-2 text-left text-sm",
                        option.id === state.selectedOptionId && "bg-muted"
                      )}
                      aria-pressed={option.id === state.selectedOptionId}
                      onClick={() =>
                        requestIdentityChange("Thay đổi phương án hiện tại chưa được lưu.", () =>
                          state.selectOption(option.id)
                        )
                      }
                      disabled={
                        state.isPending ||
                        state.isConflict ||
                        isLoadingDeleteCount ||
                        isMutationBlocked
                      }
                    >
                      <span className="break-words">{option.display_label}</span>
                    </Button>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {(selectedSupplier || state.isCreatingSupplier) && (
        <div className="space-y-3 border-t pt-4">
          <div className="space-y-2">
            <Label htmlFor="technical-supplier-name">Tên nhà cung cấp</Label>
            <Input
              id="technical-supplier-name"
              value={state.supplierDraft.name}
              onChange={(event) => state.updateSupplierDraft(event.target.value)}
              disabled={
                state.isReadOnly ||
                state.isPending ||
                state.isConflict ||
                isLoadingDeleteCount ||
                isMutationBlocked
              }
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void state.saveSupplier()}
              disabled={
                state.isReadOnly ||
                state.isPending ||
                state.isConflict ||
                isLoadingDeleteCount ||
                isMutationBlocked
              }
            >
              <Save className="size-4" aria-hidden="true" />
              Lưu nhà cung cấp
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDeleteSupplier}
              disabled={
                state.isReadOnly ||
                state.isPending ||
                state.isConflict ||
                isLoadingDeleteCount ||
                isMutationBlocked ||
                state.isCreatingSupplier ||
                !selectedSupplier
              }
              aria-label="Xóa nhà cung cấp"
            >
              {isLoadingDeleteCount ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              Xóa
            </Button>
          </div>
        </div>
      )}
    </aside>
  )
}
