import { SuggestionRouteError } from "@/app/api/device-quota/mapping/suggest/suggestion-errors"
import { createCatalogSignature, mergeSuggestionResults } from "@/app/api/device-quota/mapping/suggest/suggestion-merge"
import {
  assertSuggestionAccess,
  lookupAccessibleFacilityIds,
  runSupabaseSuggestMapping,
} from "@/app/api/device-quota/mapping/suggest/suggestion-supabase-provider"
import {
  getSuggestionRuntimeStateSizeForTests,
  resetSuggestionRuntimeStateForTests,
} from "@/app/api/device-quota/mapping/suggest/suggestion-traffic-control"
import { runVmSuggestMapping } from "@/app/api/device-quota/mapping/suggest/suggestion-vm-provider"
import type {
  SuggestionAccessUser,
  SuggestionProvider,
  SuggestionProviderResult,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"

export { SuggestionRouteError }
export { createCatalogSignature, mergeSuggestionResults }
export { assertSuggestionAccess, lookupAccessibleFacilityIds }
export { getSuggestionRuntimeStateSizeForTests, resetSuggestionRuntimeStateForTests }

export async function runSuggestMapping({
  donViId,
  provider,
  requestId,
  user,
}: {
  donViId: number
  provider: SuggestionProvider
  requestId?: string
  user: SuggestionAccessUser
}): Promise<SuggestionProviderResult> {
  if (provider === "supabase") {
    return runSupabaseSuggestMapping({ donViId, user })
  }

  return runVmSuggestMapping({
    donViId,
    requestId: requestId ?? `dqss-${Date.now().toString(36)}`,
    user,
  })
}
