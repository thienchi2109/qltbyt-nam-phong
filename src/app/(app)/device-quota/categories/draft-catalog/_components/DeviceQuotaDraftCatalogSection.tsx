"use client"

import { useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { HierarchicalEditorSection } from "@/components/hierarchical-editor/HierarchicalEditorSection"

import type {
  DeviceQuotaDraftItemPatch,
  DeviceQuotaMergedItemRow,
  DeviceQuotaMergedSectionRow,
} from "../device-quota-draft-catalog-types"
import { DeviceQuotaDraftCatalogItemRow } from "./DeviceQuotaDraftCatalogItemRow"

type DeviceQuotaDraftCatalogSectionProps = {
  section: DeviceQuotaMergedSectionRow
  items: DeviceQuotaMergedItemRow[]
  validationErrors: Record<string, string>
  isReadOnly: boolean
  isMutationPending: boolean
  onUpdate: (sourceIdentifier: string, patch: DeviceQuotaDraftItemPatch) => void
  onExclude: (sourceIdentifier: string) => void
  onRestore: (sourceIdentifier: string) => void
  sectionRef: (element: HTMLElement | null) => void
}

/** Renders one source-ordered section and preserves excluded children in place. */
export function DeviceQuotaDraftCatalogSection({
  section,
  items,
  validationErrors,
  isReadOnly,
  isMutationPending,
  onUpdate,
  onExclude,
  onRestore,
  sectionRef,
}: DeviceQuotaDraftCatalogSectionProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const disclosureRef = useRef<HTMLButtonElement>(null)
  const completeCount = useMemo(
    () => items.filter((item) => item.completeness === "complete").length,
    [items]
  )

  return (
    <HierarchicalEditorSection
      sectionKey={section.sourceIdentifier}
      label={section.name}
      disclosureLabel={section.name}
      expanded={expanded}
      onExpandedChange={setExpanded}
      sectionRef={sectionRef}
      disclosureRef={disclosureRef}
      testId={`device-quota-catalog-section-${section.sourceIdentifier}`}
      header={({ disclosure }) => (
        <header className="flex items-center gap-2 border-b bg-muted/20 px-3 py-2">
          {disclosure}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">{section.name}</h2>
            <p className="text-xs text-muted-foreground">{section.sourceReference}</p>
          </div>
          <Badge variant="secondary">
            {completeCount}/{items.length} hoàn thiện
          </Badge>
        </header>
      )}
    >
      {items.map((item) => (
        <DeviceQuotaDraftCatalogItemRow
          key={item.sourceIdentifier}
          row={item}
          validationMessage={validationErrors[item.sourceIdentifier]}
          isReadOnly={isReadOnly}
          isMutationPending={isMutationPending}
          onUpdate={onUpdate}
          onExclude={onExclude}
          onRestore={onRestore}
        />
      ))}
    </HierarchicalEditorSection>
  )
}
