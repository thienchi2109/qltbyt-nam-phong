import * as React from "react"
import { Maximize2 } from "lucide-react"

import {
  TechnicalConfigurationReferenceEvidenceIndicator,
  type TechnicalConfigurationReferenceEvidenceDetail,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceEvidence"
import type { useTechnicalConfigurationDocuments } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDocuments"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import {
  getTechnicalConfigurationReferenceProductName,
  type TechnicalConfigurationReferenceProductDraft,
} from "@/app/(app)/technical-configurations/technical-configuration-reference-product-state"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export type TechnicalConfigurationReferenceFullTextDetail = {
  title: string
  text: string
}

type TechnicalConfigurationReferenceComparisonTableProps = {
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  visibleProducts: TechnicalConfigurationReferenceProductDraft[]
  productIndexById: ReadonlyMap<string, number>
  productLabelById: ReadonlyMap<string, string>
  readOnly: boolean
  evidenceState: ReturnType<typeof useTechnicalConfigurationDocuments>
  onResponseChange: (productId: string, criterionId: string, responseText: string) => void
  onOpenFullText: (detail: TechnicalConfigurationReferenceFullTextDetail) => void
  onOpenEvidence: (detail: TechnicalConfigurationReferenceEvidenceDetail) => void
}

/** Renders the sticky comparison matrix and its per-cell response and evidence controls. */
export function TechnicalConfigurationReferenceComparisonTable({
  baselineVersion,
  visibleProducts,
  productIndexById,
  productLabelById,
  readOnly,
  evidenceState,
  onResponseChange,
  onOpenFullText,
  onOpenEvidence,
}: Readonly<TechnicalConfigurationReferenceComparisonTableProps>) {
  return (
    <div
      data-testid="reference-comparison-scroll"
      className="w-full overflow-x-auto rounded-md border"
    >
      <table className="min-w-max border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-30 w-[220px] min-w-[220px] border-b border-r bg-muted px-3 py-3 font-semibold">
              Tiêu chí
            </th>
            <th className="sticky left-[220px] z-30 w-[360px] min-w-[360px] border-b border-r bg-muted px-3 py-3 font-semibold">
              Yêu cầu cơ sở
            </th>
            {visibleProducts.map((product) => {
              const productIndex = productIndexById.get(product.id) ?? 0
              return (
                <th
                  key={product.id}
                  className="w-[320px] min-w-[320px] border-b border-r bg-muted px-3 py-3 font-semibold last:border-r-0"
                >
                  {productLabelById.get(product.id) ??
                    getTechnicalConfigurationReferenceProductName(product, productIndex)}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {baselineVersion.groups.map((group) => (
            <React.Fragment key={group.id}>
              <tr>
                <th
                  colSpan={visibleProducts.length + 2}
                  className="border-b bg-muted/40 px-3 py-2 font-semibold"
                >
                  {group.name}
                </th>
              </tr>
              {group.criteria.map((criterion) => (
                <tr key={criterion.id} className="align-top">
                  <th className="sticky left-0 z-20 border-b border-r bg-background px-3 py-3 font-medium">
                    <span className="block text-xs text-muted-foreground">
                      {criterion.criterion_code}
                    </span>
                    <span className="mt-1 block break-words">
                      {criterion.title ?? "Chưa có tiêu đề"}
                    </span>
                  </th>
                  <td className="sticky left-[220px] z-20 border-b border-r bg-background px-3 py-3">
                    <p className="line-clamp-4 whitespace-pre-wrap break-words">
                      {criterion.requirement_text}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-8 px-2"
                      aria-label={`Xem đầy đủ yêu cầu ${criterion.criterion_code}`}
                      onClick={() =>
                        onOpenFullText({
                          title: `Yêu cầu ${criterion.criterion_code}`,
                          text: criterion.requirement_text,
                        })
                      }
                    >
                      <Maximize2 className="size-4" aria-hidden="true" />
                      Xem đầy đủ
                    </Button>
                  </td>
                  {visibleProducts.map((product) => {
                    const productIndex = productIndexById.get(product.id) ?? 0
                    const ownerId = product.persistedId
                    const productName =
                      productLabelById.get(product.id) ??
                      getTechnicalConfigurationReferenceProductName(product, productIndex)
                    return (
                      <td key={product.id} className="border-b border-r p-3 last:border-r-0">
                        <Textarea
                          value={product.responses[criterion.id] ?? ""}
                          readOnly={readOnly}
                          aria-label={`Phản hồi ${productName} cho ${criterion.criterion_code}`}
                          className="min-h-[120px] resize-y whitespace-pre-wrap"
                          onChange={(event) =>
                            onResponseChange(product.id, criterion.id, event.target.value)
                          }
                        />
                        {product.responses[criterion.id] ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-8 px-2"
                            aria-label={`Xem đầy đủ phản hồi ${productName} cho ${criterion.criterion_code}`}
                            onClick={() =>
                              onOpenFullText({
                                title: `${productName} · ${criterion.criterion_code}`,
                                text: product.responses[criterion.id] ?? "",
                              })
                            }
                          >
                            <Maximize2 className="size-4" aria-hidden="true" />
                            Xem đầy đủ
                          </Button>
                        ) : null}
                        {ownerId ? (
                          <TechnicalConfigurationReferenceEvidenceIndicator
                            documents={evidenceState.getDocumentsForOwner(
                              "reference_product",
                              ownerId
                            )}
                            productName={productName}
                            criterionId={criterion.id}
                            criterionCode={criterion.criterion_code}
                            isLoading={evidenceState.documentsQuery.isLoading}
                            onOpen={() =>
                              onOpenEvidence({
                                ownerId,
                                productName,
                                criterionId: criterion.id,
                                criterionCode: criterion.criterion_code,
                              })
                            }
                          />
                        ) : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
