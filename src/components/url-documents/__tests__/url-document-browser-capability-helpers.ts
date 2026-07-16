import ts from "typescript"

import {
  assignmentPatternMayReferenceProperty,
  bindingPatternMayReferenceProperty,
} from "./url-document-ast-helpers"

const browserGlobalCapabilities = new Set([
  "Audio",
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
  "importScripts",
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
  "setInterval",
  "setTimeout",
  "SharedWorker",
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
  "Object.getOwnPropertyDescriptor",
  "window.open",
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

export function isBrowserContextMemberAccess(node: ts.Node) {
  if (ts.isPropertyAccessExpression(node)) {
    return browserContextMembers.has(node.name.text)
  }
  if (
    ts.isElementAccessExpression(node) &&
    node.argumentExpression &&
    (ts.isStringLiteral(node.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(node.argumentExpression))
  ) {
    return browserContextMembers.has(node.argumentExpression.text)
  }

  return false
}

export function bindingPatternMayReferenceBrowserContext(pattern: ts.BindingName) {
  return [...browserContextMembers].some((propertyName) =>
    bindingPatternMayReferenceProperty(pattern, propertyName)
  )
}

export function assignmentPatternMayReferenceBrowserContext(pattern: ts.Expression) {
  return [...browserContextMembers].some((propertyName) =>
    assignmentPatternMayReferenceProperty(pattern, propertyName)
  )
}
