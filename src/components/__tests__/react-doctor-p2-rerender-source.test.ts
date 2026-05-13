import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function extractFunction(source: string, functionName: string) {
  const start = source.indexOf(`export function ${functionName}`)
  const nextExport = source.indexOf("\nexport function", start + 1)
  return source.slice(start, nextExport === -1 ? undefined : nextExport)
}

describe("React Doctor P2 rerender source guard", () => {
  it("keeps the PWA install prompt state consolidated", () => {
    const source = readSource("src/components/pwa-install-prompt.tsx")
    const installPrompt = extractFunction(source, "PWAInstallPrompt")

    expect(installPrompt).toContain("useReducer")
    expect(installPrompt).toContain("useRef")
    expect(installPrompt).not.toContain("useState")
  })

  it("keeps repair request create and edit form state reducer-based", () => {
    const createSource = readSource(
      "src/app/(app)/repair-requests/_components/RepairRequestsCreateSheet.tsx",
    )
    const editSource = readSource(
      "src/app/(app)/repair-requests/_components/RepairRequestsEditDialog.tsx",
    )

    expect(createSource).toContain("useReducer")
    expect(createSource).not.toContain("setIssueDescription")
    expect(editSource).toContain("useReducer")
    expect(editSource).not.toContain("setIssueDescription")
  })

  it("keeps AddTasksDialog table state reducer-based and filter options single-pass", () => {
    const source = readSource("src/components/add-tasks-dialog.tsx")

    expect(source).toContain("useReducer")
    expect(source).not.toContain(".filter(Boolean)")
    expect(source).not.toContain("setRowSelection({})")
  })

  it("uses mutation or transition pending state in tenant and user submit dialogs", () => {
    const files = [
      "src/components/add-tenant-dialog.tsx",
      "src/components/edit-tenant-dialog.tsx",
      "src/components/add-user-dialog.tsx",
      "src/components/edit-user-dialog.tsx",
    ]

    for (const file of files) {
      const source = readSource(file)

      expect(source).not.toContain("const [isLoading, setIsLoading]")
      expect(source).not.toContain("setIsLoading(")
    }
  })
})
