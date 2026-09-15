import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import NotificationsPage from "../page"
import {
  mocks,
  mount,
  publicKey,
  pushRegistration,
  pushSubscriptionJson,
  resetNotificationTestState,
  response,
  rotatedPublicKey,
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

describe("NotificationsPage Web Push opt-in", () => {
  it("waits for a user gesture, reuses the existing worker, and registers subscription material", async () => {
    const { serviceWorker, subscribe } = pushRegistration()
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
      if (init?.method === "POST")
        return Promise.resolve(
          response({
            version: 1,
            subscription_id: "00000000-0000-4000-8000-000000000001",
            revision: "1",
          })
        )
      return Promise.resolve(response({ version: 1, don_vi_id: "7", candidates: [] }))
    })
    const user = userEvent.setup()
    mount()

    await waitFor(() => expect(screen.getByRole("button", { name: "Bật thông báo" })).toBeEnabled())
    expect(mocks.requestPermission).not.toHaveBeenCalled()
    expect(
      mocks.fetch.mock.calls.filter(([url]) => String(url).includes("/public-key"))
    ).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: "Bật thông báo" }))

    await screen.findByText("Thông báo đã bật trên trình duyệt.")
    expect(mocks.requestPermission).toHaveBeenCalledTimes(1)
    expect(serviceWorker.register).not.toHaveBeenCalled()
    expect(serviceWorker.getRegistration).not.toHaveBeenCalled()
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    })
    const put = mocks.fetch.mock.calls.find(([, init]) => init?.method === "POST")
    expect(JSON.parse(put?.[1].body)).toEqual({
      version: 1,
      vapid_key_version: "test-v1",
      subscription: pushSubscriptionJson,
    })
    expect(JSON.parse(put?.[1].body)).not.toHaveProperty("user_id")
  })

  it("shows accessible loading feedback while permission and subscription are pending", async () => {
    pushRegistration()
    let resolvePermission!: (value: NotificationPermission) => void
    mocks.requestPermission.mockReturnValue(
      new Promise<NotificationPermission>((resolve) => {
        resolvePermission = resolve
      })
    )
    mocks.fetch.mockResolvedValue(
      response({
        version: 1,
        registration_enabled: true,
        vapid: { version: "test-v1", public_key: publicKey, fingerprint: "sha256:test" },
      })
    )
    const user = userEvent.setup()
    mount()

    await waitFor(() => expect(screen.getByRole("button", { name: "Bật thông báo" })).toBeEnabled())
    await user.click(screen.getByRole("button", { name: "Bật thông báo" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Đang chuẩn bị đăng ký")
    expect(screen.getByRole("button", { name: "Đang bật thông báo" })).toBeDisabled()
    resolvePermission("denied")
    await screen.findByText("Thông báo bị chặn trong trình duyệt.")
  })

  it("cancels a pending registration and does not send it after permission resolves", async () => {
    pushRegistration()
    let resolvePermission!: (value: NotificationPermission) => void
    mocks.requestPermission.mockReturnValue(
      new Promise<NotificationPermission>((resolve) => {
        resolvePermission = resolve
      })
    )
    mocks.fetch.mockResolvedValue(
      response({
        version: 1,
        registration_enabled: true,
        vapid: { version: "test-v1", public_key: publicKey, fingerprint: "sha256:test" },
      })
    )
    const user = userEvent.setup()
    mount()

    await waitFor(() => expect(screen.getByRole("button", { name: "Bật thông báo" })).toBeEnabled())
    await user.click(screen.getByRole("button", { name: "Bật thông báo" }))
    await screen.findByRole("button", { name: "Hủy thao tác" })

    await user.click(screen.getByRole("button", { name: "Hủy thao tác" }))
    expect(await screen.findByText("Đã hủy thao tác đăng ký thông báo.")).toBeInTheDocument()

    resolvePermission("granted")
    await waitFor(() => {
      expect(mocks.fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false)
    })
  })

  it("does not prompt when registration is disabled by the server", async () => {
    pushRegistration()
    mocks.fetch.mockResolvedValue(
      response({ version: 1, registration_enabled: false, vapid: null })
    )
    mount()

    await screen.findByText("Đăng ký thông báo đang tạm tắt.")
    expect(screen.getByRole("button", { name: "Bật thông báo" })).toBeDisabled()
    expect(mocks.requestPermission).not.toHaveBeenCalled()
  })

  it("explains denied permission without prompting again", async () => {
    const { serviceWorker } = pushRegistration()
    Object.defineProperty(Notification, "permission", { configurable: true, value: "denied" })
    mount()

    expect(await screen.findByText("Thông báo bị chặn trong trình duyệt.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Bật thông báo" })).toBeDisabled()
    expect(mocks.requestPermission).not.toHaveBeenCalled()
    expect(serviceWorker.register).not.toHaveBeenCalled()
  })

  it("shows the unsupported state without changing the rest of the app", async () => {
    vi.stubGlobal("Notification", undefined)
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: undefined })
    mount()

    expect(
      await screen.findByText("Trình duyệt này chưa hỗ trợ thông báo Web Push.")
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Cài đặt nhận thông báo" })).toBeInTheDocument()
  })

  it("requires an explicit resubscribe when the public key version changes", async () => {
    const { subscribe, subscription, getSubscription } = pushRegistration()
    getSubscription.mockResolvedValue(subscription)
    mocks.requestPermission.mockResolvedValue("granted")
    let publicKeyReads = 0
    let postCount = 0
    mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/public-key")) {
        publicKeyReads += 1
        return Promise.resolve(
          response({
            version: 1,
            registration_enabled: true,
            vapid: {
              version: publicKeyReads === 1 ? "test-v1" : "rotated-v2",
              public_key: publicKeyReads === 1 ? publicKey : rotatedPublicKey,
              fingerprint: "sha256:test",
            },
          })
        )
      }
      if (init?.method === "POST") {
        postCount += 1
        return Promise.resolve(
          postCount === 1
            ? response({ version: 1, error: { code: "key_version_mismatch" } }, 409)
            : response({
                version: 1,
                subscription_id: "00000000-0000-4000-8000-000000000002",
                revision: "2",
              })
        )
      }
      return Promise.resolve(response({ version: 1, don_vi_id: "7", candidates: [] }))
    })
    const user = userEvent.setup()
    mount()

    await waitFor(() => expect(screen.getByRole("button", { name: "Bật thông báo" })).toBeEnabled())
    await user.click(screen.getByRole("button", { name: "Bật thông báo" }))
    await screen.findByText("Cần đăng ký lại thông báo để dùng khóa bảo mật mới.")
    expect(screen.getByRole("button", { name: "Đăng ký lại thông báo" })).toBeInTheDocument()
    expect(mocks.requestPermission).toHaveBeenCalledTimes(1)
    expect(publicKeyReads).toBe(2)

    Object.defineProperty(Notification, "permission", { configurable: true, value: "granted" })
    await user.click(screen.getByRole("button", { name: "Đăng ký lại thông báo" }))
    await screen.findByText("Thông báo đã bật trên trình duyệt.")
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(postCount).toBe(2)
    expect(JSON.parse(mocks.fetch.mock.calls.at(-1)?.[1].body)).toMatchObject({
      vapid_key_version: "rotated-v2",
    })
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    })
  })

  it("offers a preflight retry before asking for notification permission", async () => {
    pushRegistration()
    mocks.requestPermission.mockResolvedValue("granted")
    let publicKeyReads = 0
    mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/public-key")) {
        publicKeyReads += 1
        return Promise.resolve(
          publicKeyReads === 1
            ? response({ version: 1, error: { code: "request_failed" } }, 503)
            : response({
                version: 1,
                registration_enabled: true,
                vapid: { version: "test-v1", public_key: publicKey, fingerprint: "sha256:test" },
              })
        )
      }
      if (init?.method === "POST")
        return Promise.resolve(
          response({
            version: 1,
            subscription_id: "00000000-0000-4000-8000-000000000001",
            revision: "1",
          })
        )
      return Promise.resolve(response({ version: 1, don_vi_id: "7", candidates: [] }))
    })
    const user = userEvent.setup()
    mount()

    await screen.findByText("Không thể bật thông báo trên trình duyệt. Vui lòng thử lại.")
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeEnabled()
    expect(mocks.requestPermission).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Thử lại" }))
    await screen.findByText("Thông báo đang tắt trên trình duyệt này.")
    expect(publicKeyReads).toBe(2)
    expect(mocks.requestPermission).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Bật thông báo" }))
    await screen.findByText("Thông báo đã bật trên trình duyệt.")
    expect(mocks.requestPermission).toHaveBeenCalledTimes(1)
  })

  it("bounds registration retries and labels an unresolved request unconfirmed", async () => {
    pushRegistration()
    mocks.requestPermission.mockResolvedValue("granted")
    let postCount = 0
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
        postCount += 1
        return Promise.reject(new TypeError("network unavailable"))
      }
      return Promise.resolve(response({ version: 1, don_vi_id: "7", candidates: [] }))
    })
    const user = userEvent.setup()
    mount()

    await waitFor(() => expect(screen.getByRole("button", { name: "Bật thông báo" })).toBeEnabled())
    await user.click(screen.getByRole("button", { name: "Bật thông báo" }))
    expect(
      await screen.findByText(/Yêu cầu đã gửi nhưng chưa xác nhận trên máy chủ\./)
    ).toBeInTheDocument()
    expect(postCount).toBe(2)

    await user.click(screen.getByRole("button", { name: "Thử lại" }))
    await screen.findByText(/Yêu cầu đã gửi nhưng chưa xác nhận trên máy chủ\./)
    expect(postCount).toBe(4)
    await user.click(screen.getByRole("button", { name: "Thử lại" }))
    await screen.findByText(/Yêu cầu đã gửi nhưng chưa xác nhận trên máy chủ\./)
    expect(postCount).toBe(6)
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeDisabled()
  })

  it("rehydrates an enabled browser subscription after a reload", async () => {
    const { getSubscription, subscription } = pushRegistration()
    getSubscription.mockResolvedValue(subscription)
    storeSubscription()
    mocks.fetch.mockImplementation((input: RequestInfo | URL) =>
      String(input).includes("/public-key")
        ? Promise.resolve(
            response({
              version: 1,
              registration_enabled: true,
              vapid: { version: "test-v1", public_key: publicKey, fingerprint: "sha256:test" },
            })
          )
        : Promise.resolve(response({ version: 1, don_vi_id: "7", candidates: [] }))
    )
    const view = mount()
    await screen.findByText("Thông báo đã bật trên trình duyệt.")
    view.unmount()
    mount()

    expect(await screen.findByText("Thông báo đã bật trên trình duyệt.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tắt thông báo" })).toBeEnabled()
  })

  it("revokes the exact stored subscription revision before disabling this browser", async () => {
    const { getSubscription, subscription } = pushRegistration()
    getSubscription.mockResolvedValue(subscription)
    storeSubscription("99", {
      subscriptionId: "00000000-0000-4000-8000-000000000009",
      revision: "17",
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
      if (init?.method === "POST") return Promise.resolve(response({ version: 1, revoked: true }))
      return Promise.resolve(response({ version: 1, don_vi_id: "7", candidates: [] }))
    })
    const user = userEvent.setup()
    mount()

    await screen.findByText("Thông báo đã bật trên trình duyệt.")
    await user.click(screen.getByRole("button", { name: "Tắt thông báo" }))
    await screen.findByText("Thông báo đang tắt trên trình duyệt này.")

    const revoke = mocks.fetch.mock.calls.find(
      ([input, init]) => String(input).includes("/subscriptions/revoke") && init?.method === "POST"
    )
    expect(JSON.parse(revoke?.[1].body)).toEqual({
      version: 1,
      subscription_id: "00000000-0000-4000-8000-000000000009",
      revision: "17",
    })
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it("switches owners without sending the previous owner to revoke or register", async () => {
    const { getSubscription, subscription } = pushRegistration()
    let subscribed = true
    getSubscription.mockImplementation(async () => (subscribed ? subscription : null))
    subscription.unsubscribe.mockImplementation(async () => {
      subscribed = false
      return true
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
    await screen.findByText("Thông báo đang tắt trên trình duyệt này.")
    await user.click(screen.getByRole("button", { name: "Bật thông báo" }))
    await screen.findByText("Thông báo đã bật trên trình duyệt.")

    const revokeCalls = mocks.fetch.mock.calls.filter(([input]) =>
      String(input).includes("/subscriptions/revoke")
    )
    expect(revokeCalls).toHaveLength(0)
    const posts = mocks.fetch.mock.calls.filter(([, init]) => init?.method === "POST")
    expect(JSON.parse(posts.at(-1)?.[1].body)).not.toHaveProperty("owner_id")
  })
})
