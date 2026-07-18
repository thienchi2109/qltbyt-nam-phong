import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, type Mock } from "vitest"

import { TechnicalConfigurationReferenceComparison } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceComparison"
import { toTechnicalConfigurationReferenceProductDraft } from "@/app/(app)/technical-configurations/technical-configuration-reference-product-state"
import { baselineVersion, product, renderWithQueryClient } from "./reference-products-fixtures"

type ReferenceEvidenceState = {
  getDocumentsForOwner: Mock
}

type BaselineDocumentsMock = {
  props: {
    ownerType: string
    ownerId: string
    criterionId?: string | null
    readOnly?: boolean
  } | null
}

export function registerReferenceProductEvidenceTests({
  evidenceState,
  baselineDocumentsMock,
}: {
  evidenceState: ReferenceEvidenceState
  baselineDocumentsMock: BaselineDocumentsMock
}) {
  describe("technical configuration reference evidence", () => {
    it("shows an in-cell evidence indicator and opens a criterion detail panel", async () => {
      const user = userEvent.setup()
      const referenceProduct = toTechnicalConfigurationReferenceProductDraft(
        product("product-1", "Model A")
      )
      evidenceState.getDocumentsForOwner.mockReturnValue([
        {
          id: "document-1",
          owner_type: "reference_product",
          owner_id: "product-1",
          name: "Catalogue Model A",
          url: "https://example.com/model-a.pdf",
          citations: [
            {
              id: "citation-1",
              criterion_id: "criterion-1",
              page_section: "Mục 4.2",
              excerpt: "Nguồn điện ổn định",
            },
          ],
        },
      ])

      renderWithQueryClient(
        <TechnicalConfigurationReferenceComparison
          baselineVersion={baselineVersion}
          products={[referenceProduct]}
          readOnly={false}
          onResponseChange={() => undefined}
        />
      )

      expect(
        screen.queryByRole("columnheader", { name: /bằng chứng|tài liệu|trích dẫn/i })
      ).not.toBeInTheDocument()
      await user.click(
        screen.getByRole("button", {
          name: "Bằng chứng Model A cho TC-0001: 1 tài liệu, 1 trích dẫn",
        })
      )

      expect(screen.getByRole("dialog")).toHaveTextContent("Model A · TC-0001")
      expect(screen.getByTestId("reference-evidence-detail")).toHaveTextContent(
        "reference_product:product-1:criterion-1"
      )
      expect(baselineDocumentsMock.props).toMatchObject({
        ownerType: "reference_product",
        ownerId: "product-1",
        criterionId: "criterion-1",
      })
    })

    it("propagates archived read-only state into the reference evidence editor", async () => {
      const user = userEvent.setup()
      const referenceProduct = toTechnicalConfigurationReferenceProductDraft(
        product("product-1", "Model A")
      )
      evidenceState.getDocumentsForOwner.mockReturnValue([])

      renderWithQueryClient(
        <TechnicalConfigurationReferenceComparison
          baselineVersion={baselineVersion}
          products={[referenceProduct]}
          readOnly
          onResponseChange={vi.fn()}
        />
      )

      await user.click(
        screen.getByRole("button", {
          name: "Bằng chứng Model A cho TC-0001: 0 tài liệu, 0 trích dẫn",
        })
      )

      expect(baselineDocumentsMock.props).toMatchObject({
        ownerType: "reference_product",
        ownerId: "product-1",
        criterionId: "criterion-1",
        readOnly: true,
      })
    })

    it("does not offer evidence authoring for an unsaved reference product", () => {
      const referenceProduct = {
        ...toTechnicalConfigurationReferenceProductDraft(product("product-1", "Model A")),
        persistedId: null,
      }

      renderWithQueryClient(
        <TechnicalConfigurationReferenceComparison
          baselineVersion={baselineVersion}
          products={[referenceProduct]}
          readOnly={false}
          onResponseChange={() => undefined}
        />
      )

      expect(
        screen.queryByRole("button", { name: /Bằng chứng Model A cho TC-0001/i })
      ).not.toBeInTheDocument()
    })
  })
}
