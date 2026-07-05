import { describe, expect, it } from "vitest"

import { findHeroUIImportViolations } from "../check-heroui-import-boundary"

describe("check-heroui-import-boundary", () => {
  it("allows HeroUI imports only inside the Equipments pilot boundary", () => {
    const violations = findHeroUIImportViolations([
      {
        path: "src/components/equipment/heroui-pilot/controls.tsx",
        content: 'import { Button } from "@heroui/react"\n',
      },
      {
        path: "src/components/equipment/equipment-toolbar.tsx",
        content: 'import { Button } from "@heroui/react"\n',
      },
      {
        path: "src/components/ui/button.tsx",
        content: 'export { Button } from "@heroui/react"\n',
      },
      {
        path: "src/components/ui/card.tsx",
        content: 'const heroui = require("@heroui/react")\n',
      },
      {
        path: "src/app/globals.ts",
        content: 'import "@heroui/styles"\n',
      },
      {
        path: "src/components/equipment/equipment-toolbar-layout.tsx",
        content: 'import { Button } from "@/components/equipment/heroui-pilot/controls"\n',
      },
    ])

    expect(violations).toEqual([
      {
        path: "src/components/equipment/equipment-toolbar.tsx",
        line: 1,
        importPath: "@heroui/react",
      },
      {
        path: "src/components/ui/button.tsx",
        line: 1,
        importPath: "@heroui/react",
      },
      {
        path: "src/components/ui/card.tsx",
        line: 1,
        importPath: "@heroui/react",
      },
      {
        path: "src/app/globals.ts",
        line: 1,
        importPath: "@heroui/styles",
      },
    ])
  })
})
