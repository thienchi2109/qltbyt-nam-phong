import type {
  DeviceQuotaMergedItemRow,
  DeviceQuotaMergedRow,
  DeviceQuotaMergedSectionRow,
} from "../device-quota-draft-catalog-types"

export function makeSection(index: number): DeviceQuotaMergedSectionRow {
  return {
    id: `section-${index}`,
    sourceLabel: `${index}.`,
    type: "section",
    level: 0,
    parentSourceIdentifier: null,
    name: `Nhóm ${index}`,
    regulatoryUnit: null,
    quotaLines: null,
    sourcePages: [10 + index],
    sourceReference: `Phụ lục, mục ${index}`,
    sourceOrder: index,
    sourceIdentifier: `section-${index}`,
    completeness: "structural",
    displayName: `Nhóm ${index}`,
    displayNameOverride: null,
    regulatoryFieldsReadOnly: true,
    editableFields: {
      displayName: false,
      appliedUnit: false,
      appliedQuantity: false,
      notes: false,
    },
  }
}

export function makeItem(index: number, sectionIndex: number): DeviceQuotaMergedItemRow {
  const sourceIdentifier = `item-${index}`
  return {
    id: sourceIdentifier,
    sourceLabel: `${sectionIndex}.${index}`,
    type: "item",
    level: index === 1 ? 1 : 0,
    parentSourceIdentifier: `section-${sectionIndex}`,
    name: `Thiết bị ${index}`,
    regulatoryUnit: "Máy",
    quotaLines: index === 1 ? ["Tối thiểu 01 máy", "Tối đa 02 máy"] : ["01 máy"],
    sourcePages: index === 1 ? [12, 13] : [12],
    sourceReference: `Phụ lục, dòng ${index}`,
    sourceOrder: index + 5,
    sourceIdentifier,
    completeness: index === 1 ? "incomplete" : "complete",
    displayName: `Thiết bị ${index}`,
    displayNameOverride: null,
    appliedUnit: index === 1 ? null : "Máy",
    appliedQuantity: index === 1 ? null : 1,
    notes: null,
    isExcluded: false,
    displayOrder: index + 5,
    regulatoryItemId: `reg-${index}`,
    regulatoryName: `Thiết bị ${index}`,
    regulatoryQuotaLines: index === 1 ? ["Tối thiểu 01 máy", "Tối đa 02 máy"] : ["01 máy"],
    regulatoryRules:
      index === 1
        ? [
            { lineOrder: 1, sourceText: "Tối thiểu 01 máy" },
            { lineOrder: 2, sourceText: "Tối đa 02 máy" },
          ]
        : [{ lineOrder: 1, sourceText: "01 máy" }],
    regulatoryFieldsReadOnly: true,
    editableFields: {
      displayName: true,
      appliedUnit: true,
      appliedQuantity: true,
      notes: true,
    },
  }
}

export function makeTopLevelItem(): DeviceQuotaMergedItemRow {
  return {
    ...makeItem(99, 1),
    id: "top-level-item",
    sourceIdentifier: "top-level-item",
    sourceLabel: "2",
    parentSourceIdentifier: null,
    level: 0,
    name: "Thiết bị pháp quy gốc",
    displayName: "Tên hiển thị tùy chỉnh",
    displayNameOverride: "Tên hiển thị tùy chỉnh",
    regulatoryName: "Thiết bị pháp quy gốc",
    sourceOrder: 2,
  }
}

export function makeRows(): DeviceQuotaMergedRow[] {
  const rows: DeviceQuotaMergedRow[] = []
  let itemIndex = 1
  for (let sectionIndex = 1; sectionIndex <= 5; sectionIndex += 1) {
    rows.push(makeSection(sectionIndex))
    const itemCount = sectionIndex === 5 ? 5 : 8
    for (let index = 0; index < itemCount; index += 1) {
      rows.push(makeItem(itemIndex, sectionIndex))
      itemIndex += 1
    }
  }
  return rows
}

export const metadata = {
  unitId: 23,
  draftStatus: "draft" as const,
  documentNumber: "10/2026/TT-BYT",
  documentVersion: "2026-06-19",
  snapshotMarker: "abc123def456",
  lastSavedAt: "2026-09-01T08:30:00.000Z",
  revision: 4,
  mode: "editable" as const,
}

export const defaultEditorState = {
  isDirty: false,
  isIncomplete: true,
  isSaving: false,
  isExcluding: false,
  isRestoring: false,
  isRecovering: false,
  isReadOnly: false,
}
