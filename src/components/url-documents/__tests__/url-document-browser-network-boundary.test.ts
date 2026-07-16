import { describe, expect, it } from "vitest"

import { assertNoForbiddenBrowserCapabilities } from "./url-document-source-contract-helpers"

describe("URL document browser network boundary", () => {
  it.each([
    [
      "nested browser-context alias",
      `
        const { ownerDocument: { defaultView: view } } = node
        view?.fetch("/x")
      `,
    ],
    [
      "nested fetch alias",
      `
        const {
          ownerDocument: { defaultView: { fetch: load } },
        } = node
        load("/x")
      `,
    ],
    [
      "destructuring assignment",
      `
        let view
        ;({ ownerDocument: { defaultView: view } } = node)
        view.fetch("/x")
      `,
    ],
    [
      "computed access through an alias",
      `
        const { ownerDocument: { defaultView: view } } = node
        view["fetch"]("/x")
      `,
    ],
  ])("rejects DOM-derived access through %s", (_name, source) => {
    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source")).toThrow(
      /fixture source references browser/
    )
  })

  it.each([
    [
      "React.createElement",
      'React.createElement("form", { action: "/api/documents", method: "post" })',
    ],
    [
      "a dynamic JSX tag",
      `
        const Tag = "img" as const
        ;<Tag src="/x" alt="" />
      `,
    ],
    ["a member JSX tag", '<svg.image href="/x" />'],
    ["a namespaced JSX tag", '<svg:image href="/x" />'],
  ])("rejects JSX-equivalent network construction through %s", (_name, source) => {
    expect(() =>
      assertNoForbiddenBrowserCapabilities(source, "fixture source", "fixture.tsx")
    ).toThrow(/fixture source references browser/)
  })

  it.each([
    [
      "an aliased React.createElement",
      `
        const h = React.createElement
        h("img", { src: "/api/documents", alt: "" })
      `,
    ],
    ["React.cloneElement", 'React.cloneElement(<img alt="" />, { src: "/api/documents" })'],
    [
      "dangerouslySetInnerHTML",
      `<div dangerouslySetInnerHTML={{ __html: '<img src="/api/documents">' }} />`,
    ],
    ["iframe srcDoc", `<iframe srcDoc={'<script>fetch("/api/documents")</script>'} />`],
    [
      "an imperative form action",
      `
        <form
          ref={(node) => {
            if (node) {
              node.action = "/api/documents"
              node.submit()
            }
          }}
        />
      `,
    ],
    ["an unknown intrinsic spread", "<div {...props} />"],
    [
      "setAttribute",
      `
        node.setAttribute("src", url)
      `,
    ],
    [
      "a compound DOM property assignment",
      `
        node.src += suffix
      `,
    ],
    [
      "an inline CSS image URL",
      `
        <div style={{ backgroundImage: "url(/api/documents)" }} />
      `,
    ],
    [
      "React.createElement.call",
      `
        React.createElement.call(React, "img", { src: "/api/documents", alt: "" })
      `,
    ],
    [
      "a comma-wrapped React.createElement",
      `
        ;(0, React.createElement)("img", { src: "/api/documents", alt: "" })
      `,
    ],
    [
      "React.createElement.apply",
      `
        React.createElement.apply(React, [
          "img",
          { src: "/api/documents", alt: "" },
        ])
      `,
    ],
    [
      "React.createElement.bind",
      `
        const h = React.createElement.bind(React)
        h("img", { src: "/api/documents", alt: "" })
      `,
    ],
    [
      "an imperative CSS image URL",
      `
        node.style.backgroundImage = "url(/api/documents)"
      `,
    ],
    [
      "imperative innerHTML",
      `
        node.innerHTML = '<img src="/api/documents">'
      `,
    ],
    [
      "insertAdjacentHTML",
      `
        node.insertAdjacentHTML("beforeend", '<img src="/api/documents">')
      `,
    ],
  ])("rejects a browser request constructed through %s", (_name, source) => {
    expect(() =>
      assertNoForbiddenBrowserCapabilities(source, "fixture source", "fixture.tsx")
    ).toThrow(/fixture source references browser/)
  })

  it.each([
    ["SharedWorker", 'new SharedWorker("/worker.js")'],
    ["Audio", 'new Audio("/sound.mp3")'],
    ["importScripts", 'importScripts("/worker-dependency.js")'],
  ])("rejects the ambient request API %s", (capability, source) => {
    expect(() => assertNoForbiddenBrowserCapabilities(source, "fixture source")).toThrow(
      new RegExp(`fixture source references browser capability ${capability}`)
    )
  })

  it("allows React.createElement for an anchor href without request-producing props", () => {
    expect(() =>
      assertNoForbiddenBrowserCapabilities(
        'React.createElement("a", { href: "https://example.com/document.pdf" }, "Document")',
        "fixture source",
        "fixture.tsx"
      )
    ).not.toThrow()
  })
})
