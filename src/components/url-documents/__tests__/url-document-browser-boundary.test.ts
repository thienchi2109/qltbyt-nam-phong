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
})
