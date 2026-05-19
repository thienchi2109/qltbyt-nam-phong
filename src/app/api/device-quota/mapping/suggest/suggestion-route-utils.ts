import { SuggestionRouteError } from "@/app/api/device-quota/mapping/suggest/suggestion-errors"
import type { SuggestionAccessUser } from "@/app/api/device-quota/mapping/suggest/suggestion-types"
import { canAccessDeviceQuotaModule } from "@/lib/rbac"

export function assertSuggestionRouteUser(
  user: SuggestionAccessUser | undefined,
): asserts user is SuggestionAccessUser {
  if (!user?.id || !user.role) {
    throw new SuggestionRouteError("Unauthorized", 401)
  }

  if (!canAccessDeviceQuotaModule(user.role)) {
    throw new SuggestionRouteError("Forbidden", 403)
  }
}

export function getErrorStatus(error: unknown): number {
  if (error instanceof SuggestionRouteError) return error.status
  return 500
}

export function getErrorMessage(error: unknown, status: number): string {
  if (status >= 500) return "Internal server error"
  if (error instanceof Error && error.message) return error.message
  return "Internal server error"
}
