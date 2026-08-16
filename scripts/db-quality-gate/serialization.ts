import { createHash } from "node:crypto"

type CanonicalJsonValue =
  boolean | null | number | string | CanonicalJsonValue[] | { [key: string]: CanonicalJsonValue }

function canonicalizeJson(value: unknown): CanonicalJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Canonical JSON does not support non-finite numbers")
    }

    return value
  }

  if (Array.isArray(value)) {
    return value.map(canonicalizeJson)
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareStrings(left, right))
        .map(([key, nestedValue]) => [key, canonicalizeJson(nestedValue)])
    )
  }

  throw new Error(`Canonical JSON does not support ${typeof value}`)
}

/** Returns the lower-case SHA-256 digest for exact text content. */
export function sha256Text(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

/** Compares protocol strings by code unit without locale-dependent collation. */
export function compareStrings(left: string, right: string): number {
  if (left === right) {
    return 0
  }

  return left < right ? -1 : 1
}

/** Serializes supported JSON values with recursively sorted object keys. */
export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value))
}

/** Returns the SHA-256 digest of canonical JSON serialization. */
export function stableJsonSha256(value: unknown): string {
  return sha256Text(stableJsonStringify(value))
}
