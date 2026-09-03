"use client"

import type * as React from "react"

import type { DeviceQuotaMergedSectionRow } from "../device-quota-draft-catalog-types"

type DeviceQuotaDraftCatalogSectionProps = Readonly<{
  section: DeviceQuotaMergedSectionRow
}>

/** Renders a legal appendix section as a full-width hierarchy row. */
export function DeviceQuotaDraftCatalogSection({
  section,
}: DeviceQuotaDraftCatalogSectionProps): React.JSX.Element {
  return (
    <tr
      data-testid={`device-quota-catalog-section-${section.sourceIdentifier}`}
      data-source-order={section.sourceOrder}
      className="border-b bg-muted/35"
    >
      <th
        id={`device-quota-section-header-${section.sourceIdentifier}`}
        colSpan={7}
        scope="row"
        className="px-4 py-3 text-left"
      >
        <span className="mr-3 font-semibold">{section.sourceLabel}</span>
        <span className="font-semibold">{section.name}</span>
        <span className="ml-3 text-xs font-normal text-muted-foreground">
          {section.sourceReference}
        </span>
      </th>
    </tr>
  )
}
