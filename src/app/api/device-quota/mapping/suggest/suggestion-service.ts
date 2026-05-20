import { SuggestionRouteError } from "@/app/api/device-quota/mapping/suggest/suggestion-errors"
import { createCatalogSignature, mergeSuggestionResults } from "@/app/api/device-quota/mapping/suggest/suggestion-merge"
import {
  assertSuggestionAccess,
  lookupAccessibleFacilityIds,
} from "@/app/api/device-quota/mapping/suggest/suggestion-supabase-provider"
import {
  getSuggestionRuntimeStateSizeForTests,
  resetSuggestionRuntimeStateForTests,
} from "@/app/api/device-quota/mapping/suggest/suggestion-traffic-control"
import { runVmSuggestMapping } from "@/app/api/device-quota/mapping/suggest/suggestion-vm-provider"
import type {
  SuggestionAccessUser,
  SuggestionProviderResult,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"

export { SuggestionRouteError }
export { createCatalogSignature, mergeSuggestionResults }
export { assertSuggestionAccess, lookupAccessibleFacilityIds }
export { getSuggestionRuntimeStateSizeForTests, resetSuggestionRuntimeStateForTests }

/** Runs the VM-backed suggestion provider for the requested facility. */
export async function runSuggestMapping({
  donViId,
  requestId,
  user,
}: {
  donViId: number
  requestId?: string
  user: SuggestionAccessUser
}): Promise<SuggestionProviderResult> {
  return runVmSuggestMapping({
    donViId,
    requestId: requestId ?? `dqss-${Date.now().toString(36)}`,
    user,
  })
}
