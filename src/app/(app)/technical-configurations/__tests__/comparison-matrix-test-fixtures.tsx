import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi } from "vitest"

import {
  TechnicalConfigurationCriterionPanel,
  type TechnicalConfigurationCriterionDetail,
} from "../_components/comparison/TechnicalConfigurationCriterionPanel"
import { TechnicalConfigurationMatrix } from "../_components/comparison/TechnicalConfigurationMatrix"
import type { TechnicalConfigurationComparisonResult } from "../comparison-types"

export const LONG_REQUIREMENT =
  "Yêu cầu cơ sở rất dài để xác nhận ô ma trận chỉ hiển thị nội dung rút gọn nhưng panel chi tiết vẫn giữ nguyên toàn bộ văn bản kỹ thuật."
export const LONG_RESPONSE =
  "Phản hồi phương án rất dài để xác nhận người dùng có thể mở phần chi tiết bằng bàn phím và đọc toàn bộ nội dung."

export function ComparisonQueryProvider({ children }: React.PropsWithChildren) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export function createComparisonResult(): TechnicalConfigurationComparisonResult {
  return {
    data: {
      dossier: {
        id: "dossier-1",
        deviceTypeName: "Máy siêu âm",
        name: "Cấu hình máy siêu âm",
        revision: 4,
        archivedAt: null,
      },
      baselineVersion: {
        id: "baseline-1",
        dossierId: "dossier-1",
        versionNumber: 2,
        status: "locked",
        revision: 2,
      },
      options: [
        {
          id: "option-b",
          supplierId: "supplier-b",
          supplierName: "Nhà cung cấp B",
          model: null,
          manufacturer: null,
          optionName: "Phương án B",
          displayLabel: "Nhà cung cấp B · Phương án B",
        },
        {
          id: "option-a",
          supplierId: "supplier-a",
          supplierName: "Nhà cung cấp A",
          model: "A-100",
          manufacturer: "Hãng A",
          optionName: null,
          displayLabel: "Nhà cung cấp A · A-100",
        },
      ],
      criteria: [
        {
          group: { id: "group-1", name: "Thông số chính", sortOrder: 1 },
          criterion: {
            id: "criterion-2",
            criterionCode: "TS-02",
            title: "Độ phân giải",
            requirementText: LONG_REQUIREMENT,
            sortOrder: 2,
          },
          baselineEvidence: { documentCount: 2, citationCount: 1, hasEvidence: true },
          optionValues: [
            {
              optionId: "option-b",
              comparisonSetId: "set-b",
              response: {
                id: "response-b",
                responseText: LONG_RESPONSE,
                supplementaryInformation: "Có đầu dò bổ sung.",
              },
              evidence: { documentCount: 1, citationCount: 1, hasEvidence: true },
            },
            {
              optionId: "option-a",
              comparisonSetId: null,
              response: null,
              evidence: { documentCount: 0, citationCount: 0, hasEvidence: false },
            },
          ],
        },
        {
          group: { id: "group-1", name: "Thông số chính", sortOrder: 1 },
          criterion: {
            id: "criterion-1",
            criterionCode: "TS-01",
            title: null,
            requirementText: "Tần số tối thiểu 10 MHz",
            sortOrder: 1,
          },
          baselineEvidence: { documentCount: 0, citationCount: 0, hasEvidence: false },
          optionValues: [],
        },
        {
          group: { id: "group-2", name: "Phụ kiện", sortOrder: 2 },
          criterion: {
            id: "criterion-3",
            criterionCode: "PK-01",
            title: "Xe đẩy",
            requirementText: "Có xe đẩy chuyên dụng",
            sortOrder: 1,
          },
          baselineEvidence: { documentCount: 0, citationCount: 0, hasEvidence: false },
          optionValues: [],
        },
      ],
    },
    total: 120,
    page: 2,
    pageSize: 50,
  }
}

export function ComparisonDetailHarness() {
  const [detail, setDetail] = React.useState<TechnicalConfigurationCriterionDetail | null>(null)
  const detailReturnFocusRef = React.useRef<HTMLElement | null>(null)
  const openDetail = (nextDetail: TechnicalConfigurationCriterionDetail) => {
    detailReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDetail(nextDetail)
  }

  return (
    <ComparisonQueryProvider>
      <TechnicalConfigurationMatrix
        hasRequest
        result={createComparisonResult()}
        onOpenDetail={openDetail}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
      />
      <TechnicalConfigurationCriterionPanel
        detail={detail}
        open={detail !== null}
        returnFocusRef={detailReturnFocusRef}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      />
    </ComparisonQueryProvider>
  )
}
