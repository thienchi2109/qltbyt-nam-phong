import { beforeEach, vi } from "vitest"

import { registerReferenceProductComparisonTests } from "./reference-products-comparison-cases"
import { registerReferenceProductConflictTests } from "./reference-products-conflict-cases"
import { registerReferenceProductEvidenceTests } from "./reference-products-evidence-cases"
import { registerReferenceProductHookTests } from "./reference-products-hook-cases"
import { registerReferenceProductOperationLockTests } from "./reference-products-operation-lock-cases"
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

const evidenceState = vi.hoisted(() => ({
  documentsQuery: { isLoading: false },
  getDocumentsForOwner: vi.fn(),
}))

const baselineDocumentsMock = vi.hoisted(() => ({
  props: null as {
    ownerType: string
    ownerId: string
    criterionId?: string | null
    readOnly?: boolean
    onDirtyChange?: (dirty: boolean) => void
    onNavigationBlockedChange?: (blocked: boolean) => void
  } | null,
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

vi.mock("@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDocuments", () => ({
  useTechnicalConfigurationDocuments: () => evidenceState,
}))

vi.mock(
  "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineDocuments",
  () => ({
    TechnicalConfigurationBaselineDocuments: (
      props: NonNullable<typeof baselineDocumentsMock.props>
    ) => {
      baselineDocumentsMock.props = props
      return (
        <div data-testid="reference-evidence-detail">
          {props.ownerType}:{props.ownerId}:{props.criterionId}
        </div>
      )
    },
  })
)

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

beforeEach(() => {
  evidenceState.getDocumentsForOwner.mockReset()
  evidenceState.getDocumentsForOwner.mockReturnValue([])
  baselineDocumentsMock.props = null
})

registerReferenceProductHookTests(referenceRpc)
registerReferenceProductOperationLockTests(referenceRpc)
registerReferenceProductSaveResumeTests(referenceRpc)
registerReferenceProductConflictTests(referenceRpc)
registerReferenceProductComparisonTests()
registerReferenceProductEvidenceTests({ evidenceState, baselineDocumentsMock })
registerReferenceProductWorkspaceTests({ baselineRpc, referenceRpc })
registerReferenceProductResilienceTests({ baselineRpc, referenceRpc })
