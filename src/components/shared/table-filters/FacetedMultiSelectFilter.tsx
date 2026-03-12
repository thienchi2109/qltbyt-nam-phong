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
import { Check, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
}

export function FacetedMultiSelectFilter<TData, TValue>({
    column,
    title,
    options,
    value: controlledValue,
    onChange,
}: FacetedMultiSelectFilterProps<TData, TValue>) {
    // Resolve selected values from either column mode or controlled mode
    const isControlled = controlledValue !== undefined
    const selectedValues = new Set(
        isControlled
            ? controlledValue
            : (column?.getFilterValue() as string[]) || []
    )

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                        "h-9 border-slate-200 shadow-sm transition-all",
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
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-[240px] max-h-[400px] overflow-hidden rounded-xl border border-slate-200 shadow-lg p-0"
                align="start"
            >
                {/* Header */}
                <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm text-slate-900">{title}</span>
                    </div>
                </div>

                {/* Options List */}
                <div className="max-h-[300px] overflow-y-auto py-1">
                    {options.map((option) => {
                        const isSelected = selectedValues.has(option.value)
                        return (
                            <button
                                type="button"
                                key={option.value}
                                onClick={(e) => {
                                    e.preventDefault()
                                    if (isSelected) {
                                        selectedValues.delete(option.value)
                                    } else {
                                        selectedValues.add(option.value)
                                    }
                                    const filterValues = Array.from(selectedValues)
                                    if (isControlled) {
                                        onChange?.(filterValues)
                                    } else {
                                        column?.setFilterValue(
                                            filterValues.length ? filterValues : undefined
                                        )
                                    }
                                }}
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
                            onClick={() => {
                                if (isControlled) {
                                    onChange?.([])
                                } else {
                                    column?.setFilterValue(undefined)
                                }
                            }}
                            className="w-full h-8 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        >
                            Xóa bộ lọc
                        </Button>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
