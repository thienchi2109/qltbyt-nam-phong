import { describe, expect, it } from "vitest"

import { assertNoForbiddenBrowserCapabilities } from "./url-document-source-contract-helpers"

describe("URL document browser boundary", () => {
  it.each([
    'URL.createObjectURL(new Blob(["document"]))',
    'URL.revokeObjectURL("blob:https://example.com/document")',
    "const UrlConstructor = URL",
  ])("rejects an unbound URL capability outside direct construction: %s", (source) => {
    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source")).toThrow(
      /fixture source references browser capability URL/
    )
  })

  it.each([
    ["eval", "void eval('fetch(\"/api/documents\")')"],
    ["Function", "void Function('return fetch(\"/api/documents\")')()"],
    ["process", 'void process.getBuiltinModule("node:fs")?.writeFileSync("/tmp/document", "x")'],
    [
      "global",
      'void global.process.getBuiltinModule("node:fs")?.writeFileSync("/tmp/document", "x")',
    ],
  ])("rejects the unbound runtime escape hatch %s", (capability, source) => {
    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source")).toThrow(
      new RegExp(`fixture source references browser capability ${capability}`)
    )
  })

  it.each([
    `const execute = (() => {}).constructor('return fetch("/api/documents")')`,
    `const execute = (() => {})["constructor"]('return fetch("/api/documents")')`,
  ])("rejects dynamic code execution through a constructor property: %s", (declaration) => {
    expect(() =>
      assertNoForbiddenBrowserCapabilities(`${declaration}\nvoid execute()`, "fixture source")
    ).toThrow(/fixture source references runtime constructor/)
  })

  it.each([
    'new URL("https://example.com/document.pdf")',
    'new globalThis.URL("https://example.com/document.pdf")',
  ])("allows pure URL construction: %s", (source) => {
    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source")).not.toThrow()
  })

  it("allows a locally shadowed URL capability", () => {
    const source = `
      function create(URL: { createObjectURL(value: unknown): string }) {
        return URL.createObjectURL("document")
      }
    `

    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source")).not.toThrow()
  })

  it("allows locally shadowed runtime names", () => {
    const source = `
      function run(
        eval: (source: string) => void,
        process: { write(value: string): void }
      ) {
        eval("local")
        process.write("local")
      }
    `

    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source")).not.toThrow()
  })
})
