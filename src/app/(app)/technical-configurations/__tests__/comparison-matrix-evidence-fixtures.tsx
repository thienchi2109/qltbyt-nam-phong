import { createElement, type PropsWithChildren } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import { vi } from "vitest"

import {
  TechnicalConfigurationCriterionPanel,
  type TechnicalConfigurationCriterionDetail,
} from "../_components/comparison/TechnicalConfigurationCriterionPanel"

export function createEvidenceTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
}

function createQueryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

export function createEvidenceDetail({
  hasEvidence = true,
  owner = "baseline",
}: {
  hasEvidence?: boolean
  owner?: "baseline" | "option"
} = {}): TechnicalConfigurationCriterionDetail {
  return {
    criterionCode: "TS-02",
    criterionTitle: "Độ phân giải",
    optionLabel: owner === "option" ? "Nhà cung cấp B · Phương án B" : null,
    requirementText: "Độ phân giải tối thiểu 1920x1080.",
    responseText: owner === "option" ? "Đáp ứng 3840x2160." : null,
    supplementaryInformation: null,
    evidence: {
      documentCount: hasEvidence ? 1 : 0,
      citationCount: hasEvidence ? 1 : 0,
      hasEvidence,
    },
    evidenceTarget:
      owner === "baseline"
        ? {
            kind: "baseline",
            baselineVersionId: "baseline-1",
            criterionId: "criterion-2",
          }
        : {
            kind: "option",
            baselineVersionId: "baseline-1",
            optionId: "option-b",
            criterionId: "criterion-2",
          },
  }
}

export function renderEvidencePanel({
  detail,
  open,
  queryClient = createEvidenceTestQueryClient(),
}: {
  detail: TechnicalConfigurationCriterionDetail
  open: boolean
  queryClient?: QueryClient
}) {
  return {
    queryClient,
    ...render(
      <TechnicalConfigurationCriterionPanel detail={detail} open={open} onOpenChange={vi.fn()} />,
      { wrapper: createQueryWrapper(queryClient) }
    ),
  }
}

export function baselineEvidenceDocument({
  id,
  ownerType = "baseline",
  ownerId = "baseline-1",
  criterionId = "criterion-2",
  excerpt = "Đoạn trích xác nhận độ phân giải.",
}: {
  id: string
  ownerType?: "baseline" | "reference_product"
  ownerId?: string
  criterionId?: string
  excerpt?: string
}) {
  return {
    id,
    owner_type: ownerType,
    owner_id: ownerId,
    name: `Tài liệu ${id}`,
    url: `https://example.com/${id}`,
    created_by: 1,
    created_at: "2026-07-29T00:00:00Z",
    updated_at: "2026-07-29T00:00:00Z",
    citations: [
      {
        id: `citation-${id}`,
        criterion_id: criterionId,
        page_section: "Trang 12",
        excerpt,
      },
    ],
  }
}
