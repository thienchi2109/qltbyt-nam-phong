"use client"

import { useState } from "react"
import type * as React from "react"

import { Button } from "@/components/ui/button"

import type { DeviceQuotaMergedItemRow } from "../device-quota-draft-catalog-types"

type DeviceQuotaDraftCatalogSourceDisclosureProps = Readonly<{
  row: DeviceQuotaMergedItemRow
}>

/** Keeps concise source context visible while preserving complete traceability on demand. */
export function DeviceQuotaDraftCatalogSourceDisclosure({
  row,
}: DeviceQuotaDraftCatalogSourceDisclosureProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const itemName = row.regulatoryName
  const pages = row.sourcePages.length > 0 ? row.sourcePages.join(", ") : "Chưa rõ"
  const detailsId = `device-quota-source-details-${row.sourceIdentifier}`

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p>{`Nguồn ${row.sourceOrder} · Trang ${pages} · Cấp ${row.level}`}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-0 text-muted-foreground"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={`${open ? "Ẩn nguồn" : "Xem nguồn"} ${itemName}`}
          onClick={() => setOpen((current) => !current)}
        >
          Nguồn
        </Button>
      </div>
      {open ? (
        <dl
          id={detailsId}
          className="grid gap-x-4 gap-y-1 border-l-2 border-muted pl-3 text-sm"
          data-testid={`device-quota-source-details-${row.sourceIdentifier}`}
        >
          <div>
            <dt className="inline font-medium">Tham chiếu: </dt>
            <dd className="inline">{row.sourceReference ?? "Chưa có tham chiếu"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Trang: </dt>
            <dd className="inline">{pages}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Thứ tự nguồn: </dt>
            <dd className="inline">{row.sourceOrder}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Cấp: </dt>
            <dd className="inline">{row.level}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Thuộc: </dt>
            <dd className="inline">{row.parentSourceIdentifier ?? "gốc"}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  )
}
