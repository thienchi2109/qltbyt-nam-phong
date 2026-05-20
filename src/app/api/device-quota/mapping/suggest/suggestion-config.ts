import type {
  SuggestionProvider,
  SuggestionProviderMode,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"

export type SuggestionProviderPolicy =
  | "default"
  | "explicit"
  | "canary-allow-listed"
  | "canary-vm-default"

export type SuggestionProviderSelection = {
  configuredProvider: SuggestionProviderMode
  provider: SuggestionProvider
  policy: SuggestionProviderPolicy
}

function parseProviderMode(value: string | undefined): SuggestionProviderMode {
  const normalized = (value ?? "vm").trim().toLowerCase()
  if (normalized === "vm" || normalized === "canary") {
    return normalized
  }
  return "vm"
}

function parseCanaryFacilityIds(value: string | undefined): Set<number> {
  const ids = new Set<number>()
  for (const raw of (value ?? "").split(",")) {
    const parsed = Number(raw.trim())
    if (Number.isInteger(parsed) && parsed > 0) ids.add(parsed)
  }
  return ids
}

export function selectSuggestionProvider(donViId: number): SuggestionProviderSelection {
  const rawProvider = process.env.DEVICE_QUOTA_SUGGESTION_PROVIDER?.trim().toLowerCase()
  const configuredProvider = parseProviderMode(process.env.DEVICE_QUOTA_SUGGESTION_PROVIDER)

  if (configuredProvider === "vm") {
    return {
      configuredProvider,
      provider: "vm",
      policy: rawProvider === "vm" ? "explicit" : "default",
    }
  }

  if (configuredProvider === "canary") {
    const canaryFacilityIds = parseCanaryFacilityIds(
      process.env.DEVICE_QUOTA_SUGGESTION_CANARY_DON_VI_IDS,
    )
    if (canaryFacilityIds.has(donViId)) {
      return { configuredProvider, provider: "vm", policy: "canary-allow-listed" }
    }
    return { configuredProvider, provider: "vm", policy: "canary-vm-default" }
  }

  return { configuredProvider, provider: "vm", policy: "default" }
}
