import { describe, expect, it } from "vitest"

import type {
  DeviceQuotaRegulatoryCatalog,
  DeviceQuotaDraftEditorMode,
} from "../device-quota-draft-catalog-types"
import {
  getDeviceQuotaDraftCompleteness,
  mergeDeviceQuotaDraftCatalog,
} from "../device-quota-draft-catalog-mappers"
import type { DeviceQuotaDraft } from "@/lib/device-quota-draft-contract"

function createCatalog(): DeviceQuotaRegulatoryCatalog {
  const sections = Array.from({ length: 5 }, (_, index) => ({
    id: `section-${index + 1}`,
    sourceLabel: `Mục ${index + 1}`,
    type: "section" as const,
    level: 0 as const,
    parentSourceIdentifier: null,
    name: `Section ${index + 1}`,
    regulatoryUnit: null,
    quotaLines: null,
    sourcePages: [10 + index],
    sourceReference: `Source section ${index + 1}`,
    sourceOrder: index * 8 + 1,
  }))
  const items = Array.from({ length: 37 }, (_, index) => {
    const section = sections[Math.floor(index / 8)]
    const isChild = index < 16

    return {
      id: `item-${index + 1}`,
      sourceLabel: `TT ${index + 1}`,
      type: "item" as const,
      level: isChild ? (1 as const) : (0 as const),
      parentSourceIdentifier: isChild ? section.id : null,
      name: `Regulatory item ${index + 1}`,
      regulatoryUnit: `unit-${index + 1}`,
      quotaLines: index === 3 ? ["line one", "line two"] : [`quota ${index + 1}`],
      sourcePages: [20 + index, 21 + index],
      sourceReference: `Source item ${index + 1}`,
      sourceOrder: index + 2,
    }
  })

  return {
    document: {
      documentNumber: "10/2026/TT-BYT",
      documentTitle: "Document",
      appendixTitle: "Appendix",
      documentVersion: "v1",
      issuedDate: "2026-05-14",
      effectiveDate: "2026-07-01",
      sourcePdfPath: "source.pdf",
      sourcePdfSha256: "a".repeat(64),
    },
    catalogVersion: {
      artifactId: "artifact",
      appendixJsonPath: "appendix.json",
      appendixJsonSha256: "b".repeat(64),
      appendixMarkdownPath: "appendix.md",
      appendixMarkdownSha256: "c".repeat(64),
      extractionRevision: "r1",
      importStatus: "ready",
      isCanonical: true,
      sourcePages: "10-80",
      sourceNote: "note",
    },
    completeness: {
      structuralRows: 42,
      sectionRows: 5,
      equipmentItemRows: 37,
      sourceDeclaredChildRows: 16,
      topLevelItemRows: 21,
      ruleLines: 37,
      footnotes: 3,
      itemsWithSourcePages: 37,
      itemsWithSourceReferences: 37,
      multilineQuotaItems: 1,
    },
    rows: [...sections, ...items].sort((left, right) => left.sourceOrder - right.sourceOrder),
    footnotes: ["Footnote 1", "Footnote 2", "Footnote 3"],
  }
}

function createDraft(catalog: DeviceQuotaRegulatoryCatalog): DeviceQuotaDraft {
  return {
    id: "draft-1",
    don_vi: 7,
    catalog_version_id: "catalog-1",
    status: "draft",
    revision: 4,
    created_by: 1,
    updated_by: 1,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    items: catalog.rows
      .filter((row) => row.type === "item")
      .map((row, index) => ({
        id: `draft-item-${index + 1}`,
        regulatory_item_id: `regulatory-${index + 1}`,
        display_name_override: row.id === "item-1" ? "" : `Applied ${index + 1}`,
        applied_unit: index === 2 ? null : `applied-unit-${index + 1}`,
        applied_quantity: index === 2 ? null : index + 1,
        notes: `note ${index + 1}`,
        is_excluded: false,
        display_order: index + 1,
        source_identifier: row.id,
        source_label: row.sourceLabel,
        regulatory_name: row.name,
        regulatory_unit: row.regulatoryUnit ?? "",
        regulatory_quota_lines: row.quotaLines ?? [],
        regulatory_rules: [
          { line_order: 1, source_text: `rule ${index + 1}` },
          ...(index === 3 ? [{ line_order: 2, source_text: "second rule" }] : []),
        ],
      })),
  }
}

