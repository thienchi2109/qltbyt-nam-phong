/**
 * SearchInput.tsx
 *
 * Centralized search input component with:
 * - Optional search icon (left)
 * - Optional clear button (right)
 * - Optional end addon slot (QR scanner, etc.)
 * - Keyboard support (Escape to clear)
 * - Accessibility features (type="search", ARIA labels)
 * - Performance optimizations (useCallback)
 * - Micro-interactions (hover/focus transitions)
 *
 * NO internal debounce - consumers should handle via useDeferredValue/debounce.
 */

"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface SearchInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "type"> {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  showSearchIcon?: boolean
  showClearButton?: boolean
  endAddon?: React.ReactNode
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      showSearchIcon = true,
      showClearButton = true,
      endAddon,
      className,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null)

    // Merge refs (external + internal for focus management)
    React.useImperativeHandle(ref, () => inputRef.current!)

    // Handle input change (useCallback per performance rules)
    const handleChange = React.useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(event.target.value)
      },
      [onChange]
    )

    // Handle clear button click (useCallback per performance rules)
    const handleClear = React.useCallback(() => {
      onChange("")
      onClear?.()
      // Return focus to input after clear
      inputRef.current?.focus()
    }, [onChange, onClear])

    // Handle keyboard shortcuts
    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape" && value) {
          event.preventDefault()
          handleClear()
        }
      },
      [value, handleClear]
    )

    // Calculate padding based on visible icons/addons
    const paddingLeft = showSearchIcon ? "pl-9" : "pl-3"
    const paddingRight = React.useMemo(() => {
      const hasClearButton = showClearButton && value
      const hasEndAddon = !!endAddon

      if (hasClearButton && hasEndAddon) return "pr-16" // Both clear + addon
      if (hasClearButton || hasEndAddon) return "pr-9" // Either clear or addon
      return "pr-3" // Neither
    }, [showClearButton, value, endAddon])

    return (
      <div className="relative">
        {/* Search icon (left) */}
        {showSearchIcon ? (
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        ) : null}

        {/* Input field */}
        <Input
          ref={inputRef}
          type="search"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={cn(paddingLeft, paddingRight, className)}
          {...props}
        />

        {/* Right-side controls container (clear button + endAddon) */}
        {(showClearButton && value) || endAddon ? (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {showClearButton && value ? (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-muted-foreground transition-all duration-150 hover:scale-110 hover:text-foreground active:scale-95"
                aria-label="Xóa tìm kiếm"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
            {endAddon}
          </div>
        ) : null}
      </div>
    )
  }
)
SearchInput.displayName = "SearchInput"
