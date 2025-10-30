const MOBILE_MAINTENANCE_FLAG = process.env.NEXT_PUBLIC_FEATURE_MOBILE_MAINTENANCE_REDESIGN === "true"

const featureFlags = {
  "mobile-maintenance-redesign": MOBILE_MAINTENANCE_FLAG,
} as const satisfies Record<string, boolean>

export type FeatureFlagKey = keyof typeof featureFlags

export function getFeatureFlag(flag: FeatureFlagKey): boolean {
  return featureFlags[flag] ?? false
}

export function useFeatureFlag(flag: FeatureFlagKey): boolean {
  // Static env-driven flag; memoized to avoid re-computation per render.
  return featureFlags[flag] ?? false
}
