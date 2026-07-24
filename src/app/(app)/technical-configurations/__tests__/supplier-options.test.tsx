import { beforeEach, vi } from "vitest"

import { registerSupplierOptionResponseConflictTests } from "./supplier-option-response-conflict-cases"
import { registerSupplierOptionResponseTests } from "./supplier-option-response-cases"
import { registerSupplierOptionResponseRecoveryTests } from "./supplier-option-response-recovery-cases"
import { registerSupplierOptionConflictTests } from "./supplier-options-conflict-cases"
import { registerSupplierOptionHookTests } from "./supplier-options-hook-cases"
import { registerSupplierOptionWorkspaceTests } from "./supplier-options-workspace-cases"

const baselineRpc = vi.hoisted(() => ({
  listVersions: vi.fn(),
}))

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

const optionResponseFetch = vi.hoisted(() => vi.fn())

vi.mock("@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline", () => ({
  useTechnicalConfigurationBaseline: () => baselineRpc,
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

vi.stubGlobal("fetch", optionResponseFetch)

beforeEach(() => {
  baselineRpc.listVersions.mockReset()
  baselineRpc.listVersions.mockResolvedValue({
    data: [],
    total: 0,
    page: 1,
    page_size: 100,
  })
  optionResponseFetch.mockReset()
})

registerSupplierOptionHookTests(supplierOptionRpc)
registerSupplierOptionWorkspaceTests(supplierOptionRpc)
registerSupplierOptionConflictTests(supplierOptionRpc)
registerSupplierOptionResponseTests({
  baselineRpc,
  fetchMock: optionResponseFetch,
  supplierOptionRpc,
})
registerSupplierOptionResponseConflictTests({
  baselineRpc,
  fetchMock: optionResponseFetch,
  supplierOptionRpc,
})
registerSupplierOptionResponseRecoveryTests({
  baselineRpc,
  fetchMock: optionResponseFetch,
  supplierOptionRpc,
})
