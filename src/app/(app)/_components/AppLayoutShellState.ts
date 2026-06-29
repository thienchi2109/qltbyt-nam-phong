export type AppLayoutUiState = {
  isSidebarOpen: boolean
  isChangePasswordOpen: boolean
  isAssistantOpen: boolean
  isSigningOut: boolean
}

export type AppLayoutUiAction =
  | { type: "toggleSidebar" }
  | { type: "setChangePasswordOpen"; isOpen: boolean }
  | { type: "toggleAssistant" }
  | { type: "setAssistantOpen"; isOpen: boolean }
  | { type: "setSigningOut"; isSigningOut: boolean }

/** Initial reducer state for shared app shell UI controls. */
export const initialAppLayoutUiState: AppLayoutUiState = {
  isSidebarOpen: true,
  isChangePasswordOpen: false,
  isAssistantOpen: false,
  isSigningOut: false,
}

/** Applies app shell UI state transitions. */
export function appLayoutUiReducer(
  state: AppLayoutUiState,
  action: AppLayoutUiAction
): AppLayoutUiState {
  switch (action.type) {
    case "toggleSidebar":
      return { ...state, isSidebarOpen: !state.isSidebarOpen }
    case "setChangePasswordOpen":
      return { ...state, isChangePasswordOpen: action.isOpen }
    case "toggleAssistant":
      return { ...state, isAssistantOpen: !state.isAssistantOpen }
    case "setAssistantOpen":
      return { ...state, isAssistantOpen: action.isOpen }
    case "setSigningOut":
      return { ...state, isSigningOut: action.isSigningOut }
  }
}
