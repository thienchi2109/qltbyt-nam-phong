import { render } from "@testing-library/react"
import { vi } from "vitest"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import NotificationsPage from "../page"

export const mocks = {
  session: vi.fn(),
  tenant: vi.fn(),
  fetch: vi.fn(),
  requestPermission: vi.fn(),
}

export const publicKey =
  "BOSMYXSPeNZ9sdxrNwdifOTNnjj4RRrdT8bLFrCvlSZHid8-VorFDh0Zv9miRlFh9Xy-cdEz_5ZUWKHnau7DdzY"
export const rotatedPublicKey = `${publicKey.slice(0, -1)}Z`
export const pushSubscriptionJson = {
  endpoint: "https://push.example.test/subscription",
  keys: { p256dh: publicKey, auth: "AAAAAAAAAAAAAAAAAAAAAA" },
}

export const response = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status })

export function pushRegistration() {
  vi.stubGlobal("PushManager", class PushManager {})
  const subscription = {
    endpoint: pushSubscriptionJson.endpoint,
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

export function session(role = "user", id = "99") {
  mocks.session.mockReturnValue({
    status: "authenticated",
    data: { user: { id, role, don_vi: 4, current_don_vi: 7 } },
  })
}

export function mount() {
  const client = createTestQueryClient()
  return render(<NotificationsPage />, { wrapper: createReactQueryWrapper(client) })
}

export function storeSubscription(ownerId = "99", overrides: Record<string, unknown> = {}) {
  window.localStorage.setItem(
    `qltbyt:web-push:subscription:${encodeURIComponent(ownerId)}`,
    JSON.stringify({
      version: 1,
      ownerId,
      vapidKeyVersion: "test-v1",
      status: "enabled",
      endpoint: pushSubscriptionJson.endpoint,
      subscriptionId: "00000000-0000-4000-8000-000000000001",
      revision: "1",
      ...overrides,
    })
  )
}

export function resetNotificationTestState() {
  vi.clearAllMocks()
  window.localStorage.clear()
  session()
  mocks.tenant.mockReturnValue({ selectedFacilityId: 7, showSelector: true })
  vi.stubGlobal("fetch", mocks.fetch)
  mocks.fetch.mockResolvedValue(response({ version: 1, don_vi_id: "7", candidates: [] }))
}
