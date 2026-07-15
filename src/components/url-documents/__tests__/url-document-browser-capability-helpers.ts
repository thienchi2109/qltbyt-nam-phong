import ts from "typescript"

import {
  assignmentPatternMayReferenceProperty,
  bindingPatternMayReferenceProperty,
  readStaticPropertyName,
  readStaticString,
  unwrapExpression,
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
  "window.open",
])
const forbiddenJsxNetworkAttributes = new Map<string, ReadonlySet<string>>([
  ["a", new Set(["ping"])],
  ["audio", new Set(["src"])],
  ["button", new Set(["formAction"])],
  ["embed", new Set(["src"])],
  ["form", new Set(["action"])],
  ["iframe", new Set(["src"])],
  ["image", new Set(["href", "xlink:href", "xlinkHref"])],
  ["img", new Set(["src", "srcSet"])],
  ["input", new Set(["formAction", "src"])],
  ["link", new Set(["href"])],
  ["object", new Set(["data"])],
  ["script", new Set(["src"])],
  ["source", new Set(["src", "srcSet"])],
  ["track", new Set(["src"])],
  ["video", new Set(["poster", "src"])],
])
const forbiddenNetworkAttributeNames = new Set([
  "action",
  "data",
  "formAction",
  "ping",
  "poster",
  "src",
  "srcSet",
  "xlink:href",
  "xlinkHref",
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

function readJsxTagName(tagName: ts.JsxTagNameExpression) {
  if (ts.isIdentifier(tagName)) return tagName.text
  if (ts.isPropertyAccessExpression(tagName)) return tagName.name.text
  if (ts.isJsxNamespacedName(tagName)) return tagName.name.text
  return null
}

function readJsxElementName(node: ts.JsxAttribute | ts.JsxSpreadAttribute) {
  const element = node.parent.parent
  if (!ts.isJsxOpeningElement(element) && !ts.isJsxSelfClosingElement(element)) return null
  return readJsxTagName(element.tagName)
}

function isForbiddenNetworkAttribute(tagName: string | null, attributeName: string) {
  if (tagName && forbiddenJsxNetworkAttributes.get(tagName)?.has(attributeName)) return true
  return forbiddenNetworkAttributeNames.has(attributeName)
}

export function readForbiddenJsxNetworkAttribute(node: ts.JsxAttribute) {
  const tagName = readJsxElementName(node)
  if (!tagName) return null

  const attributeName = ts.isIdentifier(node.name)
    ? node.name.text
    : `${node.name.namespace.text}:${node.name.name.text}`
  return isForbiddenNetworkAttribute(tagName, attributeName) ? `${tagName}.${attributeName}` : null
}

export function readForbiddenJsxNetworkSpread(node: ts.JsxSpreadAttribute) {
  const tagName = readJsxElementName(node)
  return tagName && (forbiddenJsxNetworkAttributes.has(tagName) || /^[A-Z]/.test(tagName))
    ? `${tagName}.*`
    : null
}

function isCreateElementExpression(expression: ts.Expression) {
  const unwrappedExpression = unwrapExpression(expression)
  if (ts.isIdentifier(unwrappedExpression)) return unwrappedExpression.text === "createElement"
  if (ts.isPropertyAccessExpression(unwrappedExpression)) {
    return unwrappedExpression.name.text === "createElement"
  }
  if (ts.isElementAccessExpression(unwrappedExpression) && unwrappedExpression.argumentExpression) {
    return readStaticString(unwrappedExpression.argumentExpression) === "createElement"
  }

  return false
}

export function readForbiddenCreateElementNetworkAccess(node: ts.CallExpression) {
  if (!isCreateElementExpression(node.expression)) return null

  const tagName = node.arguments[0] ? readStaticString(node.arguments[0]) : null
  const props = node.arguments[1]
  if (!props || props.kind === ts.SyntaxKind.NullKeyword) return null

  const unwrappedProps = unwrapExpression(props)
  if (!ts.isObjectLiteralExpression(unwrappedProps)) {
    return tagName && forbiddenJsxNetworkAttributes.has(tagName) ? `${tagName}.*` : null
  }

  for (const property of unwrappedProps.properties) {
    if (ts.isSpreadAssignment(property)) {
      if (!tagName || forbiddenJsxNetworkAttributes.has(tagName)) return `${tagName ?? "*"}.*`
      continue
    }
    if (
      !ts.isPropertyAssignment(property) &&
      !ts.isShorthandPropertyAssignment(property) &&
      !ts.isMethodDeclaration(property) &&
      !ts.isGetAccessorDeclaration(property) &&
      !ts.isSetAccessorDeclaration(property)
    ) {
      continue
    }

    const propertyName = readStaticPropertyName(property.name)
    if (!propertyName) return `${tagName ?? "*"}.[computed]`
    if (isForbiddenNetworkAttribute(tagName, propertyName)) {
      return `${tagName ?? "*"}.${propertyName}`
    }
  }

  return null
}
