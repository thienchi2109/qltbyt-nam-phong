"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

import type { HierarchicalEditorSectionProps } from "./HierarchicalEditorTypes"

/** Renders a controlled hierarchical section while leaving its header content to the adapter. */
export function HierarchicalEditorSection({
  sectionKey,
  label,
  disclosureLabel,
  expanded,
  onExpandedChange,
  header,
  children,
  sectionRef,
  disclosureRef,
  dataAttributes,
  testId,
}: HierarchicalEditorSectionProps): React.JSX.Element {
  const resolvedDisclosureLabel = disclosureLabel ?? label
  const disclosure = (
    <CollapsibleTrigger asChild>
      <Button
        ref={disclosureRef}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`${expanded ? "Thu gọn" : "Mở rộng"} ${resolvedDisclosureLabel}`}
        title={expanded ? "Thu gọn" : "Mở rộng"}
      >
        <ChevronDown
          className={`size-4 transition-transform ${expanded ? "" : "-rotate-90"}`}
          aria-hidden="true"
        />
      </Button>
    </CollapsibleTrigger>
  )

  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange}>
      <section
        ref={sectionRef}
        className="border-b border-border/70"
        aria-label={label}
        data-hierarchy-level="section"
        data-section-key={sectionKey}
        data-testid={testId}
        {...dataAttributes}
      >
        {header({ disclosure })}
        <CollapsibleContent>{children}</CollapsibleContent>
      </section>
    </Collapsible>
  )
}
