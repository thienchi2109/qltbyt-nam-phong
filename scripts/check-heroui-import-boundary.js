const fs = require("fs")
const path = require("path")
const { collectChangedFiles, runGit } = require("./changed-files")

const DEFAULT_BASE_REF = process.env.HEROUI_BOUNDARY_BASE || "main"
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])
const HEROUI_IMPORT_RE =
  /\b(?:from\s+["'](@heroui\/[^"']+)["']|import\s*\(\s*["'](@heroui\/[^"']+)["']\s*\)|export\s+.*?\s+from\s+["'](@heroui\/[^"']+)["']|require\s*\(\s*["'](@heroui\/[^"']+)["']\s*\)|import\s+["'](@heroui\/[^"']+)["'])/
const ALLOWED_BOUNDARY_PREFIXES = [
  "src/components/equipment/heroui-pilot/",
  "src/components/shared/floating-actions/",
]
const ALLOWED_BOUNDARY_FILES = ["src/components/shared/SearchInput.tsx"]

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/")
}

function isScannableSourceFile(filePath) {
  const normalizedPath = normalizePath(filePath)
  return normalizedPath.startsWith("src/") && SOURCE_EXTENSIONS.has(path.extname(filePath))
}

function isAllowedBoundaryFile(filePath) {
  const normalizedPath = normalizePath(filePath)
  return (
    ALLOWED_BOUNDARY_FILES.includes(normalizedPath) ||
    ALLOWED_BOUNDARY_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))
  )
}

function getHeroUIImportPath(line) {
  const match = HEROUI_IMPORT_RE.exec(line)
  return match?.slice(1).find(Boolean) || null
}

function isCommentOnlyLine(line, state) {
  const trimmedLine = line.trimStart()

  if (state.isInsideBlockComment) {
    const commentEndIndex = trimmedLine.indexOf("*/")
    if (commentEndIndex === -1) {
      return true
    }

    state.isInsideBlockComment = false
    return trimmedLine.slice(commentEndIndex + 2).trim() === ""
  }

  if (trimmedLine.startsWith("//")) {
    return true
  }

  if (trimmedLine.startsWith("/*")) {
    const commentEndIndex = trimmedLine.indexOf("*/", 2)
    if (commentEndIndex === -1) {
      state.isInsideBlockComment = true
      return true
    }

    return trimmedLine.slice(commentEndIndex + 2).trim() === ""
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

    const commentState = { isInsideBlockComment: false }

    return file.content
      .split("\n")
      .map((line, index) => {
        if (isCommentOnlyLine(line, commentState)) {
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
  const allowedBoundaryList = [...ALLOWED_BOUNDARY_PREFIXES, ...ALLOWED_BOUNDARY_FILES].join(", ")

  return violations
    .map(
      (violation) =>
        `${violation.path}:${violation.line} imports ${violation.importPath} outside ${allowedBoundaryList}`
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
    console.log("No HeroUI imports found outside approved HeroUI boundary folders.")
    return
  }

  console.error(formatViolations(violations))
  console.error(
    `Found ${violations.length} HeroUI import boundary violation${violations.length === 1 ? "" : "s"}.`
  )
  process.exitCode = 1
}

module.exports = {
  ALLOWED_BOUNDARY_FILES,
  ALLOWED_BOUNDARY_PREFIXES,
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
