import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

type SourceRow = {
  id: string
  type: "section" | "item"
  level: number
  parent: string | null
  quota: string[] | null
  source_pages: number[]
  source_ref: string
}

type SourceAppendix = {
  source_file: string
  document_title: string
  rows: SourceRow[]
  footnotes: string[]
}

type SourceManifest = {
  effective_date: string
  issued_date: string
  import_status: string
  extraction_revision: string
  source_artifact: {
    pdf: { path: string; sha256: string }
    appendix_json: { path: string; sha256: string }
    appendix_markdown: { path: string; sha256: string }
  }
  completeness: {
    structural_rows: number
    section_rows: number
    equipment_item_rows: number
    source_declared_child_rows: number
    top_level_item_rows: number
    footnotes: number
    multiline_quota_items: number
    section_ids: string[]
  }
}

const artifactDirectory = join(process.cwd(), "docs/device-quota/source-artifacts/thong-tu-10-2026")
const manifest = JSON.parse(
  readFileSync(join(artifactDirectory, "manifest.json"), "utf8")
) as SourceManifest
const appendix = JSON.parse(
  readFileSync(join(artifactDirectory, "thong-tu-10-2026-appendix.json"), "utf8")
) as SourceAppendix

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

describe("Thong tu 10/2026 source freeze", () => {
  it("keeps the checked-in source files reproducible from the manifest", () => {
    expect(manifest.import_status).toBe("ready")
    expect(manifest.extraction_revision).toBe("phase-0-2026-08-31-r1")
    expect(manifest.issued_date).toBe("2026-05-14")
    expect(manifest.effective_date).toBe("2026-07-01")
    expect(sha256(join(artifactDirectory, manifest.source_artifact.pdf.path))).toBe(
      manifest.source_artifact.pdf.sha256
    )
    expect(sha256(join(artifactDirectory, manifest.source_artifact.appendix_json.path))).toBe(
      manifest.source_artifact.appendix_json.sha256
    )
    expect(sha256(join(artifactDirectory, manifest.source_artifact.appendix_markdown.path))).toBe(
      manifest.source_artifact.appendix_markdown.sha256
    )
  })

  it("preserves the complete appendix structure and source order", () => {
    const rows = appendix.rows
    const sections = rows.filter((row) => row.type === "section")
    const items = rows.filter((row) => row.type === "item")
    const children = items.filter((row) => row.level === 1)
    const topLevelItems = items.filter((row) => row.level === 0)

    expect(rows).toHaveLength(manifest.completeness.structural_rows)
    expect(sections).toHaveLength(manifest.completeness.section_rows)
    expect(items).toHaveLength(manifest.completeness.equipment_item_rows)
    expect(children).toHaveLength(manifest.completeness.source_declared_child_rows)
    expect(topLevelItems).toHaveLength(manifest.completeness.top_level_item_rows)
    expect(sections.map((row) => row.id)).toEqual(manifest.completeness.section_ids)
    expect(rows.map((row) => row.id)).toEqual([
      "1",
      "1a",
      "1b",
      "1c",
      "1d",
      "1dd",
      "2",
      "2a",
      "2b",
      "2c",
      "3",
      "4",
      "5",
      "5a",
      "5b",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "16a",
      "16b",
      "17",
      "18",
      "19",
      "20",
      "21",
      "22",
      "23",
      "23a",
      "23b",
      "23c",
      "23d",
      "24",
      "25",
      "26",
    ])
  })

  it("keeps multiline rules, footnotes, pages, references, and parents traceable", () => {
    const items = appendix.rows.filter((row) => row.type === "item")
    const multilineItems = items.filter((row) => Array.isArray(row.quota) && row.quota.length > 1)

    expect(appendix.footnotes).toHaveLength(manifest.completeness.footnotes)
    expect(multilineItems).toHaveLength(manifest.completeness.multiline_quota_items)
    expect(items.every((row) => Array.isArray(row.quota))).toBe(true)
    expect(appendix.rows.every((row) => row.source_pages.length > 0)).toBe(true)
    expect(appendix.rows.every((row) => row.source_ref.length > 0)).toBe(true)
    expect(items.filter((row) => row.level === 1).every((row) => row.parent !== null)).toBe(true)
    expect(items.filter((row) => row.level === 0).every((row) => row.parent === null)).toBe(true)
  })
})
