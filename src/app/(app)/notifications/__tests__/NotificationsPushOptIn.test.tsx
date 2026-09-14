import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import NotificationsPage from "../page"

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  tenant: vi.fn(),
  fetch: vi.fn(),
  requestPermission: vi.fn(),
}))
vi.mock("next-auth/react", () => ({ useSession: () => mocks.session() }))
vi.mock("@/contexts/TenantSelectionContext", () => ({ useTenantSelection: () => mocks.tenant() }))
vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => <button>Đơn vị mục tiêu</button>,
}))

const publicKey =
  "BOSMYXSPeNZ9sdxrNwdifOTNnjj4RRrdT8bLFrCvlSZHid8-VorFDh0Zv9miRlFh9Xy-cdEz_5ZUWKHnau7DdzY"
const rotatedPublicKey = `${publicKey.slice(0, -1)}Z`
const pushSubscriptionJson = {
  endpoint: "https://push.example.test/subscription",
  keys: { p256dh: publicKey, auth: "AAAAAAAAAAAAAAAAAAAAAA" },
}
const response = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status })

function pushRegistration() {
  vi.stubGlobal("PushManager", class PushManager {})
  const subscription = {
    toJSON: () => pushSubscriptionJson,
    unsubscribe: vi.fn().mockResolvedValue(true),
  }
  const subscribe = vi.fn().mockResolvedValue(subscription)
  const getSubscription = vi.fn().mockResolvedValue(null)
  const registration = {
    pushManager: { getSubscription, subscribe },
  }
  const serviceWorker = {
    ready: Promise.resolve(registration),
    register: vi.fn(),
    getRegistration: vi.fn().mockResolvedValue(registration),
  }
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorker,
  })
  vi.stubGlobal("Notification", {
    permission: "default",
    requestPermission: mocks.requestPermission,
  })
  return { registration, serviceWorker, subscribe, subscription, getSubscription }
}

function session(role = "user") {
  mocks.session.mockReturnValue({
    status: "authenticated",
    data: { user: { id: "99", role, don_vi: 4, current_don_vi: 7 } },
  })
}

function mount() {
  const client = createTestQueryClient()
  return render(<NotificationsPage />, { wrapper: createReactQueryWrapper(client) })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  session()
  mocks.tenant.mockReturnValue({ selectedFacilityId: 7, showSelector: true })
  vi.stubGlobal("fetch", mocks.fetch)
  mocks.fetch.mockResolvedValue(response({ version: 1, don_vi_id: "7", candidates: [] }))
})

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
        return Promise.resolve(response({ version: 1, subscription_id: "sub-1", revision: "1" }))
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
            : response({ version: 1, subscription_id: "sub-2", revision: "2" })
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
        return Promise.resolve(response({ version: 1, subscription_id: "sub-1" }))
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
