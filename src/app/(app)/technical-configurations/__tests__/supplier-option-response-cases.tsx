import { act, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, type Mock } from "vitest"

import { TechnicalConfigurationOptionResponses } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionResponses"
import { useTechnicalConfigurationOptionResponses } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptionResponses"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type {
  TechnicalConfigurationComparisonSetWire,
  TechnicalConfigurationOptionResponseWire,
} from "@/app/(app)/technical-configurations/supplier-option-types"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import {
  dossier,
  option,
  renderWithQueryClient,
  type SupplierOptionRpcMocks,
} from "./supplier-options-fixtures"

type ResponseTestMocks = {
  baselineRpc: { listVersions: Mock }
  fetchMock: Mock
  supplierOptionRpc: SupplierOptionRpcMocks
}

const timestamp = "2026-07-23T00:00:00.000Z"

export function baselineVersion(
  overrides: Partial<TechnicalConfigurationBaselineDraftWire> = {}
): TechnicalConfigurationBaselineDraftWire {
  const id = overrides.id ?? "baseline-1"
  return {
    id,
    dossier_id: dossier.id,
    version_number: 1,
    status: "draft",
    source_baseline_version_id: null,
    source_version_number: null,
    next_criterion_number: 3,
    revision: dossier.revision,
    locked_at: null,
    locked_by: null,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    groups: [
      {
        id: `group-${id}`,
        baseline_version_id: id,
        name: "Yêu cầu chung",
        sort_order: 1,
        created_at: timestamp,
        created_by: 1,
        updated_at: timestamp,
        updated_by: 1,
        criteria: [
          {
            id: `criterion-${id}-1`,
            baseline_version_id: id,
            group_id: `group-${id}`,
            criterion_code: "TC-0001",
            title: "Nguồn điện",
            requirement_text: "Dòng 1\nDòng 2",
            sort_order: 1,
            source_criterion_id: null,
            created_at: timestamp,
            created_by: 1,
            updated_at: timestamp,
            updated_by: 1,
          },
          {
            id: `criterion-${id}-2`,
            baseline_version_id: id,
            group_id: `group-${id}`,
            criterion_code: "TC-0002",
            title: "Pin dự phòng",
            requirement_text: "Hoạt động tối thiểu 30 phút",
            sort_order: 2,
            source_criterion_id: null,
            created_at: timestamp,
            created_by: 1,
            updated_at: timestamp,
            updated_by: 1,
          },
        ],
      },
    ],
    ...overrides,
  }
}

export function optionResponse(
  baseline: TechnicalConfigurationBaselineDraftWire,
  overrides: Partial<TechnicalConfigurationOptionResponseWire> = {}
): TechnicalConfigurationOptionResponseWire {
  return {
    id: "response-1",
    comparison_set_id: "comparison-set-1",
    baseline_version_id: baseline.id,
    criterion_id: baseline.groups[0]?.criteria[0]?.id ?? "",
    response_text: "Đáp ứng dòng 1\nĐáp ứng dòng 2",
    supplementary_information: "Ghi chú bổ sung\nKhông dùng để chấm điểm",
    created_at: timestamp,
    created_by: 1,
    updated_at: "2026-07-23T03:00:00.000Z",
    updated_by: 1,
    revision: dossier.revision,
    ...overrides,
  }
}

