import ts from "typescript"

export function unwrapExpression(expression: ts.Expression): ts.Expression {
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

export function readStaticString(expression: ts.Expression): string | null {
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

export function readBindingPropertyName(element: ts.BindingElement) {
  if (element.dotDotDotToken) return null

  const propertyName = element.propertyName
  if (!propertyName && ts.isIdentifier(element.name)) return element.name.text
  if (propertyName) return readStaticPropertyName(propertyName)

  return null
}

export function readStaticPropertyName(propertyName: ts.PropertyName) {
  if (
    ts.isIdentifier(propertyName) ||
    ts.isStringLiteral(propertyName) ||
    ts.isNumericLiteral(propertyName)
  ) {
    return propertyName.text
  }
  if (ts.isComputedPropertyName(propertyName)) {
    return readStaticString(propertyName.expression)
  }

  return null
}

export function bindingPatternMayReferenceProperty(
  pattern: ts.BindingName,
  expectedPropertyName: string
): boolean {
  if (ts.isIdentifier(pattern)) return false

  return pattern.elements.some((element) => {
    if (ts.isOmittedExpression(element)) return false
    if (element.dotDotDotToken) return true

    if (ts.isObjectBindingPattern(pattern)) {
      const propertyName = readBindingPropertyName(element)
      if (propertyName === expectedPropertyName) return true
      if (element.propertyName && propertyName === null) return true
    }

    return bindingPatternMayReferenceProperty(element.name, expectedPropertyName)
  })
}

export function assignmentPatternMayReferenceProperty(
  pattern: ts.Expression,
  expectedPropertyName: string
): boolean {
  const unwrappedPattern = unwrapExpression(pattern)

  if (ts.isArrayLiteralExpression(unwrappedPattern)) {
    return unwrappedPattern.elements.some((element) => {
      if (ts.isOmittedExpression(element)) return false
      if (ts.isSpreadElement(element)) return true
      return assignmentPatternMayReferenceProperty(element, expectedPropertyName)
    })
  }

  if (!ts.isObjectLiteralExpression(unwrappedPattern)) return false

  return unwrappedPattern.properties.some((property) => {
    if (ts.isSpreadAssignment(property)) return true
    if (ts.isShorthandPropertyAssignment(property)) {
      return property.name.text === expectedPropertyName
    }
    if (!ts.isPropertyAssignment(property)) return false

    const propertyName = readStaticPropertyName(property.name)
    if (propertyName === expectedPropertyName || propertyName === null) return true
    return assignmentPatternMayReferenceProperty(property.initializer, expectedPropertyName)
  })
}

export function readDestructuringAssignmentSource(pattern: ts.Expression) {
  let current = pattern
  while (
    (ts.isAsExpression(current.parent) ||
      ts.isNonNullExpression(current.parent) ||
      ts.isParenthesizedExpression(current.parent) ||
      ts.isSatisfiesExpression(current.parent) ||
      ts.isTypeAssertionExpression(current.parent)) &&
    current.parent.expression === current
  ) {
    current = current.parent
  }

  const parent = current.parent
  return ts.isBinaryExpression(parent) &&
    parent.left === current &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ? parent.right
    : undefined
}
