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
      return previousAction.id === nextAction.id && previousAction.label === nextAction.label
    })
  )
}

function createStableMobileFloatingActions(
  actions: readonly MobileFloatingActionDescriptor[],
  latestActionsRef: React.RefObject<readonly MobileFloatingActionDescriptor[]>
) {
  return actions.map((action, index) => ({
    id: action.id,
    label: action.label,
    icon: action.icon,
    onSelect: () => latestActionsRef.current[index]?.onSelect(),
  }))
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
  const latestActionsRef = React.useRef<readonly MobileFloatingActionDescriptor[]>([])
  const registeredActionIdsRef = React.useRef<readonly string[]>([])

  React.useEffect(() => {
    const nextActions = normalizeMobileFloatingActions(action)
    latestActionsRef.current = nextActions
    registeredActionIdsRef.current = nextActions.map((nextAction) => nextAction.id)

    setPageActions((currentActions) =>
      areSameMobileFloatingActions(currentActions, nextActions)
        ? currentActions
        : createStableMobileFloatingActions(nextActions, latestActionsRef)
    )
  }, [action, setPageActions])

  React.useEffect(() => {
    return () => {
      setPageActions((currentActions) => {
        const registeredActionIds = registeredActionIdsRef.current

        if (registeredActionIds.length === 0) {
          return currentActions
        }

        const ownsCurrentActions =
          currentActions.length === registeredActionIds.length &&
          currentActions.every(
            (currentAction, index) => currentAction.id === registeredActionIds[index]
          )

        return ownsCurrentActions ? [] : currentActions
      })
    }
  }, [setPageActions])
}
