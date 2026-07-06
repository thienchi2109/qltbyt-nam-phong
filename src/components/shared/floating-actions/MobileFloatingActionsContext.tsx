"use client"

import * as React from "react"

export interface MobileFloatingActionDescriptor {
  id: string
  label: string
  icon: React.ReactNode
  onSelect: () => void
}

type MobileFloatingActionRegistration =
  MobileFloatingActionDescriptor | readonly MobileFloatingActionDescriptor[] | null

interface MobileFloatingActionsContextValue {
  pageActions: readonly MobileFloatingActionDescriptor[]
  setPageActions: React.Dispatch<React.SetStateAction<readonly MobileFloatingActionDescriptor[]>>
}

const MobileFloatingActionsStateContext = React.createContext<
  readonly MobileFloatingActionDescriptor[]
>([])

const MobileFloatingActionsSetterContext = React.createContext<
  React.Dispatch<React.SetStateAction<readonly MobileFloatingActionDescriptor[]>>
>(() => undefined)

function normalizeMobileFloatingActions(action: MobileFloatingActionRegistration) {
  if (!action) return []
  return Array.isArray(action) ? action : [action]
}

function areSameMobileFloatingActions(
  previousActions: readonly MobileFloatingActionDescriptor[],
  nextActions: readonly MobileFloatingActionDescriptor[]
) {
  return (
    previousActions.length === nextActions.length &&
    previousActions.every((previousAction, index) => {
      const nextAction = nextActions[index]
      return (
        previousAction.id === nextAction.id &&
        previousAction.label === nextAction.label &&
        previousAction.icon === nextAction.icon &&
        previousAction.onSelect === nextAction.onSelect
      )
    })
  )
}

/** Provides the app-shell-local mobile page action registration state. */
export function MobileFloatingActionsProvider({ children }: { children: React.ReactNode }) {
  const [pageActions, setPageActions] = React.useState<readonly MobileFloatingActionDescriptor[]>(
    []
  )

  return (
    <MobileFloatingActionsSetterContext.Provider value={setPageActions}>
      <MobileFloatingActionsStateContext.Provider value={pageActions}>
        {children}
      </MobileFloatingActionsStateContext.Provider>
    </MobileFloatingActionsSetterContext.Provider>
  )
}

/** Reads the currently registered mobile page action for layout composition. */
export function useMobileFloatingActions() {
  const pageActions = React.use(MobileFloatingActionsStateContext)
  const setPageActions = React.use(MobileFloatingActionsSetterContext)

  return React.useMemo(
    () => ({
      pageAction: pageActions[0] ?? null,
      pageActions,
      setPageActions,
    }),
    [pageActions, setPageActions]
  )
}

/** Registers or clears the current page's mobile floating action. */
export function usePageFloatingAction(action: MobileFloatingActionRegistration) {
  const setPageActions = React.use(MobileFloatingActionsSetterContext)

  React.useEffect(() => {
    const nextActions = normalizeMobileFloatingActions(action)

    setPageActions((currentActions) =>
      areSameMobileFloatingActions(currentActions, nextActions) ? currentActions : nextActions
    )

    return () => {
      setPageActions((currentActions) => {
        if (nextActions.length === 0) {
          return currentActions
        }

        const nextActionIds = new Set(nextActions.map((nextAction) => nextAction.id))
        const ownsCurrentActions =
          currentActions.length === nextActions.length &&
          currentActions.every((currentAction) => nextActionIds.has(currentAction.id))

        return ownsCurrentActions ? [] : currentActions
      })
    }
  }, [action, setPageActions])
}
