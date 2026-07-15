import { extname } from "node:path"
import ts from "typescript"

const browserGlobalCapabilities = new Set([
  "confirm",
  "fetch",
  "indexedDB",
  "localStorage",
  "sessionStorage",
  "WebSocket",
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

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isAsExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isParenthesizedExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isTypeAssertionExpression(expression)
  ) {
    return unwrapExpression(expression.expression)
  }

  return expression
}

function readStaticString(expression: ts.Expression): string | null {
  const unwrappedExpression = unwrapExpression(expression)
  if (
    ts.isStringLiteral(unwrappedExpression) ||
    ts.isNoSubstitutionTemplateLiteral(unwrappedExpression)
  ) {
    return unwrappedExpression.text
  }

  if (
    ts.isBinaryExpression(unwrappedExpression) &&
    unwrappedExpression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = readStaticString(unwrappedExpression.left)
    const right = readStaticString(unwrappedExpression.right)
    return left !== null && right !== null ? left + right : null
  }

  return null
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

function addBindingNames(name: ts.BindingName, bindings: Set<string>) {
  if (ts.isIdentifier(name)) {
    bindings.add(name.text)
    return
  }

  for (const element of name.elements) {
    if (ts.isBindingElement(element)) addBindingNames(element.name, bindings)
  }
}

function addImportBindings(node: ts.ImportDeclaration, bindings: Set<string>) {
  const importClause = node.importClause
  if (!importClause) return

  if (importClause.name) bindings.add(importClause.name.text)
  const namedBindings = importClause.namedBindings
  if (namedBindings && ts.isNamespaceImport(namedBindings)) {
    bindings.add(namedBindings.name.text)
  } else if (namedBindings) {
    for (const element of namedBindings.elements) bindings.add(element.name.text)
  }
}

function addStatementBindings(statement: ts.Statement, bindings: Set<string>) {
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      addBindingNames(declaration.name, bindings)
    }
  } else if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement)) &&
    statement.name &&
    ts.isIdentifier(statement.name)
  ) {
    bindings.add(statement.name.text)
  } else if (ts.isImportDeclaration(statement)) {
    addImportBindings(statement, bindings)
  } else if (ts.isImportEqualsDeclaration(statement)) {
    bindings.add(statement.name.text)
  }
}

function collectScopeBindings(node: ts.Node): Set<string> | null {
  const bindings = new Set<string>()

  if (ts.isSourceFile(node) || ts.isBlock(node)) {
    for (const statement of node.statements) addStatementBindings(statement, bindings)
  } else if (ts.isFunctionLike(node)) {
    for (const parameter of node.parameters) addBindingNames(parameter.name, bindings)
  } else if (ts.isCatchClause(node) && node.variableDeclaration) {
    addBindingNames(node.variableDeclaration.name, bindings)
  } else if (
    (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
    node.initializer &&
    ts.isVariableDeclarationList(node.initializer)
  ) {
    for (const declaration of node.initializer.declarations) {
      addBindingNames(declaration.name, bindings)
    }
  } else {
    return null
  }

  return bindings
}

function isReferenceIdentifier(node: ts.Identifier) {
  if (ts.isDeclarationName(node)) return false

  const parent = node.parent
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false
  if (ts.isBindingElement(parent) && parent.propertyName === node) return false

  return true
}

function isShadowed(root: ts.Identifier, scopes: readonly Set<string>[]) {
  return scopes.some((bindings) => bindings.has(root.text))
}

function readBindingPropertyName(element: ts.BindingElement) {
  if (element.dotDotDotToken) return null

  const propertyName = element.propertyName
  if (!propertyName && ts.isIdentifier(element.name)) return element.name.text
  if (
    propertyName &&
    (ts.isIdentifier(propertyName) ||
      ts.isStringLiteral(propertyName) ||
      ts.isNumericLiteral(propertyName))
  ) {
    return propertyName.text
  }
  if (propertyName && ts.isComputedPropertyName(propertyName)) {
    return readStaticString(propertyName.expression)
  }

  return null
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

  const visit = (node: ts.Node, parentScopes: readonly Set<string>[]) => {
    const bindings = collectScopeBindings(node)
    const scopes = bindings ? [...parentScopes, bindings] : parentScopes

    if (ts.isIdentifier(node) && isReferenceIdentifier(node)) {
      assertAccessAllowed(readStaticAccess(node), scopes)
    }

    if (
      ts.isCallExpression(node) ||
      ts.isNewExpression(node) ||
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    ) {
      const expression =
        ts.isCallExpression(node) || ts.isNewExpression(node) ? node.expression : node
      assertAccessAllowed(readStaticAccess(expression), scopes)
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer
    ) {
      const baseAccess = readStaticAccess(node.initializer)
      if (baseAccess && !isShadowed(baseAccess.root, scopes)) {
        for (const element of node.name.elements) {
          const propertyName = readBindingPropertyName(element)
          if (propertyName) {
            assertAccessAllowed(
              { ...baseAccess, path: `${baseAccess.path}.${propertyName}` },
              scopes
            )
          }
        }
      }
    }

    ts.forEachChild(node, (child) => visit(child, scopes))
  }

  visit(sourceFile, [])
}
