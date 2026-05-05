import * as React from "react"
import { render, screen } from "@testing-library/react"
import { Plus, Sparkles } from "lucide-react"
import { describe, expect, it } from "vitest"

import { FloatingActionButton } from "../FloatingActionButton"

describe("FloatingActionButton", () => {
  it("renders the shared mobile page FAB contract", () => {
    render(
      <FloatingActionButton aria-label="Tạo mới">
        <Plus />
      </FloatingActionButton>,
    )

    const button = screen.getByRole("button", { name: "Tạo mới" })
    expect(button.className).toContain("fixed")
    expect(button.className).toContain("right-6")
    expect(button.className).toContain("bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)]")
    expect(button.className).toContain("z-[100]")
    expect(button.className).toContain("md:hidden")
    expect(button.className).toContain("h-14")
    expect(button.className).toContain("w-14")
    expect(button.className).toContain("rounded-full")
    expect(button.className).toContain("shadow-[0_18px_34px_rgba(15,23,42,0.24)]")
  })

  it("renders the assistant FAB at the same size on its higher mobile tier", () => {
    render(
      <FloatingActionButton tone="assistant" placement="assistant" aria-label="Trợ lý AI">
        <Sparkles />
      </FloatingActionButton>,
    )

    const button = screen.getByRole("button", { name: "Trợ lý AI" })
    expect(button.className).toContain("bottom-[calc(env(safe-area-inset-bottom,0px)+9.5rem)]")
    expect(button.className).toContain("z-[997]")
    expect(button.className).toContain("md:bottom-6")
    expect(button.className).toContain("h-14")
    expect(button.className).toContain("w-14")
    expect(button.className).toContain("bg-[linear-gradient(135deg,hsl(194,45%,42%),hsl(188,48%,32%))]")
  })
})
