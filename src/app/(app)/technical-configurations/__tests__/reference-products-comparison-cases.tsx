import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationReferenceComparison } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceComparison"
import { toTechnicalConfigurationReferenceProductDraft } from "@/app/(app)/technical-configurations/technical-configuration-reference-product-state"
import { baselineVersion, product, renderWithQueryClient } from "./reference-products-fixtures"

export function registerReferenceProductComparisonTests() {
  describe("technical configuration reference-product comparison", () => {
    it("keeps hidden columns by product identity and resets them for another baseline", async () => {
      const user = userEvent.setup()
      const longRequirement =
        "Hệ thống phải duy trì nguồn điện ổn định trong suốt quá trình vận hành liên tục tại khoa điều trị."
      const longResponse =
        "Phản hồi chi tiết cho Model A được giữ nguyên đầy đủ để người dùng kiểm tra thông số tham chiếu."
      const version = {
        ...baselineVersion,
        groups: [
          {
            ...baselineVersion.groups[0],
            criteria: [
              {
                ...baselineVersion.groups[0]!.criteria[0],
                requirement_text: longRequirement,
              },
            ],
          },
        ],
      }
      const products = ["Model A", "Model B", "Model C"].map((model, index) => {
        const draft = toTechnicalConfigurationReferenceProductDraft(
          product(`product-${index + 1}`, model)
        )
        return {
          ...draft,
          responses: {
            ...draft.responses,
            "criterion-1": index === 0 ? longResponse : `Phản hồi dài của ${model}`,
          },
        }
      })

      const { rerender } = renderWithQueryClient(
        <TechnicalConfigurationReferenceComparison
          baselineVersion={version}
          products={products}
          readOnly={false}
          onResponseChange={vi.fn()}
        />
      )

      expect(screen.getByTestId("reference-comparison-scroll")).toHaveClass("overflow-x-auto")
      expect(screen.getByRole("columnheader", { name: "Yêu cầu cơ sở" })).toHaveClass("sticky")
      expect(screen.getByRole("columnheader", { name: "Model A" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Model B" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Model C" })).toBeInTheDocument()

      await user.click(screen.getByRole("checkbox", { name: "Hiển thị Model B" }))
      expect(screen.queryByRole("columnheader", { name: "Model B" })).not.toBeInTheDocument()

      const editedProducts = products.map((draft, index) =>
        index === 0 ? { ...draft, model: "Model A cập nhật" } : draft
      )
      rerender(
        <TechnicalConfigurationReferenceComparison
          baselineVersion={version}
          products={editedProducts}
          readOnly={false}
          onResponseChange={vi.fn()}
        />
      )
      expect(screen.getByRole("columnheader", { name: "Model A cập nhật" })).toBeInTheDocument()
      expect(screen.queryByRole("columnheader", { name: "Model B" })).not.toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Xem đầy đủ yêu cầu TC-0001" }))
      expect(within(screen.getByRole("dialog")).getByText(longRequirement)).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Đóng" }))

      await user.click(
        screen.getByRole("button", {
          name: "Xem đầy đủ phản hồi Model A cập nhật cho TC-0001",
        })
      )
      expect(within(screen.getByRole("dialog")).getByText(longResponse)).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Đóng" }))

      rerender(
        <TechnicalConfigurationReferenceComparison
          baselineVersion={version}
          products={editedProducts.slice(1)}
          readOnly={false}
          onResponseChange={vi.fn()}
        />
      )
      expect(screen.queryByRole("columnheader", { name: "Model B" })).not.toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Model C" })).toBeInTheDocument()

      const nextProducts = ["Model D", "Model E"].map((model, index) =>
        toTechnicalConfigurationReferenceProductDraft(product(`next-${index + 1}`, model))
      )
      rerender(
        <TechnicalConfigurationReferenceComparison
          baselineVersion={{ ...version, id: "version-2" }}
          products={nextProducts}
          readOnly={false}
          onResponseChange={vi.fn()}
        />
      )
      expect(screen.getByRole("columnheader", { name: "Model D" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Model E" })).toBeInTheDocument()
      expect(screen.queryByText(/xếp hạng|tài liệu|trích dẫn/i)).not.toBeInTheDocument()
    })
  })
}
