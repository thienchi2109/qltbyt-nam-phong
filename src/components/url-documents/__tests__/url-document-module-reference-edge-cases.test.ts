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

  it.each([
    ["type assertion", "(runtime as typeof runtime).require"],
    ["parentheses", "(runtime).require"],
    ["non-null assertion", "runtime!.require"],
  ])("extracts an ambient loader behind %s", (_name, loader) => {
    expect(
      extractModuleReferences(`
        declare const runtime: { require(id: string): unknown }
        ${loader}("@tanstack/react-query")
      `)
    ).toEqual(["@tanstack/react-query"])
  })

  it("fails closed when require is destructured from an ambient root", () => {
    expect(() =>
      extractModuleReferences(`
        declare const runtime: { require(id: string): unknown }
        const { require } = runtime
        require("@tanstack/react-query")
      `)
    ).toThrow(/ambient require must be called directly/)
  })

  it("allows require destructured from a local runtime value", () => {
    expect(
      extractModuleReferences(`
        const runtime = { require: (id: string) => id }
        const { require } = runtime
        require("local-value")
      `)
    ).toEqual([])
  })

  it.each([
    [
      "assignment",
      `
        declare const runtime: { require(id: string): unknown }
        let load: (id: string) => unknown
        ;({ require: load } = runtime)
        load("@tanstack/react-query")
      `,
    ],
    [
      "parameter",
      `
        function run({ require: load }: { require(id: string): unknown }) {
          load("@tanstack/react-query")
        }
      `,
    ],
    [
      "nested binding",
      `
        declare const runtime: { nested: { require(id: string): unknown } }
        const {
          nested: { require: load },
        } = runtime
        load("@tanstack/react-query")
      `,
    ],
    [
      "dynamic computed binding",
      `
        declare const runtime: Record<string, (id: string) => unknown>
        const key = "require"
        const { [key]: load } = runtime
        load("@tanstack/react-query")
      `,
    ],
    [
      "rest binding",
      `
        declare const runtime: { require(id: string): unknown }
        const { ...loaders } = runtime
        loaders.require("@tanstack/react-query")
      `,
    ],
  ])("fails closed for ambient require extracted through %s", (_name, source) => {
    expect(() => extractModuleReferences(source)).toThrow(
      /(?:ambient )?require must be called directly/
    )
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

  it.each(["fixture.js", "fixture.jsx", "fixture.mjs", "fixture.cjs"])(
    "extracts a JSDoc import tag from %s",
    (fileName) => {
      expect(
        extractModuleReferences(
          '/** @import { QueryClient } from "@tanstack/react-query" */\nconst client = null',
          fileName
        )
      ).toEqual(["@tanstack/react-query"])
    }
  )
})
