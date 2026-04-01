function hasMessageProperty(value: unknown): value is { message?: unknown } {
  return typeof value === 'object' && value !== null && 'message' in value
}

export function getUnknownErrorMessage(error: unknown, fallback = ''): string {
  if (typeof error === 'string' && error) {
    return error
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  if (hasMessageProperty(error) && typeof error.message === 'string' && error.message) {
    return error.message
  }

  return fallback
}

export function normalizeRpcError(error: unknown, fallbackMessage: string): string {
  return getUnknownErrorMessage(error, fallbackMessage)
}
