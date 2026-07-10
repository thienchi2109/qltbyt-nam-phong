import * as React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AppMobileFloatingActions } from "@/app/(app)/_components/AppMobileFloatingActions"
import { MobileFloatingActionsProvider } from "@/components/shared/floating-actions"
import { TransfersToolbar } from "../_components/TransfersToolbar"

vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: ({
    className,
    variant = "default",
  }: {
    className?: string
    variant?: "default" | "command"
  }) => (
    <button
      type="button"
      data-testid="tenant-selector"
      data-class-name={className}
      data-trigger-variant={variant}
    >
      Cơ sở
    </button>
  ),
}))

vi.mock("@/components/transfers/FilterChips", () => ({
  FilterChips: () => <div data-testid="filter-chips" />,
}))

vi.mock("@/components/transfers/TransfersViewToggle", () => ({
  TransfersViewToggle: () => <div data-testid="view-toggle" />,
}))

vi.mock("@/components/assistant/AssistantTriggerButton", () => ({
  AssistantTriggerButton: ({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) => (
    <button
      type="button"
      aria-label={isOpen ? "Đóng trợ lý" : "Trợ lý AI"}
      data-testid="assistant-trigger-button"
      onClick={onToggle}
    />
  ),
}))

vi.mock("@/components/shared/floating-actions/MobileFloatingActionMenu", () => ({
  MobileFloatingActionMenu: ({
    actions,
  }: {
    actions: Array<{ id: string; label: string; onSelect: () => void }>
  }) => (
    <div data-testid="mobile-floating-action-menu">
      {actions.map((action) => (
        <button type="button" key={action.id} onClick={action.onSelect}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}))

type TransfersToolbarProps = React.ComponentProps<typeof TransfersToolbar>

function buildProps(overrides: Partial<TransfersToolbarProps> = {}): TransfersToolbarProps {
  return {
    showFacilityFilter: true,
    isRegionalLeader: false,
    activeFilterCount: 2,
    onOpenFilterModal: vi.fn(),
    onOpenAddDialog: vi.fn(),
    filterChipsValue: {},
    onRemoveFilter: vi.fn(),
    onClearAllFilters: vi.fn(),
    searchTerm: "",
    onSearchTermChange: vi.fn(),
    filterValue: { statuses: [], dateRange: null },
    onFilterChange: vi.fn(),
    compactFilters: true,
    ...overrides,
  }
}

function renderToolbar(overrides: Partial<TransfersToolbarProps> = {}) {
  const props = buildProps(overrides)
  return {
    props,
    ...render(<TransfersToolbar {...props} />),
  }
}

function renderToolbarWithMobileActions(overrides: Partial<TransfersToolbarProps> = {}) {
  const props = buildProps(overrides)
  const onAssistantToggle = vi.fn()

  return {
    props,
    onAssistantToggle,
    ...render(
      <MobileFloatingActionsProvider>
        <TransfersToolbar {...props} />
        <AppMobileFloatingActions isAssistantOpen={false} onAssistantToggle={onAssistantToggle} />
      </MobileFloatingActionsProvider>
    ),
  }
}

describe("TransfersToolbar", () => {
  it("matches the Repair compact toolbar without the desktop title above the grid", () => {
    renderToolbar()

    expect(
      screen.queryByText("Theo dõi và xử lý yêu cầu luân chuyển theo từng loại hình")
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("transfers-toolbar-compact-tenant")).toContainElement(
      screen.getByTestId("tenant-selector")
    )

    const row = screen.getByTestId("transfers-toolbar-compact-row")
    const search = screen.getByRole("searchbox", {
      name: "Tìm kiếm mã yêu cầu, thiết bị, lý do...",
    })
    const filterButton = within(row).getByRole("button", { name: "Bộ lọc" })

    expect(row).toContainElement(search)
    expect(row).toContainElement(filterButton)
    expect(filterButton).toHaveTextContent("Bộ lọc")
    expect(within(filterButton).getByText("2")).toBeInTheDocument()
    expect(screen.getByTestId("transfers-toolbar-filter-chips")).toContainElement(
      screen.getByTestId("filter-chips")
    )
  })

  it("registers the compact create action in the shared mobile floating menu", async () => {
    const onOpenAddDialog = vi.fn()
    renderToolbarWithMobileActions({ onOpenAddDialog })

    expect(screen.getByTestId("mobile-floating-action-menu")).toBeInTheDocument()
    expect(screen.queryByTestId("assistant-trigger-button")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Trợ lý AI" })).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole("button", { name: "Tạo yêu cầu mới" }))
    expect(onOpenAddDialog).toHaveBeenCalledTimes(1)
  })

  it("does not register the compact create action for regional leaders", () => {
    renderToolbarWithMobileActions({ isRegionalLeader: true })

    expect(screen.getByTestId("assistant-trigger-button")).toBeInTheDocument()
    expect(screen.queryByTestId("mobile-floating-action-menu")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tạo yêu cầu mới" })).not.toBeInTheDocument()
  })

  it("omits the redundant desktop title", () => {
    renderToolbar({ compactFilters: false })

    expect(
      screen.queryByText("Theo dõi và xử lý yêu cầu luân chuyển theo từng loại hình")
    ).not.toBeInTheDocument()
  })

  it("keeps the desktop create button wired outside compact mode", async () => {
    const onOpenAddDialog = vi.fn()
    renderToolbar({ compactFilters: false, onOpenAddDialog })

    await userEvent.setup().click(screen.getByRole("button", { name: "Tạo yêu cầu mới" }))
    expect(onOpenAddDialog).toHaveBeenCalledTimes(1)
  })
})
