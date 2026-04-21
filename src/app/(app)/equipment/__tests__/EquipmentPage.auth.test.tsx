import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}))

vi.mock("../_components/EquipmentPageClient", () => ({
  EquipmentPageClient: () => <div data-testid="equipment-page-client">Equipment</div>,
}))

import EquipmentPage from "../page"

describe("EquipmentPage auth wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("React", React)
  })

  it("shows the skeleton fallback without redirecting unauthenticated users", () => {
    mocks.useSession.mockReturnValue({
      status: "unauthenticated",
      data: null,
    })

    render(<EquipmentPage />)

    expect(screen.getByTestId("authenticated-page-skeleton-fallback")).toBeInTheDocument()
    expect(screen.queryByTestId("equipment-page-client")).not.toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("renders the equipment client once the session is authenticated", () => {
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: {
        user: {
          id: "user-1",
          username: "equipment-user",
          role: "global",
        },
      },
    })

    render(<EquipmentPage />)

    expect(screen.getByTestId("equipment-page-client")).toHaveTextContent("Equipment")
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
