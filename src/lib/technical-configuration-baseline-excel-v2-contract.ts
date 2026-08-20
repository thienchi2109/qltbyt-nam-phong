/** Stable discriminator shared by baseline workbook contract versions. */
export const BASELINE_WORKBOOK_V2_TEMPLATE_KIND = "technical_configuration_baseline"

/** Supported user-facing baseline workbook contract version. */
export const BASELINE_WORKBOOK_V2_TEMPLATE_VERSION = 2

/** Visible worksheet containing editable hierarchy rows. */
export const BASELINE_WORKBOOK_V2_CONFIGURATION_SHEET_NAME = "Nhập cấu hình"

/** Visible worksheet containing instructions and non-imported examples. */
export const BASELINE_WORKBOOK_V2_INSTRUCTIONS_SHEET_NAME = "Hướng dẫn & Ví dụ"

/** Hidden worksheet containing ownership and revision metadata. */
export const BASELINE_WORKBOOK_V2_META_SHEET_NAME = "_meta"

/** Visible reference header for the persisted criterion title. */
export const BASELINE_WORKBOOK_V2_CRITERION_TITLE_HEADER = "TIÊU ĐỀ (THAM CHIẾU)"

/** Header emitted before criterion titles became visible. */
export const BASELINE_WORKBOOK_V2_LEGACY_CRITERION_TITLE_HEADER = "__criterion_title"

/** Exact ordered metadata keys rendered on the hidden worksheet. */
export const BASELINE_WORKBOOK_V2_META_KEYS = [
  "template_kind",
  "template_version",
  "dossier_id",
  "baseline_version_id",
  "baseline_revision",
  "generated_at",
] as const

export interface TechnicalConfigurationBaselineWorkbookV2MetadataInput {
  dossier_id: string
  baseline_version_id: string
  baseline_revision: number
  generated_at: string
}

export interface TechnicalConfigurationBaselineWorkbookV2CriterionSource {
  id: string
  criterion_code: string
  title: string | null
  requirement_text: string
}

export interface TechnicalConfigurationBaselineWorkbookV2SubgroupSource {
  id: string
  name: string
  criteria: readonly TechnicalConfigurationBaselineWorkbookV2CriterionSource[]
}

export interface TechnicalConfigurationBaselineWorkbookV2GroupSource {
  id: string
  name: string
  criteria: readonly TechnicalConfigurationBaselineWorkbookV2CriterionSource[]
  subgroups: readonly TechnicalConfigurationBaselineWorkbookV2SubgroupSource[]
}

interface TechnicalConfigurationBaselineWorkbookV2BuildInputBase {
  metadata: TechnicalConfigurationBaselineWorkbookV2MetadataInput
}

export type TechnicalConfigurationBaselineWorkbookV2BuildInput =
  | (TechnicalConfigurationBaselineWorkbookV2BuildInputBase & {
      intent: "current-data"
      groups: readonly TechnicalConfigurationBaselineWorkbookV2GroupSource[]
    })
  | (TechnicalConfigurationBaselineWorkbookV2BuildInputBase & {
      intent: "blank-template"
    })

export interface TechnicalConfigurationBaselineWorkbookV2Column {
  key:
    | "stt"
    | "content"
    | "main_section_id"
    | "subgroup_id"
    | "criterion_id"
    | "criterion_code"
    | "criterion_title"
  header: string
  width: number
  hidden: boolean
}

export interface TechnicalConfigurationBaselineWorkbookV2Row {
  kind: "section" | "subgroup" | "criterion"
  stt: string | null
  content: string
  main_section_id: string | null
  subgroup_id: string | null
  criterion_id: string | null
  criterion_code: string | null
  criterion_title: string | null
}

/** Base import columns keep reference-only metadata hidden. */
export const BASELINE_WORKBOOK_V2_COLUMNS = [
  {
    key: "stt",
    header: "STT",
    width: 12,
    hidden: false,
  },
  {
    key: "content",
    header: "NỘI DUNG YÊU CẦU",
    width: 72,
    hidden: false,
  },
  {
    key: "main_section_id",
    header: "__main_section_id",
    width: 24,
    hidden: true,
  },
  {
    key: "subgroup_id",
    header: "__subgroup_id",
    width: 24,
    hidden: true,
  },
  {
    key: "criterion_id",
    header: "__criterion_id",
    width: 24,
    hidden: true,
  },
  {
    key: "criterion_code",
    header: "__criterion_code",
    width: 20,
    hidden: true,
  },
  {
    key: "criterion_title",
    header: BASELINE_WORKBOOK_V2_LEGACY_CRITERION_TITLE_HEADER,
    width: 40,
    hidden: true,
  },
] as const satisfies readonly TechnicalConfigurationBaselineWorkbookV2Column[]

const BASELINE_WORKBOOK_V2_CURRENT_DATA_COLUMNS = BASELINE_WORKBOOK_V2_COLUMNS.map((column) =>
  column.key === "criterion_title"
    ? {
        ...column,
        header: BASELINE_WORKBOOK_V2_CRITERION_TITLE_HEADER,
        hidden: false,
      }
    : column
)

