import { describe, expect, it } from "vitest"

import { parseDeviceQuotaRegulatoryCatalog } from "../deviceQuotaRegulatoryCatalogQuery"

const baseCatalogResponse = {
  document: {
    document_number: "10/2026/TT-BYT",
    document_title: "Thông tư 10/2026/TT-BYT",
    appendix_title: "Phụ lục",
    document_version: "2026-06-19",
    issued_date: "2026-05-14",
    effective_date: "2026-07-01",
    source_pdf_path: "source.pdf",
    source_pdf_sha256: "sha256:source",
  },
  catalog_version: {
    id: "7d1e3c83-5f95-4b4d-9c3a-0b3d777d0a01",
    artifact_id: "thong-tu-10-2026-appendix-freeze",
    appendix_json_path: "appendix.json",
    appendix_json_sha256: "sha256:appendix",
    appendix_markdown_path: "appendix.md",
    appendix_markdown_sha256: "sha256:markdown",
    extraction_revision: "2026-06-19",
    import_status: "ready",
    is_canonical: true,
    source_pages: "6-12",
    source_note: "Repository-owned source freeze",
  },
  completeness: {},
  rows: [],
  footnotes: [],
}

describe("device quota regulatory catalog Phase 3.5 identity", () => {
  it("preserves the actual canonical catalog version UUID from the RPC payload", () => {
    const catalog = parseDeviceQuotaRegulatoryCatalog(baseCatalogResponse)

    expect((catalog.catalogVersion as { id?: string }).id).toBe(
      baseCatalogResponse.catalog_version.id
    )
  })

  it.each([undefined, "", "not-a-uuid", "7d1e3c83-5f95-4b4d-9c3a-0b3d777d0aZZ"])(
    "fails closed when the canonical catalog UUID is %s",
    (id) => {
      const response = {
        ...baseCatalogResponse,
        catalog_version: { ...baseCatalogResponse.catalog_version, id },
      }

      expect(() => parseDeviceQuotaRegulatoryCatalog(response)).toThrow(
        "Missing catalog version identity"
      )
    }
  )
})
