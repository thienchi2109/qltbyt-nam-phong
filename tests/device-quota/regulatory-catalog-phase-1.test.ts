import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

type SourceManifest = {
  document_number: string
  effective_date: string
  issued_date: string
  import_status: string
  extraction_revision: string
  source_artifact: {
    pdf: { sha256: string }
    appendix_json: { sha256: string }
    appendix_markdown: { sha256: string }
  }
  completeness: {
    structural_rows: number
    section_rows: number
    equipment_item_rows: number
    source_declared_child_rows: number
    top_level_item_rows: number
    footnotes: number
    items_with_source_pages: number
    items_with_source_references: number
    multiline_quota_items: number
  }
}

const artifactDirectory = join(process.cwd(), "docs/device-quota/source-artifacts/thong-tu-10-2026")
const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260831120000_device_quota_regulatory_catalog_foundation.sql"
)
const manifest = JSON.parse(
  readFileSync(join(artifactDirectory, "manifest.json"), "utf8")
) as SourceManifest
const appendix = JSON.parse(
  readFileSync(join(artifactDirectory, "thong-tu-10-2026-appendix.json"), "utf8")
)

describe("device quota Phase 1 regulatory catalog contract", () => {
  it("embeds the frozen source identity and completeness contract", () => {
    const migration = readFileSync(migrationPath, "utf8")

    expect(migration).toContain(`'${manifest.document_number}'`)
    expect(migration).toMatch(new RegExp(`'${manifest.issued_date}'::date`, "i"))
    expect(migration).toMatch(new RegExp(`'${manifest.effective_date}'::date`, "i"))
    expect(migration).toContain(`'${manifest.import_status}'`)
    expect(migration).toContain(`'${manifest.extraction_revision}'`)
    expect(migration).toContain(`'${manifest.source_artifact.pdf.sha256}'`)
    expect(migration).toContain(`'${manifest.source_artifact.appendix_json.sha256}'`)
    expect(migration).toContain(`'${manifest.source_artifact.appendix_markdown.sha256}'`)

    for (const count of Object.values(manifest.completeness)) {
      if (typeof count === "number") {
        expect(migration).toContain(String(count))
      }
    }

    const embeddedAppendix = migration.match(
      /-- PHASE_0_APPENDIX_JSON_BEGIN\n\/\*\n(\{.*\})\n-- PHASE_0_APPENDIX_JSON_END\n\*\//
    )
    expect(embeddedAppendix).not.toBeNull()
    expect(JSON.parse(embeddedAppendix?.[1] ?? "")).toEqual(appendix)
  })

  it("defines only additive regulatory persistence and a guarded read contract", () => {
    const migration = readFileSync(migrationPath, "utf8")

    for (const objectName of [
      "regulatory_document",
      "regulatory_catalog_version",
      "regulatory_section",
      "regulatory_item",
      "regulatory_rule",
      "regulatory_source_position",
      "regulatory_source_page",
      "regulatory_reference",
      "device_quota_regulatory_catalog_get",
    ]) {
      expect(migration).toContain(objectName)
    }

    expect(migration).toMatch(/SECURITY DEFINER[\s\S]*SET search_path = public, pg_temp/)
    expect(migration).toContain("request.jwt.claims")
    expect(migration).toContain("app_role")
    expect(migration).toContain("user_id")
    expect(migration).toContain("don_vi")
    expect(migration).toContain("REVOKE ALL ON TABLE")
    expect(migration).toContain("GRANT EXECUTE")
    expect(migration).toContain("CREATE UNIQUE INDEX")
    expect(migration).toContain("import_status = 'ready'")

    for (const forbiddenName of [
      "nhom_thiet_bi",
      "quyet_dinh_dinh_muc",
      "dinh_muc_chi_tiet",
      "thiet_bi",
      "dinh_muc_nhom_bulk_import",
      "dinh_muc_unified_import",
      "dinh_muc_chi_tiet_bulk_import",
      "928",
    ]) {
      expect(migration).not.toContain(forbiddenName)
    }
  })
})
