export function calculateUsageDurationMinutes(startTime: string, endTime: number | string | null): number {
  const start = Date.parse(startTime)
  const end = typeof endTime === "number" ? endTime : endTime ? Date.parse(endTime) : null

  if (!Number.isFinite(start) || end === null || !Number.isFinite(end)) {
    return 0
  }

  return Math.max(0, Math.floor((end - start) / 60_000))
}