/** Stable instructions and examples rendered outside the import worksheet. */
export const BASELINE_WORKBOOK_V2_INSTRUCTION_ROWS = [
  {
    kind: "title",
    stt: null,
    content: "HƯỚNG DẪN NHẬP CẤU HÌNH",
  },
  {
    kind: "instruction",
    stt: "STT La Mã",
    content: "Mục chính, ví dụ I, II, III.",
  },
  {
    kind: "instruction",
    stt: "STT số nguyên",
    content: "Nhóm con của mục chính gần nhất, ví dụ 1, 2, 3.",
  },
  {
    kind: "instruction",
    stt: "STT để trống",
    content: "Tiêu chí; có thể nhập nội dung nhiều dòng trong một ô.",
  },
  {
    kind: "example-header",
    stt: "STT",
    content: "NỘI DUNG YÊU CẦU",
  },
  {
    kind: "example-section",
    stt: "I",
    content: "Yêu cầu kỹ thuật",
  },
  {
    kind: "example-criterion",
    stt: null,
    content: "Độ chính xác ≤ 0,5 mm\nHỗ trợ tiếng Việt.",
  },
  {
    kind: "example-subgroup",
    stt: "1",
    content: "Điều kiện vận hành",
  },
  {
    kind: "example-criterion",
    stt: null,
    content: "Hoạt động ổn định ở 40 °C.",
  },
] as const

/** Converts a positive canonical order into its Roman worksheet marker. */
export function toTechnicalConfigurationBaselineRomanOrdinal(value: number): string {
  const parts = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ] as const
  let remainder = value
  let result = ""

  for (const [amount, marker] of parts) {
    while (remainder >= amount) {
      result += marker
      remainder -= amount
    }
  }

  return result
}

function createCriterionRow(
  criterion: TechnicalConfigurationBaselineWorkbookV2CriterionSource,
  mainSectionId: string,
  subgroupId: string | null
): TechnicalConfigurationBaselineWorkbookV2Row {
  return {
    kind: "criterion",
    stt: null,
    content: criterion.requirement_text,
    main_section_id: mainSectionId,
    subgroup_id: subgroupId,
    criterion_id: criterion.id,
    criterion_code: criterion.criterion_code,
    criterion_title: criterion.title,
  }
}

function createCurrentDataRows(
  groups: readonly TechnicalConfigurationBaselineWorkbookV2GroupSource[]
): TechnicalConfigurationBaselineWorkbookV2Row[] {
  return groups.flatMap((group, groupIndex) => [
    {
      kind: "section" as const,
      stt: toTechnicalConfigurationBaselineRomanOrdinal(groupIndex + 1),
      content: group.name,
      main_section_id: group.id,
      subgroup_id: null,
      criterion_id: null,
      criterion_code: null,
      criterion_title: null,
    },
    ...group.criteria.map((criterion) => createCriterionRow(criterion, group.id, null)),
    ...group.subgroups.flatMap((subgroup, subgroupIndex) => [
      {
        kind: "subgroup" as const,
        stt: String(subgroupIndex + 1),
        content: subgroup.name,
        main_section_id: group.id,
        subgroup_id: subgroup.id,
        criterion_id: null,
        criterion_code: null,
        criterion_title: null,
      },
      ...subgroup.criteria.map((criterion) => createCriterionRow(criterion, group.id, subgroup.id)),
    ]),
  ])
}

function createMetadata(input: TechnicalConfigurationBaselineWorkbookV2MetadataInput) {
  return {
    template_kind: BASELINE_WORKBOOK_V2_TEMPLATE_KIND,
    template_version: BASELINE_WORKBOOK_V2_TEMPLATE_VERSION,
    ...input,
  } as const
}

/** Builds the deterministic XLSX v2 workbook model without ExcelJS or side effects. */
export function createTechnicalConfigurationBaselineWorkbookV2Model(
  input: TechnicalConfigurationBaselineWorkbookV2BuildInput
) {
  const rows = input.intent === "current-data" ? createCurrentDataRows(input.groups) : []

  return {
    template_kind: BASELINE_WORKBOOK_V2_TEMPLATE_KIND,
    template_version: BASELINE_WORKBOOK_V2_TEMPLATE_VERSION,
    intent: input.intent,
    sheets: [
      {
        kind: "configuration" as const,
        name: BASELINE_WORKBOOK_V2_CONFIGURATION_SHEET_NAME,
        state: "visible" as const,
        columns:
          input.intent === "current-data"
            ? BASELINE_WORKBOOK_V2_CURRENT_DATA_COLUMNS
            : BASELINE_WORKBOOK_V2_COLUMNS,
        rows,
      },
      {
        kind: "instructions" as const,
        name: BASELINE_WORKBOOK_V2_INSTRUCTIONS_SHEET_NAME,
        state: "visible" as const,
        rows: BASELINE_WORKBOOK_V2_INSTRUCTION_ROWS,
      },
      {
        kind: "meta" as const,
        name: BASELINE_WORKBOOK_V2_META_SHEET_NAME,
        state: "hidden" as const,
        metadata: createMetadata(input.metadata),
      },
    ],
  } as const
}
