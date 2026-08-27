"use client"

import dynamic from "next/dynamic"

import { AppMobileFloatingActions } from "./AppMobileFloatingActions"

const AssistantPanel = dynamic(
  () => import("@/components/assistant/AssistantPanel").then((module) => module.AssistantPanel),
  { ssr: false }
)

type AppLayoutAssistantChromeProps = {
  isAssistantOpen: boolean
  onAssistantClose: () => void
  onAssistantToggle: () => void
}

/** Renders the app-level floating assistant trigger and lazy-loaded panel. */
export function AppLayoutAssistantChrome({
  isAssistantOpen,
  onAssistantClose,
  onAssistantToggle,
}: AppLayoutAssistantChromeProps) {
  return (
    <>
      <AppMobileFloatingActions
        isAssistantOpen={isAssistantOpen}
        onAssistantToggle={onAssistantToggle}
      />
      {isAssistantOpen ? (
        <AssistantPanel isOpen={isAssistantOpen} onClose={onAssistantClose} />
      ) : null}
    </>
  )
}
