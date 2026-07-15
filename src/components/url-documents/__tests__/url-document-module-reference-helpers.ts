import ts from "typescript"

import {
  assignmentPatternMayReferenceProperty,
  bindingPatternMayReferenceProperty,
  isShorthandPropertyReference,
  readDestructuringAssignmentSource,
  readStaticString,
  unwrapExpression,
} from "./url-document-ast-helpers"
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
  const symbol = isShorthandPropertyReference(node)
    ? checker.getShorthandAssignmentValueSymbol(node.parent)
    : checker.getSymbolAtLocation(node)
  return !symbol || !hasRuntimeBinding(symbol)
}

function readStaticMemberName(node: ts.Node): string | null | undefined {
  if (ts.isPropertyAccessExpression(node)) return node.name.text

  if (ts.isElementAccessExpression(node)) {
    return readStaticString(node.argumentExpression)
  }

  return undefined
}

function readAccessRootIdentifier(node: ts.Node): ts.Identifier | undefined {
  let current = ts.isExpression(node) ? unwrapExpression(node) : node
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    current = unwrapExpression(current.expression)
  }

  return ts.isIdentifier(current) ? current : undefined
}

function readModuleMemberName(node: ts.Node, checker: ts.TypeChecker): string | null | undefined {
  if (
    (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "module" &&
    isUnboundIdentifier(node.expression, checker)
  ) {
    return readStaticMemberName(node)
  }

  return undefined
}

function isUnboundAmbientRequireMember(node: ts.Node, checker: ts.TypeChecker) {
  if (readStaticMemberName(node) !== "require") return false

  const root = readAccessRootIdentifier(node)
  return Boolean(root && root.text !== "module" && isUnboundIdentifier(root, checker))
}

function isUnboundAmbientComputedMember(node: ts.Node, checker: ts.TypeChecker) {
  if (!ts.isElementAccessExpression(node) || readStaticMemberName(node) !== null) return false

  const root = readAccessRootIdentifier(node)
  return Boolean(root && root.text !== "module" && isUnboundIdentifier(root, checker))
}

function hasUnboundModuleRoot(node: ts.Node, checker: ts.TypeChecker) {
  const root = readAccessRootIdentifier(node)
  return Boolean(root && root.text === "module" && isUnboundIdentifier(root, checker))
}

export function extractModuleReferences(source: string, fileName = "fixture.ts"): string[] {
  const { checker, sourceFile } = createSourceProgram(source, fileName)
  const references = new Set<string>()

  const assertNoAmbientRequireBinding = (pattern: ts.BindingName, initializer?: ts.Expression) => {
    if (!bindingPatternMayReferenceProperty(pattern, "require")) return
    if (!initializer) throw new Error("ambient require must be called directly")

    const unwrappedInitializer = unwrapExpression(initializer)
    if (
      ts.isObjectLiteralExpression(unwrappedInitializer) ||
      ts.isArrayLiteralExpression(unwrappedInitializer)
    ) {
      return
    }

    const root = readAccessRootIdentifier(initializer)
    if (!root || isUnboundIdentifier(root, checker)) {
      throw new Error("ambient require must be called directly")
    }
  }

  const visit = (node: ts.Node) => {
    for (const tag of ts.getJSDocTags(node)) {
      if (ts.isJSDocImportTag(tag)) {
        references.add(
          readLiteralModuleReference(tag.moduleSpecifier, "JSDoc import tag", sourceFile)
        )
      }
    }

    if (
      ts.isVariableDeclaration(node) &&
      (ts.isObjectBindingPattern(node.name) || ts.isArrayBindingPattern(node.name))
    ) {
      assertNoAmbientRequireBinding(node.name, node.initializer)
    }

    if (
      ts.isParameter(node) &&
      (ts.isObjectBindingPattern(node.name) || ts.isArrayBindingPattern(node.name))
    ) {
      assertNoAmbientRequireBinding(node.name)
    }

    if (ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)) {
      const assignmentSource = readDestructuringAssignmentSource(node)
      if (assignmentSource && assignmentPatternMayReferenceProperty(node, "require")) {
        const root = readAccessRootIdentifier(assignmentSource)
        if (!root || isUnboundIdentifier(root, checker)) {
          throw new Error("ambient require must be called directly")
        }
      }
    }

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
      const ambientRequireMember = isUnboundAmbientRequireMember(node.expression, checker)
      const ambientComputedMember = isUnboundAmbientComputedMember(node.expression, checker)

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
      } else if (ambientComputedMember) {
        throw new Error("ambient member must use a static reference")
      } else if (ambientRequireMember) {
        references.add(
          readLiteralModuleReference(
            node.arguments.length === 1 ? node.arguments[0] : undefined,
            "ambient require",
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
      } else if (hasUnboundModuleRoot(node.expression, checker)) {
        throw new Error("module calls must use direct module.require")
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
      (!ts.isDeclarationName(node) || isShorthandPropertyReference(node)) &&
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
      const ambientRequireMember = isUnboundAmbientRequireMember(node, checker)
      const ambientComputedMember = isUnboundAmbientComputedMember(node, checker)
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
      if (
        ambientRequireMember &&
        !(ts.isCallExpression(node.parent) && node.parent.expression === node)
      ) {
        throw new Error("ambient require must be called directly")
      }
      if (ambientComputedMember) {
        throw new Error("ambient member must use a static reference")
      }
    }

    for (const jsDoc of ts.getJSDocCommentsAndTags(node)) {
      if (jsDoc.parent === node) visit(jsDoc)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return [...references].toSorted()
}
