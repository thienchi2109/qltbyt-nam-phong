import { vi } from "vitest"

import { registerSupplierOptionConflictTests } from "./supplier-options-conflict-cases"
import { registerSupplierOptionHookTests } from "./supplier-options-hook-cases"
import { registerSupplierOptionWorkspaceTests } from "./supplier-options-workspace-cases"

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

registerSupplierOptionHookTests(supplierOptionRpc)
registerSupplierOptionWorkspaceTests(supplierOptionRpc)
registerSupplierOptionConflictTests(supplierOptionRpc)
