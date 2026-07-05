"use client"

import * as React from "react"

export interface MobileFloatingActionDescriptor {
  id: string
  label: string
  icon: React.ReactNode
  onSelect: () => void
}

interface MobileFloatingActionsContextValue {
  pageAction: MobileFloatingActionDescriptor | null
  setPageAction: React.Dispatch<React.SetStateAction<MobileFloatingActionDescriptor | null>>
}

const MobileFloatingActionsContext = React.createContext<MobileFloatingActionsContextValue | null>(
  null
)

const fallbackContextValue: MobileFloatingActionsContextValue = {
  pageAction: null,
  setPageAction: () => undefined,
}

/** Provides the app-shell-local mobile page action registration state. */
export function MobileFloatingActionsProvider({ children }: { children: React.ReactNode }) {
  const [pageAction, setPageAction] = React.useState<MobileFloatingActionDescriptor | null>(null)

  const value = React.useMemo(
    () => ({
      pageAction,
      setPageAction,
    }),
    [pageAction]
  )

  return (
    <MobileFloatingActionsContext.Provider value={value}>
      {children}
    </MobileFloatingActionsContext.Provider>
  )
}

/** Reads the currently registered mobile page action for layout composition. */
export function useMobileFloatingActions() {
  return React.useContext(MobileFloatingActionsContext) ?? fallbackContextValue
}

/** Registers or clears the current page's mobile floating action. */
export function usePageFloatingAction(action: MobileFloatingActionDescriptor | null) {
  const { setPageAction } = useMobileFloatingActions()

  React.useEffect(() => {
    setPageAction(action)

    return () => {
      setPageAction((currentAction) => {
        if (!action || currentAction?.id !== action.id) {
          return currentAction
        }

        return null
      })
    }
  }, [action, setPageAction])
}
