export function normalizePageSize(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1
}

export function readPageSizeFromStorage(key: string | undefined, fallback: number): number {
  const safeFallback = normalizePageSize(fallback)
  if (!key || typeof window === "undefined") {
    return safeFallback
  }

  try {
    const storedValue = window.localStorage.getItem(key)
    if (!storedValue) {
      return safeFallback
    }

    const parsedValue = Number.parseInt(storedValue, 10)
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : safeFallback
  } catch (error) {
    console.warn(`Error reading page size storage key "${key}":`, error)
    return safeFallback
  }
}

export function writePageSizeToStorage(key: string | undefined, pageSize: number): void {
  if (!key || typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(key, String(normalizePageSize(pageSize)))
  } catch (error) {
    console.warn(`Error writing page size storage key "${key}":`, error)
  }
}
