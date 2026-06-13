import * as React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { MobileCompactCard } from "../MobileCompactCard"

describe("MobileCompactCard", () => {
  function StatusSlot({ label }: { label: string }) {
    return <span>{label}</span>
  }

  it("renders compact card slots", () => {
    render(
      <MobileCompactCard
        eyebrow="TB-042"
        title="Máy X-quang"
        subtitle="CDHA"
        topRight={<span>Hoạt động</span>}
        meta={<span>Tầng 2</span>}
        activationLabel="Xem thiết bị Máy X-quang"
        primaryAction={<button type="button">Báo sửa chữa</button>}
        actions={<button type="button">Thêm</button>}
      >
        <p>Ghi chú card</p>
      </MobileCompactCard>,
    )

    expect(screen.getByText("TB-042")).toBeInTheDocument()
    expect(screen.getByText("Máy X-quang")).toBeInTheDocument()
    expect(screen.getByText("CDHA")).toBeInTheDocument()
    expect(screen.getByText("Hoạt động")).toBeInTheDocument()
    expect(screen.getByText("Tầng 2")).toBeInTheDocument()
    expect(screen.getByText("Ghi chú card")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Báo sửa chữa" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Thêm" })).toBeInTheDocument()
  })

  it("renders typed component slots from their props", () => {
    render(
      <MobileCompactCard
        title="Máy X-quang"
        activationLabel="Xem thiết bị Máy X-quang"
        TopRightComponent={StatusSlot}
        topRightProps={{ label: "Hoạt động" }}
        MetaComponent={StatusSlot}
        metaProps={{ label: "Tầng 2" }}
      />,
    )

    expect(screen.getByText("Hoạt động")).toBeInTheDocument()
    expect(screen.getByText("Tầng 2")).toBeInTheDocument()
  })

  it("does not mark the action zone as presentational or intercept keyboard events", () => {
    const { container } = render(
      <MobileCompactCard
        title="Máy X-quang"
        activationLabel="Xem thiết bị Máy X-quang"
        primaryAction={<button type="button">Duyệt</button>}
      />,
    )

    expect(container.querySelector('[role="presentation"]')).not.toBeInTheDocument()
  })

  it("omits component slots when their props are not provided", () => {
    render(
      <MobileCompactCard
        title="Máy X-quang"
        activationLabel="Xem thiết bị Máy X-quang"
        TopRightComponent={StatusSlot}
        MetaComponent={StatusSlot}
      />,
    )

    expect(screen.queryByText("Hoạt động")).not.toBeInTheDocument()
    expect(screen.queryByText("Tầng 2")).not.toBeInTheDocument()
  })

  it("activates by click and keyboard without nesting card content inside the activation button", async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()

    render(
      <MobileCompactCard
        title="Máy X-quang"
        subtitle="TB-042"
        activationLabel="Xem thiết bị Máy X-quang"
        onActivate={onActivate}
      >
        <p>Nội dung card</p>
      </MobileCompactCard>,
    )

    const activationButton = screen.getByRole("button", {
      name: "Xem thiết bị Máy X-quang",
    })

    await user.click(activationButton)
    expect(onActivate).toHaveBeenCalledTimes(1)

    activationButton.focus()
    await user.keyboard("{Enter}")
    await user.keyboard(" ")
    expect(onActivate).toHaveBeenCalledTimes(3)
    expect(within(activationButton).queryByText("Nội dung card")).not.toBeInTheDocument()
  })

  it("keeps primary and overflow actions from activating the card", async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    const onPrimary = vi.fn()
    const onMenu = vi.fn()

    render(
      <MobileCompactCard
        title="Máy X-quang"
        activationLabel="Xem thiết bị Máy X-quang"
        onActivate={onActivate}
        primaryAction={<button type="button" onClick={onPrimary}>Duyệt</button>}
        actions={<button type="button" onClick={onMenu}>Mở menu</button>}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Duyệt" }))
    await user.click(screen.getByRole("button", { name: "Mở menu" }))

    expect(onPrimary).toHaveBeenCalledTimes(1)
    expect(onMenu).toHaveBeenCalledTimes(1)
    expect(onActivate).not.toHaveBeenCalled()
  })
})
