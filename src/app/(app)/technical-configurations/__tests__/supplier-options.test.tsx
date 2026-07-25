import { beforeEach, vi } from "vitest"

import { registerSupplierOptionImportConflictTests } from "./supplier-option-import-conflict-cases"
import { registerSupplierOptionImportWorkspaceTests } from "./supplier-option-import-workspace-cases"
import { registerSupplierOptionResponseAvailabilityTests } from "./supplier-option-response-availability-cases"
import { registerSupplierOptionResponseCoordinationTests } from "./supplier-option-response-coordination-cases"
import { registerSupplierOptionResponseConflictTests } from "./supplier-option-response-conflict-cases"
import { registerSupplierOptionResponseTests } from "./supplier-option-response-cases"
import { registerSupplierOptionResponseRecoveryTests } from "./supplier-option-response-recovery-cases"
import { registerSupplierOptionResponseUxTests } from "./supplier-option-response-ux-cases"
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

const workbookCodec = vi.hoisted(() => ({
  readWorkbook: vi.fn(),
  createParser: vi.fn(),
  createWorkbook: vi.fn(),
  downloadBlob: vi.fn(),
}))

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

vi.mock("@/lib/excel-utils", () => ({
  readExcelFile: workbookCodec.readWorkbook,
  worksheetToJson: vi.fn(),
}))

vi.mock("@/lib/excel-workbook", () => ({
  downloadBlob: workbookCodec.downloadBlob,
}))

vi.mock("@/lib/technical-configuration-option-excel-export", () => ({
  createTechnicalConfigurationOptionWorkbook: workbookCodec.createWorkbook,
}))

vi.mock("@/lib/technical-configuration-option-excel-parse", () => ({
  createTechnicalConfigurationOptionWorkbookParser: workbookCodec.createParser,
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
registerSupplierOptionImportWorkspaceTests({
  baselineRpc,
  fetchMock: optionResponseFetch,
  supplierOptionRpc,
  workbookCodec,
})
registerSupplierOptionImportConflictTests({
  baselineRpc,
  fetchMock: optionResponseFetch,
  supplierOptionRpc,
  workbookCodec,
})
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
registerSupplierOptionResponseCoordinationTests({
  baselineRpc,
  fetchMock: optionResponseFetch,
  supplierOptionRpc,
})
registerSupplierOptionResponseAvailabilityTests({
  fetchMock: optionResponseFetch,
})
registerSupplierOptionResponseUxTests({
  baselineRpc,
  fetchMock: optionResponseFetch,
  supplierOptionRpc,
})
