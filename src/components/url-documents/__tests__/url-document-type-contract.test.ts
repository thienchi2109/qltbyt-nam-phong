import { expectTypeOf, it } from "vitest"

import type { UrlDocumentFormProps } from "../UrlDocumentForm"
import type { UrlDocumentItem, UrlDocumentListProps } from "../UrlDocumentList"
import {
  isAllowedDocumentUrl,
  parseAbsoluteUrl,
  type ParsedAbsoluteUrl,
} from "../url-document-utils"

it("freezes the exact URL document public TypeScript contracts", () => {
  type AllowedDocumentUrl = ParsedAbsoluteUrl & { protocol: "http:" | "https:" }

  expectTypeOf<ParsedAbsoluteUrl>().toEqualTypeOf<
    Readonly<{
      raw: string
      protocol: string
    }>
  >()
  expectTypeOf(parseAbsoluteUrl).toEqualTypeOf<(value: string) => ParsedAbsoluteUrl | null>()
  expectTypeOf(isAllowedDocumentUrl).toEqualTypeOf<
    (parsed: ParsedAbsoluteUrl | null) => parsed is AllowedDocumentUrl
  >()
  expectTypeOf<UrlDocumentFormProps>().toEqualTypeOf<{
    name: string
    url: string
    onNameChange: (value: string) => void
    onUrlChange: (value: string) => void
    onSubmit: () => void | Promise<void>
    isPending?: boolean
    disabled?: boolean
    validationError?: string | null
    submitLabel?: string
  }>()
  expectTypeOf<UrlDocumentItem>().toEqualTypeOf<{
    id: string
    name: string
    url: string
  }>()
  expectTypeOf<UrlDocumentListProps>().toEqualTypeOf<{
    items: readonly UrlDocumentItem[]
    isLoading: boolean
    onDelete?: (id: string) => void
    deletingId?: string | null
    disabled?: boolean
    emptyMessage?: string
  }>()
})
