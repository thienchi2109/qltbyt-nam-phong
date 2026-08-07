import { isRecord } from "@/lib/rpc-normalize"

import type {
  TechnicalConfigurationBaselineDecodedCriterion,
  TechnicalConfigurationBaselineDecodedDraft,
  TechnicalConfigurationBaselineDecodedDraftCreateWireResponse,
  TechnicalConfigurationBaselineDecodedDraftWireResponse,
  TechnicalConfigurationBaselineDecodedGroup,
  TechnicalConfigurationBaselineDecodedSubgroup,
  TechnicalConfigurationBaselineDecodedVersionsListWireResponse,
  TechnicalConfigurationBaselineStatus,
} from "./baseline-types"

interface HierarchyIdentityState {
  criterionIds: Set<string>
  groupIds: Set<string>
  subgroupIds: Set<string>
}

function invalidResponse(path: string): never {
  throw new Error(`invalid_response:${path}`)
}

function claimIdentity(id: string, identities: Set<string>, path: string): string {
  if (identities.has(id)) invalidResponse(path)
  identities.add(id)
  return id
}

function recordAt(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) invalidResponse(path)
  return value
}

function stringAt(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key]
  if (typeof value !== "string") invalidResponse(`${path}.${key}`)
  return value
}

function numberAt(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key]
  if (typeof value !== "number" || !Number.isFinite(value)) invalidResponse(`${path}.${key}`)
  return value
}

function nullableStringAt(
  record: Record<string, unknown>,
  key: string,
  path: string
): string | null {
  const value = record[key]
  if (value === null) return null
  if (typeof value !== "string") invalidResponse(`${path}.${key}`)
  return value
}

function nullableNumberAt(
  record: Record<string, unknown>,
  key: string,
  path: string
): number | null {
  const value = record[key]
  if (value === null) return null
  if (typeof value !== "number" || !Number.isFinite(value)) invalidResponse(`${path}.${key}`)
  return value
}

function statusAt(
  record: Record<string, unknown>,
  key: string,
  path: string
): TechnicalConfigurationBaselineStatus {
  const value = record[key]
  if (value !== "draft" && value !== "locked") invalidResponse(`${path}.${key}`)
  return value
}

function decodeCriterion(
  value: unknown,
  path: string,
  baselineVersionId: string,
  groupId: string,
  subgroupId: string | null,
  identities: HierarchyIdentityState
): TechnicalConfigurationBaselineDecodedCriterion {
  const record = recordAt(value, path)
  const criterionId = claimIdentity(
    stringAt(record, "id", path),
    identities.criterionIds,
    `${path}.id`
  )
  const decodedSubgroupId =
    record.subgroup_id === undefined ? null : nullableStringAt(record, "subgroup_id", path)
  if (
    stringAt(record, "baseline_version_id", path) !== baselineVersionId ||
    stringAt(record, "group_id", path) !== groupId ||
    decodedSubgroupId !== subgroupId
  ) {
    invalidResponse(`${path}.scope`)
  }

  return {
    id: criterionId,
    baseline_version_id: baselineVersionId,
    group_id: groupId,
    subgroup_id: decodedSubgroupId,
    criterion_code: stringAt(record, "criterion_code", path),
    title: nullableStringAt(record, "title", path),
    requirement_text: stringAt(record, "requirement_text", path),
    sort_order: numberAt(record, "sort_order", path),
    source_criterion_id: nullableStringAt(record, "source_criterion_id", path),
    created_at: stringAt(record, "created_at", path),
    created_by: numberAt(record, "created_by", path),
    updated_at: stringAt(record, "updated_at", path),
    updated_by: numberAt(record, "updated_by", path),
  }
}

function decodeSubgroup(
  value: unknown,
  path: string,
  baselineVersionId: string,
  groupId: string,
  identities: HierarchyIdentityState
): TechnicalConfigurationBaselineDecodedSubgroup {
  const record = recordAt(value, path)
  const subgroupId = claimIdentity(
    stringAt(record, "id", path),
    identities.subgroupIds,
    `${path}.id`
  )
  if (
    stringAt(record, "baseline_version_id", path) !== baselineVersionId ||
    stringAt(record, "group_id", path) !== groupId
  ) {
    invalidResponse(`${path}.scope`)
  }
  if (!Array.isArray(record.criteria)) invalidResponse(`${path}.criteria`)

  return {
    id: subgroupId,
    baseline_version_id: baselineVersionId,
    group_id: groupId,
    name: stringAt(record, "name", path),
    sort_order: numberAt(record, "sort_order", path),
    created_at: stringAt(record, "created_at", path),
    created_by: numberAt(record, "created_by", path),
    updated_at: stringAt(record, "updated_at", path),
    updated_by: numberAt(record, "updated_by", path),
    criteria: record.criteria.map((criterion, index) =>
      decodeCriterion(
        criterion,
        `${path}.criteria[${index}]`,
        baselineVersionId,
        groupId,
        subgroupId,
        identities
      )
    ),
  }
}

