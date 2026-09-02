"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

type DeviceQuotaDraftCatalogRuleDisclosureProps = {
  itemName: string
  rules: Array<{ lineOrder: number; sourceText: string }>
}

/** Keeps the full regulatory rule inline and collapsed until requested. */
export function DeviceQuotaDraftCatalogRuleDisclosure({
  itemName,
  rules,
}: DeviceQuotaDraftCatalogRuleDisclosureProps): React.JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-0 text-muted-foreground"
        aria-expanded={open}
        aria-label={`${open ? "Ẩn quy tắc" : "Xem quy tắc"} ${itemName}`}
        onClick={() => setOpen((current) => !current)}
      >
        Quy tắc
      </Button>
      {open ? (
        <ol className="space-y-1 border-l-2 border-muted pl-3 text-sm text-muted-foreground">
          {rules.map((rule) => (
            <li key={rule.lineOrder}>{rule.sourceText}</li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
