import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  collectUrlDocumentConsumers,
  inspectUrlDocumentConsumer,
} from "./url-document-consumer-contract-helpers"
import { extractModuleReferences } from "./url-document-module-reference-helpers"
import {
  assertExactSet,
  assertNoForbiddenSourcePatterns,
  expectedProductionModules,
  isProductionModulePath,
  supportedExtensions,
} from "./url-document-source-contract-fixtures"

const applicationSourceRoot = join(process.cwd(), "src")
const equipmentConsumerPath =
  "app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailFilesTab.tsx"

describe("URL document consumer source contract", () => {
  it("keeps the cumulative P6B consumer manifest exact", () => {
    assertExactSet(
      collectUrlDocumentConsumers(applicationSourceRoot),
      [equipmentConsumerPath],
      "P6B URL document consumers"
    )
  })

  it("delegates Equipment presentation through exact shared bindings", () => {
    const source = readFileSync(join(applicationSourceRoot, equipmentConsumerPath), "utf8")
    const contract = inspectUrlDocumentConsumer(source, equipmentConsumerPath)

    expect(contract.sharedImports).toEqual([
      "@/components/url-documents/UrlDocumentForm:UrlDocumentForm->UrlDocumentForm",
      "@/components/url-documents/UrlDocumentList:UrlDocumentList->UrlDocumentList",
      "@/components/url-documents/url-document-utils:isAllowedDocumentUrl->isAllowedDocumentUrl",
      "@/components/url-documents/url-document-utils:parseAbsoluteUrl->parseAbsoluteUrl",
    ])
    expect(contract.renderedElements).toEqual(
      expect.arrayContaining(["UrlDocumentForm", "UrlDocumentList"])
    )
    expect(contract.calledFunctions).toEqual(
      expect.arrayContaining(["isAllowedDocumentUrl", "parseAbsoluteUrl"])
    )
    expect(contract.forbiddenImports).toEqual([])
    expect(contract.forbiddenPresentationElements).toEqual([])
    expect(contract.constructsUrlDirectly).toBe(false)
  })
})

describe("URL document source-contract extractor", () => {
  it("extracts every supported literal module-reference form", () => {
    const source = `
      import defaultValue from "static-default"
      import type { TypeValue } from "static-type"
      import equalsValue = require("import-equals")
      export { value } from "named-export"
      export * from "star-export"
      void import("dynamic-import")
      void import("dynamic-import-with-attributes", { with: { type: "json" } })
      const required = require("required-module")
      declare const window: { require(id: string): unknown }
      const ambientMemberRequired = window.require("ambient-member-required")
      const moduleRequired = module.require("module-required")
      const computedModuleRequired = module["require"]("computed-module-required")
      type Imported = import("import-type").Imported
    `

    expect(extractModuleReferences(source)).toEqual([
      "ambient-member-required",
      "computed-module-required",
      "dynamic-import",
      "dynamic-import-with-attributes",
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

  it("fails closed when the ambient module object is aliased", () => {
    expect(() =>
      extractModuleReferences(`
        const runtime = module
        runtime.require("@tanstack/react-query")
      `)
    ).toThrow(/module must be accessed directly/)
  })

  it("fails closed when an ambient member require uses a computed specifier", () => {
    expect(() =>
      extractModuleReferences(`
        declare const window: { require(id: string): unknown }
        const moduleName = "@tanstack/react-query"
        window.require(moduleName)
      `)
    ).toThrow(/ambient require must use a string literal/)
  })

  it("fails closed when an indirect module loader chain is called", () => {
    expect(() =>
      extractModuleReferences('module.constructor._load("@tanstack/react-query")')
    ).toThrow(/module calls must use direct module\.require/)
  })

  it.each([
    [
      "require parameter",
      `
        function load(require: (name: string) => unknown) {
          return require("local-adapter")
        }
      `,
    ],
    [
      "module parameter",
      `
        function load(module: { require: (name: string) => unknown }) {
          return module.require("local-adapter")
        }
      `,
    ],
  ])("ignores a locally shadowed CommonJS %s", (_name, source) => {
    expect(extractModuleReferences(source)).toEqual([])
  })

  it("ignores a locally shadowed member require", () => {
    expect(
      extractModuleReferences(`
        function load(runtime: { require(name: string): unknown }) {
          return runtime.require("local-adapter")
        }
      `)
    ).toEqual([])
  })

  it("ignores CommonJS export assignment because it is not a module reference", () => {
    expect(extractModuleReferences("module.exports = {};", "fixture.cjs")).toEqual([])
  })

  it("treats an ambient require declaration as non-runtime", () => {
    expect(
      extractModuleReferences(`
        declare const require: (id: string) => unknown
        require("@tanstack/react-query")
      `)
    ).toEqual(["@tanstack/react-query"])
  })

  it("fails closed when a computed module member could hide require", () => {
    expect(() =>
      extractModuleReferences(`
        const method = "require"
        module[method]("@tanstack/react-query")
      `)
    ).toThrow(/module member must be a static require reference/)
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
    [
      "ambient fetch declaration",
      "declare const fetch: (url: string) => Promise<unknown>; void fetch('/api/documents')",
    ],
    ["sessionStorage", "window.sessionStorage.removeItem('draft')"],
    ["indexedDB", "globalThis.indexedDB.open('documents')"],
    ["XMLHttpRequest", "const request = new XMLHttpRequest()"],
    ["sendBeacon", "navigator.sendBeacon('/documents', payload)"],
    ["window.open", "window.open('/documents')"],
    ["top.open", "top.open('/documents')"],
    ["parent.open", "parent.open('/documents')"],
    ["global open", "open('/documents', '_blank')"],
    ["CacheStorage", "caches.open('documents')"],
    [
      "BroadcastChannel",
      "const channel = new BroadcastChannel('documents'); channel.postMessage('refresh')",
    ],
    ["EventSource", "new EventSource('/documents')"],
    ["Image", "const image = new Image(); image.src = '/documents/preview.png'"],
    ["Worker", "new Worker('/documents/worker.js')"],
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
    [
      "identifier-computed window capability",
      "const method = 'fetch'; window[method]('/documents')",
    ],
    [
      "identifier-computed globalThis capability",
      "const method = 'fetch'; globalThis[method]('/documents')",
    ],
    [
      "identifier-computed navigator capability",
      "const method = 'sendBeacon'; navigator[method]('/documents', payload)",
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

  it("allows an identifier-computed member on a locally shadowed browser root", () => {
    const source = `
      function run(window: Record<string, () => void>, method: string) {
        window[method]()
      }
    `

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
    ["named class expression", "const Local = class fetch { static current() { return fetch } }"],
  ])("allows a browser-global name shadowed by a %s", (_name, source) => {
    expect(() => assertNoForbiddenSourcePatterns(source, "fixture source")).not.toThrow()
  })

  it("allows a browser-global name used only in a type position", () => {
    const source = `
      type Image = { src: string }
      const preview: Image = { src: "" }
    `

    expect(() => assertNoForbiddenSourcePatterns(source, "fixture source")).not.toThrow()
  })

  it("allows the pure URL constructor through globalThis", () => {
    expect(() =>
      assertNoForbiddenSourcePatterns(
        'new globalThis.URL("https://example.com/document.pdf")',
        "fixture source"
      )
    ).not.toThrow()
  })
})
