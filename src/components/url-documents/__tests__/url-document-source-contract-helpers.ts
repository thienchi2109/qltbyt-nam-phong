import { extname } from "node:path"
import ts from "typescript"

import { readStaticString, unwrapExpression } from "./url-document-ast-helpers"

const browserGlobalCapabilities = new Set([
  "BroadcastChannel",
  "caches",
  "confirm",
  "document",
  "EventSource",
  "fetch",
  "globalThis",
  "history",
  "Image",
  "indexedDB",
  "localStorage",
  "location",
  "navigator",
  "open",
  "parent",
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
  if (!importClause || importClause.isTypeOnly) return

  if (importClause.name) bindings.add(importClause.name.text)
  const namedBindings = importClause.namedBindings
  if (namedBindings && ts.isNamespaceImport(namedBindings)) {
    bindings.add(namedBindings.name.text)
  } else if (namedBindings) {
    for (const element of namedBindings.elements) {
      if (!element.isTypeOnly) bindings.add(element.name.text)
    }
  }
}

function hasDeclareModifier(node: ts.Node) {
  return (
    ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)
  )
}

function isInAmbientContext(node: ts.Node) {
  let current: ts.Node | undefined = node
  while (current) {
    if (ts.isSourceFile(current)) return current.isDeclarationFile
    if (hasDeclareModifier(current)) return true
    current = current.parent
  }

  return false
}

function addStatementBindings(statement: ts.Statement, bindings: Set<string>) {
  if (isInAmbientContext(statement)) return

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
  } else if (ts.isImportEqualsDeclaration(statement) && !statement.isTypeOnly) {
    bindings.add(statement.name.text)
  }
}

function addFunctionScopedVarBindings(root: ts.Node, bindings: Set<string>) {
  const visit = (node: ts.Node) => {
    if (node !== root && ts.isFunctionLike(node)) return

    if (
      ts.isVariableDeclarationList(node) &&
      (node.flags & ts.NodeFlags.BlockScoped) === 0 &&
      !isInAmbientContext(node)
    ) {
      for (const declaration of node.declarations) {
        addBindingNames(declaration.name, bindings)
      }
    }

    ts.forEachChild(node, visit)
  }

  ts.forEachChild(root, visit)
}

function collectScopeBindings(node: ts.Node): Set<string> | null {
  const bindings = new Set<string>()

  if (ts.isSourceFile(node) || ts.isBlock(node)) {
    for (const statement of node.statements) addStatementBindings(statement, bindings)
    if (ts.isSourceFile(node)) addFunctionScopedVarBindings(node, bindings)
  } else if (ts.isCaseBlock(node)) {
    for (const clause of node.clauses) {
      for (const statement of clause.statements) addStatementBindings(statement, bindings)
    }
  } else if (ts.isFunctionLike(node)) {
    if (ts.isFunctionExpression(node) && node.name) bindings.add(node.name.text)
    for (const parameter of node.parameters) addBindingNames(parameter.name, bindings)
    addFunctionScopedVarBindings(node, bindings)
  } else if (ts.isClassExpression(node)) {
    if (node.name) bindings.add(node.name.text)
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

  const assertComputedAccessAllowed = (
    node: ts.ElementAccessExpression,
    scopes: readonly Set<string>[]
  ) => {
    if (readStaticString(node.argumentExpression) !== null) return

    const baseAccess = readStaticAccess(node.expression)
    if (
      baseAccess &&
      !isShadowed(baseAccess.root, scopes) &&
      isForbiddenBrowserCapability(baseAccess.path)
    ) {
      throw new Error(`${subject} references browser capability ${baseAccess.path}[computed]`)
    }
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
