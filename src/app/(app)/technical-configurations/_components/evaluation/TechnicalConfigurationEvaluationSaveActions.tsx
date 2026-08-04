"use client"

import { Loader2, Save, StepForward } from "lucide-react"

import { Button } from "@/components/ui/button"

type TechnicalConfigurationEvaluationSaveActionsProps = {
  disabled: boolean
  saving: boolean
  onSave: () => void
  onSaveAndContinue: () => void
}

/** Renders explicit assessment save commands for the criterion SideSheet. */
export function TechnicalConfigurationEvaluationSaveActions({
  disabled,
  saving,
  onSave,
  onSaveAndContinue,
}: Readonly<TechnicalConfigurationEvaluationSaveActionsProps>) {
  return (
    <>
      <Button type="button" variant="outline" disabled={disabled} onClick={onSave}>
        {saving ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="size-4" aria-hidden="true" />
        )}
        Lưu
      </Button>
      <Button type="button" disabled={disabled} onClick={onSaveAndContinue}>
        <StepForward className="size-4" aria-hidden="true" />
        Lưu &amp; tiếp tục
      </Button>
    </>
  )
}
