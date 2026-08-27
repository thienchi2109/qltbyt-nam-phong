import type { TechnicalConfigurationBaselineEditorGroup } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { formatTechnicalConfigurationBaselineSectionOrdinal } from "@/app/(app)/technical-configurations/technical-configuration-baseline-ordinals"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

type TechnicalConfigurationBaselineStructureSidebarProps = Readonly<{
  groups: readonly TechnicalConfigurationBaselineEditorGroup[]
  expanded: boolean
  overlay: boolean
  onToggle: () => void
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
  expanded,
  overlay,
  onToggle,
}: TechnicalConfigurationBaselineStructureSidebarProps): React.JSX.Element {
  return (
    <aside
      aria-label="Cấu trúc"
      data-testid="baseline-structure-sidebar"
      data-expanded={expanded}
      data-overlay={overlay || undefined}
      className={cn(
        "z-30 h-full min-h-0 overflow-y-auto border-r bg-background",
        overlay && "absolute inset-y-0 left-0 w-[220px] shadow-lg"
      )}
    >
      <div
        className={cn(
          "flex h-12 items-center border-b",
          expanded ? "justify-between gap-2 px-2" : "justify-center"
        )}
      >
        {expanded ? (
          <h3 className="min-w-0 truncate text-xs font-semibold text-muted-foreground">Cấu trúc</h3>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={expanded ? "Đóng bảng cấu trúc" : "Mở bảng cấu trúc"}
          title={expanded ? "Đóng bảng cấu trúc" : "Mở bảng cấu trúc"}
          onClick={onToggle}
        >
          {expanded ? (
            <PanelLeftClose className="size-4" aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {groups.length === 0 ? (
        <p
          className={cn(
            "py-6 text-sm text-muted-foreground",
            expanded ? "px-4" : "px-1 text-center"
          )}
        >
          {expanded ? "Chưa có cấu trúc." : "—"}
        </p>
      ) : (
        <ol aria-label="Tóm tắt cấu trúc" className={cn("space-y-1 py-2", expanded && "px-2")}>
          {groups.map((group, groupIndex) => {
            const ordinal = formatTechnicalConfigurationBaselineSectionOrdinal(groupIndex + 1)
            const groupName = group.name.trim() || `Nhóm ${ordinal}`
            const criterionCount = countGroupCriteria(group)

            return (
              <li
                key={group.key}
                className={cn(
                  "items-center border-l-2 border-transparent text-sm",
                  expanded
                    ? "grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-2 px-2 py-2"
                    : "flex h-10 justify-center"
                )}
              >
                <span className="font-semibold text-foreground">{ordinal}</span>
                {expanded ? (
                  <>
                    <span className="min-w-0 truncate text-foreground">{groupName}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {criterionCount} tiêu chí
                    </span>
                  </>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </aside>
  )
}
