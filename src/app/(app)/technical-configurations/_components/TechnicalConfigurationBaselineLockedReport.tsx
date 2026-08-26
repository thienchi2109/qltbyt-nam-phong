"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import type {
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineDraftWire,
} from "@/app/(app)/technical-configurations/baseline-types"
import { formatTechnicalConfigurationBaselineSectionOrdinal } from "@/app/(app)/technical-configurations/technical-configuration-baseline-ordinals"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TechnicalConfigurationBaselineLockedCriterionRowProps {
  criterion: TechnicalConfigurationBaselineCriterionWire
}

function TechnicalConfigurationBaselineLockedCriterionRow({
  criterion,
}: TechnicalConfigurationBaselineLockedCriterionRowProps) {
  return (
    <article className="grid gap-x-4 gap-y-0.5 py-2 sm:grid-cols-[110px_minmax(0,1fr)]">
      <Badge variant="outline" className="h-fit w-fit">
        {criterion.criterion_code}
      </Badge>
      <div className="min-w-0">
        {criterion.title ? <p className="text-sm font-medium">{criterion.title}</p> : null}
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">
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

const scrollToSubgroupId = (subgroupId: string) => {
  document
    .querySelector<HTMLElement>(`[data-subgroup-id="${subgroupId}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" })
}

/** Shows the locked baseline version as a read-only report reader with one group per pane. */
export function TechnicalConfigurationBaselineLockedReport({
  version,
}: Readonly<{ version: TechnicalConfigurationBaselineDraftWire }>) {
  const groups = version.groups
  const [selectedGroupIndex, setSelectedGroupIndex] = React.useState(0)
  const [pendingSubgroupScrollId, setPendingSubgroupScrollId] = React.useState<string | null>(null)
  const bodyRef = React.useRef<HTMLDivElement>(null)
  const activeGroupIndex = Math.min(selectedGroupIndex, Math.max(groups.length - 1, 0))
  const activeGroup = groups[activeGroupIndex]
  const isFirstGroup = activeGroupIndex === 0
  const isLastGroup = activeGroupIndex === groups.length - 1

  React.useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0
    }
  }, [activeGroupIndex])

  React.useEffect(() => {
    if (!pendingSubgroupScrollId) return
    scrollToSubgroupId(pendingSubgroupScrollId)
    setPendingSubgroupScrollId(null)
  }, [pendingSubgroupScrollId])

  if (!activeGroup) {
    return <section aria-label="Nội dung phiên bản đã khóa" className="flex min-h-0 flex-1" />
  }

  const selectGroup = (index: number) => {
    setSelectedGroupIndex(index)
  }

  const revealSubgroup = (groupIndex: number, subgroupId: string) => {
    setSelectedGroupIndex(groupIndex)
    setPendingSubgroupScrollId(subgroupId)
  }

  return (
    <section aria-label="Nội dung phiên bản đã khóa" className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-6 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Mục lục nhóm" className="hidden min-h-0 overflow-y-auto lg:block">
          <ul className="space-y-1 py-1">
            {groups.map((group, index) => {
              const subgroups = group.subgroups ?? []
              const isActive = index === activeGroupIndex
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    aria-label={group.name.trim() || `Nhóm ${index + 1}`}
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => selectGroup(index)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground/70">
                      {formatTechnicalConfigurationBaselineSectionOrdinal(index + 1)}
                    </span>
                    <span className="min-w-0 truncate">
                      {group.name.trim() || `Nhóm ${index + 1}`}
                    </span>
                    <span className="ml-auto text-xs tabular-nums">
                      {getGroupCriterionCount(group)}
                    </span>
                  </button>
                  {subgroups.length > 0 ? (
                    <ul className="mt-0.5 space-y-0.5 pl-7">
                      {subgroups.map((subgroup, subgroupIndex) => (
                        <li key={subgroup.id}>
                          <button
                            type="button"
                            aria-label={subgroup.name}
                            onClick={() => revealSubgroup(index, subgroup.id)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="tabular-nums">{subgroupIndex + 1}</span>
                            <span className="min-w-0 truncate">{subgroup.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b pb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isFirstGroup}
              onClick={() => selectGroup(activeGroupIndex - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Nhóm trước
            </Button>
            <span className="text-sm tabular-nums text-muted-foreground">
              Nhóm {activeGroupIndex + 1}/{groups.length}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isLastGroup}
              onClick={() => selectGroup(activeGroupIndex + 1)}
            >
              Nhóm sau
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div
            ref={bodyRef}
            data-testid="technical-configuration-locked-report-body"
            role="region"
            aria-label="Nội dung chỉ đọc"
            tabIndex={0}
            className="min-h-0 w-full flex-1 overflow-y-auto pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <article data-group-id={activeGroup.id} className="pb-10">
              <header className="flex items-center gap-3 border-b pb-3">
                <span
                  className="shrink-0 text-xl font-semibold leading-none text-primary"
                  aria-hidden="true"
                >
                  {formatTechnicalConfigurationBaselineSectionOrdinal(activeGroupIndex + 1)}
                </span>
                <h2 className="min-w-0 break-words text-lg font-semibold leading-snug">
                  {activeGroup.name.trim() || `Nhóm ${activeGroupIndex + 1}`}
                </h2>
                <Badge variant="outline" className="ml-auto shrink-0">
                  {getGroupCriterionCount(activeGroup)} tiêu chí
                </Badge>
              </header>

              {activeGroup.criteria.length > 0 ? (
                <div className="divide-y">
                  {activeGroup.criteria.map((criterion) => (
                    <TechnicalConfigurationBaselineLockedCriterionRow
                      key={criterion.id}
                      criterion={criterion}
                    />
                  ))}
                </div>
              ) : null}

              {(activeGroup.subgroups ?? []).map((subgroup, subgroupIndex) => (
                <section
                  key={subgroup.id}
                  aria-label={`Nhóm con ${subgroupIndex + 1}: ${subgroup.name}`}
                  data-subgroup-id={subgroup.id}
                  className="scroll-mt-4 border-t pt-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                      {subgroupIndex + 1}
                    </span>
                    <h3 className="min-w-0 break-words text-sm font-semibold">{subgroup.name}</h3>
                  </div>
                  <div className="mt-1 divide-y">
                    {subgroup.criteria.map((criterion) => (
                      <TechnicalConfigurationBaselineLockedCriterionRow
                        key={criterion.id}
                        criterion={criterion}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </article>
          </div>
        </div>
      </div>
    </section>
  )
}
