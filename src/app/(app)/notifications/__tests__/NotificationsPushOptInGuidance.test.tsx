import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  mocks,
  mount,
  publicKey,
  pushRegistration,
  resetNotificationTestState,
  response,
} from "./NotificationsPushOptInTestUtils"

vi.mock("next-auth/react", () => ({ useSession: () => mocks.session() }))
vi.mock("@/contexts/TenantSelectionContext", () => ({ useTenantSelection: () => mocks.tenant() }))
vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => <button>Đơn vị mục tiêu</button>,
}))

beforeEach(resetNotificationTestState)
afterEach(() => vi.unstubAllGlobals())

describe("NotificationsPage guidance", () => {
  it("shows lock-screen preview and the iPhone/iPad Home Screen guide", async () => {
    pushRegistration()
    mocks.fetch.mockResolvedValue(
      response({
        version: 1,
        registration_enabled: true,
        vapid: { version: "test-v1", public_key: publicKey, fingerprint: "sha256:test" },
      })
    )
    const user = userEvent.setup()
    mount()

    await screen.findByText("Thông báo đang tắt trên trình duyệt này.")
    expect(screen.getByRole("heading", { name: "Cài đặt nhận thông báo" })).toHaveClass(
      "text-[28px]"
    )
    expect(screen.getByRole("button", { name: "Bật thông báo" })).toHaveClass("text-sm")
    expect(
      screen.getByLabelText("Xem trước thông báo trên màn hình khóa").querySelector("svg")
    ).toHaveClass("size-6")
    expect(screen.getByText("Nội dung có thể xuất hiện trên màn hình khóa")).toBeInTheDocument()
    expect(screen.getByText("Thiết bị cần xử lý")).toBeInTheDocument()
    const guide = screen.getByText("Dùng iPhone hoặc iPad?").closest("summary")
    expect(guide).not.toBeNull()
    const details = guide?.parentElement
    expect(details).not.toHaveAttribute("open")
    expect(details).toHaveTextContent(/iOS\/iPadOS.*16\.4 trở lên/i)
    expect(details).toHaveTextContent(/không tự cấp quyền thông báo/i)
    expect(details).toHaveTextContent(/Thêm vào Màn hình chính/i)
    expect(screen.getByText(/có thể rút gọn nội dung/i)).toBeInTheDocument()
    await user.click(guide as HTMLElement)
    expect(details).toHaveAttribute("open")
  })
})
