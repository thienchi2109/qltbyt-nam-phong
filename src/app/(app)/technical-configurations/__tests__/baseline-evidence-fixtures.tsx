import type { Mock } from "vitest"

import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationDocumentWire } from "@/app/(app)/technical-configurations/document-types"

export type DocumentRpcMocks = {
  listDocuments: Mock
  createBaselineDocument: Mock
  updateBaselineDocument: Mock
  deleteBaselineDocument: Mock
  upsertBaselineCitation: Mock
  deleteBaselineCitation: Mock
  createReferenceDocument: Mock
  updateReferenceDocument: Mock
  deleteReferenceDocument: Mock
  upsertReferenceCitation: Mock
  deleteReferenceCitation: Mock
}

export const baselineVersion: TechnicalConfigurationBaselineDraftWire = {
  id: "version-1",
  dossier_id: "dossier-1",
  version_number: 1,
  status: "draft",
  source_baseline_version_id: null,
  source_version_number: null,
  next_criterion_number: 2,
  revision: 5,
  locked_at: null,
  locked_by: null,
  created_at: "2026-07-18T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-18T00:00:00.000Z",
  updated_by: 1,
  groups: [],
}

export function evidenceDocument(
  id: string,
  ownerType: TechnicalConfigurationDocumentWire["owner_type"],
  ownerId: string
): TechnicalConfigurationDocumentWire {
  return {
    id,
    owner_type: ownerType,
    owner_id: ownerId,
    name: `Tài liệu ${id}`,
    url: `https://example.com/${id}.pdf`,
    created_by: 1,
    created_at: "2026-07-18T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    citations: [],
  }
}
