import { describe, expect, it } from "vitest"

import { extractModuleReferences } from "./url-document-module-reference-helpers"

describe("URL document module-reference edge cases", () => {
  it.each([
    [
      "concatenated ambient member",
      `
        declare const window: { require(id: string): unknown }
        window["re" + "quire"]("@tanstack/react-query")
      `,
    ],
    [
      "asserted ambient member",
      `
        declare const window: { require(id: string): unknown }
        window["require" as const]("@tanstack/react-query")
      `,
    ],
    ["concatenated module member", 'module["re" + "quire"]("@tanstack/react-query")'],
  ])("extracts a literal module from a %s", (_name, source) => {
    expect(extractModuleReferences(source)).toEqual(["@tanstack/react-query"])
  })

  it("fails closed for an unresolved computed ambient member call", () => {
    expect(() =>
      extractModuleReferences(`
        declare const window: Record<string, (id: string) => unknown>
        const method = "require"
        window[method]("@tanstack/react-query")
      `)
    ).toThrow(/ambient member must use a static reference/)
  })

  it.each(["fixture.js", "fixture.jsx", "fixture.mjs", "fixture.cjs"])(
    "extracts a JSDoc import type from %s",
    (fileName) => {
      expect(
        extractModuleReferences(
          '/** @type {import("@tanstack/react-query").QueryClient} */\nconst client = null',
          fileName
        )
      ).toEqual(["@tanstack/react-query"])
    }
  )
})
