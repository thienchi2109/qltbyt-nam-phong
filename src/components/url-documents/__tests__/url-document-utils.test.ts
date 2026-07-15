import { describe, expect, it } from "vitest"

import { isAllowedDocumentUrl, parseAbsoluteUrl } from "../url-document-utils"

describe("parseAbsoluteUrl", () => {
  it("returns the original raw value and parsed protocol for an absolute URL", () => {
    expect(parseAbsoluteUrl("https://example.com/documents/spec.pdf")).toEqual({
      raw: "https://example.com/documents/spec.pdf",
      protocol: "https:",
    })
  })

  it("returns null for unparseable text", () => {
    expect(parseAbsoluteUrl("không-phải-url")).toBeNull()
  })

  it.each(["/documents/spec.pdf", "//example.com/spec.pdf"])(
    "rejects non-absolute document reference %s",
    (value) => {
      expect(parseAbsoluteUrl(value)).toBeNull()
    }
  )

  it.each([
    "https://trusted.example\t@evil.example/document.pdf",
    "https://trusted.example\r@evil.example/document.pdf",
    "https://trusted.example\n@evil.example/document.pdf",
  ])("rejects a URL containing an ASCII tab or line break", (value) => {
    expect(parseAbsoluteUrl(value)).toBeNull()
  })

  it.each([
    ["ftp://example.com/spec.pdf", "ftp:"],
    ["mailto:owner@example.com", "mailto:"],
    ["blob:https://example.com/document-id", "blob:"],
    ["javascript:alert(1)", "javascript:"],
    ["data:text/plain,specification", "data:"],
    ["file:///tmp/spec.pdf", "file:"],
  ])("parses %s without deciding whether protocol %s is allowed", (value, protocol) => {
    expect(parseAbsoluteUrl(value)).toEqual({ raw: value, protocol })
  })

  it("preserves normalization-prone raw input while exposing the parsed protocol", () => {
    const raw = "HtTpS://EXAMPLE.com/a/../spec.pdf"

    expect(parseAbsoluteUrl(raw)).toEqual({
      raw,
      protocol: "https:",
    })
  })
})

describe("isAllowedDocumentUrl", () => {
  it.each([
    "http://example.com/spec.pdf",
    "https://example.com/spec.pdf",
    "HtTpS://EXAMPLE.com/a/../spec.pdf",
  ])("accepts an explicit HTTP(S) document URL %s", (value) => {
    expect(isAllowedDocumentUrl(parseAbsoluteUrl(value))).toBe(true)
  })

  it.each([
    "ftp://example.com/spec.pdf",
    "mailto:owner@example.com",
    "blob:https://example.com/document-id",
    "javascript:alert(1)",
    "data:text/plain,specification",
    "file:///tmp/spec.pdf",
  ])("rejects a parsed non-HTTP(S) protocol %s", (value) => {
    expect(isAllowedDocumentUrl(parseAbsoluteUrl(value))).toBe(false)
  })

  it.each([
    "https:example.com",
    "https:/example.com",
    String.raw`https:\example.com`,
    String.raw`https:\\example.com`,
  ])("rejects HTTP(S) shorthand or backslash variant %s", (value) => {
    expect(isAllowedDocumentUrl(parseAbsoluteUrl(value))).toBe(false)
  })

  it("rejects leading whitespace instead of trimming the raw value", () => {
    const parsed = parseAbsoluteUrl(" https://example.com/spec.pdf")

    expect(parsed?.raw).toBe(" https://example.com/spec.pdf")
    expect(isAllowedDocumentUrl(parsed)).toBe(false)
  })

  it("rejects a missing parsed URL", () => {
    expect(isAllowedDocumentUrl(null)).toBe(false)
  })
})
