import { z } from "zod"

export type MigrationStatus = "migrated" | "pending"

interface QueryCatalogModelBudget {
  maxItems?: number
  maxBytes?: number
  modelVisibleFields?: string[]
}

interface BaseQueryCatalogEntry {
  description: string
  rpcFunction: string
  inputSchema: z.ZodType<Record<string, unknown>>
}

interface MigratedQueryCatalogEntry extends BaseQueryCatalogEntry {
  migrationStatus: "migrated"
  modelBudget: QueryCatalogModelBudget
}

interface PendingQueryCatalogEntry extends BaseQueryCatalogEntry {
  migrationStatus: "pending"
  modelBudget?: QueryCatalogModelBudget
}

export type QueryCatalogEntry = MigratedQueryCatalogEntry | PendingQueryCatalogEntry

/** Curated read-only tool definitions shared by the BFF and contract tests. */
export const QUERY_CATALOG = {
  equipmentLookup: {
    description:
      "Lookup equipment details using approved read-only RPC. Supports text search plus structured `filters` for exact `equipmentCode`, current status, department, location, classification, model, and serial; use the returned total for aggregate counts.",
    rpcFunction: "ai_equipment_lookup",
    migrationStatus: "pending",
    inputSchema: z
      .object({
        query: z.string().trim().min(1).max(200).optional(),
        limit: z.number().int().min(1).max(50).optional(),
        status: z.string().trim().min(1).max(100).optional(),
        filters: z
          .object({
            equipmentCode: z.string().trim().min(1).max(200).optional(),
            status: z.string().trim().min(1).max(100).optional(),
            department: z.string().trim().min(1).max(200).optional(),
            location: z.string().trim().min(1).max(200).optional(),
            classification: z.string().trim().min(1).max(50).optional(),
            model: z.string().trim().min(1).max(200).optional(),
            serial: z.string().trim().min(1).max(200).optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  },
  maintenanceSummary: {
    description: "Retrieve maintenance summary data via approved read-only RPC.",
    rpcFunction: "ai_maintenance_summary",
    migrationStatus: "pending",
    inputSchema: z
      .object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      })
      .strict(),
  },
  maintenancePlanLookup: {
    description:
      "Lookup maintenance, calibration, and inspection plans for a specific equipment item.",
    rpcFunction: "ai_maintenance_plan_lookup",
    migrationStatus: "pending",
    inputSchema: z
      .object({
        p_thiet_bi_id: z.number().int().positive(),
        p_nam: z.number().int().min(2000).max(2100).optional(),
      })
      .strict(),
  },
  repairSummary: {
    description: "Retrieve repair summary data via approved read-only RPC.",
    rpcFunction: "ai_repair_summary",
    migrationStatus: "pending",
    inputSchema: z
      .object({
        status: z.string().trim().min(1).max(50).optional(),
      })
      .strict(),
  },
  usageHistory: {
    description: "Retrieve usage summary evidence for a specific equipment item from usage logs.",
    rpcFunction: "ai_usage_summary",
    migrationStatus: "pending",
    inputSchema: z
      .object({
        p_thiet_bi_id: z.number().int().positive(),
        p_months: z.number().int().min(1).max(24).optional(),
      })
      .strict(),
  },
  attachmentLookup: {
    description:
      "Lookup attachment metadata (file names, access types, URLs) for a specific equipment item. Returns normalized access contract.",
    rpcFunction: "ai_attachment_metadata",
    migrationStatus: "pending",
    inputSchema: z
      .object({
        p_thiet_bi_id: z.number().int().positive(),
      })
      .strict(),
  },
  deviceQuotaLookup: {
    description:
      "Check quota status for a specific equipment item against the active quota decision.",
    rpcFunction: "ai_device_quota_lookup",
    migrationStatus: "pending",
    inputSchema: z
      .object({
        p_thiet_bi_id: z.number().int().positive(),
      })
      .strict(),
  },
  quotaComplianceSummary: {
    description: "Get facility-level device quota compliance overview from the active decision.",
    rpcFunction: "ai_quota_compliance_summary",
    migrationStatus: "pending",
    inputSchema: z.object({}).strict(),
  },
  categorySuggestion: {
    description:
      "Suggest the best matching equipment categories for a provided device name. Call this only after the user has given `device_name`; the RPC returns a bounded candidate set instead of the full category catalog.",
    rpcFunction: "ai_category_suggestion",
    migrationStatus: "migrated",
    inputSchema: z
      .object({
        device_name: z.string().trim().min(1).max(200),
      })
      .strict(),
    modelBudget: {
      maxItems: 10,
      modelVisibleFields: ["ma_nhom", "ten_nhom", "parent_name", "phan_loai", "match_reason"],
    },
  },
  departmentList: {
    description:
      "List all departments (khoa/phòng) with equipment in the current facility. Call this BEFORE filtering equipmentLookup by department to get exact department names from the database.",
    rpcFunction: "ai_department_list",
    migrationStatus: "migrated",
    inputSchema: z.object({}).strict(),
    modelBudget: {
      maxItems: 50,
      modelVisibleFields: ["name", "equipment_count"],
    },
  },
} satisfies Record<string, QueryCatalogEntry>

export type QueryCatalogToolName = keyof typeof QUERY_CATALOG

/** Stable list of names exposed by the query catalog. */
export const QUERY_CATALOG_TOOL_NAMES = Object.keys(QUERY_CATALOG) as QueryCatalogToolName[]

/** Returns each catalog tool name paired with its approved RPC function. */
export function getQueryCatalogToolRpcMapping(): Record<string, string> {
  return Object.fromEntries(Object.entries(QUERY_CATALOG).map(([k, v]) => [k, v.rpcFunction]))
}

/** Returns each catalog tool name paired with its migration status. */
export function getQueryCatalogMigrationStatusMap(): Record<string, MigrationStatus> {
  return Object.fromEntries(Object.entries(QUERY_CATALOG).map(([k, v]) => [k, v.migrationStatus]))
}

/** Names of catalog tools that still await the migrated envelope contract. */
export const QUERY_CATALOG_PENDING_TOOL_NAMES: ReadonlySet<string> = new Set(
  Object.entries(QUERY_CATALOG)
    .filter(([, def]) => def.migrationStatus === "pending")
    .map(([name]) => name)
)
