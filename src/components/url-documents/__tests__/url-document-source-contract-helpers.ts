import { extname } from "node:path"
import ts from "typescript"

const browserGlobalCapabilities = new Set([
  "fetch",
  "indexedDB",
  "localStorage",
  "sessionStorage",
  "WebSocket",
  "XMLHttpRequest",
])
const browserMemberCapabilities = new Set([
  "document.cookie",
  "navigator.sendBeacon",
  "window.open",
])

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

function readStaticAccessPath(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) return expression.text

  if (ts.isPropertyAccessExpression(expression)) {
    const parentPath = readStaticAccessPath(expression.expression)
    return parentPath ? `${parentPath}.${expression.name.text}` : null
  }

  if (ts.isElementAccessExpression(expression)) {
    const parentPath = readStaticAccessPath(expression.expression)
    const argument = expression.argumentExpression
    const propertyName =
      argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
        ? argument.text
        : null

    return parentPath && propertyName ? `${parentPath}.${propertyName}` : null
  }

  return null
}

function isForbiddenBrowserCapability(path: string) {
  if (browserMemberCapabilities.has(path)) return true

  const normalizedPath = path.replace(/^(?:globalThis|window)\./, "")
  if (browserMemberCapabilities.has(normalizedPath)) return true

  const rootCapability = normalizedPath.split(".")[0]
  return browserGlobalCapabilities.has(rootCapability)
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

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) ||
      ts.isNewExpression(node) ||
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    ) {
      const expression =
        ts.isCallExpression(node) || ts.isNewExpression(node) ? node.expression : node
      const path = readStaticAccessPath(expression)
      if (path && isForbiddenBrowserCapability(path)) {
        throw new Error(`${subject} references browser capability ${path}`)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}
