import type { TechnicalConfigurationBaselineEditorGroup } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { formatTechnicalConfigurationBaselineSectionOrdinal } from "@/app/(app)/technical-configurations/technical-configuration-baseline-ordinals"

type TechnicalConfigurationBaselineStructureSidebarProps = Readonly<{
  groups: readonly TechnicalConfigurationBaselineEditorGroup[]
}>

function countGroupCriteria(group: TechnicalConfigurationBaselineEditorGroup): number {
  return (
    group.criteria.length +
    (group.subgroups ?? []).reduce((count, subgroup) => count + subgroup.criteria.length, 0)
  )
}

/** Presents a passive outline of the canonical baseline group order. */
export function TechnicalConfigurationBaselineStructureSidebar({
  groups,
}: TechnicalConfigurationBaselineStructureSidebarProps): React.JSX.Element {
  return (
    <aside
      aria-label="Cấu trúc"
      data-testid="baseline-structure-sidebar"
      className="min-h-0 overflow-y-auto border-r bg-muted/20"
    >
      <div className="border-b px-4 py-3">
        <h3 className="text-xs font-semibold text-muted-foreground">Cấu trúc</h3>
      </div>

      {groups.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Chưa có cấu trúc.</p>
      ) : (
        <ol aria-label="Tóm tắt cấu trúc" className="space-y-1 px-2 py-3">
          {groups.map((group, groupIndex) => {
            const ordinal = formatTechnicalConfigurationBaselineSectionOrdinal(groupIndex + 1)
            const groupName = group.name.trim() || `Nhóm ${ordinal}`
            const criterionCount = countGroupCriteria(group)

            return (
              <li
                key={group.key}
                className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 border-l-2 border-transparent px-2 py-2 text-sm"
              >
                <span className="font-semibold text-foreground">{ordinal}</span>
                <span className="min-w-0 truncate text-foreground">{groupName}</span>
                <span className="tabular-nums text-muted-foreground">
                  {criterionCount} tiêu chí
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </aside>
  )
}
