import * as React from 'react'

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // Generate a unique ID for this hook instance to prevent handling own events
  const hookId = React.useRef(Math.random().toString(36).substring(7))
  
  // Track if the update was initiated locally to sync to localStorage
  const isLocalUpdate = React.useRef(false)

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
        // Allow value to be a function so we have same API as useState
        setStoredValue((prev) => {
          const valueToStore = value instanceof Function ? value(prev) : value
          isLocalUpdate.current = true
          return valueToStore
        })
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error)
      }
    },
    [key]
  )

  // Sync to localStorage and dispatch event when local state changes
  React.useEffect(() => {
    if (isLocalUpdate.current) {
      isLocalUpdate.current = false
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(key, JSON.stringify(storedValue))
          // Dispatch custom event to sync across components in same tab
          window.dispatchEvent(
            new CustomEvent('local-storage-change', {
              detail: { key, value: storedValue, source: hookId.current },
            })
          )
        } catch (error) {
          console.warn(`Error writing to localStorage key "${key}":`, error)
        }
      }
    }
  }, [storedValue, key])

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
    const handleLocalChange = (e: CustomEvent<{ key: string; value: T; source?: string }>) => {
      if (e.detail.key === key && e.detail.source !== hookId.current) {
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
