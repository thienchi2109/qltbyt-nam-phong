import * as React from 'react'

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // Generate a unique ID for this hook instance to prevent handling own events
  const hookId = React.useRef(Math.random().toString(36).substring(7))

  // Initialize stored value from localStorage
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

  // Ref to track current value for synchronous access in setValue
  // Needed for functional updates (prev => newValue) when calls happen before re-render
  const storedValueRef = React.useRef<T>(storedValue)

  // Keep ref in sync with state (handles remote updates via storage events)
  React.useEffect(() => {
    storedValueRef.current = storedValue
  }, [storedValue])

  const setValue = React.useCallback(
    (value: T | ((val: T) => T)) => {
      const prev = storedValueRef.current
      const valueToStore = value instanceof Function ? value(prev) : value

      // Only persist if value actually differs
      if (!Object.is(prev, valueToStore)) {
        // Update ref and state first - these must always succeed together
        storedValueRef.current = valueToStore
        setStoredValue(valueToStore)

        // Try to persist to localStorage (non-critical for hook functionality)
        // Hook gracefully degrades to in-memory-only if localStorage unavailable
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, JSON.stringify(valueToStore))
            // Dispatch custom event to sync across components in same tab
            window.dispatchEvent(
              new CustomEvent('local-storage-change', {
                detail: { key, value: valueToStore, source: hookId.current },
              })
            )
          } catch (error) {
            console.warn(`Error writing to localStorage key "${key}":`, error)
          }
        }
      }
    },
    [key]
  )

  // Re-sync when key prop changes (prevents stale state when switching keys)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const item = window.localStorage.getItem(key)
      const newValue = item ? JSON.parse(item) : initialValue
      setStoredValue(newValue)
      storedValueRef.current = newValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}" on key change:`, error)
      setStoredValue(initialValue)
      storedValueRef.current = initialValue
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]) // Only re-read when key changes, not initialValue

  // Sync state when localStorage changes (from other tabs or same-tab components)
  React.useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        if (e.newValue !== null) {
          try {
            const parsed = JSON.parse(e.newValue)
            setStoredValue(parsed)
            storedValueRef.current = parsed
          } catch {
            // Parse error - revert to initial value
            setStoredValue(initialValue)
            storedValueRef.current = initialValue
          }
        } else {
          // Key was removed - revert to initial value
          setStoredValue(initialValue)
          storedValueRef.current = initialValue
        }
      }
    }

    // Handle same-tab updates via custom event
    const handleLocalChange = (e: CustomEvent<{ key: string; value: T; source?: string }>) => {
      if (e.detail.key === key && e.detail.source !== hookId.current) {
        setStoredValue(e.detail.value)
        storedValueRef.current = e.detail.value
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
