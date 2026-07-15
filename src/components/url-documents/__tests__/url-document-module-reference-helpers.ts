import ts from "typescript"

import { scriptKindForFile } from "./url-document-source-contract-helpers"

function readLiteralModuleReference(
  expression: ts.Expression | undefined,
  referenceKind: string,
  sourceFile: ts.SourceFile
) {
  if (!expression || !ts.isStringLiteral(expression)) {
    const text = expression?.getText(sourceFile) ?? "<missing>"
    throw new Error(`${referenceKind} must use a string literal: ${text}`)
  }

  return expression.text
}

function createSourceProgram(source: string, fileName: string) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(fileName)
  )
  const compilerOptions: ts.CompilerOptions = {
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    noLib: true,
    target: ts.ScriptTarget.Latest,
  }
  const host: ts.CompilerHost = {
    fileExists: (requestedFileName) => requestedFileName === fileName,
    getCanonicalFileName: (requestedFileName) => requestedFileName,
    getCurrentDirectory: () => "",
    getDefaultLibFileName: () => "",
    getNewLine: () => "\n",
    getSourceFile: (requestedFileName) => (requestedFileName === fileName ? sourceFile : undefined),
    readFile: (requestedFileName) => (requestedFileName === fileName ? source : undefined),
    useCaseSensitiveFileNames: () => true,
    writeFile: () => undefined,
  }
  const program = ts.createProgram([fileName], compilerOptions, host)
  const programSourceFile = program.getSourceFile(fileName)
  if (!programSourceFile) throw new Error(`Unable to parse ${fileName}`)

  return { checker: program.getTypeChecker(), sourceFile: programSourceFile }
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

function isTypeOnlyImportDeclaration(node: ts.Declaration) {
  if (ts.isImportSpecifier(node)) {
    return node.isTypeOnly || node.parent.parent.isTypeOnly
  }
  if (ts.isNamespaceImport(node)) return node.parent.isTypeOnly
  if (ts.isImportClause(node)) return node.isTypeOnly
  if (ts.isImportEqualsDeclaration(node)) return node.isTypeOnly
  return false
}

function hasRuntimeBinding(symbol: ts.Symbol) {
  const runtimeSymbolFlags = ts.SymbolFlags.Value | ts.SymbolFlags.Alias
  if ((symbol.flags & runtimeSymbolFlags) === 0) return false

  return symbol.declarations?.some(
    (declaration) => !isInAmbientContext(declaration) && !isTypeOnlyImportDeclaration(declaration)
  )
}

function isUnboundIdentifier(node: ts.Identifier, checker: ts.TypeChecker) {
  const symbol = checker.getSymbolAtLocation(node)
  return !symbol || !hasRuntimeBinding(symbol)
}

function readModuleMemberName(node: ts.Node, checker: ts.TypeChecker): string | null | undefined {
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "module" &&
    isUnboundIdentifier(node.expression, checker)
  ) {
    return node.name.text
  }

  if (
    ts.isElementAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "module" &&
    isUnboundIdentifier(node.expression, checker)
  ) {
    const argument = node.argumentExpression
    return argument &&
      (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
      ? argument.text
      : null
  }

  return undefined
}

export function extractModuleReferences(source: string, fileName = "fixture.ts"): string[] {
  const { checker, sourceFile } = createSourceProgram(source, fileName)
  const references = new Set<string>()

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      references.add(readLiteralModuleReference(node.moduleSpecifier, "import", sourceFile))
    } else if (ts.isImportEqualsDeclaration(node)) {
      if (ts.isExternalModuleReference(node.moduleReference)) {
        references.add(
          readLiteralModuleReference(node.moduleReference.expression, "import equals", sourceFile)
        )
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      references.add(readLiteralModuleReference(node.moduleSpecifier, "export from", sourceFile))
    } else if (ts.isCallExpression(node)) {
      const moduleMemberName = readModuleMemberName(node.expression, checker)

      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        references.add(
          readLiteralModuleReference(
            node.arguments.length === 1 || node.arguments.length === 2
              ? node.arguments[0]
              : undefined,
            "dynamic import",
            sourceFile
          )
        )
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        isUnboundIdentifier(node.expression, checker)
      ) {
        references.add(
          readLiteralModuleReference(
            node.arguments.length === 1 ? node.arguments[0] : undefined,
            "require",
            sourceFile
          )
        )
      } else if (moduleMemberName === null) {
        throw new Error("module member must be a static require reference")
      } else if (moduleMemberName === "require") {
        references.add(
          readLiteralModuleReference(
            node.arguments.length === 1 ? node.arguments[0] : undefined,
            "module.require",
            sourceFile
          )
        )
      }
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument
      const literal =
        ts.isLiteralTypeNode(argument) && ts.isStringLiteral(argument.literal)
          ? argument.literal
          : undefined
      references.add(readLiteralModuleReference(literal, "import type", sourceFile))
    } else if (
      ts.isIdentifier(node) &&
      node.text === "require" &&
      isUnboundIdentifier(node, checker) &&
      !ts.isDeclarationName(node) &&
      !(ts.isCallExpression(node.parent) && node.parent.expression === node) &&
      !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
    ) {
      throw new Error("require must be called directly")
    } else if (
      ts.isIdentifier(node) &&
      node.text === "module" &&
      isUnboundIdentifier(node, checker) &&
      !(
        (ts.isPropertyAccessExpression(node.parent) || ts.isElementAccessExpression(node.parent)) &&
        node.parent.expression === node &&
        readModuleMemberName(node.parent, checker) !== undefined
      )
    ) {
      throw new Error("module must be accessed directly")
    } else {
      const moduleMemberName = readModuleMemberName(node, checker)
      if (
        moduleMemberName !== undefined &&
        !(ts.isCallExpression(node.parent) && node.parent.expression === node)
      ) {
        if (moduleMemberName === null) {
          throw new Error("module member must be a static require reference")
        }
        if (moduleMemberName === "require")
          throw new Error("module.require must be called directly")
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return [...references].toSorted()
}
