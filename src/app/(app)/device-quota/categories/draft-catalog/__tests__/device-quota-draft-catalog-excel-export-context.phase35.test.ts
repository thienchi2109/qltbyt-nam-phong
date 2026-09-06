import { describe, expect, it } from "vitest"

import { createDeviceQuotaDraftCatalogExportContext } from "../device-quota-draft-catalog-excel-export-context"
import type {
  DeviceQuotaDraftSnapshot,
  DeviceQuotaRegulatoryCatalog,
} from "../device-quota-draft-catalog-types"

const draft = {
  id: "draft-1",
  don_vi: 23,
  catalog_version_id: "c1e2d3f4-5678-4abc-9def-0123456789ab",
  status: "draft",
  revision: 4,
  created_by: 31,
  updated_by: 31,
  created_at: "2026-09-01T08:00:00.000Z",
  updated_at: "2026-09-01T08:30:00.000Z",
  items: [],
} as DeviceQuotaDraftSnapshot

const catalog = {
  document: {
    documentNumber: "10/2026/TT-BYT",
    documentTitle: "Thông tư 10/2026/TT-BYT",
    appendixTitle: "Phụ lục",
    documentVersion: "2026-06-19",
    issuedDate: "2026-05-14",
    effectiveDate: "2026-07-01",
    sourcePdfPath: "source.pdf",
    sourcePdfSha256: "sha256:source",
  },
  catalogVersion: {
    id: "7d1e3c83-5f95-4b4d-9c3a-0b3d777d0a01",
    artifactId: "artifact",
    appendixJsonPath: "appendix.json",
    appendixJsonSha256: "sha256:appendix",
    appendixMarkdownPath: "appendix.md",
    appendixMarkdownSha256: "sha256:markdown",
    extractionRevision: "2026-06-19",
    importStatus: "ready",
    isCanonical: true,
    sourcePages: "6-12",
    sourceNote: "source",
  },
  completeness: {
    structuralRows: 0,
    sectionRows: 0,
    equipmentItemRows: 0,
    sourceDeclaredChildRows: 0,
    topLevelItemRows: 0,
    ruleLines: 0,
    footnotes: 0,
    itemsWithSourcePages: 0,
    itemsWithSourceReferences: 0,
    multilineQuotaItems: 0,
  },
  rows: [],
  footnotes: ["one", "two", "three"],
} as DeviceQuotaRegulatoryCatalog

describe("device quota export context Phase 3.5 identity", () => {
  it("creates an export context when canonical and draft UUIDs match", () => {
    const matchingDraft = {
      ...draft,
      catalog_version_id: catalog.catalogVersion.id,
    }

    expect(
      createDeviceQuotaDraftCatalogExportContext({
        draft: matchingDraft,
        catalog,
        rows: [],
        userId: "user-1",
        unitId: 23,
      })
    ).toMatchObject({
      catalogVersionId: catalog.catalogVersion.id,
      unitId: 23,
    })
  })

  it("does not create an export context when canonical and draft UUIDs differ", () => {
    expect(
      createDeviceQuotaDraftCatalogExportContext({
        draft,
        catalog,
        rows: [],
        userId: "user-1",
        unitId: 23,
      })
    ).toBeNull()
  })

  it("does not create an export context when canonical UUID evidence is absent", () => {
    const catalogWithoutIdentity = {
      ...catalog,
      catalogVersion: { ...catalog.catalogVersion, id: undefined },
    } as DeviceQuotaRegulatoryCatalog

    expect(
      createDeviceQuotaDraftCatalogExportContext({
        draft,
        catalog: catalogWithoutIdentity,
        rows: [],
        userId: "user-1",
        unitId: 23,
      })
    ).toBeNull()
  })

  it("does not create an export context for a mismatched draft unit", () => {
    const matchingDraft = {
      ...draft,
      catalog_version_id: catalog.catalogVersion.id,
      don_vi: 24,
    }

    expect(
      createDeviceQuotaDraftCatalogExportContext({
        draft: matchingDraft,
        catalog,
        rows: [],
        userId: "user-1",
        unitId: 23,
      })
    ).toBeNull()
  })
})
