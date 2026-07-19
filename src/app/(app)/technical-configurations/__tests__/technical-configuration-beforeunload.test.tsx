import "@testing-library/jest-dom"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  baselineVersionsResponse,
  createDraft,
  dossier,
  getBaselineRpcMock,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"

const rpc = getBaselineRpcMock()

describe("technical configuration beforeunload protection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listVersions.mockReset()
    rpc.getDossier.mockResolvedValue({ data: dossier })
    rpc.listVersions.mockResolvedValue(baselineVersionsResponse([createDraft()]))
  })

  it("registers beforeunload protection only while the form is dirty", async () => {
    const user = userEvent.setup()
    const addEventListener = vi.spyOn(window, "addEventListener")

    try {
      renderTab()

      const cleanHandlerCount = addEventListener.mock.calls.filter(
        ([eventName]) => eventName === "beforeunload"
      ).length

      const nameInput = await screen.findByDisplayValue("Yêu cầu chung")
      await user.type(nameInput, " thay đổi")

      await waitFor(() =>
        expect(
          addEventListener.mock.calls.filter(([eventName]) => eventName === "beforeunload")
        ).toHaveLength(cleanHandlerCount + 1)
      )
      const beforeUnloadHandler = addEventListener.mock.calls
        .filter(([eventName]) => eventName === "beforeunload")
        .at(-1)?.[1]
      expect(beforeUnloadHandler).toBeTypeOf("function")
      const dirtyEvent = new Event("beforeunload", { cancelable: true })
      ;(beforeUnloadHandler as EventListener)(dirtyEvent)
      expect(dirtyEvent.defaultPrevented).toBe(true)
    } finally {
      addEventListener.mockRestore()
    }
  })
})
