"use client"

import * as React from "react"
import { SuggestedMappingPreviewDialogContent } from "./SuggestedMappingPreviewDialogContent"

// ============================================
// Types
// ============================================

export interface SuggestedMappingPreviewDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    donViId: number | null
    userRole: string | null
}

// ============================================
// SuggestedMappingPreviewDialog
// ============================================

/**
 * Thin container for suggested mapping preview flow.
 * Composes hook orchestration + group sections + unmatched section + shared primitives.
 * Confirm button wired to saveBatch mutation for bulk save.
 */
export function SuggestedMappingPreviewDialog({
    open,
    onOpenChange,
    donViId,
    userRole,
}: SuggestedMappingPreviewDialogProps) {
    if (!open) return null

    return (
        <SuggestedMappingPreviewDialogContent
            open={open}
            onOpenChange={onOpenChange}
            donViId={donViId}
            userRole={userRole}
        />
    )
}
