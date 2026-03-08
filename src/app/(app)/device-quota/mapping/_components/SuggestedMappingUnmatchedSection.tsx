"use client"

import * as React from "react"
import { ChevronRight, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"

// ============================================
// Types
// ============================================

export interface SuggestedMappingUnmatchedSectionProps {
    unmatched: { device_name: string; device_ids: number[] }[]
}

// ============================================
// SuggestedMappingUnmatchedSection
// ============================================

/**
 * Collapsible section displaying device names without a suggested category match.
 * Starts collapsed. No exclude/restore since there is nothing to save.
 */
export function SuggestedMappingUnmatchedSection({
    unmatched,
}: SuggestedMappingUnmatchedSectionProps) {
    const [open, setOpen] = React.useState(false)

    if (unmatched.length === 0) return null

    const totalDevices = unmatched.reduce(
        (sum, u) => sum + u.device_ids.length,
        0
    )

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
                <button
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                    aria-label={`Chưa gợi ý được (${totalDevices} thiết bị)`}
                >
                    <ChevronRight
                        className={cn(
                            "h-4 w-4 shrink-0 transition-transform",
                            open && "rotate-90"
                        )}
                    />
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                    <span>Chưa gợi ý được</span>
                    <span className="font-medium">({totalDevices} thiết bị)</span>
                </button>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-2 space-y-1.5 pl-6">
                {unmatched.map((item) => (
                    <div
                        key={item.device_name}
                        className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground"
                    >
                        {item.device_name}
                    </div>
                ))}
            </CollapsibleContent>
        </Collapsible>
    )
}
