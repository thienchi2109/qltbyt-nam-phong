import { extname } from "node:path"
import ts from "typescript"

import {
  assignmentPatternMayReferenceProperty,
  bindingPatternMayReferenceProperty,
  isShorthandPropertyReference,
  readBindingPropertyName,
  readDestructuringAssignmentSource,
  readStaticString,
  unwrapExpression,
} from "./url-document-ast-helpers"
import { collectScopeBindings } from "./url-document-scope-helpers"

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
  "window",
  "Worker",
  "XMLHttpRequest",
])
const browserMemberCapabilities = new Set([
  "document.cookie",
  "globalThis.open",
  "navigator.sendBeacon",
  "window.open",
])

interface StaticAccess {
  path: string
  root: ts.Identifier
}

export function scriptKindForFile(fileName: string) {
  switch (extname(fileName)) {
    case ".js":
    case ".cjs":
    case ".mjs":
      return ts.ScriptKind.JS
    case ".jsx":
      return ts.ScriptKind.JSX
    case ".tsx":
      return ts.ScriptKind.TSX
    default:
      return ts.ScriptKind.TS
  }
}

function readStaticAccess(expression: ts.Expression): StaticAccess | null {
  const unwrappedExpression = unwrapExpression(expression)
  if (ts.isIdentifier(unwrappedExpression)) {
    return { path: unwrappedExpression.text, root: unwrappedExpression }
  }

  if (ts.isPropertyAccessExpression(unwrappedExpression)) {
    const parentAccess = readStaticAccess(unwrappedExpression.expression)
    return parentAccess
      ? { ...parentAccess, path: `${parentAccess.path}.${unwrappedExpression.name.text}` }
      : null
  }

  if (ts.isElementAccessExpression(unwrappedExpression)) {
    const parentAccess = readStaticAccess(unwrappedExpression.expression)
    const propertyName = unwrappedExpression.argumentExpression
      ? readStaticString(unwrappedExpression.argumentExpression)
      : null

    return parentAccess && propertyName
      ? { ...parentAccess, path: `${parentAccess.path}.${propertyName}` }
      : null
  }

  return null
}

function isForbiddenBrowserCapability(path: string) {
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

function isAllowedUrlConstructorExpression(expression: ts.Expression) {
  const access = readStaticAccess(expression)
  return access?.path === "URL" || access?.path === "globalThis.URL"
}

function isRuntimeConstructorAccess(node: ts.Node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text === "constructor"
  if (ts.isElementAccessExpression(node) && node.argumentExpression) {
    return readStaticString(node.argumentExpression) === "constructor"
  }

  return false
}

function isExpressionWrapper(
  node: ts.Node
): node is
  | ts.AsExpression
  | ts.NonNullExpression
  | ts.ParenthesizedExpression
  | ts.SatisfiesExpression
  | ts.TypeAssertion {
  return (
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node)
  )
}

function isAllowedUrlConstructorUse(node: ts.Node) {
  if (ts.isNewExpression(node)) return isAllowedUrlConstructorExpression(node.expression)
  if (
    !ts.isIdentifier(node) &&
    !ts.isPropertyAccessExpression(node) &&
    !ts.isElementAccessExpression(node)
  ) {
    return false
  }

  let expression: ts.Expression = node
  while (isExpressionWrapper(expression.parent) && expression.parent.expression === expression) {
    expression = expression.parent
  }

  return (
    ts.isNewExpression(expression.parent) &&
    expression.parent.expression === expression &&
    isAllowedUrlConstructorExpression(expression)
  )
}

function isReferenceIdentifier(node: ts.Identifier) {
  if (ts.isDeclarationName(node) && !isShorthandPropertyReference(node)) return false

  const parent = node.parent
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) return false
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false
  if (ts.isElementAccessExpression(parent) && parent.expression === node) return false
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false
  if (ts.isBindingElement(parent) && parent.propertyName === node) return false

  return true
}

function isInTypePosition(node: ts.Node) {
  let current = node.parent
  while (current) {
    if (ts.isTypeNode(current)) return true
    if (ts.isExpression(current) || ts.isStatement(current) || ts.isSourceFile(current)) {
      return false
    }
    current = current.parent
  }

  return false
}

function isShadowed(root: ts.Identifier, scopes: readonly Set<string>[]) {
  return scopes.some((bindings) => bindings.has(root.text))
}

export function assertNoForbiddenBrowserCapabilities(
  source: string,
  subject: string,
  fileName = "fixture.ts"
) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(fileName)
  )

  const assertAccessAllowed = (access: StaticAccess | null, scopes: readonly Set<string>[]) => {
    if (access && !isShadowed(access.root, scopes) && isForbiddenBrowserCapability(access.path)) {
      throw new Error(`${subject} references browser capability ${access.path}`)
    }
  }

  const assertComputedAccessAllowed = (
    node: ts.ElementAccessExpression,
    scopes: readonly Set<string>[]
  ) => {
    if (readStaticString(node.argumentExpression) !== null) return

    const baseAccess = readStaticAccess(node.expression)
    if (baseAccess && isShadowed(baseAccess.root, scopes)) return
    if (baseAccess && isForbiddenBrowserCapability(baseAccess.path)) {
      throw new Error(`${subject} references browser capability ${baseAccess.path}[computed]`)
    }

    throw new Error(`${subject} uses a computed property access without a static key`)
  }

  const visit = (node: ts.Node, parentScopes: readonly Set<string>[]) => {
    const bindings = collectScopeBindings(node)
    const scopes = bindings ? [...parentScopes, bindings] : parentScopes
    const inTypePosition = isInTypePosition(node)
    const allowedUrlConstructorUse = isAllowedUrlConstructorUse(node)

    if (
      !inTypePosition &&
      !allowedUrlConstructorUse &&
      ts.isIdentifier(node) &&
      isReferenceIdentifier(node)
    ) {
      assertAccessAllowed(readStaticAccess(node), scopes)
    }

    if (!inTypePosition && ts.isElementAccessExpression(node)) {
      assertComputedAccessAllowed(node, scopes)
    }

    if (!inTypePosition && isRuntimeConstructorAccess(node)) {
      throw new Error(`${subject} references runtime constructor`)
    }

    if (
      !inTypePosition &&
      ts.isObjectBindingPattern(node) &&
      bindingPatternMayReferenceProperty(node, "constructor")
    ) {
      throw new Error(`${subject} references runtime constructor`)
    }

    if (
      !inTypePosition &&
      (ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)) &&
      readDestructuringAssignmentSource(node) &&
      assignmentPatternMayReferenceProperty(node, "constructor")
    ) {
      throw new Error(`${subject} references runtime constructor`)
    }

    if (
      !inTypePosition &&
      !allowedUrlConstructorUse &&
      (ts.isCallExpression(node) ||
        ts.isNewExpression(node) ||
        ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node))
    ) {
      const expression =
        ts.isCallExpression(node) || ts.isNewExpression(node) ? node.expression : node
      assertAccessAllowed(readStaticAccess(expression), scopes)
    }

    if (
      !inTypePosition &&
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer
    ) {
      const baseAccess = readStaticAccess(node.initializer)
      for (const element of node.name.elements) {
        const propertyName = readBindingPropertyName(element)
        if (propertyName && baseAccess && !isShadowed(baseAccess.root, scopes)) {
          assertAccessAllowed({ ...baseAccess, path: `${baseAccess.path}.${propertyName}` }, scopes)
        }
      }
    }

    ts.forEachChild(node, (child) => visit(child, scopes))
  }

  visit(sourceFile, [])
}
