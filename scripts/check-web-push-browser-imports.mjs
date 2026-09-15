import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const visited = new Set()

function check(file) {
  if (visited.has(file)) return
  visited.add(file)
  const source = readFileSync(file, "utf8")
  for (const match of source.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)) {
    const dependency = match[1]
    assert(!dependency.startsWith("node:"), `${file} imports ${dependency}`)
    if (dependency.startsWith(".")) check(resolve(dirname(file), `${dependency}.ts`))
  }
}

check(resolve(root, "src/lib/web-push/subscription-validation.ts"))
console.log("Web Push browser validators have no Node builtin dependencies.")
