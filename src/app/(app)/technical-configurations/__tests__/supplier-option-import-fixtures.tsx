import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi, type Mock } from "vitest"

import { TechnicalConfigurationOptionResponses } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionResponses"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationOptionWire } from "@/app/(app)/technical-configurations/supplier-option-types"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import {
  OPTION_WORKBOOK_TEMPLATE_KIND,
  OPTION_WORKBOOK_TEMPLATE_VERSION,
  type TechnicalConfigurationOptionWorkbookParseResult,
  type TechnicalConfigurationOptionWorkbookRow,
} from "@/lib/technical-configuration-option-excel-contract"

import { baselineVersion, comparisonSet, optionResponse } from "./supplier-option-response-cases"
import {
  dossier,
  option,
  renderWithQueryClient,
  type SupplierOptionRpcMocks,
} from "./supplier-options-fixtures"

export type SupplierOptionWorkbookCodecMocks = {
  readWorkbook: Mock
  createParser: Mock
  createWorkbook: Mock
  downloadBlob: Mock
}

export type SupplierOptionImportTestMocks = {
  baselineRpc: { listVersions: Mock }
  fetchMock: Mock
  supplierOptionRpc: SupplierOptionRpcMocks
  workbookCodec: SupplierOptionWorkbookCodecMocks
}

export function setImportBaselineVersion(
  baselineRpc: SupplierOptionImportTestMocks["baselineRpc"],
  baseline: TechnicalConfigurationBaselineDraftWire
) {
  baselineRpc.listVersions.mockResolvedValue({
    data: [baseline],
    total: 1,
    page: 1,
    page_size: 100,
  })
  return baseline
}

export function toWorkbookRows(
  baseline: TechnicalConfigurationBaselineDraftWire,
  values: Record<
    string,
    Pick<TechnicalConfigurationOptionWorkbookRow, "response_text" | "supplementary_information">
  > = {}
): TechnicalConfigurationOptionWorkbookRow[] {
  return baseline.groups.flatMap((group) =>
    group.criteria.map((criterion) => ({
      group_order: group.sort_order,
      group_name: group.name,
      criterion_order: criterion.sort_order,
      criterion_id: criterion.id,
      criterion_code: criterion.criterion_code,
      criterion_title: criterion.title,
      requirement_text: criterion.requirement_text,
      response_text: values[criterion.id]?.response_text ?? "",
      supplementary_information: values[criterion.id]?.supplementary_information ?? "",
    }))
  )
}

export function workbookPayload({
  baseline,
  currentOption,
  revision = dossier.revision,
  rows = toWorkbookRows(baseline),
}: {
  baseline: TechnicalConfigurationBaselineDraftWire
  currentOption: TechnicalConfigurationOptionWire
  revision?: number
  rows?: TechnicalConfigurationOptionWorkbookRow[]
}): TechnicalConfigurationOptionWorkbookParseResult {
  return {
    metadata: {
      template_kind: OPTION_WORKBOOK_TEMPLATE_KIND,
      template_version: OPTION_WORKBOOK_TEMPLATE_VERSION,
      dossier_id: dossier.id,
      option_id: currentOption.id,
      baseline_version_id: baseline.id,
      dossier_revision: revision,
      generated_at: "2026-07-25T00:00:00.000Z",
    },
    rows,
  }
}

export function renderImportResponses({
  mocks,
  baseline = baselineVersion(),
  currentOption = option({ id: "option-1" }),
  dossierValue = dossier,
  onRevisionChange = vi.fn(),
}: {
  mocks: SupplierOptionImportTestMocks
  baseline?: TechnicalConfigurationBaselineDraftWire
  currentOption?: TechnicalConfigurationOptionWire
  dossierValue?: TechnicalConfigurationDossierWire
  onRevisionChange?: (revision: number) => void
}) {
  setImportBaselineVersion(mocks.baselineRpc, baseline)
  return {
    ...renderWithQueryClient(
      <TechnicalConfigurationOptionResponses
        dossier={dossierValue}
        option={currentOption}
        onRevisionChange={onRevisionChange}
      />
    ),
    baseline,
    currentOption,
    onRevisionChange,
  }
}

export function mockParsedWorkbook(
  workbookCodec: SupplierOptionWorkbookCodecMocks,
  payload: TechnicalConfigurationOptionWorkbookParseResult
) {
  workbookCodec.createParser.mockReturnValue(async () => [payload])
}

export async function uploadOptionWorkbook(
  user: ReturnType<typeof userEvent.setup>,
  fileName = "option.xlsx"
) {
  await user.click(screen.getByRole("button", { name: "Nhập phản hồi từ Excel" }))
  await user.upload(
    screen.getByLabelText("Chọn template phản hồi phương án"),
    new File(["workbook"], fileName, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  )
}

export async function confirmOptionImport(user: ReturnType<typeof userEvent.setup>) {
  let confirmation = screen.queryByRole("alertdialog")
  if (!confirmation) {
    await user.click(screen.getByRole("button", { name: /Nhập 2 dòng/ }))
    confirmation = await screen.findByRole("alertdialog")
  }
  await user.click(within(confirmation).getByRole("button", { name: "Áp dụng import" }))
}

export function persistedImportResponse(
  baseline: TechnicalConfigurationBaselineDraftWire,
  revision = dossier.revision
) {
  return optionResponse(baseline, {
    response_text: "Phản hồi hiện tại",
    supplementary_information: "Thông tin bổ sung cũ",
    revision,
  })
}

export function persistedImportSet(
  baseline: TechnicalConfigurationBaselineDraftWire,
  revision = dossier.revision
) {
  return comparisonSet(baseline, [persistedImportResponse(baseline, revision)], revision)
}
