import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import NotificationsPage from "../page"
import {
  mocks,
  mount,
  publicKey,
  pushRegistration,
  resetNotificationTestState,
  response,
  session,
  storeSubscription,
} from "./NotificationsPushOptInTestUtils"

vi.mock("next-auth/react", () => ({ useSession: () => mocks.session() }))
vi.mock("@/contexts/TenantSelectionContext", () => ({ useTenantSelection: () => mocks.tenant() }))
vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => <button>Đơn vị mục tiêu</button>,
}))

beforeEach(resetNotificationTestState)
afterEach(() => vi.unstubAllGlobals())

describe("NotificationsPage browser lifecycle", () => {
  it("waits for previous-owner cleanup before registering a new owner", async () => {
    const { getSubscription, subscription } = pushRegistration()
    let subscribed = true
    let resolveUnsubscribe!: (value: boolean) => void
    const unsubscribe = new Promise<boolean>((resolve) => {
      resolveUnsubscribe = resolve
    })
    getSubscription.mockImplementation(async () => (subscribed ? subscription : null))
    subscription.unsubscribe.mockImplementation(async () => {
      const result = await unsubscribe
      subscribed = false
      return result
    })
    storeSubscription("99")
    mocks.requestPermission.mockResolvedValue("granted")
    mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/public-key")) {
        return Promise.resolve(
          response({
            version: 1,
            registration_enabled: true,
            vapid: { version: "test-v1", public_key: publicKey, fingerprint: "sha256:test" },
          })
        )
      }
      if (init?.method === "POST") {
        return Promise.resolve(
          response({
            version: 1,
            subscription_id: "00000000-0000-4000-8000-000000000002",
            revision: "2",
          })
        )
      }
      return Promise.resolve(response({ version: 1, don_vi_id: "7", candidates: [] }))
    })

    const user = userEvent.setup()
    const view = mount()
    await screen.findByText("Thông báo đã bật trên trình duyệt.")

    session("user", "user-b")
    view.rerender(<NotificationsPage />)
    await waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole("button", { name: "Bật thông báo" })).toBeEnabled())

    await user.click(screen.getByRole("button", { name: "Bật thông báo" }))
    expect(mocks.requestPermission).toHaveBeenCalledTimes(1)
    expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0)

    resolveUnsubscribe(true)
    await waitFor(() =>
      expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1)
    )
    expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1)
  })

  it("cancels a pending revoke without allowing its late response to overwrite the UI", async () => {
    const { getSubscription, subscription } = pushRegistration()
    getSubscription.mockResolvedValue(subscription)
    storeSubscription("99", {
      subscriptionId: "00000000-0000-4000-8000-000000000009",
      revision: "17",
    })
    let resolveRevoke!: (value: Response) => void
    const revokeResponse = new Promise<Response>((resolve) => {
      resolveRevoke = resolve
    })
    mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/public-key")) {
        return Promise.resolve(
          response({
            version: 1,
            registration_enabled: true,
            vapid: { version: "test-v1", public_key: publicKey, fingerprint: "sha256:test" },
          })
        )
      }
      if (String(input).includes("/subscriptions/revoke") && init?.method === "POST") {
        return revokeResponse
      }
      return Promise.resolve(response({ version: 1, don_vi_id: "7", candidates: [] }))
    })

    const user = userEvent.setup()
    mount()
    await screen.findByText("Thông báo đã bật trên trình duyệt.")
    await user.click(screen.getByRole("button", { name: "Tắt thông báo" }))
    await screen.findByRole("button", { name: "Hủy thao tác" })
    await user.click(screen.getByRole("button", { name: "Hủy thao tác" }))
    await screen.findByText("Đã hủy thao tác tắt thông báo.")
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeEnabled()

    resolveRevoke(response({ version: 1, revoked: true }))
    await waitFor(() => {
      expect(screen.getByText("Đã hủy thao tác tắt thông báo.")).toBeInTheDocument()
    })
  })
})
