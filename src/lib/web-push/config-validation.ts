import { isRecord, exactKeys, versionIsOne, parsePositiveBigint } from "./validation-common"
export type ConfigPutRequest = {
  donViId: string
  usernames: string[]
  selfAction: "none" | "add" | "remove"
}

/** Validates a recipient configuration mutation request. */
export function parseConfigPutRequest(value: unknown): ConfigPutRequest | null {
  if (
    !isRecord(value) ||
    !exactKeys(
      value,
      "self_action" in value
        ? ["version", "don_vi_id", "usernames", "self_action"]
        : ["version", "don_vi_id", "usernames"]
    ) ||
    !versionIsOne(value.version)
  ) {
    return null
  }
  const selfAction = value.self_action === undefined ? "none" : value.self_action
  if (selfAction !== "none" && selfAction !== "add" && selfAction !== "remove") return null
  const donViId = parsePositiveBigint(value.don_vi_id)
  if (
    !donViId ||
    typeof value.usernames !== "string" ||
    new TextEncoder().encode(value.usernames).byteLength > 8192
  ) {
    return null
  }
  const inputNames = [
    ...new Set(
      value.usernames
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
    ),
  ]
  if (inputNames.some((name) => new TextEncoder().encode(name).byteLength > 256)) return null
  const names = [...new Set(inputNames.map((name) => name.toLowerCase()))]
  if (names.length > 100 || names.some((name) => new TextEncoder().encode(name).byteLength > 256)) {
    return null
  }
  return { donViId, usernames: names, selfAction }
}

/** Validates and narrows a recipient configuration response envelope. */
export function validateConfigResponse(value: unknown): Record<string, unknown> | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "don_vi_id", "recipients"]) ||
    value.version !== 1
  )
    return null
  if (
    !parsePositiveBigint(value.don_vi_id) ||
    !Array.isArray(value.recipients) ||
    value.recipients.length > 100
  )
    return null
  if (
    value.recipients.some(
      (recipient) =>
        !isRecord(recipient) ||
        !exactKeys(recipient, [
          "user_id",
          "username",
          "full_name",
          "status",
          "protected",
          "editable",
        ]) ||
        (recipient.full_name !== null && typeof recipient.full_name !== "string") ||
        (recipient.status !== "eligible" && recipient.status !== "ineligible") ||
        typeof recipient.protected !== "boolean" ||
        typeof recipient.editable !== "boolean" ||
        !parsePositiveBigint(recipient.user_id) ||
        typeof recipient.username !== "string"
    )
  ) {
    return null
  }
  return value
}
