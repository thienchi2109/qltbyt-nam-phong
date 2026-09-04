import React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

import { DeviceQuotaDraftCatalogItemRow } from "../_components/DeviceQuotaDraftCatalogItemRow"
import { makeItem } from "./DeviceQuotaDraftCatalogTestSupport"

function renderItem(
  overrides: Partial<React.ComponentProps<typeof DeviceQuotaDraftCatalogItemRow>> = {}
) {
  const props: React.ComponentProps<typeof DeviceQuotaDraftCatalogItemRow> = {
    row: makeItem(1, 1),
    isReadOnly: false,
    isMutationPending: false,
    onUpdate: vi.fn(),
    onExclude: vi.fn(),
    onRestore: vi.fn(),
    ...overrides,
  }

  return {
    ...render(
      <table>
        <tbody>
          <DeviceQuotaDraftCatalogItemRow {...props} />
        </tbody>
      </table>
    ),
    props,
  }
}

describe("DeviceQuotaDraftCatalogItemRow", () => {
  it("keeps the appendix X-ray item names distinct through row interaction", async () => {
    const user = userEvent.setup()
    const regulatoryNames = [
      "Máy X - quang kỹ thuật số chụp tổng quát",
      "Máy X - quang di động",
      "Máy X - quang C Arm",
    ]

    render(
      <table>
        <tbody>
          {regulatoryNames.map((regulatoryName, index) => {
            const sourceIdentifier = `1${String.fromCharCode(97 + index)}`

            return (
              <DeviceQuotaDraftCatalogItemRow
                key={sourceIdentifier}
                row={{
                  ...makeItem(index + 1, 1),
                  id: sourceIdentifier,
                  sourceIdentifier,
                  sourceLabel: String.fromCharCode(97 + index),
                  name: regulatoryName,
                  displayName: regulatoryName,
                  regulatoryItemId: `regulatory-${sourceIdentifier}`,
                  regulatoryName,
                }}
                isReadOnly={false}
                isMutationPending={false}
                onUpdate={vi.fn()}
                onExclude={vi.fn()}
                onRestore={vi.fn()}
              />
            )
          })}
        </tbody>
      </table>
    )

    for (const [index, regulatoryName] of regulatoryNames.entries()) {
      const sourceIdentifier = `1${String.fromCharCode(97 + index)}`
      const row = screen.getByTestId(`device-quota-catalog-row-${sourceIdentifier}`)

      expect(within(row).getByText(regulatoryName)).toBeInTheDocument()
      await user.click(
        within(row).getByRole("button", { name: `Chỉnh tên hiển thị ${regulatoryName}` })
      )
      expect(
        within(row).getByRole("textbox", { name: `Tên hiển thị - ${regulatoryName}` })
      ).toBeInTheDocument()
    }
  })

  it("renders immutable source cells, complete rules, and the three draft fields", () => {
    renderItem()

    const row = screen.getByTestId("device-quota-catalog-row-item-1")
    expect(within(row).getByText("1.1")).toBeInTheDocument()
    expect(within(row).getByText("Thiết bị 1")).toBeInTheDocument()
    expect(within(row).getByText("Máy", { selector: "[data-source-unit]" })).toBeInTheDocument()
    expect(within(row).getByText("Tối thiểu 01 máy")).toBeInTheDocument()
    expect(within(row).getByText("Tối đa 02 máy")).toBeInTheDocument()
    expect(
      within(row).getByRole("textbox", { name: "ĐVT áp dụng - Thiết bị 1" })
    ).toBeInTheDocument()
    expect(
      within(row).getByRole("spinbutton", { name: "SL đề xuất - Thiết bị 1" })
    ).toBeInTheDocument()
    expect(within(row).getByRole("textbox", { name: "Ghi chú - Thiết bị 1" })).toBeInTheDocument()
    expect(within(row).queryByRole("textbox", { name: /Chủng loại/ })).not.toBeInTheDocument()
  })

  it("keeps source metadata and rule disclosures accessible", async () => {
    const user = userEvent.setup()
    renderItem()
    const row = screen.getByTestId("device-quota-catalog-row-item-1")

    await user.click(within(row).getByRole("button", { name: "Xem nguồn Thiết bị 1" }))
    expect(within(row).getByTestId("device-quota-source-details-item-1")).toBeInTheDocument()
    await user.click(within(row).getByRole("button", { name: "Xem quy tắc Thiết bị 1" }))
    expect(within(row).getAllByText("Tối thiểu 01 máy")).toHaveLength(2)
  })

  it("preserves exclude and restore callbacks without putting the item name in button text", async () => {
    const user = userEvent.setup()
    const onExclude = vi.fn()
    const onRestore = vi.fn()
    const { rerender, props } = renderItem({ onExclude, onRestore })

    const excludeButton = screen.getByRole("button", { name: "Loại khỏi bản nháp Thiết bị 1" })
    expect(excludeButton).not.toHaveTextContent("Thiết bị 1")
    await user.click(excludeButton)
    expect(onExclude).toHaveBeenCalledWith("item-1")

    rerender(
      <table>
        <tbody>
          <DeviceQuotaDraftCatalogItemRow
            {...props}
            row={{ ...makeItem(1, 1), isExcluded: true, completeness: "excluded" }}
          />
        </tbody>
      </table>
    )
    const restoreButton = screen.getByRole("button", { name: "Khôi phục Thiết bị 1" })
    expect(restoreButton).not.toHaveTextContent("Thiết bị 1")
    expect(screen.getByText("Đã loại khỏi bản nháp")).toBeInTheDocument()
    await user.click(restoreButton)
    expect(onRestore).toHaveBeenCalledWith("item-1")
  })
})
