import type { TechnicalConfigurationComparisonHierarchyRow } from "../../technical-configuration-comparison-hierarchy"

type TechnicalConfigurationMatrixHeadingRowProps = {
  row: Extract<TechnicalConfigurationComparisonHierarchyRow, { kind: "section" | "subgroup" }>
  columnCount: number
}

/** Renders a non-assessable comparison hierarchy heading across all visible columns. */
export function TechnicalConfigurationMatrixHeadingRow({
  row,
  columnCount,
}: Readonly<TechnicalConfigurationMatrixHeadingRowProps>) {
  const isSection = row.kind === "section"

  return (
    <tr
      data-testid={isSection ? "comparison-section-row" : "comparison-subgroup-row"}
      data-section-id={isSection ? row.id : row.sectionId}
      data-subgroup-id={isSection ? undefined : row.id}
    >
      <th
        className={
          isSection
            ? "border-b bg-muted/70 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground"
            : "border-b bg-muted/40 px-6 py-2 text-foreground"
        }
        colSpan={columnCount}
        scope={isSection ? "rowgroup" : undefined}
      >
        {isSection ? row.name : <h3 className="text-sm font-semibold">{row.name}</h3>}
      </th>
    </tr>
  )
}
