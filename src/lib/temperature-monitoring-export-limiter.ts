const WINDOW_MS = 10 * 60_000
const actors = new Map<string, { active: boolean; starts: number[] }>()
let active = 0

/** ponytail: per-process limits; use a shared store if replicas are introduced. */
export function acquireTemperatureExport(actor: string, now = Date.now()) {
  for (const [key, value] of actors) {
    value.starts = value.starts.filter((time) => now - time < WINDOW_MS)
    if (!value.active && !value.starts.length) actors.delete(key)
  }
  const entry = actors.get(actor) ?? { active: false, starts: [] }
  if (
    entry.active ||
    active >= 2 ||
    entry.starts.length >= 5 ||
    (!actors.has(actor) && actors.size >= 1000)
  )
    return null
  entry.active = true
  entry.starts.push(now)
  actors.set(actor, entry)
  active++
  let released = false
  return () => {
    if (released) return
    released = true
    entry.active = false
    active--
  }
}
