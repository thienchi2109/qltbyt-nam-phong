import type { HTMLAttributes, ReactNode } from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

type MockElementProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode
}

function createHeroCardMock(ReactRuntime: typeof import("react")) {
  const createMockElement =
    (tagName: "section" | "div" | "h3" | "p", testId: string) =>
    ({ children, ...props }: MockElementProps) =>
      ReactRuntime.createElement(tagName, { ...props, "data-testid": testId }, children)

  return Object.assign(createMockElement("section", "heroui-card-root"), {
    Header: createMockElement("div", "heroui-card-header"),
    Title: createMockElement("h3", "heroui-card-title"),
    Description: createMockElement("p", "heroui-card-description"),
    Content: createMockElement("div", "heroui-card-content"),
  })
}

vi.mock("@heroui/react/card", async () => {
  const ReactRuntime = await import("react")

  return { Card: createHeroCardMock(ReactRuntime) }
})

vi.mock("@heroui/react", async () => {
  const ReactRuntime = await import("react")

  return { Card: createHeroCardMock(ReactRuntime) }
})

import { ListFilterSearchCard } from "../ListFilterSearchCard"

describe("ListFilterSearchCard HeroUI backing", () => {
  it("renders the card surface through HeroUI card primitives", () => {
    render(
      <ListFilterSearchCard
        title="Danh mục thiết bị"
        description="Quản lý danh sách thiết bị."
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Tìm kiếm chung..."
      />
    )

    expect(screen.getByTestId("heroui-card-root")).toBeInTheDocument()
    expect(screen.getByTestId("heroui-card-header")).toHaveTextContent("Danh mục thiết bị")
    expect(screen.getByTestId("heroui-card-title")).toHaveTextContent("Danh mục thiết bị")
    expect(screen.getByTestId("heroui-card-description")).toHaveTextContent(
      "Quản lý danh sách thiết bị."
    )
    expect(screen.getByTestId("heroui-card-content")).toContainElement(
      screen.getByRole("searchbox", { name: "Tìm kiếm chung..." })
    )
  })
})
