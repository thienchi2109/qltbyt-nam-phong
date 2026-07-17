import { vi } from "vitest"

import { registerReferenceProductComparisonTests } from "./reference-products-comparison-cases"
import { registerReferenceProductConflictTests } from "./reference-products-conflict-cases"
import { registerReferenceProductHookTests } from "./reference-products-hook-cases"
import { registerReferenceProductResilienceTests } from "./reference-products-resilience-cases"
import { registerReferenceProductSaveResumeTests } from "./reference-products-save-resume-cases"
import { registerReferenceProductWorkspaceTests } from "./reference-products-workspace-cases"

const baselineRpc = vi.hoisted(() => ({
  listVersions: vi.fn(),
}))

const referenceRpc = vi.hoisted(() => ({
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  upsertResponse: vi.fn(),
}))

vi.mock("@/app/(app)/technical-configurations/technical-configuration-reference-rpc", () => ({
  listTechnicalConfigurationReferenceProducts: referenceRpc.listProducts,
  createTechnicalConfigurationReferenceProduct: referenceRpc.createProduct,
  updateTechnicalConfigurationReferenceProduct: referenceRpc.updateProduct,
  deleteTechnicalConfigurationReferenceProduct: referenceRpc.deleteProduct,
  upsertTechnicalConfigurationReferenceResponse: referenceRpc.upsertResponse,
}))

vi.mock("@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline", () => ({
  useTechnicalConfigurationBaseline: () => baselineRpc,
}))

vi.mock(
  "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab",
  async () => {
    const ReactModule = await import("react")
    return {
      TechnicalConfigurationBaselineTab: ({
        onDirtyChange,
        onNavigationBlockedChange,
      }: {
        onDirtyChange: (dirty: boolean) => void
        onNavigationBlockedChange?: (blocked: boolean) => void
      }) => {
        ReactModule.useEffect(() => {
          onDirtyChange(false)
          onNavigationBlockedChange?.(false)
        }, [onDirtyChange, onNavigationBlockedChange])
        return <div>Baseline editor</div>
      },
    }
  }
)

registerReferenceProductHookTests(referenceRpc)
registerReferenceProductSaveResumeTests(referenceRpc)
registerReferenceProductConflictTests(referenceRpc)
registerReferenceProductComparisonTests()
registerReferenceProductWorkspaceTests({ baselineRpc, referenceRpc })
registerReferenceProductResilienceTests({ baselineRpc, referenceRpc })
