import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AssistantTriggerButton } from "@/components/assistant/AssistantTriggerButton"

describe("AssistantTriggerButton layering", () => {
  it("renders at z-[997] tier (below AssistantPanel z-998)", () => {
    render(<AssistantTriggerButton isOpen={false} onToggle={() => {}} />)

    const button = screen.getByTestId("assistant-trigger-button")
    expect(button.className).toContain("z-[997]")
  })

  it("maintains z-[997] tier when panel is open", () => {
    render(<AssistantTriggerButton isOpen={true} onToggle={() => {}} />)

    const button = screen.getByTestId("assistant-trigger-button")
    expect(button.className).toContain("z-[997]")
  })
})
