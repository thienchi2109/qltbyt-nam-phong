import ts from "typescript"

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

export function collectScopeBindings(node: ts.Node): Set<string> | null {
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
