import { useEffect } from "react"

/**
 * Keyboard shortcuts for repair requests page.
 * - '/' key: focus search input
 * - 'n' key: open create dialog (non-regional-leaders only)
 *
 * Shortcuts are ignored when user is typing in an input/textarea.
 */
export interface ShortcutOptions {
  /** Ref to the search input element */
  searchInputRef: React.RefObject<HTMLInputElement | null>
  /** Callback to open create dialog */
  onCreate: () => void
  /** Whether current user is a regional leader (regional leaders can't create requests) */
  isRegionalLeader: boolean
}

export function useRepairRequestShortcuts({
  searchInputRef,
  onCreate,
  isRegionalLeader
}: ShortcutOptions): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )

      // '/' key: focus search input
      if (!isTyping && e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      // 'n' key: open create dialog (not for regional leaders)
      if (!isTyping && e.key.toLowerCase() === 'n' && !isRegionalLeader) {
        e.preventDefault()
        onCreate()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchInputRef, onCreate, isRegionalLeader])
}
