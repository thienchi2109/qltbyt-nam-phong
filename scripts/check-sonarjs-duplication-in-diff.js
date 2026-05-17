#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")
const { collectChangedFiles, getCommittedChangedFiles, runGit } = require("./changed-files")

const DEFAULT_BASE_REF = process.env.DEDUPE_BASE || "main"
const JAVASCRIPT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"])

const SONARJS_DUPLICATION_RULES = {
  "sonarjs/no-all-duplicated-branches": "error",
  "sonarjs/no-duplicate-in-composite": "error",
  "sonarjs/no-duplicated-branches": "error",
  "sonarjs/no-identical-conditions": "error",
  "sonarjs/no-identical-expressions": "error",
  "sonarjs/no-identical-functions": "error",
}

function isJavaScriptFile(filePath) {
  return JAVASCRIPT_EXTENSIONS.has(path.extname(filePath))
}

function collectChangedJavaScriptFiles(
  baseRef = DEFAULT_BASE_REF,
  { runGitImpl = runGit, fileExists = fs.existsSync } = {}
) {
  return collectChangedFiles(baseRef, {
    runGitImpl,
    includeFile: isJavaScriptFile,
    fileExists,
  })
}

async function lintFiles(filePaths) {
  const { ESLint } = require("eslint")
  const sonarjs = require("eslint-plugin-sonarjs")
  const parser = require("@typescript-eslint/parser")

  const eslint = new ESLint({
    cwd: process.cwd(),
    ignore: false,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}"],
        languageOptions: {
          ecmaVersion: "latest",
          parser,
          parserOptions: {
            ecmaFeatures: {
              jsx: true,
            },
          },
          sourceType: "module",
        },
        plugins: {
          sonarjs,
        },
        rules: SONARJS_DUPLICATION_RULES,
      },
    ],
  })

  return eslint.lintFiles(filePaths)
}

function formatLintMessages(results) {
  return results.flatMap((result) => {
    const relativePath = path.relative(process.cwd(), result.filePath)

    return result.messages
      .filter((message) => message.ruleId && SONARJS_DUPLICATION_RULES[message.ruleId])
      .map(
        (message) =>
          `${relativePath}:${message.line}:${message.column} ${message.ruleId} ${message.message}`
      )
  })
}

async function main() {
  let filePaths

  try {
    filePaths = collectChangedJavaScriptFiles(process.argv[2] || DEFAULT_BASE_REF)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Unable to determine changed JavaScript/TypeScript files: ${message}`)
    process.exitCode = 1
    return
  }

  if (filePaths.length === 0) {
    console.log("No changed JavaScript/TypeScript files to scan for duplicate code.")
    return
  }

  const results = await lintFiles(filePaths)
  const messages = formatLintMessages(results)

  if (messages.length === 0) {
    console.log("No SonarJS duplicate-code findings found in changed JavaScript/TypeScript files.")
    console.log(
      "Note: this gate is diff-only. Use the code-deduplication skill for cross-file semantic reuse checks against unchanged code."
    )
    return
  }

  console.error(messages.join("\n"))
  console.error(
    `Found ${messages.length} SonarJS duplicate-code finding${messages.length === 1 ? "" : "s"} in changed JavaScript/TypeScript files.`
  )
  process.exitCode = 1
}

module.exports = {
  SONARJS_DUPLICATION_RULES,
  collectChangedJavaScriptFiles,
  formatLintMessages,
  getCommittedChangedFiles,
  isJavaScriptFile,
  lintFiles,
  runGit,
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Unable to run SonarJS duplicate-code gate: ${message}`)
    process.exitCode = 1
  })
}
