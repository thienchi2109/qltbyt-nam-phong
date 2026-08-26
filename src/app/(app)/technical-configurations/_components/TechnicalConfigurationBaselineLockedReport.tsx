import { FileLock2 } from "lucide-react"

import type {
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineDraftWire,
} from "@/app/(app)/technical-configurations/baseline-types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface TechnicalConfigurationBaselineLockedCriterionRowProps {
  criterion: TechnicalConfigurationBaselineCriterionWire
}

function TechnicalConfigurationBaselineLockedCriterionRow({
  criterion,
}: TechnicalConfigurationBaselineLockedCriterionRowProps) {
  return (
    <article className="grid gap-2 py-3 sm:grid-cols-[110px_minmax(0,1fr)]">
      <Badge variant="outline" className="w-fit">
        {criterion.criterion_code}
      </Badge>
      <div className="min-w-0">
        {criterion.title ? <p className="text-sm font-medium">{criterion.title}</p> : null}
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
          {criterion.requirement_text}
        </p>
      </div>
    </article>
  )
}

function getGroupCriterionCount(group: TechnicalConfigurationBaselineDraftWire["groups"][number]) {
  return (
    group.criteria.length +
    (group.subgroups ?? []).reduce((total, subgroup) => total + subgroup.criteria.length, 0)
  )
}

/** Shows the locked baseline version as a read-only report document. */
export function TechnicalConfigurationBaselineLockedReport({
  version,
}: Readonly<{ version: TechnicalConfigurationBaselineDraftWire }>) {
  const criterionCount = version.groups.reduce(
    (total, group) => total + getGroupCriterionCount(group),
    0
  )

  const scrollToGroup = (groupId: string) => {
    document
      .querySelector<HTMLElement>(`[data-group-id="${groupId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <section aria-label="Nội dung phiên bản đã khóa" className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-start gap-3 border-b pb-4">
        <FileLock2 className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Nội dung chỉ đọc</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <Badge variant="secondary">Đã khóa</Badge>
            <span className="font-medium text-foreground">Phiên bản {version.version_number}</span>
            <span aria-hidden="true">·</span>
            <span>{version.groups.length} nhóm</span>
            <span aria-hidden="true">·</span>
            <span>{criterionCount} tiêu chí</span>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-6 pt-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Mục lục nhóm" className="hidden lg:block">
          <ul className="space-y-1">
            {version.groups.map((group, index) => (
              <li key={group.id}>
                <button
                  type="button"
                  aria-label={group.name.trim() || `Nhóm ${index + 1}`}
                  onClick={() => scrollToGroup(group.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-xs tabular-nums text-muted-foreground/70">{index + 1}</span>
                  <span className="min-w-0 truncate">
                    {group.name.trim() || `Nhóm ${index + 1}`}
                  </span>
                  <span className="ml-auto text-xs tabular-nums">
                    {getGroupCriterionCount(group)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div
          data-testid="technical-configuration-locked-report-body"
          className="min-h-0 w-full flex-1 overflow-y-auto"
        >
          <div className="mx-auto max-w-3xl space-y-6 pb-10">
            {version.groups.map((group, index) => (
              <Card key={group.id} data-group-id={group.id} className="scroll-mt-4">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-primary/25 bg-primary/5 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <h3 className="min-w-0 break-words text-base font-semibold leading-snug">
                    {group.name.trim() || `Nhóm ${index + 1}`}
                  </h3>
                  <Badge variant="outline" className="ml-auto shrink-0">
                    {getGroupCriterionCount(group)} tiêu chí
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  {group.criteria.length > 0 ? (
                    <div className="divide-y">
                      {group.criteria.map((criterion) => (
                        <TechnicalConfigurationBaselineLockedCriterionRow
                          key={criterion.id}
                          criterion={criterion}
                        />
                      ))}
                    </div>
                  ) : null}
                  {(group.subgroups ?? []).map((subgroup, subgroupIndex) => (
                    <section
                      key={subgroup.id}
                      aria-label={`Nhóm con ${subgroupIndex + 1}: ${subgroup.name}`}
                      className="border-t pt-4"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border text-xs font-semibold">
                          {subgroupIndex + 1}
                        </span>
                        <h4 className="min-w-0 break-words text-sm font-semibold">
                          {subgroup.name}
                        </h4>
                      </div>
                      <div className="mt-2 divide-y">
                        {subgroup.criteria.map((criterion) => (
                          <TechnicalConfigurationBaselineLockedCriterionRow
                            key={criterion.id}
                            criterion={criterion}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
