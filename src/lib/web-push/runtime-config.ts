import "server-only"

import { createHash, ECDH } from "node:crypto"

import { callWebPushRpc, WebPushApiError } from "./api"

export type VapidArtifact = {
  version: string
  publicKey: string
  fingerprint: string
}

export type WebPushRuntimeControls = {
  registrationEnabled: boolean
  dispatchEnabled: boolean
  vapid: VapidArtifact | null
}

const CONTROL_RPC = "web_push_runtime_controls_get"
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const FINGERPRINT = /^sha256:[0-9a-f]{64}$/

const CONTROL_USER = {
  id: "web-push-runtime-controls",
  role: "global" as const,
  don_vi: null,
  current_don_vi: null,
  dia_ban_id: "0",
  khoa_phong: "web-push-runtime-controls",
}

function readVapid(value: unknown): VapidArtifact | null {
  if (!value || typeof value !== "object") return null
  const artifact = value as Record<string, unknown>
  const version = artifact.version
  const publicKey = artifact.public_key
  const fingerprint = artifact.fingerprint
  if (
    typeof version !== "string" ||
    !VERSION.test(version) ||
    typeof publicKey !== "string" ||
    typeof fingerprint !== "string" ||
    !FINGERPRINT.test(fingerprint)
  ) {
    return null
  }
  try {
    const point = Buffer.from(publicKey, "base64url")
    if (
      point.length !== 65 ||
      point[0] !== 4 ||
      Buffer.from(point).toString("base64url") !== publicKey
    ) {
      return null
    }
    ECDH.convertKey(point, "prime256v1", undefined, undefined, "uncompressed")
    const expected = `sha256:${createHash("sha256").update(point).digest("hex")}`
    return fingerprint === expected ? { version, publicKey, fingerprint } : null
  } catch {
    return null
  }
}

function parseControls(value: unknown): WebPushRuntimeControls | null {
  if (!value || typeof value !== "object") return null
  const controls = value as Record<string, unknown>
  if (
    controls.version !== 1 ||
    typeof controls.registration_enabled !== "boolean" ||
    typeof controls.dispatch_enabled !== "boolean" ||
    !(controls.vapid === null || typeof controls.vapid === "object")
  ) {
    return null
  }
  const vapid = readVapid(controls.vapid)
  if (controls.vapid !== null && !vapid) return null
  return {
    registrationEnabled: controls.registration_enabled && vapid !== null,
    dispatchEnabled: controls.dispatch_enabled && vapid !== null,
    vapid,
  }
}

/** Loads and validates the DB-authoritative Web Push runtime controls. */
export async function readRuntimeControls(): Promise<WebPushRuntimeControls> {
  const response = await callWebPushRpc<unknown>(CONTROL_RPC, {}, CONTROL_USER, "service_role")
  const controls = parseControls(response)
  if (!controls) throw new WebPushApiError(503, "unavailable", 60)
  return controls
}

/** Returns the configured VAPID artifact or rejects an unknown version. */
export function assertVapidVersion(
  controls: WebPushRuntimeControls,
  version: string
): VapidArtifact {
  if (!controls.vapid) throw new WebPushApiError(503, "disabled", 60)
  if (version !== controls.vapid.version) {
    throw new WebPushApiError(409, "key_version_mismatch")
  }
  return controls.vapid
}
