import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import {
  getAppLayoutShellMocks,
  resetAppLayoutShellMocks,
} from "@/app/(app)/__tests__/AppLayoutShellTestHarness"
import { AppLayoutShell } from "@/app/(app)/_components/AppLayoutShell"

const mocks = getAppLayoutShellMocks()

function renderShell(role: string) {
  mocks.useSession.mockReturnValue({
    data: { user: { id: "u1", role, don_vi: 19 } },
    status: "authenticated",
    update: mocks.updateSession,
  })

  return render(
    <AppLayoutShell
      user={{
        role,
        full_name: "Test User",
        username: "tester",
        khoa_phong: "Phòng Kỹ thuật",
      }}
    >
      <div>Technical Configurations workspace</div>
    </AppLayoutShell>
  )
}

describe("AppLayoutShell expert isolation", () => {
  beforeEach(() => {
    resetAppLayoutShellMocks()
    mocks.usePathname.mockReturnValue("/technical-configurations")
  })

  it("keeps only expert shell infrastructure and disables unrelated bootstrap", async () => {
    const user = userEvent.setup()

    renderShell("chuyen_gia")

    expect(mocks.tenantSelectionProviderProps).toHaveBeenLastCalledWith({ enabled: false })
    expect(mocks.useAppNotificationCounts).toHaveBeenCalledWith({
      enabled: false,
      facilityId: null,
    })
    expect(mocks.useTenantBranding).toHaveBeenCalled()
    expect(screen.getAllByText("CDC")).not.toHaveLength(0)
    expect(screen.getByText("Test User")).toBeInTheDocument()
    expect(screen.getByText("Chuyên gia")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /thay đổi mật khẩu/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /đăng xuất/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /cấu hình kỹ thuật/i })).toHaveAttribute(
      "href",
      "/technical-configurations"
    )
    expect(screen.getByTestId("mobile-footer-nav")).toBeInTheDocument()

    expect(screen.queryByRole("searchbox", { name: /tìm kiếm thiết bị/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId("realtime-status")).not.toBeInTheDocument()
    expect(screen.queryByTestId("help-button")).not.toBeInTheDocument()
    expect(screen.queryByTestId("notification-bell")).not.toBeInTheDocument()
    expect(screen.queryByTestId("mobile-floating-actions")).not.toBeInTheDocument()
    expect(screen.queryByTestId("assistant-panel")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /thay đổi mật khẩu/i }))
    expect(screen.getByTestId("change-password-dialog")).toBeInTheDocument()
  })

  it.each(["global", "admin"])("preserves the current %s shell features and requests", (role) => {
    renderShell(role)

    expect(mocks.tenantSelectionProviderProps).toHaveBeenLastCalledWith({ enabled: true })
    expect(mocks.useAppNotificationCounts).toHaveBeenCalledWith({
      enabled: true,
      facilityId: null,
    })
    expect(screen.getByRole("searchbox", { name: /tìm kiếm thiết bị/i })).toBeInTheDocument()
    expect(screen.getByTestId("realtime-status")).toBeInTheDocument()
    expect(screen.getByTestId("help-button")).toBeInTheDocument()
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument()
    expect(screen.getByTestId("mobile-floating-actions")).toBeInTheDocument()
  })
})
