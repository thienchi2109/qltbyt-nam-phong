"use client"

import * as React from "react"
import { LoaderCircle, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { HierarchicalEditorToolbarProps } from "./HierarchicalEditorTypes"

const PENDING_INPUT_STATUS_ID = "hierarchical-editor-pending-input-status"

/** Renders a controlled toolbar for hierarchical editors. */
export function HierarchicalEditorToolbar({
  testId = "hierarchical-editor-toolbar",
  leading,
  status,
  actions,
  onSave,
  saveDisabled,
  isSaving = false,
  pendingInputDescription,
  pendingInputDescriptionId = PENDING_INPUT_STATUS_ID,
}: HierarchicalEditorToolbarProps): React.JSX.Element {
  const hasPendingInput = pendingInputDescription != null

  return (
    <div data-testid={testId} className="flex min-h-12 shrink-0 items-center gap-2 border-y py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {leading}
        {status ? (
          <div className="shrink-0" aria-live="polite">
            {status}
          </div>
        ) : null}
        {hasPendingInput ? (
          <div
            id={pendingInputDescriptionId}
            className="shrink-0 text-sm font-medium text-amber-700"
            aria-live="polite"
          >
            {pendingInputDescription}
          </div>
        ) : null}
      </div>

      <div className={cn("flex shrink-0 items-center gap-2", !actions && "ml-auto")}>
        {actions}
        <Button
          type="button"
          className="h-9"
          disabled={saveDisabled || isSaving || hasPendingInput}
          aria-describedby={hasPendingInput ? pendingInputDescriptionId : undefined}
          onClick={onSave}
        >
          {isSaving ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {isSaving ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>
    </div>
  )
}
