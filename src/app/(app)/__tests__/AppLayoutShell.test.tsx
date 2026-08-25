import "@testing-library/jest-dom"
import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  getAppLayoutShellMocks,
  resetAppLayoutShellMocks,
} from "@/app/(app)/__tests__/AppLayoutShellTestHarness"
import { AppLayoutShell } from "@/app/(app)/_components/AppLayoutShell"

describe("AppLayoutShell", () => {
  const mocks = getAppLayoutShellMocks()

  beforeEach(() => {
    resetAppLayoutShellMocks()
  })

  it("defers the change-password dialog until the avatar menu action completes", () => {
    vi.useFakeTimers()

    try {
      render(
        <AppLayoutShell
          user={{
            role: "global",
            full_name: "Test User",
            username: "tester",
            khoa_phong: "IT",
          }}
        >
          <div>Child Content</div>
        </AppLayoutShell>
      )

      fireEvent.click(screen.getByRole("button", { name: /thay đổi mật khẩu/i }))

      expect(screen.queryByTestId("change-password-dialog")).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(0)
      })

      expect(screen.getByTestId("change-password-dialog")).toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "Hủy" }))

      expect(screen.queryByTestId("change-password-dialog")).not.toBeInTheDocument()
      expect(document.body.style.pointerEvents).not.toBe("none")
    } finally {
      vi.useRealTimers()
    }
  })

  it("scopes notification counts to the selected facility", () => {
    mocks.useTenantSelection.mockReturnValue({
      selectedFacilityId: 21,
      shouldFetchData: true,
    })

    render(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    expect(mocks.useAppNotificationCounts).toHaveBeenCalledWith({
      enabled: true,
      facilityId: 21,
    })
  })

  it("keeps notification bootstrap disabled while session hydration is still loading", () => {
    mocks.useSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "loading",
      update: mocks.updateSession,
    })

    render(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    expect(mocks.useAppNotificationCounts).toHaveBeenCalledWith({
      enabled: false,
      facilityId: null,
    })
  })

  it("persists a user-initiated signout reason before signing out from the user menu", async () => {
    const user = userEvent.setup()

    render(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    await user.click(screen.getByRole("button", { name: /đăng xuất/i }))

    expect(mocks.clearAllEquipmentFilters).toHaveBeenCalledTimes(1)
    expect(mocks.updateSession).toHaveBeenCalledWith({
      pending_signout_reason: "user_initiated",
    })
    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" })
    expect(mocks.clearAllEquipmentFilters.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.updateSession.mock.invocationCallOrder[0]
    )
    expect(mocks.updateSession.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0]
    )
  })

  it("allows retrying user-menu signout after a signOut failure", async () => {
    const user = userEvent.setup()
    mocks.signOut
      .mockRejectedValueOnce(new Error("redirect failed"))
      .mockResolvedValueOnce(undefined)

    render(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    const signOutButton = screen.getByRole("button", { name: /đăng xuất/i })

    await user.click(signOutButton)
    await vi.waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledTimes(1)
    })

    const retrySignOutButton = await screen.findByRole("button", { name: /đăng xuất/i })

    await user.click(retrySignOutButton)
    await vi.waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledTimes(2)
    })
  })

  it("hides protected content immediately while user-menu signout redirect is pending", async () => {
    const user = userEvent.setup()

    render(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    await user.click(screen.getByRole("button", { name: /đăng xuất/i }))

    expect(screen.queryByText("Child Content")).not.toBeInTheDocument()
    expect(screen.getByTestId("authenticated-page-spinner-fallback")).toBeInTheDocument()
  })

  it("hides the stale app shell immediately while user-menu signout redirect is pending", async () => {
    const user = userEvent.setup()

    render(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    await user.click(screen.getByRole("button", { name: /đăng xuất/i }))

    expect(screen.queryByText("CDC")).not.toBeInTheDocument()
    expect(screen.queryByText("Test User")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /đăng xuất/i })).not.toBeInTheDocument()
    expect(screen.getByTestId("authenticated-page-spinner-fallback")).toBeInTheDocument()
  })

  it("redirects through signOut when the session becomes unauthenticated", () => {
    const sessionState = {
      data: { user: { id: "u1" } },
      status: "authenticated",
    }
    mocks.useSession.mockImplementation(() => sessionState)

    const { rerender } = render(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    vi.clearAllMocks()

    sessionState.data = null
    sessionState.status = "unauthenticated"

    rerender(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    expect(mocks.clearAllEquipmentFilters).toHaveBeenCalledTimes(1)
    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" })
    expect(mocks.clearAllEquipmentFilters.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0]
    )
  })

  it("does not trigger signOut twice for the same session-exit path", async () => {
    const user = userEvent.setup()

    const sessionState = {
      data: { user: { id: "u1" } },
      status: "authenticated",
    }
    mocks.useSession.mockImplementation(() => sessionState)

    const { rerender } = render(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    await user.click(screen.getByRole("button", { name: /đăng xuất/i }))

    expect(mocks.signOut).toHaveBeenCalledTimes(1)

    sessionState.data = null
    sessionState.status = "unauthenticated"

    rerender(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    expect(mocks.clearAllEquipmentFilters).toHaveBeenCalledTimes(1)
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
  })

  it("keeps a header skeleton while tenant branding is loading", () => {
    mocks.useTenantBranding.mockReturnValue({
      isLoading: true,
      data: null,
    })

    render(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    expect(screen.getAllByTestId("skeleton")).toHaveLength(3)
    expect(screen.queryByText("CVMEMS")).not.toBeInTheDocument()
  })

  it("removes the mobile offcanvas navigation while keeping bottom and desktop navigation", () => {
    render(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    expect(
      screen.queryByRole("button", { name: /toggle navigation menu/i })
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("mobile-footer-nav")).toBeInTheDocument()

    const desktopSidebarTrigger = screen.getByRole("button", { name: /toggle sidebar/i })

    expect(desktopSidebarTrigger).toHaveClass("hidden", "shrink-0", "touch-target", "lg:flex")
  })

  it("keeps the equipment search aligned inside the right header action cluster", () => {
    render(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    const headerActions = screen.getByTestId("app-header-actions")

    expect(headerActions).toHaveClass("ml-auto", "shrink-0")
    expect(headerActions).toContainElement(
      screen.getByRole("searchbox", { name: /tìm kiếm thiết bị/i })
    )
  })
})
