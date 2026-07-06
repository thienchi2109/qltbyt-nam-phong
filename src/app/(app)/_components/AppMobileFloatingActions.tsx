"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"

import { AssistantTriggerButton } from "@/components/assistant/AssistantTriggerButton"
import {
  MobileFloatingActionMenu,
  useMobileFloatingActions,
  type MobileFloatingActionDescriptor,
} from "@/components/shared/floating-actions"

interface AppMobileFloatingActionsProps {
  isAssistantOpen: boolean
  onAssistantToggle: () => void
}

/** Renders the assistant FAB alone or combines it with the current page mobile action. */
export function AppMobileFloatingActions({
  isAssistantOpen,
  onAssistantToggle,
}: AppMobileFloatingActionsProps) {
  const { pageAction } = useMobileFloatingActions()

  const assistantAction = React.useMemo<MobileFloatingActionDescriptor>(
    () => ({
      id: "assistant",
      label: isAssistantOpen ? "Đóng trợ lý" : "Trợ lý AI",
      icon: <Sparkles aria-hidden="true" />,
      onSelect: onAssistantToggle,
    }),
    [isAssistantOpen, onAssistantToggle]
  )

  if (!pageAction) {
    return <AssistantTriggerButton isOpen={isAssistantOpen} onToggle={onAssistantToggle} />
  }

  return <MobileFloatingActionMenu actions={[assistantAction, pageAction]} />
}
