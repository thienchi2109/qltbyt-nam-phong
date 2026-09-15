import { parseWebPushNotificationPayload, sameOriginRepairRequestUrl } from "./worker-payload"

type PushEventLike = {
  data?: { json: () => unknown } | null
}

type NotificationClickEventLike = {
  notification: { data?: unknown; close: () => void }
}

type WorkerClient = {
  url: string
  focus: () => Promise<unknown>
  navigate: (url: string) => Promise<unknown>
}

export type WorkerScope = {
  location: { origin: string }
  registration: {
    showNotification: (
      title: string,
      options: { body: string; tag: string; data: { url: string } }
    ) => Promise<unknown>
  }
  clients: {
    matchAll: (options: {
      type: "window"
      includeUncontrolled: boolean
    }) => Promise<readonly WorkerClient[]>
    openWindow: (url: string) => Promise<unknown>
  }
}

/** Displays only validated text from the server payload in the service worker. */
export async function handlePush(event: PushEventLike, worker: WorkerScope): Promise<void> {
  if (!event.data) return

  let raw: unknown
  try {
    raw = event.data.json()
  } catch {
    return
  }
  const payload = parseWebPushNotificationPayload(raw)
  if (!payload) return

  await worker.registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    data: { url: payload.url },
  })
}

/** Opens a validated same-origin repair request through the current auth boundary. */
export async function handleNotificationClick(
  event: NotificationClickEventLike,
  worker: WorkerScope
): Promise<void> {
  event.notification.close()
  const data = event.notification.data
  const rawUrl =
    typeof data === "object" && data !== null && "url" in data && typeof data.url === "string"
      ? data.url
      : null
  if (!rawUrl) return

  const targetUrl = sameOriginRepairRequestUrl(rawUrl, worker.location.origin)
  if (!targetUrl) return

  const clients = await worker.clients.matchAll({ type: "window", includeUncontrolled: true })
  const client = clients.find((candidate) => {
    try {
      return new URL(candidate.url).origin === worker.location.origin
    } catch {
      return false
    }
  })

  if (client) {
    await client.navigate(targetUrl)
    await client.focus()
    return
  }

  await worker.clients.openWindow(targetUrl)
}
