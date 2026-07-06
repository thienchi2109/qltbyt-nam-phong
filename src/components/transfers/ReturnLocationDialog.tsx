"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { callRpc } from "@/lib/rpc-client"
import type { TransferListItem } from "@/types/transfers-data-grid"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type LocationSuggestion = {
  vi_tri: string | null
}

type ReturnLocationDialogProps = Readonly<{
  open: boolean
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  transfer: TransferListItem | null
  onConfirm: (viTriHoanTra: string) => Promise<void>
}>

const FORBIDDEN_RETURN_LOCATION = "Đang luân chuyển bên ngoài"

function normalizeLocationValue(value: string): string {
  return value.trim()
}

function getValidationMessage(value: string): string | null {
  if (value.length === 0) {
    return "Vui lòng nhập vị trí hoàn trả."
  }

  if (value.toLocaleLowerCase("vi-VN") === FORBIDDEN_RETURN_LOCATION.toLocaleLowerCase("vi-VN")) {
    return 'Vị trí hoàn trả không được là "Đang luân chuyển bên ngoài".'
  }

  return null
}

/** Collects and validates the destination location before completing an external return. */
export function ReturnLocationDialog({
  open,
  isSubmitting,
  onOpenChange,
  transfer,
  onConfirm,
}: ReturnLocationDialogProps) {
  const resetKey = open ? String(transfer?.id ?? "none") : "closed"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ReturnLocationDialogContent
        key={resetKey}
        open={open}
        isSubmitting={isSubmitting}
        onCancel={() => onOpenChange(false)}
        transfer={transfer}
        onConfirm={onConfirm}
      />
    </Dialog>
  )
}

function ReturnLocationDialogContent({
  open,
  isSubmitting,
  onCancel,
  transfer,
  onConfirm,
}: Omit<ReturnLocationDialogProps, "onOpenChange"> & { onCancel: () => void }) {
  const [location, setLocation] = React.useState("")
  const [validationMessage, setValidationMessage] = React.useState<string | null>(null)

  const { data: locationSuggestionsData, isLoading: isLocationSuggestionsLoading } = useQuery({
    queryKey: ["equipment-location-suggestions", transfer?.id],
    enabled: open && transfer !== null,
    queryFn: async () =>
      callRpc<LocationSuggestion[]>({
        fn: "get_equipment_location_suggestions",
        args: { p_transfer_request_id: transfer?.id },
      }),
    staleTime: 60_000,
  })

  const suggestions = React.useMemo(() => {
    const seen = new Set<string>()
    const nextSuggestions: string[] = []

    for (const item of locationSuggestionsData ?? []) {
      const suggestion = normalizeLocationValue(item.vi_tri ?? "")
      if (suggestion.length === 0) continue

      const key = suggestion.toLocaleLowerCase("vi-VN")
      if (seen.has(key)) continue

      seen.add(key)
      nextSuggestions.push(suggestion)
    }

    return nextSuggestions
  }, [locationSuggestionsData])

  const handleLocationChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setLocation(event.target.value)
      if (validationMessage) {
        setValidationMessage(null)
      }
    },
    [validationMessage]
  )

  const handleSelectSuggestion = React.useCallback((suggestion: string) => {
    setLocation(suggestion)
    setValidationMessage(null)
  }, [])

  const handleConfirm = React.useCallback(async () => {
    const normalizedLocation = normalizeLocationValue(location)
    const nextValidationMessage = getValidationMessage(normalizedLocation)

    if (nextValidationMessage) {
      setValidationMessage(nextValidationMessage)
      return
    }

    try {
      await onConfirm(normalizedLocation)
    } catch {
      // Parent mutation already surfaces errors; keep the dialog state intact for retry.
    }
  }, [location, onConfirm])

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Xác nhận vị trí hoàn trả</DialogTitle>
        <DialogDescription>
          Chọn một vị trí gợi ý hoặc nhập vị trí lắp đặt mới khi thiết bị được hoàn trả.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="return-location-input">Vị trí hoàn trả</Label>
          <Input
            id="return-location-input"
            value={location}
            onChange={handleLocationChange}
            placeholder="Nhập vị trí hoàn trả"
            disabled={isSubmitting}
            aria-invalid={validationMessage ? "true" : "false"}
            aria-describedby={validationMessage ? "return-location-error" : undefined}
          />
          {validationMessage ? (
            <p id="return-location-error" className="text-sm text-destructive">
              {validationMessage}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Vị trí gợi ý</p>
          {isLocationSuggestionsLoading ? (
            <p className="text-sm text-muted-foreground">Đang tải vị trí gợi ý…</p>
          ) : suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Chưa có vị trí gợi ý phù hợp cho thiết bị này.
            </p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
          Hủy
        </Button>
        <Button type="button" disabled={isSubmitting} onClick={() => void handleConfirm()}>
          Xác nhận hoàn trả
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
