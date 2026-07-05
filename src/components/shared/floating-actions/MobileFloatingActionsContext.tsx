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

const MobileFloatingActionsStateContext =
  React.createContext<MobileFloatingActionDescriptor | null>(null)

const MobileFloatingActionsSetterContext = React.createContext<
  React.Dispatch<React.SetStateAction<MobileFloatingActionDescriptor | null>>
>(() => undefined)

function isSameMobileFloatingAction(
  previousAction: MobileFloatingActionDescriptor | null,
  nextAction: MobileFloatingActionDescriptor | null
) {
  return (
    previousAction?.id === nextAction?.id &&
    previousAction?.label === nextAction?.label &&
    previousAction?.icon === nextAction?.icon &&
    previousAction?.onSelect === nextAction?.onSelect
  )
}

/** Provides the app-shell-local mobile page action registration state. */
export function MobileFloatingActionsProvider({ children }: { children: React.ReactNode }) {
  const [pageAction, setPageAction] = React.useState<MobileFloatingActionDescriptor | null>(null)

  return (
    <MobileFloatingActionsSetterContext.Provider value={setPageAction}>
      <MobileFloatingActionsStateContext.Provider value={pageAction}>
        {children}
      </MobileFloatingActionsStateContext.Provider>
    </MobileFloatingActionsSetterContext.Provider>
  )
}

/** Reads the currently registered mobile page action for layout composition. */
export function useMobileFloatingActions() {
  const pageAction = React.use(MobileFloatingActionsStateContext)
  const setPageAction = React.use(MobileFloatingActionsSetterContext)

  return React.useMemo(
    () => ({
      pageAction,
      setPageAction,
    }),
    [pageAction, setPageAction]
  )
}

/** Registers or clears the current page's mobile floating action. */
export function usePageFloatingAction(action: MobileFloatingActionDescriptor | null) {
  const setPageAction = React.use(MobileFloatingActionsSetterContext)

  React.useEffect(() => {
    setPageAction((currentAction) =>
      isSameMobileFloatingAction(currentAction, action) ? currentAction : action
    )

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
