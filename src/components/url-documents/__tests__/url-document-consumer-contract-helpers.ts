import { readFileSync, readdirSync } from "node:fs"
import { extname, join, relative, sep } from "node:path"
import ts from "typescript"

const sharedModuleBindings = new Map<string, readonly string[]>([
  ["@/components/url-documents/UrlDocumentForm", ["UrlDocumentForm"]],
  ["@/components/url-documents/UrlDocumentList", ["UrlDocumentList"]],
  ["@/components/url-documents/url-document-utils", ["isAllowedDocumentUrl", "parseAbsoluteUrl"]],
])
const forbiddenPresentationImports = new Set([
  "@/components/ui/input",
  "@/components/ui/label",
  "@/components/ui/scroll-area",
  "@/components/ui/skeleton",
])
const forbiddenPresentationElements = new Set(["Input", "Label", "ScrollArea", "Skeleton"])
const supportedConsumerExtensions = new Set([".ts", ".tsx"])

function normalizePath(filePath: string) {
  return filePath.split(sep).join("/")
}

function createSourceFile(source: string, fileName: string) {
  return ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
}

function readJsxTagName(tagName: ts.JsxTagNameExpression) {
  return ts.isIdentifier(tagName) ? tagName.text : tagName.getText()
}

function collectSourceFiles(directory: string): string[] {
  const files: string[] = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "__tests__") continue

    const absolutePath = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(absolutePath))
    } else if (supportedConsumerExtensions.has(extname(entry.name))) {
      files.push(absolutePath)
    }
  }

  return files
}

export function collectUrlDocumentConsumers(sourceDirectory: string) {
  return collectSourceFiles(sourceDirectory)
    .filter((absolutePath) => {
      const source = readFileSync(absolutePath, "utf8")
      const sourceFile = createSourceFile(source, absolutePath)

      return sourceFile.statements.some(
        (statement) =>
          ts.isImportDeclaration(statement) &&
          ts.isStringLiteral(statement.moduleSpecifier) &&
          sharedModuleBindings.has(statement.moduleSpecifier.text)
      )
    })
    .map((absolutePath) => normalizePath(relative(sourceDirectory, absolutePath)))
    .toSorted()
}

export function inspectUrlDocumentConsumer(source: string, fileName: string) {
  const sourceFile = createSourceFile(source, fileName)
  const sharedImports: string[] = []
  const forbiddenImports: string[] = []
  const renderedElements = new Set<string>()
  const calledFunctions = new Set<string>()
  let constructsUrlDirectly = false

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const modulePath = node.moduleSpecifier.text
      if (forbiddenPresentationImports.has(modulePath)) forbiddenImports.push(modulePath)

      if (sharedModuleBindings.has(modulePath)) {
        const namedBindings =
          node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
            ? node.importClause.namedBindings.elements
            : []

        for (const binding of namedBindings) {
          const importedName = binding.propertyName?.text ?? binding.name.text
          const localName = binding.name.text
          sharedImports.push(`${modulePath}:${importedName}->${localName}`)
        }
      }
    } else if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      renderedElements.add(readJsxTagName(node.tagName))
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      calledFunctions.add(node.expression.text)
    } else if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "URL"
    ) {
      constructsUrlDirectly = true
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return {
    sharedImports: sharedImports.toSorted(),
    forbiddenImports: forbiddenImports.toSorted(),
    forbiddenPresentationElements: [...renderedElements]
      .filter((element) => forbiddenPresentationElements.has(element))
      .toSorted(),
    renderedElements: [...renderedElements].toSorted(),
    calledFunctions: [...calledFunctions].toSorted(),
    constructsUrlDirectly,
  }
}
