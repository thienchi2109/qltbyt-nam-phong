import { createElement } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import { TechnicalConfigurationBaselineProductionActions } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineProductionActions"
import type {
  TechnicalConfigurationBaselineDecodedDraft,
  TechnicalConfigurationBaselineDraftWire,
} from "@/app/(app)/technical-configurations/baseline-types"

import { createDraft } from "./technical-configuration-baseline-tab-fixtures"

type ExcelActionUser = {
  click: (element: Element) => Promise<void>
}

export function createCurrentDataWorkbookExpectation(generatedAt: unknown) {
  return {
    intent: "current-data",
    sheets: [
      {
        kind: "configuration",
        columns: [
          { key: "stt", hidden: false },
          { key: "content", hidden: false },
          { key: "main_section_id", hidden: true },
          { key: "subgroup_id", hidden: true },
          { key: "criterion_id", hidden: true },
          { key: "criterion_code", hidden: true },
          {
            key: "criterion_title",
            header: "TIÊU ĐỀ (THAM CHIẾU)",
            hidden: false,
          },
        ],
        rows: [
          {
            kind: "section",
            stt: "I",
            content: "Yêu cầu chung",
            main_section_id: "group-1",
          },
          {
            kind: "criterion",
            stt: null,
            content: "Dòng 1\nDòng 2",
            main_section_id: "group-1",
            subgroup_id: null,
            criterion_id: "criterion-1",
            criterion_code: "TC-0001",
            criterion_title: "Nguồn điện",
          },
          {
            kind: "subgroup",
            stt: "1",
            content: "Điều kiện vận hành",
            main_section_id: "group-1",
            subgroup_id: "subgroup-1",
          },
          {
            kind: "criterion",
            stt: null,
            content: "Hoạt động ổn định ở 18-30°C",
            main_section_id: "group-1",
            subgroup_id: "subgroup-1",
            criterion_id: "criterion-2",
            criterion_code: "TC-0002",
            criterion_title: "Nhiệt độ",
          },
          {
            kind: "section",
            stt: "II",
            content: "Yêu cầu cấu hình cung cấp",
            main_section_id: "group-2",
          },
          {
            kind: "section",
            stt: "III",
            content: "Yêu cầu kỹ thuật",
            main_section_id: "group-3",
          },
          {
            kind: "section",
            stt: "IV",
            content: "Yêu cầu khác",
            main_section_id: "group-4",
          },
        ],
      },
      { kind: "instructions" },
      {
        kind: "meta",
        state: "hidden",
        metadata: {
          dossier_id: "dossier-1",
          baseline_version_id: "draft-1",
          baseline_revision: 11,
          generated_at: generatedAt,
        },
      },
    ],
  }
}

/** Selects a deferred action from the production Excel dropdown. */
export async function chooseExcelAction(user: ExcelActionUser, actionName: string): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Công cụ Excel" }))
  fireEvent.click(await screen.findByRole("menuitem", { name: actionName }))
  await waitFor(() => {
    if (screen.queryByRole("menuitem", { name: actionName })) {
      throw new Error("Excel action menu is still open")
    }
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

export function renderBaselineProductionActions({
  version = createHierarchicalDraft(),
  dirty = false,
  conflict = false,
  disabled = false,
  disabledMessage = null,
}: {
  version?: TechnicalConfigurationBaselineDecodedDraft
  dirty?: boolean
  conflict?: boolean
  disabled?: boolean
  disabledMessage?: string | null
} = {}) {
  return render(
    createElement(TechnicalConfigurationBaselineProductionActions, {
      version,
      deviceTypeName: "Máy lọc thận",
      dossierName: "Hồ sơ khu A",
      dirty,
      conflict,
      disabled,
      disabledMessage,
      onRequestHierarchyImport: () => undefined,
    })
  )
}

export function readBlobBytes(blob: Blob): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(Array.from(new Uint8Array(reader.result as ArrayBuffer)))
    reader.readAsArrayBuffer(blob)
  })
}

export function createHierarchicalDraft(
  overrides: Partial<TechnicalConfigurationBaselineDraftWire> = {}
): TechnicalConfigurationBaselineDecodedDraft {
  const draft = createDraft({
    version_number: 7,
    revision: 11,
  })
  const group = draft.groups[0]
  const directCriterion = group.criteria[0]

  return {
    ...draft,
    groups: [
      {
        ...group,
        criteria: [{ ...directCriterion, subgroup_id: null }],
        subgroups: [
          {
            id: "subgroup-1",
            baseline_version_id: draft.id,
            group_id: group.id,
            name: "Điều kiện vận hành",
            sort_order: 1,
            created_at: draft.created_at,
            created_by: draft.created_by,
            updated_at: draft.updated_at,
            updated_by: draft.updated_by,
            criteria: [
              {
                ...directCriterion,
                id: "criterion-2",
                group_id: group.id,
                subgroup_id: "subgroup-1",
                criterion_code: "TC-0002",
                title: "Nhiệt độ",
                requirement_text: "Hoạt động ổn định ở 18-30°C",
              },
            ],
          },
        ],
      },
      ...draft.groups.slice(1).map((remainingGroup) => ({
        ...remainingGroup,
        criteria: remainingGroup.criteria.map((criterion) => ({
          ...criterion,
          subgroup_id: criterion.subgroup_id ?? null,
        })),
        subgroups: (remainingGroup.subgroups ?? []).map((subgroup) => ({
          ...subgroup,
          criteria: subgroup.criteria.map((criterion) => ({
            ...criterion,
            subgroup_id: criterion.subgroup_id ?? subgroup.id,
          })),
        })),
      })),
    ],
    ...overrides,
  }
}
