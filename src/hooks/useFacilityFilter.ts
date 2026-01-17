/**
 * @deprecated This hook is deprecated in favor of useTenantSelection() from
 * @/contexts/TenantSelectionContext which provides centralized tenant selection
 * with sessionStorage persistence and consistent UX across all pages.
 *
 * Migration: Replace useFacilityFilter() with useTenantSelection() hook.
 * @see src/contexts/TenantSelectionContext.tsx
 * @see src/components/shared/TenantSelector.tsx
 */

import * as React from 'react'
import { USER_ROLES } from '@/types/database'

// Role type aligned with project conventions and existing codebase usage
export type Role = keyof typeof USER_ROLES | 'regional_leader'

export type FacilityOption = {
  id: number
  name: string
  count?: number
}

// Client mode options: select by facility id or name
type ClientOptionsId<T> = {
  mode: 'client'
  selectBy: 'id'
  items: T[]
  userRole: string | Role
  getFacilityId: (item: T) => number | null | undefined
  getFacilityName?: (item: T) => string | null | undefined
}

type ClientOptionsName<T> = {
  mode: 'client'
  selectBy: 'name'
  items: T[]
  userRole: string | Role
  getFacilityName: (item: T) => string | null | undefined
}

// Server mode options: state-only consolidation for pages using server-side filtering
type ServerOptions = {
  mode: 'server'
  userRole: string | Role
  facilities?: FacilityOption[]
  initialSelectedId?: number | null
}

type ClientReturn<T> = {
  showFacilityFilter: boolean
  // When selecting by id
  selectedFacilityId: number | null
  setSelectedFacilityId: (id: number | null) => void
  // When selecting by name
  selectedFacilityName: string | null
  setSelectedFacilityName: (name: string | null) => void
  // Unified facilities output (id may be 0 when name-only)
  facilities: FacilityOption[]
  filteredItems: T[]
}

type ServerReturn = {
  showFacilityFilter: boolean
  selectedFacilityId: number | null
  setSelectedFacilityId: (id: number | null) => void
  facilities: FacilityOption[]
}

function isCoreFilterRole(role: string): boolean {
  const r = String(role || '').toLowerCase()
  return r === 'regional_leader' || r === 'global' || r === 'admin'
}

export function useFacilityFilter<T>(
  options: ClientOptionsId<T>
): ClientReturn<T>
export function useFacilityFilter<T>(
  options: ClientOptionsName<T>
): ClientReturn<T>
export function useFacilityFilter(
  options: ServerOptions
): ServerReturn
export function useFacilityFilter<T>(
  options: ClientOptionsId<T> | ClientOptionsName<T> | ServerOptions
): any {
  const mode = (options as any).mode as 'client' | 'server'
  const userRole = (options as any).userRole as string
  const showFacilityFilter = isCoreFilterRole(userRole)

  if (mode === 'server') {
    const { facilities = [], initialSelectedId = null } = options as ServerOptions
    const [selectedFacilityId, setSelectedFacilityId] = React.useState<number | null>(initialSelectedId)

    return {
      showFacilityFilter,
      selectedFacilityId,
      setSelectedFacilityId,
      facilities,
    } satisfies ServerReturn
  }

  // Client mode
  const clientOpts = options as ClientOptionsId<T> | ClientOptionsName<T>
  const items = clientOpts.items || []

  // State for both id and name selection (only one will be used depending on selectBy)
  const [selectedFacilityId, setSelectedFacilityId] = React.useState<number | null>(null)
  const [selectedFacilityName, setSelectedFacilityName] = React.useState<string | null>(null)

  const { facilities, idToName } = React.useMemo(() => {
    const idToNameMap = new Map<number, string>()
    const nameCount = new Map<string, number>()

    if ((clientOpts as ClientOptionsId<T>).selectBy === 'id') {
      const getId = (clientOpts as ClientOptionsId<T>).getFacilityId
      const getName = (clientOpts as ClientOptionsId<T>).getFacilityName
      for (const it of items) {
        const id = getId(it)
        if (id && Number.isFinite(id)) {
          const name = (getName ? getName(it) : null) ?? String(id)
          idToNameMap.set(id, name)
        }
      }
      const facs: FacilityOption[] = Array.from(idToNameMap.entries()).map(([id, name]) => ({ id, name }))
      return { facilities: facs.sort((a, b) => a.name.localeCompare(b.name)), idToName: idToNameMap }
    } else {
      const getName = (clientOpts as ClientOptionsName<T>).getFacilityName
      for (const it of items) {
        const name = getName(it)
        if (name) {
          nameCount.set(name, (nameCount.get(name) || 0) + 1)
        }
      }
      const facs: FacilityOption[] = Array.from(nameCount.entries()).map(([name, count]) => ({ id: 0, name, count }))
      return { facilities: facs.sort((a, b) => a.name.localeCompare(b.name)), idToName: idToNameMap }
    }
  }, [items, clientOpts])

  const filteredItems = React.useMemo(() => {
    if (!showFacilityFilter) return items

    if ((clientOpts as ClientOptionsId<T>).selectBy === 'id') {
      const getId = (clientOpts as ClientOptionsId<T>).getFacilityId
      if (!selectedFacilityId) return items
      return items.filter((it) => {
        const id = getId(it)
        return !!id && id === selectedFacilityId
      })
    } else {
      const getName = (clientOpts as ClientOptionsName<T>).getFacilityName
      if (!selectedFacilityName) return items
      // SAFETY FIX: Explicitly handle null/undefined to prevent comparison errors
      return items.filter((it) => {
        const name = getName(it)
        // Exclude items with missing facility info when filtering
        if (name === undefined || name === null) return false
        return name === selectedFacilityName
      })
    }
  }, [items, clientOpts, showFacilityFilter, selectedFacilityId, selectedFacilityName])

  // For id mode, keep selectedFacilityName in sync for convenience
  React.useEffect(() => {
    if ((clientOpts as ClientOptionsId<T>).selectBy === 'id') {
      if (selectedFacilityId && idToName.has(selectedFacilityId)) {
        const nm = idToName.get(selectedFacilityId) || null
        if (nm !== selectedFacilityName) setSelectedFacilityName(nm)
      }
      if (!selectedFacilityId && selectedFacilityName) {
        setSelectedFacilityName(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFacilityId, idToName])

  return {
    showFacilityFilter,
    selectedFacilityId,
    setSelectedFacilityId,
    selectedFacilityName,
    setSelectedFacilityName,
    facilities,
    filteredItems,
  } as ClientReturn<T>
}
