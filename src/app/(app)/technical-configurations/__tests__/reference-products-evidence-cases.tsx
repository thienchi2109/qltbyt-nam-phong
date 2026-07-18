import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, type Mock } from "vitest"

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
    onDirtyChange?: (dirty: boolean) => void
    onNavigationBlockedChange?: (blocked: boolean) => void
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

    it("closes stale evidence details when the baseline version changes", async () => {
      const user = userEvent.setup()
      const onEvidenceDirtyChange = vi.fn()
      const onEvidenceNavigationBlockedChange = vi.fn()
      const referenceProduct = toTechnicalConfigurationReferenceProductDraft(
        product("product-1", "Model A")
      )
      evidenceState.getDocumentsForOwner.mockReturnValue([])
      const view = renderWithQueryClient(
        <TechnicalConfigurationReferenceComparison
          baselineVersion={baselineVersion}
          products={[referenceProduct]}
          readOnly={false}
          onResponseChange={vi.fn()}
          onEvidenceDirtyChange={onEvidenceDirtyChange}
          onEvidenceNavigationBlockedChange={onEvidenceNavigationBlockedChange}
        />
      )

      await user.click(
        screen.getByRole("button", {
          name: "Bằng chứng Model A cho TC-0001: 0 tài liệu, 0 trích dẫn",
        })
      )
      expect(screen.getByRole("dialog")).toBeInTheDocument()
      baselineDocumentsMock.props?.onDirtyChange?.(true)
      baselineDocumentsMock.props?.onNavigationBlockedChange?.(true)

      view.rerender(
        <TechnicalConfigurationReferenceComparison
          baselineVersion={{ ...baselineVersion, id: "version-2" }}
          products={[referenceProduct]}
          readOnly={false}
          onResponseChange={vi.fn()}
          onEvidenceDirtyChange={onEvidenceDirtyChange}
          onEvidenceNavigationBlockedChange={onEvidenceNavigationBlockedChange}
        />
      )

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      await waitFor(() => {
        expect(onEvidenceDirtyChange).toHaveBeenLastCalledWith(false)
        expect(onEvidenceNavigationBlockedChange).toHaveBeenLastCalledWith(false)
      })
    })

    it("keeps the evidence dialog open while a mutation blocks navigation", async () => {
      const user = userEvent.setup()
      const onNavigationBlockedChange = vi.fn()
      const referenceProduct = toTechnicalConfigurationReferenceProductDraft(
        product("product-1", "Model A")
      )
      evidenceState.getDocumentsForOwner.mockReturnValue([])
      renderWithQueryClient(
        <TechnicalConfigurationReferenceComparison
          baselineVersion={baselineVersion}
          products={[referenceProduct]}
          readOnly={false}
          onResponseChange={vi.fn()}
          onEvidenceNavigationBlockedChange={onNavigationBlockedChange}
        />
      )

      await user.click(
        screen.getByRole("button", {
          name: "Bằng chứng Model A cho TC-0001: 0 tài liệu, 0 trích dẫn",
        })
      )
      baselineDocumentsMock.props?.onNavigationBlockedChange?.(true)
      await user.click(screen.getByRole("button", { name: "Đóng" }))

      expect(screen.getByRole("dialog")).toBeInTheDocument()
      expect(onNavigationBlockedChange).toHaveBeenCalledWith(true)

      baselineDocumentsMock.props?.onNavigationBlockedChange?.(false)
      await user.click(screen.getByRole("button", { name: "Đóng" }))

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      expect(onNavigationBlockedChange).toHaveBeenCalledWith(false)
    })

    it("uses an alert dialog before closing dirty evidence", async () => {
      const user = userEvent.setup()
      const nativeConfirm = vi.spyOn(window, "confirm").mockReturnValue(false)
      const onEvidenceDirtyChange = vi.fn()
      const referenceProduct = toTechnicalConfigurationReferenceProductDraft(
        product("product-1", "Model A")
      )
      evidenceState.getDocumentsForOwner.mockReturnValue([])

      try {
        renderWithQueryClient(
          <TechnicalConfigurationReferenceComparison
            baselineVersion={baselineVersion}
            products={[referenceProduct]}
            readOnly={false}
            onResponseChange={vi.fn()}
            onEvidenceDirtyChange={onEvidenceDirtyChange}
          />
        )

        await user.click(
          screen.getByRole("button", {
            name: "Bằng chứng Model A cho TC-0001: 0 tài liệu, 0 trích dẫn",
          })
        )
        await user.type(screen.getByRole("textbox", { name: "Bản nháp bằng chứng" }), "Đang sửa")
        baselineDocumentsMock.props?.onDirtyChange?.(true)
        await user.click(screen.getByRole("button", { name: "Đóng" }))

        expect(nativeConfirm).not.toHaveBeenCalled()
        const discardDialog = await screen.findByRole("alertdialog")
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
        await user.click(within(discardDialog).getByRole("button", { name: "Hủy" }))
        expect(screen.getByRole("dialog")).toBeInTheDocument()
        expect(screen.getByRole("textbox", { name: "Bản nháp bằng chứng" })).toHaveValue("Đang sửa")

        await user.click(screen.getByRole("button", { name: "Đóng" }))
        await user.click(
          within(await screen.findByRole("alertdialog")).getByRole("button", {
            name: "Bỏ thay đổi",
          })
        )
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
        expect(onEvidenceDirtyChange).toHaveBeenLastCalledWith(false)
      } finally {
        nativeConfirm.mockRestore()
      }
    })

    it("resolves evidence documents once per visible product", () => {
      const referenceProduct = toTechnicalConfigurationReferenceProductDraft(
        product("product-1", "Model A")
      )
      const firstCriterion = baselineVersion.groups[0].criteria[0]
      const baselineWithTwoCriteria = {
        ...baselineVersion,
        groups: [
          {
            ...baselineVersion.groups[0],
            criteria: [
              firstCriterion,
              {
                ...firstCriterion,
                id: "criterion-2",
                criterion_code: "TC-0002",
                sort_order: 2,
              },
            ],
          },
        ],
      }
      evidenceState.getDocumentsForOwner.mockReturnValue([])

      renderWithQueryClient(
        <TechnicalConfigurationReferenceComparison
          baselineVersion={baselineWithTwoCriteria}
          products={[referenceProduct]}
          readOnly={false}
          onResponseChange={vi.fn()}
        />
      )

      expect(evidenceState.getDocumentsForOwner).toHaveBeenCalledTimes(1)
      expect(evidenceState.getDocumentsForOwner).toHaveBeenCalledWith(
        "reference_product",
        "product-1"
      )
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
