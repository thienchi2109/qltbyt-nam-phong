import ts from "typescript"

import {
  readBindingPropertyName,
  readStaticPropertyName,
  readStaticString,
  unwrapExpression,
} from "./url-document-ast-helpers"

const forbiddenJsxNetworkAttributes = new Map<string, ReadonlySet<string>>([
  ["a", new Set(["ping"])],
  ["audio", new Set(["src"])],
  ["button", new Set(["formAction"])],
  ["embed", new Set(["src"])],
  ["form", new Set(["action"])],
  ["iframe", new Set(["src", "srcDoc"])],
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
  "backgroundImage",
  "dangerouslySetInnerHTML",
  "data",
  "formAction",
  "innerHTML",
  "outerHTML",
  "ping",
  "poster",
  "src",
  "srcDoc",
  "srcSet",
  "style",
  "xlink:href",
  "xlinkHref",
])

type ElementFactoryKind = "cloneElement" | "createElement"

export interface ElementFactoryAliases {
  cloneElement: ReadonlySet<string>
  createElement: ReadonlySet<string>
}

interface ElementFactoryInvocation {
  argumentOffset: number | null
  factoryKind: ElementFactoryKind
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
  return tagName ? `${tagName}.*` : null
}

function readElementFactoryKind(
  expression: ts.Expression,
  aliases?: ElementFactoryAliases
): ElementFactoryKind | null {
  const unwrappedExpression = unwrapExpression(expression)
  if (
    ts.isBinaryExpression(unwrappedExpression) &&
    unwrappedExpression.operatorToken.kind === ts.SyntaxKind.CommaToken
  ) {
    return readElementFactoryKind(unwrappedExpression.right, aliases)
  }
  if (ts.isIdentifier(unwrappedExpression)) {
    if (
      unwrappedExpression.text === "cloneElement" ||
      unwrappedExpression.text === "createElement"
    ) {
      return unwrappedExpression.text
    }
    if (aliases?.cloneElement.has(unwrappedExpression.text)) return "cloneElement"
    if (aliases?.createElement.has(unwrappedExpression.text)) return "createElement"
    return null
  }
  if (ts.isPropertyAccessExpression(unwrappedExpression)) {
    const propertyName = unwrappedExpression.name.text
    if (propertyName === "cloneElement" || propertyName === "createElement") return propertyName
    return null
  }
  if (ts.isElementAccessExpression(unwrappedExpression) && unwrappedExpression.argumentExpression) {
    const propertyName = readStaticString(unwrappedExpression.argumentExpression)
    return propertyName === "cloneElement" || propertyName === "createElement" ? propertyName : null
  }

  return null
}

function readElementFactoryInvocation(
  expression: ts.Expression,
  aliases: ElementFactoryAliases
): ElementFactoryInvocation | null {
  const unwrappedExpression = unwrapExpression(expression)
  let invocationMethod: string | null = null
  if (ts.isPropertyAccessExpression(unwrappedExpression)) {
    invocationMethod = unwrappedExpression.name.text
  } else if (
    ts.isElementAccessExpression(unwrappedExpression) &&
    unwrappedExpression.argumentExpression
  ) {
    invocationMethod = readStaticString(unwrappedExpression.argumentExpression)
  }
  if (invocationMethod === "apply" || invocationMethod === "bind" || invocationMethod === "call") {
    const factoryKind = readElementFactoryKind(unwrappedExpression.expression, aliases)
    if (!factoryKind) return null
    return {
      argumentOffset: invocationMethod === "call" ? 1 : null,
      factoryKind,
    }
  }

  const factoryKind = readElementFactoryKind(unwrappedExpression, aliases)
  return factoryKind ? { argumentOffset: 0, factoryKind } : null
}

