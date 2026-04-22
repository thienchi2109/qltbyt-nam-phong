import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
}))

vi.mock("@/components/activity-logs/activity-logs-viewer", () => ({
  ActivityLogsViewer: () => <div data-testid="activity-logs-viewer">Activity Logs Viewer</div>,
}))

import ActivityLogsPage from "../page"

describe("ActivityLogsPage auth wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows the shared spinner while the session is loading", () => {
    mocks.useSession.mockReturnValue({
      status: "loading",
      data: null,
    })

    render(<ActivityLogsPage />)

    expect(screen.getByTestId("authenticated-page-spinner-fallback")).toBeInTheDocument()
    expect(screen.queryByTestId("activity-logs-viewer")).not.toBeInTheDocument()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("shows the shared spinner without redirecting when unauthenticated", () => {
    mocks.useSession.mockReturnValue({
      status: "unauthenticated",
      data: null,
    })

    render(<ActivityLogsPage />)

    expect(screen.getByTestId("authenticated-page-spinner-fallback")).toBeInTheDocument()
    expect(screen.queryByTestId("activity-logs-viewer")).not.toBeInTheDocument()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("shows the restricted access message for non-global users", () => {
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: {
        user: {
          id: "user-1",
          username: "regular-user",
          role: "to_qltb",
        },
      },
    })

    render(<ActivityLogsPage />)

    expect(screen.getByText("Truy cập bị hạn chế")).toBeInTheDocument()
    expect(screen.queryByTestId("activity-logs-viewer")).not.toBeInTheDocument()
    expect(screen.queryByTestId("authenticated-page-spinner-fallback")).not.toBeInTheDocument()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("renders the activity logs viewer for global users", () => {
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: {
        user: {
          id: "user-1",
          username: "global-admin",
          role: "admin",
        },
      },
    })

    render(<ActivityLogsPage />)

    expect(screen.getByTestId("activity-logs-viewer")).toBeInTheDocument()
    expect(screen.getByText("Nhật ký hoạt động")).toBeInTheDocument()
    expect(screen.getByText(/Phiên của bạn:/)).toHaveTextContent("global-admin")
    expect(screen.queryByTestId("authenticated-page-spinner-fallback")).not.toBeInTheDocument()
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