describe("device quota draft catalog mappers", () => {
  it("merges all source rows by immutable source identifier and preserves hierarchy/order", () => {
    const catalog = createCatalog()
    const draft = createDraft(catalog)

    const merged = mergeDeviceQuotaDraftCatalog(catalog, draft, "editable")

    expect(merged).toHaveLength(42)
    expect(merged.filter((row) => row.type === "section")).toHaveLength(5)
    expect(merged.filter((row) => row.type === "item")).toHaveLength(37)
    expect(merged.map((row) => row.sourceOrder)).toEqual(
      [...merged]
        .sort((left, right) => left.sourceOrder - right.sourceOrder)
        .map((row) => row.sourceOrder)
    )
    expect(merged.filter((row) => row.type === "item" && row.level === 1)).toHaveLength(16)
    expect(merged.filter((row) => row.type === "item" && row.level === 0)).toHaveLength(21)

    const child = merged.find((row) => row.sourceIdentifier === "item-1")
    expect(child).toMatchObject({
      parentSourceIdentifier: "section-1",
      level: 1,
      sourceReference: "Source item 1",
      sourcePages: [20, 21],
      regulatoryQuotaLines: ["quota 1"],
      regulatoryFieldsReadOnly: true,
      editableFields: {
        displayName: true,
        appliedUnit: true,
        appliedQuantity: true,
        notes: true,
      },
    })
    expect(merged.find((row) => row.sourceIdentifier === "item-4")).toMatchObject({
      regulatoryRules: [
        { lineOrder: 1, sourceText: "rule 4" },
        { lineOrder: 2, sourceText: "second rule" },
      ],
    })
  })

  it("falls back to the regulatory name without changing the persisted override", () => {
    const catalog = createCatalog()
    const draft = createDraft(catalog)

    const [row] = mergeDeviceQuotaDraftCatalog(catalog, draft, "editable").filter(
      (candidate) => candidate.sourceIdentifier === "item-1"
    )

    expect(row?.displayName).toBe("Regulatory item 1")
    expect(row?.displayNameOverride).toBe("")
  })

  it.each<DeviceQuotaDraftEditorMode>(["editable", "readonly"])(
    "derives incomplete state only for active rows and applies %s editability",
    (mode) => {
      const catalog = createCatalog()
      const draft = createDraft(catalog)
      const items = draft.items
      const incomplete = items[2]
      const excluded = items[3]
      if (!incomplete || !excluded) throw new Error("fixture item missing")
      incomplete.applied_unit = null
      incomplete.applied_quantity = null
      excluded.applied_unit = null
      excluded.applied_quantity = null
      excluded.is_excluded = true

      const merged = mergeDeviceQuotaDraftCatalog(catalog, draft, mode)

      expect(
        merged.find((row) => row.sourceIdentifier === incomplete.source_identifier)
      ).toMatchObject({
        completeness: "incomplete",
      })
      expect(
        merged.find((row) => row.sourceIdentifier === excluded.source_identifier)
      ).toMatchObject({
        completeness: "excluded",
      })
      expect(merged.find((row) => row.sourceIdentifier === "item-1")).toMatchObject({
        regulatoryFieldsReadOnly: true,
        editableFields: {
          displayName: mode === "editable",
          appliedUnit: mode === "editable",
          appliedQuantity: mode === "editable",
          notes: mode === "editable",
        },
      })
    }
  )

  it("exposes deterministic completeness validation for the draft contract", () => {
    const catalog = createCatalog()
    const draft = createDraft(catalog)

    expect(getDeviceQuotaDraftCompleteness(draft.items[0]!)).toBe("complete")
    expect(
      getDeviceQuotaDraftCompleteness({
        ...draft.items[0]!,
        applied_unit: " ",
        applied_quantity: 1,
      })
    ).toBe("incomplete")
    expect(
      getDeviceQuotaDraftCompleteness({
        ...draft.items[0]!,
        is_excluded: true,
        applied_unit: null,
        applied_quantity: null,
      })
    ).toBe("excluded")
  })
})
