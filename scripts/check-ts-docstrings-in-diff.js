#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
const { collectChangedFiles, getCommittedChangedFiles, runGit } = require("./changed-files")

const DEFAULT_BASE_REF = process.env.TS_DOCSTRINGS_BASE || "main"
const JAVASCRIPT_TYPESCRIPT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"])

// Diff-only policy: require JSDoc on public/exported runtime declarations, not local callbacks or tests.
function isJavaScriptTypeScriptFile(filePath) {
  return JAVASCRIPT_TYPESCRIPT_EXTENSIONS.has(path.extname(filePath))
}

function isTestFile(filePath) {
  return /(^|[/\\])__tests__([/\\]|$)/.test(filePath) || /\.(test|spec)\.[jt]sx?$/.test(filePath)
}

function getScriptKind(filePath) {
  if (filePath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX
  }
  if (filePath.endsWith(".jsx")) {
    return ts.ScriptKind.JSX
  }
  if (filePath.endsWith(".js")) {
    return ts.ScriptKind.JS
  }
  return ts.ScriptKind.TS
}

function hasExportModifier(node) {
  return Boolean(
    node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  )
}

function getIdentifierText(name) {
  return name && ts.isIdentifier(name) ? name.text : null
}

function getVariableStatement(node) {
  return ts.isVariableDeclaration(node) &&
    node.parent &&
    ts.isVariableDeclarationList(node.parent) &&
    node.parent.parent &&
    ts.isVariableStatement(node.parent.parent)
    ? node.parent.parent
    : null
}

function hasJsDoc(node) {
  const commentTargets = [node]
  const variableStatement = getVariableStatement(node)

  if (variableStatement) {
    commentTargets.push(variableStatement)
  }

  return commentTargets.some((target) => ts.getJSDocCommentsAndTags(target).length > 0)
}

function declarationKind(node) {
  if (ts.isFunctionDeclaration(node)) {
    return "function"
  }
  if (ts.isClassDeclaration(node)) {
    return "class"
  }
  if (ts.isVariableDeclaration(node)) {
    return "variable"
  }
  return "declaration"
}

function declarationStartNode(node) {
  return getVariableStatement(node) || node
}

function makeViolation(sourceFile, node, filePath, name) {
  const startNode = declarationStartNode(node)
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(startNode.getStart(sourceFile))

  return {
    filePath,
    line: line + 1,
    column: character + 1,
    kind: declarationKind(node),
    name,
  }
}

function collectTopLevelDeclarations(sourceFile) {
  const declarations = new Map()

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      const name = getIdentifierText(statement.name)

      if (name) {
        declarations.set(name, statement)
      }
      continue
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const name = getIdentifierText(declaration.name)

        if (name) {
          declarations.set(name, declaration)
        }
      }
    }
  }

  return declarations
}

function findMissingJsDocViolations(source, filePath) {
  if (isTestFile(filePath)) {
    return []
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath)
  )
  const topLevelDeclarations = collectTopLevelDeclarations(sourceFile)
  const violations = []
  const visited = new Set()

  function addViolation(node, name) {
    const key = `${node.pos}:${name}`

    if (visited.has(key) || hasJsDoc(node)) {
      return
    }

    visited.add(key)
    violations.push(makeViolation(sourceFile, node, filePath, name))
  }

  for (const statement of sourceFile.statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && hasExportModifier(statement)) {
      addViolation(statement, getIdentifierText(statement.name) || "default")
      continue
    }

    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const name = getIdentifierText(declaration.name)

        if (name) {
          addViolation(declaration, name)
        }
      }
      continue
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause) &&
      !statement.moduleSpecifier
    ) {
      for (const element of statement.exportClause.elements) {
        const localName = (element.propertyName || element.name).text
        const exportedDeclaration = topLevelDeclarations.get(localName)

        if (exportedDeclaration) {
          addViolation(exportedDeclaration, localName)
        }
      }
    }
  }

  return violations
}

function formatViolations(violations) {
  return violations
    .map(
      (violation) =>
        `${violation.filePath}:${violation.line}:${violation.column} exported ${violation.kind} ${violation.name} requires JSDoc`
    )
    .join("\n")
}

function collectChangedJavaScriptTypeScriptFiles(
  baseRef = DEFAULT_BASE_REF,
  { runGitImpl = runGit, fileExists = fs.existsSync } = {}
) {
  return collectChangedFiles(baseRef, {
    runGitImpl,
    includeFile: (filePath) => isJavaScriptTypeScriptFile(filePath) && !isTestFile(filePath),
    fileExists,
  })
}

function scanFiles(filePaths) {
  return filePaths.flatMap((filePath) => {
    const source = fs.readFileSync(filePath, "utf8")
    return findMissingJsDocViolations(source, filePath)
  })
}

function main() {
  let filePaths

  try {
    filePaths = collectChangedJavaScriptTypeScriptFiles(process.argv[2] || DEFAULT_BASE_REF)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Unable to determine changed JavaScript/TypeScript source files: ${message}`)
    process.exitCode = 1
    return
  }

  if (filePaths.length === 0) {
    console.log("No changed JavaScript/TypeScript source files to scan for exported JSDoc.")
    return
  }

  const violations = scanFiles(filePaths)

  if (violations.length === 0) {
    console.log("No missing exported JSDoc found in changed JavaScript/TypeScript source files.")
    console.log(
      "Policy: this diff-only gate requires JSDoc only for public/exported functions, classes, and variables; private helpers, component-local callbacks, and tests are ignored."
    )
    return
  }

  console.error(formatViolations(violations))
  console.error(
    `Found ${violations.length} exported declaration${violations.length === 1 ? "" : "s"} without JSDoc in changed JavaScript/TypeScript source files.`
  )
  process.exitCode = 1
}

module.exports = {
  collectChangedJavaScriptTypeScriptFiles,
  findMissingJsDocViolations,
  formatViolations,
  getCommittedChangedFiles,
  isJavaScriptTypeScriptFile,
  isTestFile,
  runGit,
  scanFiles,
}

if (require.main === module) {
  main()
}
