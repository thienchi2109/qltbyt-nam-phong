import { readFileSync, readdirSync } from "node:fs"
import { extname, join, relative, sep } from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

import {
  assertNoForbiddenBrowserCapabilities,
  scriptKindForFile,
} from "./url-document-source-contract-helpers"

const sourceRoot = join(process.cwd(), "src/components/url-documents")
const supportedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"])
const expectedProductionModules = [
  "UrlDocumentForm.tsx",
  "UrlDocumentList.tsx",
  "url-document-utils.ts",
]
const expectedModuleReferences: Readonly<Record<string, readonly string[]>> = {
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
  [
    /\b(?:useMutation|useQuery|useToast|toast|confirm|fetch)\s*\(/,
    "mutation, query, toast, confirmation, or network orchestration",
  ],
  [/\bqueryKey\b|\.rpc\s*\(|\bsupabase\b|["']use server["']/, "persistence boundary"],
]

function normalizePath(path: string) {
  return path.split(sep).join("/")
}

function isProductionModulePath(path: string) {
  const normalized = normalizePath(path)
  const fileName = normalized.split("/").at(-1) ?? normalized

  return (
    supportedExtensions.has(extname(fileName)) &&
    !normalized.split("/").includes("__tests__") &&
    !/\.(?:test|spec)\.[^.]+$/.test(fileName)
  )
}

function collectProductionModules(directory: string): string[] {
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

function assertExactSet(
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

function assertNoForbiddenSourcePatterns(source: string, subject: string, fileName = "fixture.ts") {
  for (const [pattern, description] of forbiddenSourcePatterns) {
    if (pattern.test(source)) {
      throw new Error(`${subject} references ${description}`)
    }
  }

  assertNoForbiddenBrowserCapabilities(source, subject, fileName)
}

function readLiteralModuleReference(
  expression: ts.Expression | undefined,
  referenceKind: string,
  sourceFile: ts.SourceFile
) {
  if (!expression || !ts.isStringLiteral(expression)) {
    const text = expression?.getText(sourceFile) ?? "<missing>"
    throw new Error(`${referenceKind} must use a string literal: ${text}`)
  }

  return expression.text
}

function extractModuleReferences(source: string, fileName = "fixture.ts"): string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(fileName)
  )
  const references = new Set<string>()

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      references.add(readLiteralModuleReference(node.moduleSpecifier, "import", sourceFile))
    } else if (ts.isImportEqualsDeclaration(node)) {
      if (ts.isExternalModuleReference(node.moduleReference)) {
        references.add(
          readLiteralModuleReference(node.moduleReference.expression, "import equals", sourceFile)
        )
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      references.add(readLiteralModuleReference(node.moduleSpecifier, "export from", sourceFile))
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        references.add(
          readLiteralModuleReference(
            node.arguments.length === 1 ? node.arguments[0] : undefined,
            "dynamic import",
            sourceFile
          )
        )
      } else if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
        references.add(
          readLiteralModuleReference(
            node.arguments.length === 1 ? node.arguments[0] : undefined,
            "require",
            sourceFile
          )
        )
      }
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument
      const literal =
        ts.isLiteralTypeNode(argument) && ts.isStringLiteral(argument.literal)
          ? argument.literal
          : undefined
      references.add(readLiteralModuleReference(literal, "import type", sourceFile))
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return [...references].toSorted()
}

describe("URL document source-contract extractor", () => {
  it("extracts every supported literal module-reference form", () => {
    const source = `
      import defaultValue from "static-default"
      import type { TypeValue } from "static-type"
      import equalsValue = require("import-equals")
      export { value } from "named-export"
      export * from "star-export"
      void import("dynamic-import")
      const required = require("required-module")
      type Imported = import("import-type").Imported
    `

    expect(extractModuleReferences(source)).toEqual([
      "dynamic-import",
      "import-equals",
      "import-type",
      "named-export",
      "required-module",
      "star-export",
      "static-default",
      "static-type",
    ])
  })

  it("distinguishes allowed and denied static imports through exact set equality", () => {
    const observed = extractModuleReferences(`
      import type { Allowed } from "allowed"
      import { Denied } from "allowed/denied"
    `)

    expect(() => assertExactSet(observed, ["allowed"], "fixture imports")).toThrow(
      /unexpected=\[allowed\/denied\]/
    )
  })

  it.each([
    ["dynamic import", "const moduleName = 'dynamic'; void import(moduleName)"],
    ["require", "const moduleName = 'required'; require(moduleName)"],
    ["import type", "type ModuleName = 'types'; type Value = import(ModuleName).Value"],
  ])("fails closed for a computed %s reference", (_kind, source) => {
    expect(() => extractModuleReferences(source)).toThrow(/must use a string literal/)
  })

  it.each([...supportedExtensions])(
    "treats an added production %s module as inventory drift",
    (extension) => {
      const observed = [...expectedProductionModules, `nested/extra${extension}`].filter(
        isProductionModulePath
      )

      expect(() =>
        assertExactSet(observed, expectedProductionModules, "production inventory")
      ).toThrow(/unexpected=\[nested\/extra/)
    }
  )

  it("ignores test modules while detecting missing production modules", () => {
    const observed = [
      "UrlDocumentForm.tsx",
      "url-document-utils.ts",
      "__tests__/UrlDocumentList.test.tsx",
      "helper.spec.js",
    ].filter(isProductionModulePath)

    expect(() =>
      assertExactSet(observed, expectedProductionModules, "production inventory")
    ).toThrow(/missing=\[UrlDocumentList\.tsx\]/)
  })

  it("reports both missing and unexpected module specifiers", () => {
    expect(() =>
      assertExactSet(
        ["react", "unexpected-module"],
        ["react", "lucide-react"],
        "fixture references"
      )
    ).toThrow(/missing=\[lucide-react\]; unexpected=\[unexpected-module\]/)
  })

  it.each([
    ["localStorage", "localStorage.setItem('draft', 'value')"],
    ["sessionStorage", "window.sessionStorage.removeItem('draft')"],
    ["indexedDB", "globalThis.indexedDB.open('documents')"],
    ["XMLHttpRequest", "const request = new XMLHttpRequest()"],
    ["sendBeacon", "navigator.sendBeacon('/documents', payload)"],
    ["window.open", "window.open('/documents')"],
    ["computed sendBeacon", "navigator['sendBeacon']('/documents', payload)"],
    ["WebSocket", "const socket = new WebSocket('wss://example.com/documents')"],
    ["document.cookie", "document.cookie = 'draft=value'"],
  ])("detects the browser-side effect %s without relying on imports", (_name, source) => {
    expect(() => assertNoForbiddenSourcePatterns(source, "fixture source")).toThrow(
      /fixture source references browser capability/
    )
  })
})

describe("URL document production source boundary", () => {
  it("contains exactly the three approved production modules", () => {
    assertExactSet(
      collectProductionModules(sourceRoot),
      expectedProductionModules,
      "URL document production inventory"
    )
  })

  it.each(expectedProductionModules)(
    "keeps %s on its exact approved module-reference set",
    (fileName) => {
      const source = readFileSync(join(sourceRoot, fileName), "utf8")
      assertExactSet(
        extractModuleReferences(source, fileName),
        expectedModuleReferences[fileName],
        `${fileName} module references`
      )
    }
  )

  it.each(expectedProductionModules)(
    "keeps %s free of Equipment and persistence-specific symbols",
    (fileName) => {
      const source = readFileSync(join(sourceRoot, fileName), "utf8")
      expect(() => assertNoForbiddenSourcePatterns(source, fileName, fileName)).not.toThrow()
    }
  )
})
