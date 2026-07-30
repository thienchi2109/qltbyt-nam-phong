import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type {
  TechnicalConfigurationComparisonCriterionRow,
  TechnicalConfigurationComparisonResult,
} from "../comparison-types"
import type { TechnicalConfigurationOptionWire } from "../supplier-option-types"
import type { TechnicalConfigurationDossierWire } from "../types"

export const dossier: TechnicalConfigurationDossierWire = {
  id: "dossier-1",
  device_type_name: "Máy siêu âm",
  name: "Cấu hình máy siêu âm",
  description: null,
  revision: 6,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-30T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-30T00:00:00.000Z",
  updated_by: 1,
}

export function createOption(id: string, displayLabel: string): TechnicalConfigurationOptionWire {
  return {
    id,
    dossier_id: dossier.id,
    supplier_id: `supplier-${id}`,
    supplier_name: displayLabel.split(" · ")[0] ?? displayLabel,
    model: null,
    manufacturer: null,
    option_name: null,
    notes: null,
    display_label: displayLabel,
    created_at: "2026-07-30T00:00:00.000Z",
    created_by: 1,
    updated_at: "2026-07-30T00:00:00.000Z",
    updated_by: 1,
    revision: 1,
  }
}

function createCriterion(
  id: string,
  criterionCode: string
): TechnicalConfigurationComparisonCriterionRow {
  return {
    group: {
      id: "group-1",
      name: "Thông số chính",
      sortOrder: 1,
    },
    criterion: {
      id,
      criterionCode,
      title: `Tiêu chí ${criterionCode}`,
      requirementText: `Yêu cầu ${criterionCode}`,
      sortOrder: Number(criterionCode.replace(/\D/g, "")),
    },
    baselineEvidence: {
      documentCount: 0,
      citationCount: 0,
      hasEvidence: false,
    },
    optionValues: [
      {
        optionId: "option-1",
        comparisonSetId: "comparison-set-1",
        response: {
          id: `response-${id}`,
          responseText: `Phản hồi ${criterionCode}`,
          supplementaryInformation: "",
        },
        evidence: {
          documentCount: 0,
          citationCount: 0,
          hasEvidence: false,
        },
      },
      {
        optionId: "option-2",
        comparisonSetId: "comparison-set-2",
        response: {
          id: `response-option-2-${id}`,
          responseText: `Phản hồi B ${criterionCode}`,
          supplementaryInformation: "",
        },
        evidence: {
          documentCount: 0,
          citationCount: 0,
          hasEvidence: false,
        },
      },
    ],
  }
}

export function createComparisonResult(
  page: number,
  optionId: string
): TechnicalConfigurationComparisonResult {
  const rows =
    page === 1
      ? [createCriterion("criterion-1", "TC-01"), createCriterion("criterion-2", "TC-02")]
      : [createCriterion("criterion-3", "TC-03")]
  const option = createOption(
    optionId,
    optionId === "option-1" ? "Nhà cung cấp A · Model A" : "Nhà cung cấp B · Model B"
  )

  return {
    data: {
      dossier: {
        id: dossier.id,
        deviceTypeName: dossier.device_type_name,
        name: dossier.name,
        revision: dossier.revision,
        archivedAt: null,
      },
      baselineVersion: {
        id: "baseline-1",
        dossierId: dossier.id,
        versionNumber: 2,
        status: "locked",
        revision: 4,
      },
      options: [
        {
          id: option.id,
          supplierId: option.supplier_id,
          supplierName: option.supplier_name,
          model: option.model,
          manufacturer: option.manufacturer,
          optionName: option.option_name,
          displayLabel: option.display_label,
        },
      ],
      criteria: rows,
    },
    total: 3,
    page,
    pageSize: 2,
  }
}

export function createDraft(criterionId: string | null) {
  return {
    criterionId,
    comparisonSetId: "comparison-set-1",
    technicalAxis: null,
    evidenceAxis: null,
    notes: "",
    expectedAssessmentRevision: 0,
    expectedDossierRevision: dossier.revision,
    saveStatus: "idle" as const,
    error: null as unknown,
    isDirty: false,
  }
}

export async function openCurrentCriterion(user: ReturnType<typeof userEvent.setup>) {
  await user.click((await screen.findAllByTestId("evaluation-criterion"))[0]!)
  return screen.findByRole("dialog")
}

export function getCriterion(criterionId: string): HTMLElement {
  const criterion = screen
    .getAllByTestId("evaluation-criterion")
    .find((row) => row.getAttribute("data-criterion-id") === criterionId)
  if (!criterion) throw new Error(`Missing evaluation criterion ${criterionId}`)
  return criterion
}
