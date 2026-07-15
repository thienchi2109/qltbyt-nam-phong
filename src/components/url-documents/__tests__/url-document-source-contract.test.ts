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
  [/\b(?:useMutation|useQuery|useToast|toast)\s*\(/, "mutation, query, or toast orchestration"],
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

function isModuleRequireExpression(
  expression: ts.LeftHandSideExpression
): expression is ts.PropertyAccessExpression {
  return (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "module" &&
    expression.name.text === "require"
  )
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
      } else if (isModuleRequireExpression(node.expression)) {
        references.add(
          readLiteralModuleReference(
            node.arguments.length === 1 ? node.arguments[0] : undefined,
            "module.require",
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
    } else if (
      ts.isIdentifier(node) &&
      node.text === "require" &&
      !ts.isDeclarationName(node) &&
      !(ts.isCallExpression(node.parent) && node.parent.expression === node) &&
      !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
    ) {
      throw new Error("require must be called directly")
    } else if (
      isModuleRequireExpression(node as ts.LeftHandSideExpression) &&
      !(ts.isCallExpression(node.parent) && node.parent.expression === node)
    ) {
      throw new Error("module.require must be called directly")
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
      const moduleRequired = module.require("module-required")
      type Imported = import("import-type").Imported
    `

    expect(extractModuleReferences(source)).toEqual([
      "dynamic-import",
      "import-equals",
      "import-type",
      "module-required",
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

  it("fails closed when require is aliased instead of called directly", () => {
    expect(() =>
      extractModuleReferences(`
        const load = require
        load("@/app/(app)/equipment/_hooks/use-equipment-attachments")
      `)
    ).toThrow(/require must be called directly/)
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
    ["global open", "open('/documents', '_blank')"],
    ["CacheStorage", "caches.open('documents')"],
    ["EventSource", "new EventSource('/documents')"],
    ["self.fetch", "self.fetch('/documents')"],
    ["location.assign", "location.assign('/documents')"],
    ["history.pushState", "history.pushState({}, '', '/documents')"],
    ["computed sendBeacon", "navigator['sendBeacon']('/documents', payload)"],
    ["WebSocket", "const socket = new WebSocket('wss://example.com/documents')"],
    ["document.cookie", "document.cookie = 'draft=value'"],
    [
      "destructured sendBeacon",
      "const { sendBeacon } = navigator; sendBeacon('/documents', payload)",
    ],
    ["aliased localStorage", "const storage = localStorage; storage.setItem('draft', 'value')"],
    ["computed window.open", "window['op' + 'en']('/documents')"],
    ["aliased window root", "const browser = window; browser.open('/documents')"],
    ["aliased globalThis root", "const runtime = globalThis; runtime.fetch('/documents')"],
    [
      "assignment-destructured sendBeacon",
      "let send; ({ sendBeacon: send } = navigator); send('/documents', payload)",
    ],
    [
      "nested-destructured sendBeacon",
      "const { navigator: { sendBeacon } } = window; sendBeacon('/documents', payload)",
    ],
  ])("detects the browser-side effect %s without relying on imports", (_name, source) => {
    expect(() => assertNoForbiddenSourcePatterns(source, "fixture source")).toThrow(
      /fixture source references browser capability/
    )
  })

  it("allows a locally shadowed browser-global name", () => {
    const source = "function run(fetch: () => void) { fetch() }"

    expect(() => assertNoForbiddenSourcePatterns(source, "fixture source")).not.toThrow()
  })

  it("allows a browser-global name shadowed in a switch case block", () => {
    const source = `
      switch (kind) {
        case "local":
          const fetch = () => undefined
          fetch()
          break
      }
    `

    expect(() => assertNoForbiddenSourcePatterns(source, "fixture source")).not.toThrow()
  })

  it.each([
    ["named function expression", "const run = function fetch() { fetch() }"],
    [
      "function-scoped var from a nested block",
      "function run() { if (condition) { var fetch = () => undefined } fetch() }",
    ],
  ])("allows a browser-global name shadowed by a %s", (_name, source) => {
    expect(() => assertNoForbiddenSourcePatterns(source, "fixture source")).not.toThrow()
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
