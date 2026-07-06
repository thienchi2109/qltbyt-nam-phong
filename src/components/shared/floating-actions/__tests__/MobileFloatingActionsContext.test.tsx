import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PlusCircle } from "lucide-react"
import { describe, expect, it } from "vitest"

import {
  MobileFloatingActionsProvider,
  useMobileFloatingActions,
  usePageFloatingAction,
} from "../MobileFloatingActionsContext"

function PageActionProbe({ label }: { label: string | null }) {
  const action = React.useMemo(
    () =>
      label
        ? {
            id: "page-action",
            label,
            icon: <PlusCircle />,
            onSelect: () => undefined,
          }
        : null,
    [label]
  )

  usePageFloatingAction(action)

  return null
}

let inlineProbeRenderCount = 0
const inlineProbeIcon = <PlusCircle />
const inlineProbeSelect = () => undefined

function InlinePageActionProbe() {
  inlineProbeRenderCount += 1

  usePageFloatingAction({
    id: "inline-page-action",
    label: "Tạo yêu cầu",
    icon: inlineProbeIcon,
    onSelect: inlineProbeSelect,
  })

  return null
}

function RegisteredActionLabel() {
  const { pageAction } = useMobileFloatingActions()

  return <div data-testid="registered-action">{pageAction?.label ?? "none"}</div>
}

describe("MobileFloatingActionsContext", () => {
  it("lets a page register one floating action for the layout to read", () => {
    render(
      <MobileFloatingActionsProvider>
        <PageActionProbe label="Tạo yêu cầu" />
        <RegisteredActionLabel />
      </MobileFloatingActionsProvider>
    )

    expect(screen.getByTestId("registered-action")).toHaveTextContent("Tạo yêu cầu")
  })

  it("clears the registered action when the page unmounts", async () => {
    const user = userEvent.setup()

    function Harness() {
      const [showPage, setShowPage] = React.useState(true)

      return (
        <MobileFloatingActionsProvider>
          {showPage ? <PageActionProbe label="Tạo yêu cầu" /> : null}
          <RegisteredActionLabel />
          <button type="button" onClick={() => setShowPage(false)}>
            Unmount page
          </button>
        </MobileFloatingActionsProvider>
      )
    }

    render(<Harness />)

    await user.click(screen.getByRole("button", { name: "Unmount page" }))

    expect(screen.getByTestId("registered-action")).toHaveTextContent("none")
  })

  it("replaces the previous descriptor when a page updates its action", async () => {
    const user = userEvent.setup()

    function Harness() {
      const [label, setLabel] = React.useState("Tạo yêu cầu")

      return (
        <MobileFloatingActionsProvider>
          <PageActionProbe label={label} />
          <RegisteredActionLabel />
          <button type="button" onClick={() => setLabel("Tạo phiếu sửa chữa")}>
            Rename action
          </button>
        </MobileFloatingActionsProvider>
      )
    }

    render(<Harness />)

    await user.click(screen.getByRole("button", { name: "Rename action" }))

    expect(screen.getByTestId("registered-action")).toHaveTextContent("Tạo phiếu sửa chữa")
  })

  it("does not rerender the registering page from its own inline action registration", () => {
    inlineProbeRenderCount = 0

    render(
      <MobileFloatingActionsProvider>
        <InlinePageActionProbe />
        <RegisteredActionLabel />
      </MobileFloatingActionsProvider>
    )

    expect(screen.getByTestId("registered-action")).toHaveTextContent("Tạo yêu cầu")
    expect(inlineProbeRenderCount).toBe(1)
  })
})
