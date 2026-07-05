const fs = require("fs")
const path = require("path")
const { collectChangedFiles, runGit } = require("./changed-files")

const DEFAULT_BASE_REF = process.env.HEROUI_BOUNDARY_BASE || "main"
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])
const HEROUI_IMPORT_RE =
  /\b(?:from\s+["'](@heroui\/[^"']+)["']|import\s*\(\s*["'](@heroui\/[^"']+)["']\s*\)|export\s+.*?\s+from\s+["'](@heroui\/[^"']+)["']|require\s*\(\s*["'](@heroui\/[^"']+)["']\s*\)|import\s+["'](@heroui\/[^"']+)["'])/
const ALLOWED_BOUNDARY_PREFIX = "src/components/equipment/heroui-pilot/"

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/")
}

function isScannableSourceFile(filePath) {
  const normalizedPath = normalizePath(filePath)
  return normalizedPath.startsWith("src/") && SOURCE_EXTENSIONS.has(path.extname(filePath))
}

function isAllowedBoundaryFile(filePath) {
  return normalizePath(filePath).startsWith(ALLOWED_BOUNDARY_PREFIX)
}

function getHeroUIImportPath(line) {
  const match = HEROUI_IMPORT_RE.exec(line)
  return match?.slice(1).find(Boolean) || null
}

function isCommentOnlyLine(line) {
  const trimmedLine = line.trimStart()

  if (trimmedLine.startsWith("//")) {
    return true
  }

  if (trimmedLine.startsWith("/*")) {
    const commentEndIndex = trimmedLine.indexOf("*/", 2)
    return commentEndIndex === -1 || trimmedLine.slice(commentEndIndex + 2).trim() === ""
  }

  if (trimmedLine.startsWith("*/")) {
    return trimmedLine.slice(2).trim() === ""
  }

  return trimmedLine.startsWith("*")
}

function findHeroUIImportViolations(files) {
  return files.flatMap((file) => {
    if (!isScannableSourceFile(file.path) || isAllowedBoundaryFile(file.path)) {
      return []
    }

    return file.content
      .split("\n")
      .map((line, index) => {
        if (isCommentOnlyLine(line)) {
          return null
        }

        const importPath = getHeroUIImportPath(line)

        if (!importPath) {
          return null
        }

        return {
          path: normalizePath(file.path),
          line: index + 1,
          importPath,
        }
      })
      .filter(Boolean)
  })
}

function collectChangedSourceFiles(baseRef = DEFAULT_BASE_REF, { runGitImpl = runGit } = {}) {
  return collectChangedFiles(baseRef, {
    runGitImpl,
    includeFile: isScannableSourceFile,
    fileExists: fs.existsSync,
  })
}

function scanFiles(filePaths) {
  return findHeroUIImportViolations(
    filePaths.map((filePath) => ({
      path: filePath,
      content: fs.readFileSync(filePath, "utf8"),
    }))
  )
}

function formatViolations(violations) {
  return violations
    .map(
      (violation) =>
        `${violation.path}:${violation.line} imports ${violation.importPath} outside ${ALLOWED_BOUNDARY_PREFIX}`
    )
    .join("\n")
}

function main() {
  const filePaths = collectChangedSourceFiles(process.argv[2] || DEFAULT_BASE_REF)

  if (filePaths.length === 0) {
    console.log("No changed source files to scan for HeroUI imports.")
    return
  }

  const violations = scanFiles(filePaths)

  if (violations.length === 0) {
    console.log("No HeroUI imports found outside the approved Equipments pilot boundary.")
    return
  }

  console.error(formatViolations(violations))
  console.error(
    `Found ${violations.length} HeroUI import boundary violation${violations.length === 1 ? "" : "s"}.`
  )
  process.exitCode = 1
}

module.exports = {
  ALLOWED_BOUNDARY_PREFIX,
  collectChangedSourceFiles,
  findHeroUIImportViolations,
  formatViolations,
  isAllowedBoundaryFile,
  isScannableSourceFile,
  scanFiles,
}

if (require.main === module) {
  main()
}
