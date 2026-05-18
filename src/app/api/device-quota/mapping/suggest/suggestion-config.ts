import type {
  SuggestionProvider,
  SuggestionProviderMode,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"

export type SuggestionProviderPolicy =
  | "default"
  | "explicit"
  | "canary-allow-listed"
  | "canary-supabase"

export type SuggestionProviderSelection = {
  configuredProvider: SuggestionProviderMode
  provider: SuggestionProvider
  policy: SuggestionProviderPolicy
}

function parseProviderMode(value: string | undefined): SuggestionProviderMode {
  const normalized = (value ?? "supabase").trim().toLowerCase()
  if (normalized === "vm" || normalized === "canary" || normalized === "supabase") {
    return normalized
  }
  return "supabase"
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
  const configuredProvider = parseProviderMode(process.env.DEVICE_QUOTA_SUGGESTION_PROVIDER)

  if (configuredProvider === "vm") {
    return { configuredProvider, provider: "vm", policy: "explicit" }
  }

  if (configuredProvider === "canary") {
    const canaryFacilityIds = parseCanaryFacilityIds(
      process.env.DEVICE_QUOTA_SUGGESTION_CANARY_DON_VI_IDS,
    )
    if (canaryFacilityIds.has(donViId)) {
      return { configuredProvider, provider: "vm", policy: "canary-allow-listed" }
    }
    return { configuredProvider, provider: "supabase", policy: "canary-supabase" }
  }

  return { configuredProvider, provider: "supabase", policy: "default" }
}
