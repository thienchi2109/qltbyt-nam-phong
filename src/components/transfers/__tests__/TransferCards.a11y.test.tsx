import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { makeTransferItem } from "@/test-utils/transfers-fixtures"
import { TransferCard } from "../TransferCard"
import { TransfersKanbanCard } from "../TransfersKanbanCard"

describe("transfer cards accessibility", () => {
  it("opens the transfer card with keyboard activation", async () => {
    const user = userEvent.setup()
    const transfer = makeTransferItem({ ma_yeu_cau: "LC-A11Y-1" })
    const onClick = vi.fn()

    render(<TransferCard transfer={transfer} onClick={onClick} />)

    const card = screen.getByRole("button", { name: /LC-A11Y-1/ })
    await user.tab()
    expect(card).toHaveFocus()

    await user.keyboard("{Enter}")
    expect(onClick).toHaveBeenCalledWith(transfer)

    await user.keyboard(" ")
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it("does not open the transfer card from action controls", async () => {
    const user = userEvent.setup()
    const transfer = makeTransferItem({ ma_yeu_cau: "LC-A11Y-2" })
    const onClick = vi.fn()
    const onAction = vi.fn()

    render(
      <TransferCard
        transfer={transfer}
        onClick={onClick}
        actions={<button type="button" onClick={onAction}>Action</button>}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Action" }))

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })

  it("opens the kanban card with keyboard activation", async () => {
    const user = userEvent.setup()
    const transfer = makeTransferItem({ ma_yeu_cau: "LC-A11Y-3" })
    const onClick = vi.fn()

    render(<TransfersKanbanCard transfer={transfer} onClick={onClick} />)

    const card = screen.getByRole("button", { name: /LC-A11Y-3/ })
    card.focus()

    await user.keyboard("{Enter}")
    expect(onClick).toHaveBeenCalledWith(transfer)

    await user.keyboard(" ")
    expect(onClick).toHaveBeenCalledTimes(2)
  })
})