export function collectElementFactoryAliases(sourceFile: ts.SourceFile): ElementFactoryAliases {
  const aliases = {
    cloneElement: new Set<string>(),
    createElement: new Set<string>(),
  }
  let changed = true

  while (changed) {
    changed = false
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const factoryKind = readElementFactoryKind(node.initializer, aliases)
        if (factoryKind && !aliases[factoryKind].has(node.name.text)) {
          aliases[factoryKind].add(node.name.text)
          changed = true
        }
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left)
      ) {
        const factoryKind = readElementFactoryKind(node.right, aliases)
        if (factoryKind && !aliases[factoryKind].has(node.left.text)) {
          aliases[factoryKind].add(node.left.text)
          changed = true
        }
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isObjectBindingPattern(node.name) &&
        node.initializer
      ) {
        for (const element of node.name.elements) {
          const propertyName = readBindingPropertyName(element)
          if (
            (propertyName === "cloneElement" || propertyName === "createElement") &&
            ts.isIdentifier(element.name) &&
            !aliases[propertyName].has(element.name.text)
          ) {
            aliases[propertyName].add(element.name.text)
            changed = true
          }
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
  }

  return aliases
}

function readJsxExpressionTagName(expression: ts.Expression) {
  const unwrappedExpression = unwrapExpression(expression)
  if (ts.isJsxSelfClosingElement(unwrappedExpression)) {
    return readJsxTagName(unwrappedExpression.tagName)
  }
  if (ts.isJsxElement(unwrappedExpression)) {
    return readJsxTagName(unwrappedExpression.openingElement.tagName)
  }

  return null
}

function readForbiddenNetworkProps(tagName: string | null, props: ts.Expression | undefined) {
  if (!props || props.kind === ts.SyntaxKind.NullKeyword) return null

  const unwrappedProps = unwrapExpression(props)
  if (!ts.isObjectLiteralExpression(unwrappedProps)) {
    return !tagName || forbiddenJsxNetworkAttributes.has(tagName) ? `${tagName ?? "*"}.*` : null
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

export function readForbiddenElementFactoryNetworkAccess(
  node: ts.CallExpression,
  aliases: ElementFactoryAliases
) {
  const invocation = readElementFactoryInvocation(node.expression, aliases)
  if (!invocation) return null
  if (invocation.argumentOffset === null) return "*.*"

  const element = node.arguments[invocation.argumentOffset]
  let tagName: string | null = null
  if (element) {
    tagName =
      invocation.factoryKind === "createElement"
        ? readStaticString(element)
        : readJsxExpressionTagName(element)
  }

  return readForbiddenNetworkProps(tagName, node.arguments[invocation.argumentOffset + 1])
}

export function readForbiddenDomNetworkMutation(node: ts.BinaryExpression) {
  if (
    node.operatorToken.kind < ts.SyntaxKind.FirstAssignment ||
    node.operatorToken.kind > ts.SyntaxKind.LastAssignment
  ) {
    return null
  }

  const target = unwrapExpression(node.left)
  let propertyName: string | null = null
  if (ts.isPropertyAccessExpression(target)) {
    propertyName = target.name.text
  } else if (ts.isElementAccessExpression(target) && target.argumentExpression) {
    propertyName = readStaticString(target.argumentExpression)
  }

  return propertyName && forbiddenNetworkAttributeNames.has(propertyName)
    ? `*.${propertyName}`
    : null
}

export function readForbiddenDomNetworkCall(node: ts.CallExpression) {
  const expression = unwrapExpression(node.expression)
  let methodName: string | null = null
  if (ts.isPropertyAccessExpression(expression)) {
    methodName = expression.name.text
  } else if (ts.isElementAccessExpression(expression) && expression.argumentExpression) {
    methodName = readStaticString(expression.argumentExpression)
  }
  if (methodName === "insertAdjacentHTML") return "*.insertAdjacentHTML"
  if (methodName !== "setAttribute" && methodName !== "setAttributeNS") return null

  const attributeArgument = node.arguments[methodName === "setAttribute" ? 0 : 1]
  if (!attributeArgument) return "*.[computed]"

  const attributeName = readStaticString(attributeArgument)
  if (attributeName === null) return "*.[computed]"
  return forbiddenNetworkAttributeNames.has(attributeName) ? `*.${attributeName}` : null
}
