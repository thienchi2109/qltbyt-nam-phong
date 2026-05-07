/**
 * FacetedMultiSelectFilter.tsx
 *
 * Shared multi-select faceted filter supporting two modes:
 * 1. Column mode: coupled to TanStack Table Column API (column prop)
 * 2. Controlled mode: standalone with value/onChange props (no table needed)
 *
 * Renders a dropdown with checkmark-style option list, selected count badge,
 * and clear action. Designed for use in toolbars, dialogs, and standalone panels.
 */

"use client"

import * as React from "react"
import type { Column } from "@tanstack/react-table"
import { Check, Filter, Search } from "lucide-react"
import { includesNormalizedSearch, normalizeSearchText } from "@/lib/search-normalize"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const DEFAULT_SEARCH_DEBOUNCE_MS = 300
const DEFAULT_SEARCH_PLACEHOLDER = "Tìm lựa chọn..."
const DEFAULT_EMPTY_SEARCH_MESSAGE = "Không tìm thấy lựa chọn phù hợp"

function useDebouncedValue(value: string, delay: number): string {
    const [debouncedValue, setDebouncedValue] = React.useState(value)

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => window.clearTimeout(timer)
    }, [delay, value])

    return debouncedValue
}

export interface FacetedMultiSelectFilterProps<TData, TValue> {
    column?: Column<TData, TValue>
    title?: string
    options: {
        label: string
        value: string
    }[]
    /** Controlled mode: current selected values (no column needed) */
    value?: string[]
    /** Controlled mode: callback when selection changes */
    onChange?: (values: string[]) => void
    searchable?: boolean
    searchPlaceholder?: string
    searchDebounceMs?: number
    emptySearchMessage?: string
    contentClassName?: string
}

export function FacetedMultiSelectFilter<TData, TValue>({
    column,
    title,
    options,
    value: controlledValue,
    onChange,
    searchable = true,
    searchPlaceholder = DEFAULT_SEARCH_PLACEHOLDER,
    searchDebounceMs = DEFAULT_SEARCH_DEBOUNCE_MS,
    emptySearchMessage = DEFAULT_EMPTY_SEARCH_MESSAGE,
    contentClassName,
}: FacetedMultiSelectFilterProps<TData, TValue>) {
    const [open, setOpen] = React.useState(false)
    const [optionSearch, setOptionSearch] = React.useState("")
    const searchInputRef = React.useRef<HTMLInputElement>(null)
    const firstOptionRef = React.useRef<HTMLButtonElement>(null)
    const debouncedOptionSearch = useDebouncedValue(optionSearch, searchDebounceMs)

    // Resolve selected values from either column mode or controlled mode
    const isControlled = controlledValue !== undefined
    const selectedValues = new Set(
        isControlled
            ? controlledValue
            : (column?.getFilterValue() as string[]) || []
    )

    const visibleOptions = React.useMemo(() => {
        const normalizedSearch = normalizeSearchText(debouncedOptionSearch)
        if (!normalizedSearch) return options
        return options.filter((option) =>
            includesNormalizedSearch(option.label, normalizedSearch) ||
            includesNormalizedSearch(option.value, normalizedSearch)
        )
    }, [debouncedOptionSearch, options])

    React.useEffect(() => {
        if (!open) {
            setOptionSearch("")
            return
        }

        if (!searchable) return

        const timer = window.setTimeout(() => {
            searchInputRef.current?.focus()
        }, 0)

        return () => window.clearTimeout(timer)
    }, [open, searchable])

    const updateSelectedValues = React.useCallback((filterValues: string[]) => {
        if (isControlled) {
            onChange?.(filterValues)
            return
        }

        column?.setFilterValue(filterValues.length ? filterValues : undefined)
    }, [column, isControlled, onChange])

    const handleOptionToggle = React.useCallback((optionValue: string) => {
        const nextValues = new Set(selectedValues)
        if (nextValues.has(optionValue)) {
            nextValues.delete(optionValue)
        } else {
            nextValues.add(optionValue)
        }
        updateSelectedValues(Array.from(nextValues))
    }, [selectedValues, updateSelectedValues])

    const handleClear = React.useCallback(() => {
        updateSelectedValues([])
    }, [updateSelectedValues])

    const handleOptionSearchKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "ArrowDown") {
            event.preventDefault()
            firstOptionRef.current?.focus()
        }
    }, [])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-haspopup="dialog"
                    className={cn(
                        "h-9 min-w-[132px] justify-start border-slate-200 shadow-sm transition-all",
                        selectedValues?.size > 0
                            ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
                            : "hover:border-primary/30"
                    )}
                >
                    <div className="flex items-center gap-2">
                        <span className="font-medium">{title}</span>
                        {selectedValues?.size > 0 && (
                            <Badge
                                variant="secondary"
                                className="h-5 min-w-[20px] rounded-full bg-primary text-white px-1.5 text-xs font-semibold"
                            >
                                {selectedValues.size}
                            </Badge>
                        )}
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className={cn(
                    "w-[min(420px,calc(100vw-2rem))] max-h-[440px] overflow-hidden rounded-xl border border-slate-200 p-0 shadow-lg",
                    contentClassName
                )}
                align="start"
            >
                {/* Header */}
                <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm text-slate-900">{title}</span>
                    </div>
                </div>

                {searchable ? (
                    <div className="border-b border-slate-100 p-2">
                        <div className="relative">
                            <Search
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <Input
                                ref={searchInputRef}
                                type="search"
                                value={optionSearch}
                                onChange={(event) => setOptionSearch(event.target.value)}
                                onKeyDown={handleOptionSearchKeyDown}
                                aria-label={`Tìm lựa chọn ${title ?? "bộ lọc"}`}
                                placeholder={searchPlaceholder}
                                className="h-9 pl-9"
                            />
                        </div>
                    </div>
                ) : null}

                {/* Options List */}
                <div className="max-h-[300px] overflow-y-auto py-1">
                    {visibleOptions.length === 0 ? (
                        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                            {emptySearchMessage}
                        </div>
                    ) : null}
                    {visibleOptions.map((option, index) => {
                        const isSelected = selectedValues.has(option.value)
                        return (
                            <button
                                ref={index === 0 ? firstOptionRef : undefined}
                                type="button"
                                key={option.value}
                                onClick={() => handleOptionToggle(option.value)}
                                aria-pressed={isSelected}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                                    "hover:bg-slate-50 active:bg-slate-100",
                                    isSelected && "bg-primary/5 hover:bg-primary/10"
                                )}
                            >
                                <div className={cn(
                                    "flex items-center justify-center h-5 w-5 rounded border-2 transition-all shrink-0",
                                    isSelected
                                        ? "bg-primary border-primary"
                                        : "border-slate-300 hover:border-primary/50"
                                )}>
                                    {isSelected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                                </div>
                                <span className={cn(
                                    "truncate text-left flex-1",
                                    isSelected ? "font-medium text-slate-900" : "text-slate-600"
                                )}>
                                    {option.label}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Footer — Clear button */}
                {selectedValues.size > 0 && (
                    <div className="border-t border-slate-100 p-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClear}
                            className="w-full h-8 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        >
                            Xóa bộ lọc
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
