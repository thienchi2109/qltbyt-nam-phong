import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

describe("technical configuration workspace shell source boundaries", () => {
  it("keeps the shell thin and baseline responsibilities extracted before the threshold", () => {
    const moduleRoot = path.resolve(process.cwd(), "src/app/(app)/technical-configurations")
    const files = [
      "TechnicalConfigurationsClient.tsx",
      "_components/TechnicalConfigurationWorkspaceShell.tsx",
      "_components/TechnicalConfigurationBaselineTab.tsx",
      "_components/TechnicalConfigurationBaselineEvidence.tsx",
      "_components/TechnicalConfigurationBaselineAlerts.tsx",
      "_components/TechnicalConfigurationOptionResponseEditor.tsx",
      "_components/TechnicalConfigurationOptionResponses.tsx",
      "_components/TechnicalConfigurationBaselineTabStates.tsx",
      "_components/TechnicalConfigurationBaselineEditor.tsx",
      "_components/TechnicalConfigurationCriteriaSpreadsheet.tsx",
      "_components/TechnicalConfigurationBulkEntryWorkbench.tsx",
      "_components/TechnicalConfigurationAllGroupsOverview.tsx",
      "_components/TechnicalConfigurationGroupNavigator.tsx",
      "_hooks/useTechnicalConfigurationBaselineEditor.ts",
      "_hooks/useTechnicalConfigurationBaselineImport.ts",
      "_hooks/useTechnicalConfigurationBulkEntrySessions.ts",
      "_hooks/useTechnicalConfigurationInlineEditor.ts",
      "_hooks/useTechnicalConfigurationOptionResponses.ts",
      "__tests__/comparison-matrix-rendering-cases.tsx",
      "__tests__/technical-configuration-baseline-workspace.test.tsx",
    ]

    for (const file of files) {
      const source = fs.readFileSync(path.join(moduleRoot, file), "utf8")
      const lineCount = source.split("\n").length
      expect(lineCount).toBeLessThan(350)
    }

    const shellSource = fs.readFileSync(
      path.join(moduleRoot, "_components/TechnicalConfigurationWorkspaceShell.tsx"),
      "utf8"
    )
    expect(shellSource).toContain("TechnicalConfigurationBaselineTab")
    expect(shellSource).toContain("TechnicalConfigurationBaselineEvidence")
    expect(shellSource).not.toContain("useQuery")
    expect(shellSource).not.toContain("useMutation")

    for (const file of [
      "_components/TechnicalConfigurationBaselineTab.tsx",
      "_hooks/useTechnicalConfigurationBaselineEditor.ts",
    ]) {
      const source = fs.readFileSync(path.join(moduleRoot, file), "utf8")
      expect(source).not.toMatch(/reference[-_ ]?product/i)
    }
  })
})
