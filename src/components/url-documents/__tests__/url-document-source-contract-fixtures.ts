import { readdirSync } from "node:fs"
import { extname, join, relative, sep } from "node:path"

import { assertNoForbiddenBrowserCapabilities } from "./url-document-source-contract-helpers"

export const sourceRoot = join(process.cwd(), "src/components/url-documents")
export const supportedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
])
export const expectedProductionModules = [
  "UrlDocumentForm.tsx",
  "UrlDocumentList.tsx",
  "url-document-utils.ts",
]
export const expectedModuleReferences: Readonly<Record<string, readonly string[]>> = {
  "UrlDocumentForm.tsx": [
    "react",
    "lucide-react",
    "@/components/ui/button",
    "@/components/ui/input",
    "@/components/ui/label",
  ],
  "UrlDocumentList.tsx": [
    "lucide-react",
    "@/components/ui/button",
    "@/components/ui/scroll-area",
    "@/components/ui/skeleton",
    "./url-document-utils",
  ],
  "url-document-utils.ts": [],
}
const forbiddenSourcePatterns: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /EquipmentDetailFilesTab|useEquipmentAttachments|\bAttachment\b|file_dinh_kem/,
    "Equipment-specific type, hook, component, or adapter",
  ],
  [/equipment_(?:attachments_list|attachment_create|attachment_delete)/, "Equipment RPC"],
  [/\b(?:useMutation|useQuery|useToast|toast)\s*\(/, "mutation, query, or toast orchestration"],
  [/\bqueryKey\b|\.rpc\s*\(|\bsupabase\b|["']use server["']/, "persistence boundary"],
]

function normalizePath(path: string) {
  return path.split(sep).join("/")
}

export function isProductionModulePath(path: string) {
  const normalized = normalizePath(path)
  const fileName = normalized.split("/").at(-1) ?? normalized

  return (
    supportedExtensions.has(extname(fileName)) &&
    !normalized.split("/").includes("__tests__") &&
    !/\.(?:test|spec)\.[^.]+$/.test(fileName)
  )
}

export function collectProductionModules(directory: string): string[] {
  const modules: string[] = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name)
    if (entry.isDirectory()) {
      modules.push(...collectProductionModules(absolutePath))
    } else {
      const relativePath = normalizePath(relative(sourceRoot, absolutePath))
      if (isProductionModulePath(relativePath)) modules.push(relativePath)
    }
  }

  return modules.toSorted()
}

export function assertExactSet(
  observedValues: readonly string[],
  expectedValues: readonly string[],
  subject: string
) {
  const observed = [...new Set(observedValues)].toSorted()
  const expected = [...new Set(expectedValues)].toSorted()
  const missing = expected.filter((value) => !observed.includes(value))
  const unexpected = observed.filter((value) => !expected.includes(value))

  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `${subject} mismatch; missing=[${missing.join(", ")}]; unexpected=[${unexpected.join(", ")}]`
    )
  }
}

export function assertNoForbiddenSourcePatterns(
  source: string,
  subject: string,
  fileName = "fixture.ts"
) {
  for (const [pattern, description] of forbiddenSourcePatterns) {
    if (pattern.test(source)) {
      throw new Error(`${subject} references ${description}`)
    }
  }

  assertNoForbiddenBrowserCapabilities(source, subject, fileName)
}
