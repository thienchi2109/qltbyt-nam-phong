import { describe, expect, it } from "vitest"

import { findHeroUIImportViolations } from "../check-heroui-import-boundary"

describe("check-heroui-import-boundary", () => {
  it("allows HeroUI imports only inside approved boundary folders", () => {
    const violations = findHeroUIImportViolations([
      {
        path: "src/components/equipment/heroui-pilot/controls.tsx",
        content: 'import { Button } from "@heroui/react"\n',
      },
      {
        path: "src/components/shared/floating-actions/MobileFloatingActionMenu.tsx",
        content: 'import { Dropdown } from "@heroui/react"\n',
      },
      {
        path: "src/components/shared/SearchInput.tsx",
        content: 'import { Input } from "@heroui/react/input"\n',
      },
      {
        path: "src/components/shared/ListFilterSearchCard.tsx",
        content: 'import { Card } from "@heroui/react"\n',
      },
      {
        path: "src/components/shared/table-filters/FacetedMultiSelectFilter.tsx",
        content: 'import { Popover } from "@heroui/react/popover"\n',
      },
      {
        path: "src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineDocuments.tsx",
        content: 'import { Button, Select } from "@heroui/react"\n',
      },
      {
        path: "src/app/(app)/technical-configurations/_components/TechnicalConfigurationCitationEditor.tsx",
        content: 'import { TextArea, TextField } from "@heroui/react"\n',
      },
      {
        path: "src/app/(app)/technical-configurations/_components/TechnicalConfigurationDocumentsHeader.tsx",
        content: 'import { Button, Chip } from "@heroui/react"\n',
      },
      {
        path: "src/app/(app)/technical-configurations/_components/TechnicalConfigurationDocumentsQueryError.tsx",
        content: 'import { Button } from "@heroui/react"\n',
      },
      {
        path: "src/components/equipment/equipment-toolbar.tsx",
        content: 'import { Button } from "@heroui/react"\n',
      },
      {
        path: "src/app/(app)/repair-requests/_components/RepairRequestsPageLayout.tsx",
        content: 'import { Dropdown } from "@heroui/react"\n',
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
        path: "src/app/(app)/repair-requests/_components/RepairRequestsPageLayout.tsx",
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

  it("ignores HeroUI import examples in comment-only lines", () => {
    const violations = findHeroUIImportViolations([
      {
        path: "src/components/equipment/equipment-toolbar.tsx",
        content: [
          '// TODO: import { Button } from "@heroui/react"',
          '/* import { Button } from "@heroui/react" */',
          ' * import { Button } from "@heroui/react"',
          " */",
          'console.log("Use @heroui/react only in the pilot boundary")',
        ].join("\n"),
      },
    ])

    expect(violations).toEqual([])
  })

  it("ignores HeroUI import examples inside multi-line block comments", () => {
    const violations = findHeroUIImportViolations([
      {
        path: "src/components/equipment/equipment-toolbar.tsx",
        content: [
          "/*",
          'import { Button } from "@heroui/react"',
          'const Modal = require("@heroui/react")',
          "*/",
        ].join("\n"),
      },
    ])

    expect(violations).toEqual([])
  })

  it("flags HeroUI imports after a closed block comment", () => {
    const violations = findHeroUIImportViolations([
      {
        path: "src/components/equipment/equipment-toolbar.tsx",
        content: '/* pilot note */ import { Button } from "@heroui/react"',
      },
      {
        path: "src/components/equipment/equipment-toolbar-layout.tsx",
        content: '*/ import { Button } from "@heroui/react"',
      },
    ])

    expect(violations).toEqual([
      {
        path: "src/components/equipment/equipment-toolbar.tsx",
        line: 1,
        importPath: "@heroui/react",
      },
      {
        path: "src/components/equipment/equipment-toolbar-layout.tsx",
        line: 1,
        importPath: "@heroui/react",
      },
    ])
  })
})
