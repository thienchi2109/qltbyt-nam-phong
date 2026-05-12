export type AppLayoutUiState = {
  isSidebarOpen: boolean
  isMobileSheetOpen: boolean
  isChangePasswordOpen: boolean
  isAssistantOpen: boolean
  isSigningOut: boolean
}

export type AppLayoutUiAction =
  | { type: "toggleSidebar" }
  | { type: "setMobileSheetOpen"; isOpen: boolean }
  | { type: "setChangePasswordOpen"; isOpen: boolean }
  | { type: "toggleAssistant" }
  | { type: "setAssistantOpen"; isOpen: boolean }
  | { type: "setSigningOut"; isSigningOut: boolean }

export const initialAppLayoutUiState: AppLayoutUiState = {
  isSidebarOpen: true,
  isMobileSheetOpen: false,
  isChangePasswordOpen: false,
  isAssistantOpen: false,
  isSigningOut: false,
}

export function appLayoutUiReducer(
  state: AppLayoutUiState,
  action: AppLayoutUiAction
): AppLayoutUiState {
  switch (action.type) {
    case "toggleSidebar":
      return { ...state, isSidebarOpen: !state.isSidebarOpen }
    case "setMobileSheetOpen":
      return { ...state, isMobileSheetOpen: action.isOpen }
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