export function comparisonSet(
  baseline: TechnicalConfigurationBaselineDraftWire,
  responses: TechnicalConfigurationOptionResponseWire[] = [],
  revision = dossier.revision
): TechnicalConfigurationComparisonSetWire {
  return {
    id: "comparison-set-1",
    dossier_id: dossier.id,
    option_id: "option-1",
    baseline_version_id: baseline.id,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    revision,
    responses,
  }
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function getRequest(fetchMock: Mock, index: number) {
  const [url, init] = fetchMock.mock.calls[index] ?? []
  const request = init as RequestInit | undefined
  return {
    url,
    body: JSON.parse(typeof request?.body === "string" ? request.body : "{}") as Record<
      string,
      unknown
    >,
  }
}

export function renderResponseHook({
  baseline = baselineVersion(),
  dossierValue = dossier,
  onRevisionChange = () => undefined,
  onNavigationBlockedChange = () => undefined,
}: {
  baseline?: TechnicalConfigurationBaselineDraftWire
  dossierValue?: typeof dossier
  onRevisionChange?: (revision: number) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
} = {}) {
  const queryClient = createTestQueryClient()
  const currentOption = option({ id: "option-1" })
  const rendered = renderHook(
    () =>
      useTechnicalConfigurationOptionResponses({
        dossier: dossierValue,
        option: currentOption,
        baselineVersion: baseline,
        onRevisionChange,
        onNavigationBlockedChange,
      }),
    { wrapper: createReactQueryWrapper(queryClient) }
  )
  return { ...rendered, queryClient, baseline, currentOption }
}

export function registerSupplierOptionResponseTests({ baselineRpc, fetchMock }: ResponseTestMocks) {
  describe("technical configuration option responses", () => {
    it("opens a null exact-baseline snapshot without creating comparison data", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: null }))

      const { result, baseline, currentOption } = renderResponseHook()
      await waitFor(() => expect(result.current.responseQuery.isSuccess).toBe(true))

      expect(result.current.draft).toEqual({
        responseText: "",
        supplementaryInformation: "",
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(getRequest(fetchMock, 0)).toEqual({
        url: "/api/rpc/technical_configuration_comparison_set_get",
        body: {
          p_option_id: currentOption.id,
          p_baseline_version_id: baseline.id,
        },
      })
    })

    it("preserves exact multiline response and supplementary information", async () => {
      const baseline = baselineVersion()
      const response = optionResponse(baseline)
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: comparisonSet(baseline, [response]) }))

      const { result } = renderResponseHook({ baseline })
      await waitFor(() => expect(result.current.responseQuery.isSuccess).toBe(true))

      expect(result.current.draft.responseText).toBe(response.response_text)
      expect(result.current.draft.supplementaryInformation).toBe(response.supplementary_information)
    })

    it("uses the get-or-create revision for the first explicit response save", async () => {
      const onRevisionChange = vi.fn()
      const baseline = baselineVersion()
      const createdSet = comparisonSet(baseline, [], 4)
      const savedResponse = optionResponse(baseline, {
        response_text: "Đáp ứng đầy đủ",
        supplementary_information: "Biên bản thử nghiệm số 12",
        revision: 5,
      })
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: null }))
        .mockResolvedValueOnce(jsonResponse({ data: createdSet }))
        .mockResolvedValueOnce(jsonResponse({ data: savedResponse }))

      const { result, currentOption } = renderResponseHook({ baseline, onRevisionChange })
      await waitFor(() => expect(result.current.responseQuery.isSuccess).toBe(true))
      act(() =>
        result.current.updateDraft({
          responseText: savedResponse.response_text,
          supplementaryInformation: savedResponse.supplementary_information,
        })
      )
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await act(async () => result.current.save())

      expect(getRequest(fetchMock, 1)).toEqual({
        url: "/api/rpc/technical_configuration_comparison_set_get_or_create",
        body: {
          p_option_id: currentOption.id,
          p_baseline_version_id: baseline.id,
          p_expected_revision: dossier.revision,
        },
      })
      expect(getRequest(fetchMock, 2)).toEqual({
        url: "/api/rpc/technical_configuration_option_response_upsert",
        body: {
          p_comparison_set_id: createdSet.id,
          p_criterion_id: baseline.groups[0]?.criteria[0]?.id,
          p_response_text: savedResponse.response_text,
          p_supplementary_information: savedResponse.supplementary_information,
          p_expected_revision: createdSet.revision,
        },
      })
      expect(onRevisionChange).toHaveBeenNthCalledWith(1, 4)
      expect(onRevisionChange).toHaveBeenNthCalledWith(2, 5)
      expect(result.current.isDirty).toBe(false)
    })

    it("keeps validation local and sends no mutation", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: null }))
      const { result } = renderResponseHook()
      await waitFor(() => expect(result.current.responseQuery.isSuccess).toBe(true))

      act(() => result.current.updateDraft({ responseText: "   " }))
      await act(async () => result.current.save())

      expect(result.current.validationError).toBe("Phản hồi tiêu chí là bắt buộc.")
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result.current.draft.responseText).toBe("   ")
    })

    it("keeps locked baselines editable, archived dossiers read-only, and renders no lock controls", async () => {
      const user = userEvent.setup()
      const locked = baselineVersion({ status: "locked", locked_at: timestamp, locked_by: 9 })
      baselineRpc.listVersions.mockResolvedValue({
        data: [locked],
        total: 1,
        page: 1,
        page_size: 100,
      })
      fetchMock.mockResolvedValue(jsonResponse({ data: null }))

      const { rerender } = renderWithQueryClient(
        <TechnicalConfigurationOptionResponses
          dossier={dossier}
          option={option({ id: "option-1" })}
        />
      )
      const responseInput = await screen.findByLabelText("Phản hồi tiêu chí")
      expect(responseInput).toBeEnabled()
      expect(screen.getByLabelText("Thông tin bổ sung")).toBeEnabled()
      expect(screen.queryByText(/khóa phương án/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/phiên bản phương án/i)).not.toBeInTheDocument()
      await user.type(responseInput, "Đáp ứng")

      rerender(
        <TechnicalConfigurationOptionResponses
          dossier={{ ...dossier, archived_at: timestamp, archived_by: 9 }}
          option={option({ id: "option-1" })}
        />
      )
      expect(await screen.findByText("Chế độ chỉ đọc")).toBeInTheDocument()
      expect(screen.getByLabelText("Phản hồi tiêu chí")).toBeDisabled()
    })
  })
}
