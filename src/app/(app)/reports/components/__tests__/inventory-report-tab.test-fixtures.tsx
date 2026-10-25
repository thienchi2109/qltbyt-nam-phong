import type { ReactNode } from "react"

type ListFilterSearchCardProps = {
  title?: ReactNode
  description?: ReactNode
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filterControls?: ReactNode
  actions?: ReactNode
}

export function ListFilterSearchCardStub({
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filterControls,
  actions,
}: ListFilterSearchCardProps) {
  return (
    <section data-testid="reports-shared-filter-section">
      {title ? <h2>{title}</h2> : null}
      {description ? <p>{description}</p> : null}
      {searchPlaceholder ? (
        <input
          aria-label={searchPlaceholder}
          value={searchValue ?? ""}
          onChange={(event) => onSearchChange?.(event.target.value)}
        />
      ) : null}
      {filterControls}
      {actions}
    </section>
  )
}
