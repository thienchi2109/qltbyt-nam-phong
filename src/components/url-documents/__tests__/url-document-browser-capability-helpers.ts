import ts from "typescript"

const browserGlobalCapabilities = new Set([
  "BroadcastChannel",
  "caches",
  "confirm",
  "document",
  "eval",
  "EventSource",
  "fetch",
  "Function",
  "global",
  "globalThis",
  "history",
  "Image",
  "indexedDB",
  "localStorage",
  "location",
  "navigator",
  "open",
  "parent",
  "process",
  "Reflect",
  "self",
  "sessionStorage",
  "top",
  "URL",
  "WebSocket",
  "WebTransport",
  "window",
  "Worker",
  "XMLHttpRequest",
])
const browserContextMembers = new Set([
  "contentDocument",
  "contentWindow",
  "defaultView",
  "ownerDocument",
])
const browserMemberCapabilities = new Set([
  "document.cookie",
  "globalThis.open",
  "navigator.sendBeacon",
  "window.open",
])
const forbiddenJsxNetworkAttributes = new Map<string, ReadonlySet<string>>([
  ["audio", new Set(["src"])],
  ["button", new Set(["formAction"])],
  ["embed", new Set(["src"])],
  ["form", new Set(["action"])],
  ["iframe", new Set(["src"])],
  ["img", new Set(["src", "srcSet"])],
  ["input", new Set(["formAction", "src"])],
  ["link", new Set(["href"])],
  ["object", new Set(["data"])],
  ["script", new Set(["src"])],
  ["source", new Set(["src", "srcSet"])],
  ["track", new Set(["src"])],
  ["video", new Set(["poster", "src"])],
])

function isDirectForbiddenBrowserCapability(path: string) {
  const matchesMemberCapability = (candidate: string) =>
    [...browserMemberCapabilities].some(
      (capability) => candidate === capability || candidate.startsWith(`${capability}.`)
    )

  if (matchesMemberCapability(path)) return true

  const normalizedPath = path.replace(/^(?:globalThis|window)\./, "")
  if (matchesMemberCapability(normalizedPath)) return true

  const rootCapability = normalizedPath.split(".")[0]
  return browserGlobalCapabilities.has(rootCapability)
}

function readBrowserContextTail(path: string) {
  const segments = path.split(".")
  const contextIndex = segments.findLastIndex((segment) => browserContextMembers.has(segment))
  if (contextIndex < 0 || contextIndex === segments.length - 1) return null

  return segments.slice(contextIndex + 1).join(".")
}

export function hasBrowserContextAccess(path: string) {
  return path.split(".").some((segment) => browserContextMembers.has(segment))
}

export function isForbiddenBrowserCapability(path: string) {
  if (isDirectForbiddenBrowserCapability(path)) return true

  const browserContextTail = readBrowserContextTail(path)
  return browserContextTail ? isDirectForbiddenBrowserCapability(browserContextTail) : false
}

export function readForbiddenJsxNetworkAttribute(node: ts.JsxAttribute) {
  if (!ts.isIdentifier(node.name)) return null

  const element = node.parent.parent
  if (!ts.isJsxOpeningElement(element) && !ts.isJsxSelfClosingElement(element)) return null
  if (!ts.isIdentifier(element.tagName)) return null

  const tagName = element.tagName.text
  return forbiddenJsxNetworkAttributes.get(tagName)?.has(node.name.text)
    ? `${tagName}.${node.name.text}`
    : null
}
