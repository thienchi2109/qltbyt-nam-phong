import "server-only"

import { NextRequest } from "next/server"

import type { SupabaseRpcUser } from "@/lib/ai/server-rpc"

import {
  isValidWebPushSignature,
  WEB_PUSH_KEY_ID_HEADER,
  WEB_PUSH_NONCE_HEADER,
  WEB_PUSH_SIGNATURE_HEADER,
  WEB_PUSH_TIMESTAMP_HEADER,
} from "./wire"
import { callWebPushRpc, WebPushApiError } from "./api"

type WorkerCredential = { keyId: string; secret: string; expiresAt?: number }

const WORKER_USER: SupabaseRpcUser = {
  id: "web-push-worker",
  role: "global",
  don_vi: null,
  current_don_vi: null,
  dia_ban_id: "0",
  khoa_phong: "web-push-worker",
}

function readWorkerCredentials(nowSeconds: number): WorkerCredential[] {
  const credentials: WorkerCredential[] = []
  const currentKeyId = process.env.WEB_PUSH_HMAC_CURRENT_KEY_ID
  const currentSecret = process.env.WEB_PUSH_HMAC_CURRENT_SECRET
  if (currentKeyId && currentSecret)
    credentials.push({ keyId: currentKeyId, secret: currentSecret })
  const previousKeyId = process.env.WEB_PUSH_HMAC_PREVIOUS_KEY_ID
  const previousSecret = process.env.WEB_PUSH_HMAC_PREVIOUS_SECRET
  const previousStarted = process.env.WEB_PUSH_HMAC_PREVIOUS_STARTED_AT
  const previousExpiry = process.env.WEB_PUSH_HMAC_PREVIOUS_EXPIRES_AT
  const startedAt = previousStarted
    ? Number(previousStarted) || Date.parse(previousStarted) / 1000
    : 0
  const expiresAt = previousExpiry ? Number(previousExpiry) || Date.parse(previousExpiry) / 1000 : 0
  if (
    previousKeyId &&
    previousSecret &&
    Number.isFinite(startedAt) &&
    Number.isFinite(expiresAt) &&
    startedAt > 0 &&
    expiresAt === startedAt + 86400 &&
    nowSeconds >= startedAt &&
    expiresAt > nowSeconds &&
    expiresAt - nowSeconds <= 86400
  ) {
    credentials.push({ keyId: previousKeyId, secret: previousSecret, expiresAt })
  }
  return credentials
}

function readConfiguredOrigin(): string {
  const configured = process.env.WEB_PUSH_ORIGIN
  if (!configured) throw new WebPushApiError(503, "unavailable", 60)
  try {
    const url = new URL(configured)
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error("invalid origin")
    }
    return url.origin
  } catch {
    throw new WebPushApiError(503, "unavailable", 60)
  }
}

/** Verifies the origin, path, active HMAC credential, and request signature. */
export function verifyWorkerSignature(
  req: NextRequest,
  rawBody: string,
  expectedPath: string
): { keyId: string; nonce: string } {
  const url = new URL(req.url)
  if (
    req.method !== "POST" ||
    url.origin !== readConfiguredOrigin() ||
    url.pathname !== expectedPath ||
    url.search ||
    url.hash
  ) {
    throw new WebPushApiError(401, "unauthorized")
  }
  const keyId = req.headers.get(WEB_PUSH_KEY_ID_HEADER)
  const timestamp = req.headers.get(WEB_PUSH_TIMESTAMP_HEADER)
  const nonce = req.headers.get(WEB_PUSH_NONCE_HEADER)
  const signature = req.headers.get(WEB_PUSH_SIGNATURE_HEADER)
  const nowSeconds = Math.floor(Date.now() / 1000)
  const credential = readWorkerCredentials(nowSeconds).find(
    (candidate) =>
      candidate.keyId === keyId &&
      isValidWebPushSignature({
        secretBase64: candidate.secret,
        keyId: keyId ?? "",
        method: "POST",
        path: expectedPath,
        timestamp: timestamp ?? "",
        nonce: nonce ?? "",
        rawBody,
        signature,
        nowSeconds,
      })
  )
  if (!credential) throw new WebPushApiError(401, "unauthorized")
  return { keyId: keyId as string, nonce: nonce as string }
}

/** Atomically consumes a worker nonce through the service-role RPC. */
export async function consumeWorkerNonce(keyId: string, nonce: string): Promise<void> {
  const consumed = await callWebPushRpc<boolean>(
    "web_push_worker_nonce_consume",
    { p_key_id: keyId, p_nonce: nonce },
    WORKER_USER,
    "service_role"
  )
  if (consumed !== true) throw new WebPushApiError(409, "replay")
}

/** Verifies and consumes the nonce for a signed worker request. */
export async function authenticateWorkerRequest(
  req: NextRequest,
  rawBody: string,
  expectedPath: string
): Promise<void> {
  const { keyId, nonce } = verifyWorkerSignature(req, rawBody, expectedPath)
  await consumeWorkerNonce(keyId, nonce)
}

/** Calls an internal Web Push RPC with the service-role worker identity. */
export async function callInternalRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  return callWebPushRpc<T>(fn, args, WORKER_USER, "service_role")
}
