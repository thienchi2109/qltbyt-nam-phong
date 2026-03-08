"use client"

import * as React from "react"
import { X, Undo2, Folder } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { SuggestedGroup } from "../_hooks/useSuggestMapping"

// ============================================
// Types
// ============================================

export interface SuggestedMappingGroupSectionProps {
    group: SuggestedGroup
    excludedDeviceNames: Set<string>
    isGroupExcluded: boolean
    onToggleDeviceName: (name: string) => void
    onToggleGroup: () => void
}

// ============================================
// Device Name Row
// ============================================

function DeviceNameRow({
    name,
    isExcluded,
    onToggle,
}: {
    name: string
    isExcluded: boolean
    onToggle: () => void
}) {
    return (
        <div
            className={cn(
                "flex items-center justify-between gap-2 rounded-md border px-3 py-2 transition-opacity",
                isExcluded && "opacity-50 bg-muted/30"
            )}
        >
            <span
                className={cn("text-sm truncate", isExcluded && "line-through")}
            >
                {name}
            </span>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={onToggle}
                aria-label={isExcluded ? "Khôi phục" : "Loại bỏ"}
            >
                {isExcluded ? (
                    <Undo2 className="h-4 w-4" />
                ) : (
                    <X className="h-4 w-4 text-destructive" />
                )}
            </Button>
        </div>
    )
}

// ============================================
// SuggestedMappingGroupSection
// ============================================

/**
 * Presentational component for one category group in suggested mapping.
 * Shows category header + list of matched device names with exclude/restore.
 */
export function SuggestedMappingGroupSection({
    group,
    excludedDeviceNames,
    isGroupExcluded,
    onToggleDeviceName,
    onToggleGroup,
}: SuggestedMappingGroupSectionProps) {
    const totalDeviceCount = group.device_ids.length

    return (
        <div
            className={cn(
                "rounded-lg border p-4 space-y-3 transition-opacity",
                isGroupExcluded && "opacity-50 bg-muted/30"
            )}
            data-testid="suggested-group"
        >
            {/* Group header */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <Folder className="h-5 w-5 text-primary/70 shrink-0" />
                    <div className="min-w-0">
                        <span className="text-sm font-semibold truncate block">
                            {group.nhom_label}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="secondary" className="font-mono text-xs">
                                {group.nhom_code}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                {totalDeviceCount} thiết bị
                            </span>
                        </div>
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleGroup}
                    aria-label={isGroupExcluded ? "Khôi phục nhóm" : "Loại bỏ nhóm"}
                    className="shrink-0 text-xs"
                >
                    {isGroupExcluded ? (
                        <>
                            <Undo2 className="h-3.5 w-3.5 mr-1" />
                            Khôi phục nhóm
                        </>
                    ) : (
                        <>
                            <X className="h-3.5 w-3.5 mr-1" />
                            Loại bỏ nhóm
                        </>
                    )}
                </Button>
            </div>

            {/* Device name list */}
            <div className="space-y-1.5">
                {group.device_names.map((name) => (
                    <DeviceNameRow
                        key={name}
                        name={name}
                        isExcluded={isGroupExcluded || excludedDeviceNames.has(name)}
                        onToggle={() => onToggleDeviceName(name)}
                    />
                ))}
            </div>
        </div>
    )
}
