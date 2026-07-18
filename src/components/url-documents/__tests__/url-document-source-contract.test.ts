import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  collectUrlDocumentConsumers,
  inspectUrlDocumentConsumer,
} from "./url-document-consumer-contract-helpers"
import { assertExactSet } from "./url-document-source-contract-fixtures"

const applicationSourceRoot = join(process.cwd(), "src")
const equipmentConsumerPath =
  "app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailFilesTab.tsx"
const baselineConsumerPath =
  "app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineDocuments.tsx"

describe("URL document consumer source contract", () => {
  it("keeps the cumulative P7B2 consumer manifest exact", () => {
    assertExactSet(
      collectUrlDocumentConsumers(applicationSourceRoot),
      [equipmentConsumerPath, baselineConsumerPath],
      "P7B2 URL document consumers"
    )
  })

  it.each([
    ["Equipment", equipmentConsumerPath],
    ["baseline evidence", baselineConsumerPath],
  ])("delegates %s presentation through exact shared bindings", (_label, consumerPath) => {
    const source = readFileSync(join(applicationSourceRoot, consumerPath), "utf8")
    const contract = inspectUrlDocumentConsumer(source, consumerPath)

    expect(contract.sharedImports).toEqual([
      "@/components/url-documents/UrlDocumentForm:UrlDocumentForm->UrlDocumentForm",
      "@/components/url-documents/UrlDocumentList:UrlDocumentList->UrlDocumentList",
      "@/components/url-documents/url-document-utils:isAllowedDocumentUrl->isAllowedDocumentUrl",
      "@/components/url-documents/url-document-utils:parseAbsoluteUrl->parseAbsoluteUrl",
    ])
    expect(contract.renderedElements).toEqual(
      expect.arrayContaining(["UrlDocumentForm", "UrlDocumentList"])
    )
    expect(contract.calledFunctions).toEqual(
      expect.arrayContaining(["isAllowedDocumentUrl", "parseAbsoluteUrl"])
    )
    expect(contract.forbiddenImports).toEqual([])
    expect(contract.forbiddenPresentationElements).toEqual([])
    expect(contract.constructsUrlDirectly).toBe(false)
  })
})
