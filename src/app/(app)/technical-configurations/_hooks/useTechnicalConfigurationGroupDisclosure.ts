import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

export type UseTechnicalConfigurationGroupDisclosureResult = {
  expandedGroupKeys: ReadonlySet<string>
  isExpanded: (groupKey: string) => boolean
  setExpanded: (groupKey: string, expanded: boolean) => void
  expand: (groupKey: string) => void
}

function removeMissingGroupKeys(
  collapsedGroupKeys: ReadonlySet<string>,
  groupKeys: readonly string[]
) {
  const currentGroupKeys = new Set(groupKeys)
  const nextCollapsedGroupKeys = new Set(
    [...collapsedGroupKeys].filter((groupKey) => currentGroupKeys.has(groupKey))
  )

  return nextCollapsedGroupKeys.size === collapsedGroupKeys.size
    ? collapsedGroupKeys
    : nextCollapsedGroupKeys
}

/** Tracks per-group disclosure state while expanding newly introduced group keys by default. */
export function useTechnicalConfigurationGroupDisclosure(
  groupKeys: readonly string[]
): UseTechnicalConfigurationGroupDisclosureResult {
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<ReadonlySet<string>>(() => new Set())
  const expandedGroupKeys = useMemo(
    () => new Set(groupKeys.filter((groupKey) => !collapsedGroupKeys.has(groupKey))),
    [collapsedGroupKeys, groupKeys]
  )
  const expandedGroupKeysRef = useRef<ReadonlySet<string>>(expandedGroupKeys)
  const currentGroupKeysRef = useRef<ReadonlySet<string> | null>(null)

  useLayoutEffect(() => {
    expandedGroupKeysRef.current = expandedGroupKeys
    currentGroupKeysRef.current = new Set(groupKeys)
  }, [expandedGroupKeys, groupKeys])

  useEffect(() => {
    setCollapsedGroupKeys((current) => removeMissingGroupKeys(current, groupKeys))
  }, [groupKeys])

  const isExpanded = useCallback(
    (groupKey: string) => expandedGroupKeysRef.current.has(groupKey),
    []
  )

  const setExpanded = useCallback((groupKey: string, expanded: boolean) => {
    if (!currentGroupKeysRef.current?.has(groupKey)) {
      return
    }

    setCollapsedGroupKeys((current) => {
      const isCurrentlyExpanded = !current.has(groupKey)
      if (isCurrentlyExpanded === expanded) {
        return current
      }

      const next = new Set(current)
      if (expanded) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }, [])

  const expand = useCallback((groupKey: string) => {
    if (!currentGroupKeysRef.current?.has(groupKey)) {
      return
    }

    setCollapsedGroupKeys((current) => {
      if (!current.has(groupKey)) {
        return current
      }

      const next = new Set(current)
      next.delete(groupKey)
      return next
    })
  }, [])

  return {
    expandedGroupKeys,
    isExpanded,
    setExpanded,
    expand,
  }
}
