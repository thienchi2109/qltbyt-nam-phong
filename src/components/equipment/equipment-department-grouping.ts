/** Fallback label for equipment rows without a managing department. */
export const UNKNOWN_DEPARTMENT_LABEL = "Chưa cập nhật"

interface DepartmentDistributionLike {
  label: string
}

export interface DepartmentColorClasses {
  rowClassName: string
  chipClassName: string
  badgeClassName: string
}

const DEPARTMENT_COLOR_PALETTE: DepartmentColorClasses[] = [
  {
    rowClassName: "bg-sky-50/60 hover:bg-sky-50",
    chipClassName: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
    badgeClassName: "border-sky-200 bg-sky-100 text-sky-800",
  },
  {
    rowClassName: "bg-emerald-50/60 hover:bg-emerald-50",
    chipClassName: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
    badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-800",
  },
  {
    rowClassName: "bg-violet-50/60 hover:bg-violet-50",
    chipClassName: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100",
    badgeClassName: "border-violet-200 bg-violet-100 text-violet-800",
  },
  {
    rowClassName: "bg-amber-50/60 hover:bg-amber-50",
    chipClassName: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    badgeClassName: "border-amber-200 bg-amber-100 text-amber-800",
  },
  {
    rowClassName: "bg-cyan-50/60 hover:bg-cyan-50",
    chipClassName: "border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100",
    badgeClassName: "border-cyan-200 bg-cyan-100 text-cyan-800",
  },
  {
    rowClassName: "bg-rose-50/60 hover:bg-rose-50",
    chipClassName: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
    badgeClassName: "border-rose-200 bg-rose-100 text-rose-800",
  },
  {
    rowClassName: "bg-lime-50/60 hover:bg-lime-50",
    chipClassName: "border-lime-200 bg-lime-50 text-lime-800 hover:bg-lime-100",
    badgeClassName: "border-lime-200 bg-lime-100 text-lime-800",
  },
  {
    rowClassName: "bg-slate-50/70 hover:bg-slate-100/70",
    chipClassName: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
    badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
  },
]

/** Returns a display-safe department label for grouping and coloring equipment rows. */
export function getEquipmentDepartmentLabel(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : UNKNOWN_DEPARTMENT_LABEL
}

/** Assigns stable pastel color classes to department labels in result order. */
export function buildDepartmentColorClassByLabel(
  distribution: DepartmentDistributionLike[]
) {
  return distribution.reduce<Record<string, DepartmentColorClasses>>((acc, item, index) => {
    acc[item.label] = DEPARTMENT_COLOR_PALETTE[index % DEPARTMENT_COLOR_PALETTE.length]
    return acc
  }, {})
}
