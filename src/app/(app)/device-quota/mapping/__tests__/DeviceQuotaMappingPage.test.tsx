import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/(app)/_components/AuthenticatedPageBoundary", () => ({
  AuthenticatedPageBoundary: ({
    children,
  }: {
    children: (user: { role: string; don_vi: string }) => React.ReactNode
  }) => <>{children({ role: "admin", don_vi: "1" })}</>,
}))

vi.mock("../_components/DeviceQuotaMappingContext", () => ({
  DeviceQuotaMappingProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mapping-provider">{children}</div>
  ),
}))

vi.mock("../_components/DeviceQuotaUnassignedList", () => ({
  DeviceQuotaUnassignedList: () => (
    <section data-testid="mapping-unassigned-list">Thiết bị chưa phân loại</section>
  ),
}))

vi.mock("../_components/DeviceQuotaCategoryTree", () => ({
  DeviceQuotaCategoryTree: () => (
    <section data-testid="mapping-category-tree">Danh mục định mức</section>
  ),
}))

vi.mock("../_components/DeviceQuotaMappingActions", () => ({
  DeviceQuotaMappingActions: () => <div data-testid="mapping-actions">Actions</div>,
}))

vi.mock("../_components/DeviceQuotaMappingGuide", () => ({
  DeviceQuotaMappingGuide: () => <div data-testid="mapping-guide">Guide</div>,
}))

vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => <div data-testid="tenant-selector">Tenant selector</div>,
}))

import DeviceQuotaMappingPage from "../page"

describe("DeviceQuotaMappingPage", () => {
  it("renders mapping workbench panes with the shared 40:60 split layout", () => {
    render(<DeviceQuotaMappingPage />)

    expect(screen.getByTestId("device-quota-split-pane")).toHaveClass(
      "lg:grid-cols-[minmax(320px,40%)_minmax(0,60%)]"
    )
    expect(screen.getByTestId("mapping-unassigned-list")).toBeInTheDocument()
    expect(screen.getByTestId("mapping-category-tree")).toBeInTheDocument()
    expect(screen.getByTestId("mapping-actions")).toBeInTheDocument()
  })
})
