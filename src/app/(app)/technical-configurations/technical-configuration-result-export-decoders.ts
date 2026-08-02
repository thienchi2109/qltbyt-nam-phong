import {
  TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES,
  TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_VALUES,
  TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_VALUES,
} from "@/lib/technical-configuration-evaluation"

import type {
  TechnicalConfigurationResultExportDocumentLinkWire,
  TechnicalConfigurationResultExportManifestWireResponse,
  TechnicalConfigurationResultExportMatrixCellWire,
  TechnicalConfigurationResultExportPageRpcArgs,
  TechnicalConfigurationResultExportRankingItemWire,
  TechnicalConfigurationResultExportScopeRpcArgs,
} from "./technical-configuration-result-export-types"

export type TechnicalConfigurationResultExportErrorKind =
  | "permission_denied"
  | "not_found"
  | "conflict"
  | "validation"
  | "server"
  | "transport"
  | "invalid_response"
  | "snapshot_changed"

/** Typed failure for every non-cancellation P14 result-export operation. */
export class TechnicalConfigurationResultExportError extends Error {
  readonly kind: TechnicalConfigurationResultExportErrorKind
  readonly status?: number
  readonly code?: string
  readonly details?: string
  readonly hint?: string

  constructor(
    kind: TechnicalConfigurationResultExportErrorKind,
    message: string,
    metadata: {
      status?: number
      code?: string
      details?: string
      hint?: string
      cause?: unknown
    } = {}
  ) {
    super(message, { cause: metadata.cause })
    this.name = "TechnicalConfigurationResultExportError"
    this.kind = kind
    this.status = metadata.status
    this.code = metadata.code
    this.details = metadata.details
    this.hint = metadata.hint
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MANIFEST_DATA_KEYS =
  "dossier baseline_version option_total criterion_total snapshot_token ranking_snapshot_token".split(
    " "
  )
const DOSSIER_KEYS = "id device_type_name name revision archived_at".split(" ")
const BASELINE_KEYS = "id dossier_id version_number status revision locked_at".split(" ")
const PAGE_KEYS =
  "data dossier_id baseline_version_id snapshot_token ranking_snapshot_token total page page_size".split(
    " "
  )
const RANKING_ITEM_KEYS =
  "option_id supplier_id supplier_name display_label eligibility incomplete_criterion_count failed_count insufficient_evidence_count exceeds_count rank".split(
    " "
  )
const DOCUMENT_LINK_KEYS =
  "document_id document_name document_url citation_id page_section excerpt".split(" ")
const MATRIX_CELL_KEYS =
  "group_id group_name group_order criterion_id criterion_code criterion_title requirement_text criterion_order option_id supplier_id supplier_name display_label model manufacturer option_name response_text supplementary_information document_links technical_axis evidence_axis assessment_notes conclusion".split(
    " "
  )

function invalidResponse(path: string): never {
  throw new TechnicalConfigurationResultExportError(
    "invalid_response",
    `Invalid result export response at ${path}.`
  )
}

function exactRecord(value: unknown, keys: readonly string[], path: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalidResponse(path)
  }
  const record = value as Record<string, unknown>
  const actualKeys = Object.keys(record).sort()
  const expectedKeys = [...keys].sort()
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    return invalidResponse(path)
  }
  return record
}

function stringValue(value: unknown, path: string): string {
  return typeof value === "string" ? value : invalidResponse(path)
}

function nonEmptyString(value: unknown, path: string): string {
  const result = stringValue(value, path)
  return result.length > 0 ? result : invalidResponse(path)
}

function nullableString(value: unknown, path: string): string | null {
  return value === null ? null : stringValue(value, path)
}

function uuidValue(value: unknown, path: string): string {
  const result = stringValue(value, path)
  return UUID_PATTERN.test(result) ? result : invalidResponse(path)
}

function integerValue(value: unknown, path: string, minimum = 0): number {
  return Number.isSafeInteger(value) && Number(value) >= minimum
    ? Number(value)
    : invalidResponse(path)
}

function enumValue<T extends string>(value: unknown, values: readonly T[], path: string): T {
  return typeof value === "string" && values.includes(value as T)
    ? (value as T)
    : invalidResponse(path)
}

function nullableEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string
): T | null {
  return value === null ? null : enumValue(value, values, path)
}

