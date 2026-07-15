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
    ["Reflect", `void Reflect.get(() => {}, "constructor")('return fetch("/api/documents")')()`],
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

  it("rejects a runtime constructor extracted through destructuring", () => {
    const source = `
      const { constructor: execute } = (() => {}) as unknown as {
        constructor: typeof Function
      }
      execute('return fetch("/api/documents")')()
    `

    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source")).toThrow(
      /fixture source references runtime constructor/
    )
  })

  it.each([
    [
      "assignment",
      `
        let execute: typeof Function
        ;({ constructor: execute } = (() => {}) as unknown as {
          constructor: typeof Function
        })
        execute('return fetch("/api/documents")')()
      `,
    ],
    [
      "parameter",
      `
        function run({ constructor: execute }: { constructor: typeof Function }) {
          execute('return fetch("/api/documents")')()
        }
      `,
    ],
    [
      "nested binding",
      `
        const {
          value: { constructor: execute },
        } = { value: (() => {}) } as unknown as {
          value: { constructor: typeof Function }
        }
        execute('return fetch("/api/documents")')()
      `,
    ],
    [
      "dynamic computed binding",
      `
        const key = "constructor"
        const { [key]: execute } = (() => {}) as unknown as Record<
          string,
          typeof Function
        >
        execute('return fetch("/api/documents")')()
      `,
    ],
  ])("rejects a runtime constructor extracted through %s", (_name, source) => {
    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source")).toThrow(
      /fixture source references runtime constructor/
    )
  })

  it("fails closed for a dynamic property key", () => {
    const source = `
      const key = "constructor"
      const execute = (() => {})[key]
      execute('return fetch("/api/documents")')()
    `

    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source")).toThrow(
      /fixture source uses a computed property access without a static key/
    )
  })

  it("rejects an unbound browser capability captured by shorthand property", () => {
    const source = `
      const capabilities = { fetch }
      capabilities.fetch("/documents")
    `

    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source")).toThrow(
      /fixture source references browser capability fetch/
    )
  })

  it("allows a locally shadowed capability captured by shorthand property", () => {
    const source = `
      function run(fetch: (url: string) => void) {
        const capabilities = { fetch }
        capabilities.fetch("/documents")
      }
    `

    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source")).not.toThrow()
  })

  it.each([
    [
      "a browser capability reached through a DOM window chain",
      `
        function submit(event: Event) {
          event.currentTarget?.ownerDocument.defaultView?.fetch("/api/documents")
        }
      `,
      "fixture.ts",
    ],
    ["a form action", '<form action="/api/documents" method="post" />', "fixture.tsx"],
    ["an image source", '<img src="/api/documents/export" alt="" />', "fixture.tsx"],
    [
      "an unbound WebTransport constructor",
      'new WebTransport("https://example.com/documents")',
      "fixture.ts",
    ],
    ["an image source hidden in a spread", '<img {...{ src: "/x" }} alt="" />', "fixture.tsx"],
    ["a form action hidden in a spread", "<form {...props} />", "fixture.tsx"],
    ["an SVG image href", '<svg><image href="/x" /></svg>', "fixture.tsx"],
    [
      "an anchor ping",
      '<a href="https://example.com/document.pdf" ping="/audit">Document</a>',
      "fixture.tsx",
    ],
  ])("rejects imperative or implicit network access through %s", (_name, source, fileName) => {
    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source", fileName)).toThrow(
      /fixture source references browser/
    )
  })

  it("allows a local object method named fetch", () => {
    const source = `
      const api = { fetch: () => undefined }
      api.fetch()
    `

    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source")).not.toThrow()
  })

  it.each([
    [
      "variable alias",
      `
        const view = node.ownerDocument.defaultView
        view.fetch("/x")
      `,
    ],
    [
      "assignment alias",
      `
        let view
        view = node.ownerDocument.defaultView
        view.fetch("/x")
      `,
    ],
    [
      "destructuring alias",
      `
        const { fetch: load } = node.ownerDocument.defaultView
        load("/x")
      `,
    ],
    [
      "nested destructuring alias",
      `
        const { runtime: { fetch: load } } = {
          runtime: node.ownerDocument.defaultView,
        }
        load("/x")
      `,
    ],
    [
      "parameter-default alias",
      `
        function load(view = node.ownerDocument.defaultView) {
          view.fetch("/x")
        }
      `,
    ],
    [
      "call-chain access",
      `
        node.querySelector("iframe")?.contentWindow?.fetch("/x")
      `,
    ],
  ])("rejects a DOM-derived browser context propagated through %s", (_name, source) => {
    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source")).toThrow(
      /fixture source references browser/
    )
  })

  it("allows an anchor href without request-producing attributes", () => {
    expect(() =>
      assertNoForbiddenBrowserCapabilities(
        '<a href="https://example.com/document.pdf">Document</a>',
        "fixture source",
        "fixture.tsx"
      )
    ).not.toThrow()
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
