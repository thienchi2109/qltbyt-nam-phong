import type { UrlDocumentFormProps } from "./url-documents/UrlDocumentForm"
import type { UrlDocumentItem, UrlDocumentListProps } from "./url-documents/UrlDocumentList"
import type { ParsedAbsoluteUrl } from "./url-documents/url-document-utils"

type Assert<T extends true> = T
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

type AllowedDocumentUrl = ParsedAbsoluteUrl & { protocol: "http:" | "https:" }
type ParseAbsoluteUrl = typeof import("./url-documents/url-document-utils").parseAbsoluteUrl
type IsAllowedDocumentUrl = typeof import("./url-documents/url-document-utils").isAllowedDocumentUrl
type UrlDocumentForm = typeof import("./url-documents/UrlDocumentForm").UrlDocumentForm
type UrlDocumentList = typeof import("./url-documents/UrlDocumentList").UrlDocumentList

type _parsedAbsoluteUrl = Assert<
  Equal<
    ParsedAbsoluteUrl,
    Readonly<{
      raw: string
      protocol: string
    }>
  >
>
type _parseAbsoluteUrl = Assert<
  Equal<ParseAbsoluteUrl, (value: string) => ParsedAbsoluteUrl | null>
>
type _isAllowedDocumentUrl = Assert<
  Equal<IsAllowedDocumentUrl, (parsed: ParsedAbsoluteUrl | null) => parsed is AllowedDocumentUrl>
>
type _urlDocumentFormProps = Assert<
  Equal<
    UrlDocumentFormProps,
    {
      name: string
      url: string
      onNameChange: (value: string) => void
      onUrlChange: (value: string) => void
      onSubmit: () => void | Promise<void>
      isPending?: boolean
      disabled?: boolean
      validationError?: string | null
      submitLabel?: string
    }
  >
>
type _urlDocumentForm = Assert<Equal<Parameters<UrlDocumentForm>, [UrlDocumentFormProps]>>
type _urlDocumentItem = Assert<
  Equal<
    UrlDocumentItem,
    {
      id: string
      name: string
      url: string
    }
  >
>
type _urlDocumentListProps = Assert<
  Equal<
    UrlDocumentListProps,
    {
      items: readonly UrlDocumentItem[]
      isLoading: boolean
      onDelete?: (id: string) => void
      deletingId?: string | null
      disabled?: boolean
      emptyMessage?: string
    }
  >
>
type _urlDocumentList = Assert<Equal<Parameters<UrlDocumentList>, [UrlDocumentListProps]>>