/** Decode and validate the exact result-export manifest wire contract. */
export function decodeManifest(
  value: unknown,
  args: TechnicalConfigurationResultExportScopeRpcArgs
): TechnicalConfigurationResultExportManifestWireResponse {
  const response = exactRecord(value, ["data"], "manifest")
  const data = exactRecord(response.data, MANIFEST_DATA_KEYS, "manifest.data")
  const dossier = exactRecord(data.dossier, DOSSIER_KEYS, "manifest.data.dossier")
  const baseline = exactRecord(
    data.baseline_version,
    BASELINE_KEYS,
    "manifest.data.baseline_version"
  )
  const dossierId = uuidValue(dossier.id, "manifest.data.dossier.id")
  const baselineId = uuidValue(baseline.id, "manifest.data.baseline_version.id")
  const baselineDossierId = uuidValue(
    baseline.dossier_id,
    "manifest.data.baseline_version.dossier_id"
  )
  if (
    dossierId !== args.p_dossier_id ||
    baselineId !== args.p_baseline_version_id ||
    baselineDossierId !== dossierId
  ) {
    return invalidResponse("manifest.data.identity")
  }
  const optionTotal = integerValue(data.option_total, "manifest.data.option_total")
  const criterionTotal = integerValue(data.criterion_total, "manifest.data.criterion_total")
  if (
    (args.p_option_ids !== null && args.p_option_ids.length !== optionTotal) ||
    (args.p_criterion_ids !== null && args.p_criterion_ids.length !== criterionTotal)
  ) {
    return invalidResponse("manifest.data.scope_totals")
  }
  return {
    data: {
      dossier: {
        id: dossierId,
        device_type_name: stringValue(
          dossier.device_type_name,
          "manifest.data.dossier.device_type_name"
        ),
        name: stringValue(dossier.name, "manifest.data.dossier.name"),
        revision: integerValue(dossier.revision, "manifest.data.dossier.revision"),
        archived_at: nullableString(dossier.archived_at, "manifest.data.dossier.archived_at"),
      },
      baseline_version: {
        id: baselineId,
        dossier_id: baselineDossierId,
        version_number: integerValue(
          baseline.version_number,
          "manifest.data.baseline_version.version_number",
          1
        ),
        status: enumValue(
          baseline.status,
          ["draft", "locked"] as const,
          "manifest.data.baseline_version.status"
        ),
        revision: integerValue(baseline.revision, "manifest.data.baseline_version.revision"),
        locked_at: nullableString(baseline.locked_at, "manifest.data.baseline_version.locked_at"),
      },
      option_total: optionTotal,
      criterion_total: criterionTotal,
      snapshot_token: nonEmptyString(data.snapshot_token, "manifest.data.snapshot_token"),
      ranking_snapshot_token: nonEmptyString(
        data.ranking_snapshot_token,
        "manifest.data.ranking_snapshot_token"
      ),
    },
  }
}

/** Decode and validate shared result-export page metadata. */
export function decodePageMetadata(
  value: unknown,
  args: TechnicalConfigurationResultExportPageRpcArgs,
  path: string
) {
  const response = exactRecord(value, PAGE_KEYS, path)
  const dossierId = uuidValue(response.dossier_id, `${path}.dossier_id`)
  const baselineId = uuidValue(response.baseline_version_id, `${path}.baseline_version_id`)
  const page = integerValue(response.page, `${path}.page`, 1)
  const pageSize = integerValue(response.page_size, `${path}.page_size`, 1)
  if (
    dossierId !== args.p_dossier_id ||
    baselineId !== args.p_baseline_version_id ||
    page !== args.p_page ||
    pageSize !== args.p_page_size
  ) {
    return invalidResponse(`${path}.identity`)
  }
  const data = response.data
  if (!Array.isArray(data)) return invalidResponse(`${path}.data`)
  const total = integerValue(response.total, `${path}.total`)
  const offset = (page - 1) * pageSize
  const expectedPageLength = Math.min(pageSize, Math.max(total - offset, 0))
  if (data.length !== expectedPageLength) {
    return invalidResponse(`${path}.data.length`)
  }
  return {
    data,
    dossierId,
    baselineId,
    page,
    pageSize,
    total,
    snapshotToken: nonEmptyString(response.snapshot_token, `${path}.snapshot_token`),
    rankingSnapshotToken: nonEmptyString(
      response.ranking_snapshot_token,
      `${path}.ranking_snapshot_token`
    ),
  }
}

