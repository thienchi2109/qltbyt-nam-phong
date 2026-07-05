import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PlusCircle } from "lucide-react"
import { describe, expect, it, vi } from "vitest"

import { AppMobileFloatingActions } from "../_components/AppMobileFloatingActions"
import {
  MobileFloatingActionsProvider,
  usePageFloatingAction,
} from "@/components/shared/floating-actions"

vi.mock("@/components/assistant/AssistantTriggerButton", () => ({
  AssistantTriggerButton: ({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) => (
    <button
      type="button"
      aria-label={isOpen ? "Đóng trợ lý" : "Trợ lý AI"}
      data-testid="assistant-trigger-button"
      onClick={onToggle}
    />
  ),
}))

vi.mock("@/components/shared/floating-actions/MobileFloatingActionMenu", () => ({
  MobileFloatingActionMenu: ({
    actions,
  }: {
    actions: Array<{ id: string; label: string; onSelect: () => void }>
  }) => (
    <div data-testid="mobile-floating-action-menu">
      {actions.map((action) => (
        <button type="button" key={action.id} onClick={action.onSelect}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}))

function RegisteredPageAction({ onSelect }: { onSelect: () => void }) {
  const action = React.useMemo(
    () => ({
      id: "create-repair-request",
      label: "Tạo yêu cầu",
      icon: <PlusCircle />,
      onSelect,
    }),
    [onSelect]
  )

  usePageFloatingAction(action)

  return null
}

describe("AppMobileFloatingActions", () => {
  it("keeps the standalone assistant trigger when no page action is registered", () => {
    render(
      <MobileFloatingActionsProvider>
        <AppMobileFloatingActions isAssistantOpen={false} onAssistantToggle={vi.fn()} />
      </MobileFloatingActionsProvider>
    )

    expect(screen.getByTestId("assistant-trigger-button")).toBeInTheDocument()
    expect(screen.queryByTestId("mobile-floating-action-menu")).not.toBeInTheDocument()
  })

  it("combines assistant and registered page action into one mobile floating menu", async () => {
    const user = userEvent.setup()
    const toggleAssistant = vi.fn()
    const openCreate = vi.fn()

    render(
      <MobileFloatingActionsProvider>
        <RegisteredPageAction onSelect={openCreate} />
        <AppMobileFloatingActions isAssistantOpen={false} onAssistantToggle={toggleAssistant} />
      </MobileFloatingActionsProvider>
    )

    expect(screen.queryByTestId("assistant-trigger-button")).not.toBeInTheDocument()
    expect(screen.getByTestId("mobile-floating-action-menu")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Trợ lý AI" }))
    await user.click(screen.getByRole("button", { name: "Tạo yêu cầu" }))

    expect(toggleAssistant).toHaveBeenCalledTimes(1)
    expect(openCreate).toHaveBeenCalledTimes(1)
  })
})
