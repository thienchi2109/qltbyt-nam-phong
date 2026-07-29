"use client"

import * as React from "react"
import { Columns3, Focus, Pin, PinOff, X } from "lucide-react"

import { COMPARISON_MATRIX_LIMITS } from "@/app/(app)/technical-configurations/comparison-matrix-constants"
import type { TechnicalConfigurationOptionWire } from "@/app/(app)/technical-configurations/supplier-option-types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type TechnicalConfigurationMatrixColumnControlsProps = {
  selectedOptions: readonly TechnicalConfigurationOptionWire[]
  visibleOptionIds: readonly string[]
  pinnedOptionIds: readonly string[]
  focusedOptionId: string | null
  onToggleOptionVisibility: (optionId: string) => void
  onToggleOptionPin: (optionId: string) => void
  onFocusOption: (optionId: string) => void
  onExitFocus: () => void
}

/** Keeps view-only column actions behind one compact, immediate-action control. */
export function TechnicalConfigurationMatrixColumnControls({
  selectedOptions,
  visibleOptionIds,
  pinnedOptionIds,
  focusedOptionId,
  onToggleOptionVisibility,
  onToggleOptionPin,
  onFocusOption,
  onExitFocus,
}: Readonly<TechnicalConfigurationMatrixColumnControlsProps>) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const exitFocusRef = React.useRef<HTMLButtonElement | null>(null)
  const visibleOptionIdSet = React.useMemo(() => new Set(visibleOptionIds), [visibleOptionIds])
  const pinnedOptionIdSet = React.useMemo(() => new Set(pinnedOptionIds), [pinnedOptionIds])
  const focusedOption = selectedOptions.find((option) => option.id === focusedOptionId)
  const resolvedFocusedOptionId = focusedOption?.id ?? null
  const wasFocusedRef = React.useRef(resolvedFocusedOptionId !== null)

  React.useEffect(() => {
    if (resolvedFocusedOptionId === null) return
    const frame = window.requestAnimationFrame(() => exitFocusRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [resolvedFocusedOptionId])

  React.useEffect(() => {
    const wasFocused = wasFocusedRef.current
    wasFocusedRef.current = resolvedFocusedOptionId !== null
    if (!wasFocused || resolvedFocusedOptionId !== null) return

    const frame = window.requestAnimationFrame(() => triggerRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [resolvedFocusedOptionId])

  return (
    <div className="flex min-h-9 items-center gap-2">
      <Popover
        open={open}
        onOpenChange={(nextOpen) => setOpen(resolvedFocusedOptionId ? false : nextOpen)}
      >
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            aria-label="Tùy chỉnh cột so sánh"
            disabled={selectedOptions.length === 0 || resolvedFocusedOptionId !== null}
          >
            <Columns3 aria-hidden="true" />
            Cột
            <span className="text-muted-foreground">
              {visibleOptionIds.length}/{selectedOptions.length}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[420px] p-0"
          aria-labelledby="comparison-column-controls-title"
        >
          <div className="border-b px-3 py-2.5">
            <p id="comparison-column-controls-title" className="text-sm font-medium">
              Cột phương án
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Yêu cầu cơ sở luôn hiển thị · Ghim tối đa {COMPARISON_MATRIX_LIMITS.pinnedOptions} cột
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {selectedOptions.map((option) => {
              const isVisible = visibleOptionIdSet.has(option.id)
              const isPinned = pinnedOptionIdSet.has(option.id)
              const pinDisabled =
                !isVisible ||
                (!isPinned && pinnedOptionIds.length >= COMPARISON_MATRIX_LIMITS.pinnedOptions)

              return (
                <div
                  key={option.id}
                  className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-1"
                >
                  <Checkbox
                    id={`comparison-column-${option.id}`}
                    checked={isVisible}
                    aria-label={`Hiển thị ${option.display_label}`}
                    onCheckedChange={() => onToggleOptionVisibility(option.id)}
                  />
                  <label
                    htmlFor={`comparison-column-${option.id}`}
                    className="min-w-0 cursor-pointer truncate text-sm"
                    title={option.display_label}
                  >
                    {option.display_label}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`${isPinned ? "Bỏ ghim" : "Ghim"} ${option.display_label}`}
                    title={isPinned ? "Bỏ ghim" : "Ghim cột"}
                    disabled={pinDisabled}
                    onClick={() => onToggleOptionPin(option.id)}
                  >
                    {isPinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Tập trung ${option.display_label}`}
                    title="Tập trung cột"
                    onClick={() => {
                      setOpen(false)
                      onFocusOption(option.id)
                    }}
                  >
                    <Focus aria-hidden="true" />
                  </Button>
                </div>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

      {focusedOption ? (
        <div
          className="flex h-9 min-w-0 max-w-[360px] items-center gap-2 border bg-muted/40 pl-3 pr-1 text-sm"
          role="status"
        >
          <span className="truncate">Đang tập trung: {focusedOption.display_label}</span>
          <Button
            ref={exitFocusRef}
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label="Thoát chế độ tập trung"
            title="Thoát chế độ tập trung"
            onClick={onExitFocus}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
