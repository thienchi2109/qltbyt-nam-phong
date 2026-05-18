export function readPageSizeFromStorage(key: string | undefined, fallback: number): number {
  const safeFallback = Math.max(1, fallback)
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
    window.localStorage.setItem(key, String(Math.max(1, pageSize)))
  } catch (error) {
    console.warn(`Error writing page size storage key "${key}":`, error)
  }
}
