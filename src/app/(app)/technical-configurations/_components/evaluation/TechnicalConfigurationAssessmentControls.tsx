"use client"

import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  deriveTechnicalConfigurationEvaluationStatus,
  TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS,
  TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_LABELS,
  TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_VALUES,
  TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_LABELS,
  TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_VALUES,
  type TechnicalConfigurationEvidenceAxis,
  type TechnicalConfigurationTechnicalAxis,
} from "@/lib/technical-configuration-evaluation"

const UNSELECTED_AXIS_VALUE = "__unselected__"

export type TechnicalConfigurationAssessmentControlsProps = {
  technicalAxis: TechnicalConfigurationTechnicalAxis | null
  evidenceAxis: TechnicalConfigurationEvidenceAxis | null
  notes: string
  onTechnicalAxisChange: (value: TechnicalConfigurationTechnicalAxis | null) => void
  onEvidenceAxisChange: (value: TechnicalConfigurationEvidenceAxis | null) => void
  onNotesChange: (value: string) => void
  disabled?: boolean
  loading?: boolean
  errorMessage?: string | null
}

function toTechnicalAxis(value: string): TechnicalConfigurationTechnicalAxis | null {
  if (value === UNSELECTED_AXIS_VALUE) return null
  return (
    TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_VALUES.find((candidate) => candidate === value) ?? null
  )
}

function toEvidenceAxis(value: string): TechnicalConfigurationEvidenceAxis | null {
  if (value === UNSELECTED_AXIS_VALUE) return null
  return (
    TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_VALUES.find((candidate) => candidate === value) ?? null
  )
}

/** Renders controlled P11A manual axes, notes, and their canonical derived status. */
export function TechnicalConfigurationAssessmentControls({
  technicalAxis,
  evidenceAxis,
  notes,
  onTechnicalAxisChange,
  onEvidenceAxisChange,
  onNotesChange,
  disabled = false,
  loading = false,
  errorMessage = null,
}: Readonly<TechnicalConfigurationAssessmentControlsProps>) {
  const derivedStatus = deriveTechnicalConfigurationEvaluationStatus(technicalAxis, evidenceAxis)
  const controlsDisabled = disabled || loading
  const errorId = errorMessage ? "technical-configuration-assessment-error" : undefined

  return (
    <div className="space-y-4" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Đánh giá thủ công</h3>
        <Badge role="status" variant="outline" className="whitespace-normal text-center">
          {TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS[derivedStatus]}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="technical-configuration-technical-axis">Mức đáp ứng kỹ thuật</Label>
          <Select
            value={technicalAxis ?? UNSELECTED_AXIS_VALUE}
            onValueChange={(value) => onTechnicalAxisChange(toTechnicalAxis(value))}
            disabled={controlsDisabled}
          >
            <SelectTrigger
              id="technical-configuration-technical-axis"
              aria-label="Mức đáp ứng kỹ thuật"
              aria-describedby={errorId}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSELECTED_AXIS_VALUE}>Chưa chọn</SelectItem>
              {TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="technical-configuration-evidence-axis">Mức đầy đủ bằng chứng</Label>
          <Select
            value={evidenceAxis ?? UNSELECTED_AXIS_VALUE}
            onValueChange={(value) => onEvidenceAxisChange(toEvidenceAxis(value))}
            disabled={controlsDisabled}
          >
            <SelectTrigger
              id="technical-configuration-evidence-axis"
              aria-label="Mức đầy đủ bằng chứng"
              aria-describedby={errorId}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSELECTED_AXIS_VALUE}>Chưa chọn</SelectItem>
              {TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="technical-configuration-assessment-notes">Ghi chú</Label>
        <Textarea
          id="technical-configuration-assessment-notes"
          value={notes}
          rows={4}
          disabled={controlsDisabled}
          aria-describedby={errorId}
          onChange={(event) => onNotesChange(event.target.value)}
        />
      </div>

      {errorMessage ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
