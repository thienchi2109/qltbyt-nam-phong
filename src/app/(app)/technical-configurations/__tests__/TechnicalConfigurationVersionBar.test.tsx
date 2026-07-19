import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationVersionBar } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationVersionBar"

import {
  createDraft,
  createLockedVersion,
  openBaselineVersionSelect,
} from "./technical-configuration-baseline-tab-fixtures"

const idleStatus = {
  hasDraft: false,
  isCreating: false,
  isLocking: false,
  isCopying: false,
  isLoadingMoreVersions: false,
  hasLoadMoreError: false,
  isNavigationDisabled: false,
  hasMoreVersions: false,
  isDownloadingTemplate: false,
  isImportBusy: false,
  isImportBlocked: false,
}

describe("TechnicalConfigurationVersionBar", () => {
  it("renders the preserved historical selection through a visible HeroUI trigger", async () => {
    const user = userEvent.setup()
    const selectedVersion = createLockedVersion({ id: "version-1", version_number: 1 })
    const visibleVersion = createLockedVersion({ id: "version-2", version_number: 2 })

    render(
      <TechnicalConfigurationVersionBar
        versions={[visibleVersion]}
        selectedVersion={selectedVersion}
        lockBlockedReason={null}
        status={{ ...idleStatus, hasMoreVersions: true }}
        onSelectVersion={vi.fn()}
        onLoadMoreVersions={vi.fn()}
        onRequestLock={vi.fn()}
        onCreateBlank={vi.fn()}
        onCopy={vi.fn()}
        onDownloadTemplate={vi.fn()}
        onRequestImport={vi.fn()}
      />
    )

    const trigger = screen.getByRole("button", { name: /Lịch sử phiên bản/ })
    expect(trigger).toHaveTextContent("Phiên bản 1 · Đã khóa")
    expect(screen.queryByRole("combobox", { name: "Lịch sử phiên bản" })).not.toBeInTheDocument()

    await openBaselineVersionSelect(user)
    expect(screen.getByRole("option", { name: "Phiên bản 1 · Đã khóa" })).toBeInTheDocument()
  })

  it("uses the preserved draft snapshot for a same-id selector option", async () => {
    const user = userEvent.setup()
    const selectedVersion = createDraft({ id: "version-1", version_number: 1 })
    const serverVersion = createLockedVersion({ id: selectedVersion.id, version_number: 1 })

    render(
      <TechnicalConfigurationVersionBar
        versions={[serverVersion]}
        selectedVersion={selectedVersion}
        lockBlockedReason={null}
        status={{ ...idleStatus, hasDraft: true }}
        onSelectVersion={vi.fn()}
        onLoadMoreVersions={vi.fn()}
        onRequestLock={vi.fn()}
        onCreateBlank={vi.fn()}
        onCopy={vi.fn()}
        onDownloadTemplate={vi.fn()}
        onRequestImport={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: /Lịch sử phiên bản/ })).toHaveTextContent(
      "Phiên bản 1 · Bản nháp"
    )
    await openBaselineVersionSelect(user)
    expect(screen.getByRole("option", { name: "Phiên bản 1 · Bản nháp" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Phiên bản 1 · Đã khóa" })).not.toBeInTheDocument()
  })
})