/** Decode one exact result-export ranking row. */
export function decodeRankingItem(
  value: unknown,
  index: number
): TechnicalConfigurationResultExportRankingItemWire {
  const path = `ranking.data[${index}]`
  const row = exactRecord(value, RANKING_ITEM_KEYS, path)
  return {
    option_id: uuidValue(row.option_id, `${path}.option_id`),
    supplier_id: uuidValue(row.supplier_id, `${path}.supplier_id`),
    supplier_name: stringValue(row.supplier_name, `${path}.supplier_name`),
    display_label: stringValue(row.display_label, `${path}.display_label`),
    eligibility: enumValue(
      row.eligibility,
      ["eligible", "incomplete"] as const,
      `${path}.eligibility`
    ),
    incomplete_criterion_count: integerValue(
      row.incomplete_criterion_count,
      `${path}.incomplete_criterion_count`
    ),
    failed_count: integerValue(row.failed_count, `${path}.failed_count`),
    insufficient_evidence_count: integerValue(
      row.insufficient_evidence_count,
      `${path}.insufficient_evidence_count`
    ),
    exceeds_count: integerValue(row.exceeds_count, `${path}.exceeds_count`),
    rank: row.rank === null ? null : integerValue(row.rank, `${path}.rank`, 1),
  }
}

function decodeDocumentLink(
  value: unknown,
  path: string
): TechnicalConfigurationResultExportDocumentLinkWire {
  const row = exactRecord(value, DOCUMENT_LINK_KEYS, path)
  return {
    document_id: uuidValue(row.document_id, `${path}.document_id`),
    document_name: stringValue(row.document_name, `${path}.document_name`),
    document_url: stringValue(row.document_url, `${path}.document_url`),
    citation_id: uuidValue(row.citation_id, `${path}.citation_id`),
    page_section: nullableString(row.page_section, `${path}.page_section`),
    excerpt: nullableString(row.excerpt, `${path}.excerpt`),
  }
}

/** Decode one exact result-export matrix cell. */
export function decodeMatrixCell(
  value: unknown,
  index: number
): TechnicalConfigurationResultExportMatrixCellWire {
  const path = `matrix.data[${index}]`
  const row = exactRecord(value, MATRIX_CELL_KEYS, path)
  if (!Array.isArray(row.document_links)) return invalidResponse(`${path}.document_links`)
  return {
    group_id: uuidValue(row.group_id, `${path}.group_id`),
    group_name: stringValue(row.group_name, `${path}.group_name`),
    group_order: integerValue(row.group_order, `${path}.group_order`),
    criterion_id: uuidValue(row.criterion_id, `${path}.criterion_id`),
    criterion_code: stringValue(row.criterion_code, `${path}.criterion_code`),
    criterion_title: nullableString(row.criterion_title, `${path}.criterion_title`),
    requirement_text: stringValue(row.requirement_text, `${path}.requirement_text`),
    criterion_order: integerValue(row.criterion_order, `${path}.criterion_order`),
    option_id: uuidValue(row.option_id, `${path}.option_id`),
    supplier_id: uuidValue(row.supplier_id, `${path}.supplier_id`),
    supplier_name: stringValue(row.supplier_name, `${path}.supplier_name`),
    display_label: stringValue(row.display_label, `${path}.display_label`),
    model: nullableString(row.model, `${path}.model`),
    manufacturer: nullableString(row.manufacturer, `${path}.manufacturer`),
    option_name: nullableString(row.option_name, `${path}.option_name`),
    response_text: nullableString(row.response_text, `${path}.response_text`),
    supplementary_information: nullableString(
      row.supplementary_information,
      `${path}.supplementary_information`
    ),
    document_links: row.document_links.map((link, linkIndex) =>
      decodeDocumentLink(link, `${path}.document_links[${linkIndex}]`)
    ),
    technical_axis: nullableEnum(
      row.technical_axis,
      TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_VALUES,
      `${path}.technical_axis`
    ),
    evidence_axis: nullableEnum(
      row.evidence_axis,
      TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_VALUES,
      `${path}.evidence_axis`
    ),
    assessment_notes: nullableString(row.assessment_notes, `${path}.assessment_notes`),
    conclusion: enumValue(
      row.conclusion,
      TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES,
      `${path}.conclusion`
    ),
  }
}
