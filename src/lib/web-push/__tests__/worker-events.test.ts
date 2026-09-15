import { describe, expect, it, vi } from "vitest"

import { handleNotificationClick, handlePush, type WorkerScope } from "../worker-events"

const notificationId = "00000000-0000-4000-8000-000000000001"
const pushPayload = {
  version: 1,
  notification_id: notificationId,
  title: "Thiết bị cần xử lý",
  body: "Khoa Huyết học\nMô tả sự cố",
  url: "/repair-requests?action=view&requestId=42",
  tag: "repair-request:42",
}

function scope() {
  const client = {
    url: "https://app.example/notifications",
    focus: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn().mockResolvedValue(undefined),
  }
  const worker: WorkerScope = {
    location: { origin: "https://app.example" },
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
    clients: {
      matchAll: vi.fn().mockResolvedValue([client]),
      openWindow: vi.fn().mockResolvedValue(undefined),
    },
  }
  return { worker, client }
}

describe("service worker Web Push events", () => {
  it("uses the worker as the sole display path with text-only options", async () => {
    const { worker } = scope()
    const event = { data: { json: () => pushPayload } }

    await handlePush(event, worker)

    expect(worker.registration.showNotification).toHaveBeenCalledOnce()
    expect(worker.registration.showNotification).toHaveBeenCalledWith("Thiết bị cần xử lý", {
      body: "Khoa Huyết học\nMô tả sự cố",
      tag: "repair-request:42",
      data: { url: "/repair-requests?action=view&requestId=42" },
    })
  })

  it("focuses and navigates an existing same-origin client on click", async () => {
    const { worker, client } = scope()
    const notification = { data: { url: pushPayload.url }, close: vi.fn() }

    await handleNotificationClick({ notification }, worker)

    expect(notification.close).toHaveBeenCalledOnce()
    expect(client.navigate).toHaveBeenCalledWith(`https://app.example${pushPayload.url}`)
    expect(client.focus).toHaveBeenCalledOnce()
    expect(worker.clients.openWindow).not.toHaveBeenCalled()
  })

  it("does not open an external URL from untrusted notification data", async () => {
    const { worker } = scope()
    const notification = {
      data: { url: "https://evil.example/phishing" },
      close: vi.fn(),
    }

    await handleNotificationClick({ notification }, worker)

    expect(notification.close).toHaveBeenCalledOnce()
    expect(worker.clients.matchAll).not.toHaveBeenCalled()
    expect(worker.clients.openWindow).not.toHaveBeenCalled()
  })

  it("opens the same-origin deep link when no app window is available", async () => {
    const { worker } = scope()
    worker.clients.matchAll = vi.fn().mockResolvedValue([])
    const notification = { data: { url: pushPayload.url }, close: vi.fn() }

    await handleNotificationClick({ notification }, worker)

    expect(worker.clients.openWindow).toHaveBeenCalledWith(`https://app.example${pushPayload.url}`)
  })
})
