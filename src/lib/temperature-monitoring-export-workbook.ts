import ExcelJS from "exceljs"
import { createWriteStream } from "node:fs"
import { Transform } from "node:stream"
import { finished } from "node:stream/promises"

/** Stream committed rows to disk; never use the document workbook or shared strings. */
export function createTemperatureExportWorkbook(
  path: string,
  maxBytes: number,
  signal: AbortSignal
) {
  let bytes = 0
  const output = createWriteStream(path, { mode: 0o600 })
  const bounded = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length
      callback(bytes > maxBytes ? new Error("export byte limit") : null, chunk)
    },
  })
  const failed = new Promise<never>((_resolve, reject) => {
    bounded.on("error", reject)
    output.on("error", reject)
  })
  // A failure can happen while awaiting an RPC page, before finish() races it.
  void failed.catch(() => {})
  const abort = () => bounded.destroy(new Error("export cancelled or timed out"))
  signal.addEventListener("abort", abort, { once: true })
  bounded.pipe(output)
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: bounded,
    useStyles: false,
    useSharedStrings: false,
  })
  // ponytail: ExcelJS 4.4 has no public abort; use its Archiver until a public API exists.
  const archive = workbook as unknown as {
    zip: { abort(): void; on(event: "error", listener: (error: Error) => void): void }
  }
  archive.zip.on("error", (error) => bounded.destroy(error))
  function addSheet(name: string) {
    const sheet = workbook.addWorksheet(name)
    let headers: string[] | null = null
    return {
      row(value: Record<string, unknown>) {
        signal.throwIfAborted()
        if (bounded.destroyed) throw new Error("export output failed")
        if (!headers) {
          headers = Object.keys(value)
          sheet.addRow(headers).commit()
        }
        sheet
          .addRow(
            headers.map((key) => {
              const cell = value[key]
              if (cell == null || typeof cell === "number" || typeof cell === "boolean")
                return cell ?? null
              const text = typeof cell === "string" ? cell : JSON.stringify(cell)
              if (text.length > 32767) throw new Error("export cell limit")
              return text
            })
          )
          .commit()
      },
      commit() {
        sheet.commit()
      },
    }
  }
  return {
    addSheet,
    async finish() {
      try {
        await Promise.race([
          (async () => {
            await workbook.commit()
            await finished(output)
          })(),
          failed,
        ])
        signal.throwIfAborted()
        return bytes
      } finally {
        signal.removeEventListener("abort", abort)
      }
    },
    async abort() {
      signal.removeEventListener("abort", abort)
      archive.zip.abort()
      bounded.destroy()
      output.destroy()
      await finished(output).catch(() => {})
    },
  }
}
