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
