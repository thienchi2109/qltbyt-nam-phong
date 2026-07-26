import { expect, it } from "vitest"

import { getTechnicalConfigurationCitationValues } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationCitationEditorState"

it("does not inspect citations without an exact selected criterion", () => {
  let citationReads = 0
  const document = {
    get citations() {
      citationReads += 1
      return []
    },
  }

  expect(getTechnicalConfigurationCitationValues(document, null)).toEqual({
    pageSection: "",
    excerpt: "",
  })
  expect(citationReads).toBe(0)
})
