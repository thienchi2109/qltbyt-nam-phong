import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const pendingEquipmentPage = new Promise<never>(() => {})

const mocks = vi.hoisted(() => ({
  renderEquipmentPageClient: vi.fn<() => React.ReactNode>(),
}))

vi.mock("@/app/(app)/_components/AuthenticatedPageBoundary", () => ({
  AuthenticatedPageBoundary: ({
    children,
  }: {
    children: () => React.ReactNode
    fallback: React.ReactNode
  }) => <>{children()}</>,
}))

vi.mock("@/app/(app)/_components/AuthenticatedPageFallbacks", () => ({
  AuthenticatedPageSkeletonFallback: () => (
    <div data-testid="equipment-page-suspense-fallback" />
  ),
}))

vi.mock("../_components/EquipmentPageClient", () => ({
  EquipmentPageClient: () => mocks.renderEquipmentPageClient(),
}))

import EquipmentPage from "../page"

describe("EquipmentPage Suspense boundary", () => {
  it("renders the page skeleton when the client route sync suspends", async () => {
    mocks.renderEquipmentPageClient.mockImplementation(() => {
      throw pendingEquipmentPage
    })

    render(<EquipmentPage />)

    expect(
      await screen.findByTestId("equipment-page-suspense-fallback")
    ).toBeInTheDocument()
  })
})