function decodeGroup(
  value: unknown,
  path: string,
  baselineVersionId: string,
  identities: HierarchyIdentityState
): TechnicalConfigurationBaselineDecodedGroup {
  const record = recordAt(value, path)
  const groupId = claimIdentity(stringAt(record, "id", path), identities.groupIds, `${path}.id`)
  if (stringAt(record, "baseline_version_id", path) !== baselineVersionId) {
    invalidResponse(`${path}.scope`)
  }
  if (!Array.isArray(record.criteria)) invalidResponse(`${path}.criteria`)
  const subgroups = record.subgroups === undefined ? [] : record.subgroups
  if (!Array.isArray(subgroups)) invalidResponse(`${path}.subgroups`)

  return {
    id: groupId,
    baseline_version_id: baselineVersionId,
    name: stringAt(record, "name", path),
    sort_order: numberAt(record, "sort_order", path),
    created_at: stringAt(record, "created_at", path),
    created_by: numberAt(record, "created_by", path),
    updated_at: stringAt(record, "updated_at", path),
    updated_by: numberAt(record, "updated_by", path),
    criteria: record.criteria.map((criterion, index) =>
      decodeCriterion(
        criterion,
        `${path}.criteria[${index}]`,
        baselineVersionId,
        groupId,
        null,
        identities
      )
    ),
    subgroups: subgroups.map((subgroup, index) =>
      decodeSubgroup(
        subgroup,
        `${path}.subgroups[${index}]`,
        baselineVersionId,
        groupId,
        identities
      )
    ),
  }
}

/** Decodes one baseline version while normalizing optional hierarchy fields. */
export function decodeTechnicalConfigurationBaselineDraftWire(
  value: unknown,
  path = "data"
): TechnicalConfigurationBaselineDecodedDraft {
  const record = recordAt(value, path)
  const baselineVersionId = stringAt(record, "id", path)
  if (!Array.isArray(record.groups)) invalidResponse(`${path}.groups`)
  const identities: HierarchyIdentityState = {
    criterionIds: new Set(),
    groupIds: new Set(),
    subgroupIds: new Set(),
  }

  return {
    id: baselineVersionId,
    dossier_id: stringAt(record, "dossier_id", path),
    version_number: numberAt(record, "version_number", path),
    status: statusAt(record, "status", path),
    source_baseline_version_id: nullableStringAt(record, "source_baseline_version_id", path),
    source_version_number: nullableNumberAt(record, "source_version_number", path),
    next_criterion_number: numberAt(record, "next_criterion_number", path),
    revision: numberAt(record, "revision", path),
    locked_at: nullableStringAt(record, "locked_at", path),
    locked_by: nullableNumberAt(record, "locked_by", path),
    created_at: stringAt(record, "created_at", path),
    created_by: numberAt(record, "created_by", path),
    updated_at: stringAt(record, "updated_at", path),
    updated_by: numberAt(record, "updated_by", path),
    groups: record.groups.map((group, index) =>
      decodeGroup(group, `${path}.groups[${index}]`, baselineVersionId, identities)
    ),
  }
}

/** Decodes a baseline version RPC response into the normalized client contract. */
export function decodeTechnicalConfigurationBaselineDraftWireResponse(
  value: unknown
): TechnicalConfigurationBaselineDecodedDraftWireResponse {
  const response = recordAt(value, "response")
  return {
    data: decodeTechnicalConfigurationBaselineDraftWire(response.data),
  }
}

/** Decodes a draft create/copy response and preserves dossier revision metadata. */
export function decodeTechnicalConfigurationBaselineDraftCreateWireResponse(
  value: unknown
): TechnicalConfigurationBaselineDecodedDraftCreateWireResponse {
  const response = recordAt(value, "response")
  const data = recordAt(response.data, "data")
  return {
    data: {
      ...decodeTechnicalConfigurationBaselineDraftWire(data),
      dossier_revision: numberAt(data, "dossier_revision", "data"),
    },
  }
}

/** Decodes a paginated baseline history response into normalized version snapshots. */
export function decodeTechnicalConfigurationBaselineVersionsListWireResponse(
  value: unknown
): TechnicalConfigurationBaselineDecodedVersionsListWireResponse {
  const response = recordAt(value, "response")
  if (!Array.isArray(response.data)) invalidResponse("response.data")
  return {
    data: response.data.map((draft, index) =>
      decodeTechnicalConfigurationBaselineDraftWire(draft, `response.data[${index}]`)
    ),
    total: numberAt(response, "total", "response"),
    page: numberAt(response, "page", "response"),
    page_size: numberAt(response, "page_size", "response"),
  }
}
