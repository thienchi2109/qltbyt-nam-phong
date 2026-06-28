/** Fallback label for equipment rows without a managing department. */
export const UNKNOWN_DEPARTMENT_LABEL = "Chưa cập nhật"

interface DepartmentDistributionLike {
  label: string
}

export interface DepartmentColorClasses {
  badgeClassName: string
}

const DEPARTMENT_COLOR_PALETTE: DepartmentColorClasses[] = [
  {
    badgeClassName: "border-sky-200 bg-sky-100 text-sky-800",
  },
  {
    badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-800",
  },
  {
    badgeClassName: "border-violet-200 bg-violet-100 text-violet-800",
  },
  {
    badgeClassName: "border-amber-200 bg-amber-100 text-amber-800",
  },
  {
    badgeClassName: "border-cyan-200 bg-cyan-100 text-cyan-800",
  },
  {
    badgeClassName: "border-rose-200 bg-rose-100 text-rose-800",
  },
  {
    badgeClassName: "border-lime-200 bg-lime-100 text-lime-800",
  },
  {
    badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
  },
]

function getStablePaletteIndex(label: string): number {
  let hash = 0
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) >>> 0
  }
  return hash % DEPARTMENT_COLOR_PALETTE.length
}

/** Returns a display-safe department label for grouping and coloring equipment badges. */
export function getEquipmentDepartmentLabel(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : UNKNOWN_DEPARTMENT_LABEL
}

/** Assigns stable badge color classes to department labels. */
export function buildDepartmentColorClassByLabel(
  distribution: DepartmentDistributionLike[]
): Record<string, DepartmentColorClasses> {
  return distribution.reduce<Record<string, DepartmentColorClasses>>((acc, item) => {
    acc[item.label] = DEPARTMENT_COLOR_PALETTE[getStablePaletteIndex(item.label)]
    return acc
  }, {})
}
