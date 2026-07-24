import "@testing-library/jest-dom"
import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  option,
  optionsResponse,
  renderSupplierOptionsHook,
  supplier,
  suppliersResponse,
} from "./supplier-options-fixtures"
import { baselineVersion, jsonResponse, renderResponseHook } from "./supplier-option-response-cases"
import {
  baselineVersionsResponse,
  createDraft,
  dossier,
  getBaselineRpcMock,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"

const rpc = getBaselineRpcMock()

const supplierOptionRpc = vi.hoisted(() => ({
  listSuppliers: vi.fn(),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
  deleteSupplier: vi.fn(),
  listOptions: vi.fn(),
  createOption: vi.fn(),
  updateOption: vi.fn(),
  deleteOption: vi.fn(),
}))

vi.mock("@/app/(app)/technical-configurations/technical-configuration-supplier-option-rpc", () => ({
  listTechnicalConfigurationSuppliers: supplierOptionRpc.listSuppliers,
  createTechnicalConfigurationSupplier: supplierOptionRpc.createSupplier,
  updateTechnicalConfigurationSupplier: supplierOptionRpc.updateSupplier,
  deleteTechnicalConfigurationSupplier: supplierOptionRpc.deleteSupplier,
  listTechnicalConfigurationOptions: supplierOptionRpc.listOptions,
  createTechnicalConfigurationOption: supplierOptionRpc.createOption,
  updateTechnicalConfigurationOption: supplierOptionRpc.updateOption,
  deleteTechnicalConfigurationOption: supplierOptionRpc.deleteOption,
}))

describe("technical configuration beforeunload protection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listVersions.mockReset()
    rpc.getDossier.mockResolvedValue({ data: dossier })
    rpc.listVersions.mockResolvedValue(baselineVersionsResponse([createDraft()]))
    Object.values(supplierOptionRpc).forEach((mock) => mock.mockReset())
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

  it("registers beforeunload protection for a dirty supplier option draft", async () => {
    const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
    const currentOption = option({ id: "option-1" })
    supplierOptionRpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
    supplierOptionRpc.listOptions.mockResolvedValue(optionsResponse([currentOption]))
    const addEventListener = vi.spyOn(window, "addEventListener")

    try {
      const cleanHandlerCount = addEventListener.mock.calls.filter(
        ([eventName]) => eventName === "beforeunload"
      ).length
      const { result } = renderSupplierOptionsHook()
      await waitFor(() => expect(result.current.options).toHaveLength(1))

      act(() => result.current.updateOptionDraft({ model: "Model chưa lưu" }))

      await waitFor(() =>
        expect(
          addEventListener.mock.calls.filter(([eventName]) => eventName === "beforeunload")
        ).toHaveLength(cleanHandlerCount + 1)
      )
      const beforeUnloadHandler = addEventListener.mock.calls
        .filter(([eventName]) => eventName === "beforeunload")
        .at(-1)?.[1]
      const dirtyEvent = new Event("beforeunload", { cancelable: true })
      ;(beforeUnloadHandler as EventListener)(dirtyEvent)
      expect(dirtyEvent.defaultPrevented).toBe(true)
    } finally {
      addEventListener.mockRestore()
    }
  })

  it("registers beforeunload protection for a dirty exact-baseline response draft", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: null }))
    const addEventListener = vi.spyOn(window, "addEventListener")

    try {
      const cleanHandlerCount = addEventListener.mock.calls.filter(
        ([eventName]) => eventName === "beforeunload"
      ).length
      const { result } = renderResponseHook({ baseline: baselineVersion() })
      await waitFor(() => expect(result.current.responseQuery.isSuccess).toBe(true))

      act(() => result.current.updateDraft({ responseText: "Phản hồi chưa lưu" }))

      await waitFor(() =>
        expect(
          addEventListener.mock.calls.filter(([eventName]) => eventName === "beforeunload")
        ).toHaveLength(cleanHandlerCount + 1)
      )
      const beforeUnloadHandler = addEventListener.mock.calls
        .filter(([eventName]) => eventName === "beforeunload")
        .at(-1)?.[1]
      const dirtyEvent = new Event("beforeunload", { cancelable: true })
      ;(beforeUnloadHandler as EventListener)(dirtyEvent)
      expect(dirtyEvent.defaultPrevented).toBe(true)
    } finally {
      addEventListener.mockRestore()
      fetchMock.mockRestore()
    }
  })
})
