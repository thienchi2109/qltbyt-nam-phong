export type StatusPercentageItem = {
  key: string
  label: string
  count: number
  percentage: number
  color: string
}

export type DonutDatum = {
  key: string
  name: string
  value: number
  percent: number
  color: string
}

export function buildStatusDonutData(items: StatusPercentageItem[]): DonutDatum[] {
  return items
    .filter((item) => item.count > 0)
    .map((item) => ({
      key: item.key,
      name: item.label,
      value: item.count,
      percent: item.percentage,
      color: item.color,
    }))
}
