import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

import { registerBaselineEvidenceCitationTests } from "./baseline-evidence-citation-cases"
import { registerBaselineEvidenceDocumentTests } from "./baseline-evidence-document-cases"
import { registerBaselineEvidenceMutationTests } from "./baseline-evidence-mutation-cases"
import { registerBaselineEvidenceQueryTests } from "./baseline-evidence-query-cases"
import { registerBaselineEvidenceWorkspaceTests } from "./baseline-evidence-workspace-cases"

const baselineRpc = vi.hoisted(() => ({
  listVersions: vi.fn(),
}))
const documentRpc = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  createBaselineDocument: vi.fn(),
  updateBaselineDocument: vi.fn(),
  deleteBaselineDocument: vi.fn(),
  upsertBaselineCitation: vi.fn(),
  deleteBaselineCitation: vi.fn(),
  createReferenceDocument: vi.fn(),
  updateReferenceDocument: vi.fn(),
  deleteReferenceDocument: vi.fn(),
  upsertReferenceCitation: vi.fn(),
  deleteReferenceCitation: vi.fn(),
}))

vi.mock("@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline", () => ({
  useTechnicalConfigurationBaseline: () => baselineRpc,
}))

vi.mock("@/app/(app)/technical-configurations/technical-configuration-document-rpc", () => ({
  listTechnicalConfigurationBaselineDocuments: documentRpc.listDocuments,
  createTechnicalConfigurationBaselineDocument: documentRpc.createBaselineDocument,
  updateTechnicalConfigurationBaselineDocument: documentRpc.updateBaselineDocument,
  deleteTechnicalConfigurationBaselineDocument: documentRpc.deleteBaselineDocument,
  upsertTechnicalConfigurationBaselineCitation: documentRpc.upsertBaselineCitation,
  deleteTechnicalConfigurationBaselineCitation: documentRpc.deleteBaselineCitation,
  createTechnicalConfigurationReferenceDocument: documentRpc.createReferenceDocument,
  updateTechnicalConfigurationReferenceDocument: documentRpc.updateReferenceDocument,
  deleteTechnicalConfigurationReferenceDocument: documentRpc.deleteReferenceDocument,
  upsertTechnicalConfigurationReferenceCitation: documentRpc.upsertReferenceCitation,
  deleteTechnicalConfigurationReferenceCitation: documentRpc.deleteReferenceCitation,
}))

registerBaselineEvidenceQueryTests(documentRpc)
registerBaselineEvidenceMutationTests(documentRpc)
registerBaselineEvidenceCitationTests()
registerBaselineEvidenceDocumentTests(documentRpc)
registerBaselineEvidenceWorkspaceTests({ baselineRpc, documentRpc })

describe("TechnicalConfigurationCitationEditor", () => {
  it("exists at the planned P7B2 component path", () => {
    expect(
      existsSync(
        join(
          process.cwd(),
          "src/app/(app)/technical-configurations/_components/TechnicalConfigurationCitationEditor.tsx"
        )
      )
    ).toBe(true)
  })
})
