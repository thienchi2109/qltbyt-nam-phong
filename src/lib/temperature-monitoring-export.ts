import { createReadStream } from "node:fs"
import { appendFile, chmod, mkdtemp, readdir, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createInterface } from "node:readline"
import { setImmediate } from "node:timers/promises"
import {
  TEMPERATURE_EXPORT_CONSISTENCY,
  TEMPERATURE_EXPORT_DATASETS,
  TEMPERATURE_EXPORT_MAX_BYTES,
  TEMPERATURE_EXPORT_MAX_ROWS,
  temperatureExportSchema,
  type TemperatureExportFilter,
} from "./temperature-monitoring-export-contract"
import { createTemperatureExportWorkbook } from "./temperature-monitoring-export-workbook"

export type TemperatureExportPage = {
  items: Record<string, unknown>[]
  next_cursor: Record<string, unknown> | null
  page_read_at: string
}
type LoadPage = (args: Record<string, unknown>) => Promise<TemperatureExportPage>
const SHEETS = ["Readings", "Amendments", "Reading events", "Deviations", "Deviation events"]
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Reclaim only old task directories whose originating process no longer exists. */
async function reclaimAbandonedExports() {
  for (const name of await readdir(tmpdir())) {
    const match = /^temperature-export-(\d+)-[\w-]+$/.exec(name)
    if (!match) continue
    try {
      const path = join(tmpdir(), name)
      if (Date.now() - (await stat(path)).mtimeMs < 3600_000) continue
      try {
        process.kill(Number(match[1]), 0)
        continue
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") continue
      }
      await rm(path, { recursive: true, force: true })
    } catch {
      /* Another request may already have reclaimed the same directory. */
    }
  }
}

/** Keep membership on disk so later status changes cannot orphan related sheets. */
async function* membershipBatches(path: string) {
  const input = createReadStream(path)
  const lines = createInterface({ input, crlfDelay: Infinity })
  let ids: string[] = []
  try {
    for await (const line of lines) {
      if (!uuid.test(line)) throw new Error("invalid export membership")
      ids.push(line)
      if (ids.length === 25) {
        yield ids
        ids = []
      }
    }
    if (ids.length) yield ids
  } finally {
    lines.close()
    input.destroy()
  }
}

/** Generate the complete bounded file before any attachment response can start. */
export async function prepareTemperatureExport(
  input: TemperatureExportFilter,
  actor: string,
  loadPage: LoadPage,
  signal: AbortSignal,
  limits: { rows?: number; bytes?: number } = {}
) {
  const filter = temperatureExportSchema.parse(input)
  signal.throwIfAborted()
  await reclaimAbandonedExports()
  const directory = await mkdtemp(join(tmpdir(), `temperature-export-${process.pid}-`))
  const path = join(directory, "temperature.xlsx")
  const members = join(directory, "readings.txt")
  const cleanup = () => rm(directory, { recursive: true, force: true })
  let writer: ReturnType<typeof createTemperatureExportWorkbook> | undefined
  const startedAt = new Date().toISOString()
  let total = 0
  const counts: Record<string, number> = {}
  try {
    await chmod(directory, 0o700)
    writer = createTemperatureExportWorkbook(
      path,
      limits.bytes ?? TEMPERATURE_EXPORT_MAX_BYTES,
      signal
    )
    await appendFile(members, "", { mode: 0o600 })
    for (const [index, dataset] of TEMPERATURE_EXPORT_DATASETS.entries()) {
      const sheet = writer.addSheet(SHEETS[index])
      counts[dataset] = 0
      async function pages(ids: string[] | null) {
        let cursor: Record<string, unknown> | null = null
        let previousId = ""
        do {
          signal.throwIfAborted()
          const page = await loadPage({
            p_from_date: filter.from,
            p_to_date: filter.to,
            p_equipment_id: filter.equipment ?? null,
            p_shift_codes: filter.shift ? [filter.shift] : null,
            p_status: filter.status ?? null,
            p_dataset: dataset,
            p_cursor: cursor,
            p_limit: 25,
            p_started_at: startedAt,
            p_reading_ids: ids,
          })
          signal.throwIfAborted()
          if (
            !Array.isArray(page.items) ||
            page.items.length > 25 ||
            typeof page.page_read_at !== "string"
          )
            throw new Error("invalid export page")
          for (const item of page.items) {
            if (++total > (limits.rows ?? TEMPERATURE_EXPORT_MAX_ROWS))
              throw new Error("export row limit")
            if (dataset === "readings") {
              if (typeof item.id !== "string" || !uuid.test(item.id) || item.id <= previousId)
                throw new Error("invalid export reading cursor")
              previousId = item.id
              await appendFile(members, `${item.id}\n`)
            }
            sheet.row({ ...item, page_read_at: page.page_read_at })
            counts[dataset]++
          }
          const next = page.next_cursor
          if (next && (!page.items.length || JSON.stringify(next) === JSON.stringify(cursor)))
            throw new Error("export cursor did not advance")
          cursor = next
          await setImmediate()
        } while (cursor)
      }
      if (dataset === "readings") await pages(null)
      else for await (const ids of membershipBatches(members)) await pages(ids)
      sheet.commit()
    }
    const metadata = writer.addSheet("Export")
    for (const [key, value] of Object.entries({
      ...filter,
      actor: `#${actor}`,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      consistency: TEMPERATURE_EXPORT_CONSISTENCY,
      counts,
      max_rows: limits.rows ?? TEMPERATURE_EXPORT_MAX_ROWS,
      max_bytes: limits.bytes ?? TEMPERATURE_EXPORT_MAX_BYTES,
    }))
      metadata.row({ field: key, value })
    metadata.commit()
    const bytes = await writer.finish()
    return { path, bytes, cleanup }
  } catch (error) {
    try {
      await writer?.abort()
    } finally {
      await cleanup()
    }
    throw error
  }
}
