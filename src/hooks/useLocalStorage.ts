import * as React from 'react'

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = React.useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Use functional update form to get latest state value
        setStoredValue(prev => {
          const valueToStore = value instanceof Function ? value(prev) : value
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, JSON.stringify(valueToStore))
            // Dispatch custom event to sync across components in same tab
            window.dispatchEvent(new CustomEvent('local-storage-change', {
              detail: { key, value: valueToStore }
            }))
          }
          return valueToStore
        })
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error)
      }
    },
    [key]
  )

  // Re-sync when key prop changes (prevents stale state when switching keys)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const item = window.localStorage.getItem(key)
      setStoredValue(item ? JSON.parse(item) : initialValue)
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}" on key change:`, error)
      setStoredValue(initialValue)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]) // Only re-read when key changes, not initialValue

  // Sync state when localStorage changes (from other tabs or same-tab components)
  React.useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        if (e.newValue !== null) {
          try {
            setStoredValue(JSON.parse(e.newValue))
          } catch {
            // Parse error - revert to initial value
            setStoredValue(initialValue)
          }
        } else {
          // Key was removed - revert to initial value
          setStoredValue(initialValue)
        }
      }
    }

    // Handle same-tab updates via custom event
    const handleLocalChange = (e: CustomEvent<{ key: string; value: T }>) => {
      if (e.detail.key === key) {
        setStoredValue(e.detail.value)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('local-storage-change', handleLocalChange as EventListener)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('local-storage-change', handleLocalChange as EventListener)
    }
  }, [key, initialValue])

  return [storedValue, setValue]
}
