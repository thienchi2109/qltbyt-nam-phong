import * as React from "react"
import { Maximize2 } from "lucide-react"

import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import {
  getTechnicalConfigurationReferenceProductName,
  type TechnicalConfigurationReferenceProductDraft,
} from "@/app/(app)/technical-configurations/technical-configuration-reference-product-state"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type TechnicalConfigurationReferenceComparisonProps = {
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  products: TechnicalConfigurationReferenceProductDraft[]
  readOnly: boolean
  onResponseChange: (productId: string, criterionId: string, responseText: string) => void
}

type FullTextDetail = {
  title: string
  text: string
}

type ReferenceColumnState = {
  baselineVersionId: string
  productIds: string[]
  hiddenProductIds: string[]
}

const NEW_REFERENCE_PRODUCT_PREFIX = "new-reference-product-"

function haveSameProductIds(left: string[], right: string[]) {
  return (
    left.length === right.length && left.every((productId, index) => productId === right[index])
  )
}

function reconcileReferenceColumnState(
  current: ReferenceColumnState,
  baselineVersionId: string,
  productIds: string[]
): ReferenceColumnState | null {
  if (current.baselineVersionId !== baselineVersionId) {
    return {
      baselineVersionId,
      productIds,
      hiddenProductIds: [],
    }
  }
  if (haveSameProductIds(current.productIds, productIds)) return null

  const priorProductIdSet = new Set(current.productIds)
  const hiddenProductIdSet = new Set(current.hiddenProductIds)
  productIds.forEach((productId, index) => {
    if (priorProductIdSet.has(productId)) return
    const priorProductId = current.productIds[index]
    if (
      priorProductId?.startsWith(NEW_REFERENCE_PRODUCT_PREFIX) &&
      hiddenProductIdSet.has(priorProductId)
    ) {
      hiddenProductIdSet.add(productId)
    }
  })

  return {
    baselineVersionId,
    productIds,
    hiddenProductIds: [...hiddenProductIdSet],
  }
}

/** Renders the baseline-first comparison matrix with user-selectable product columns. */
export function TechnicalConfigurationReferenceComparison({
  baselineVersion,
  products,
  readOnly,
  onResponseChange,
}: Readonly<TechnicalConfigurationReferenceComparisonProps>) {
  const productIds = products.map((product) => product.id)
  const [columnState, setColumnState] = React.useState<ReferenceColumnState>(() => ({
    baselineVersionId: baselineVersion.id,
    productIds,
    hiddenProductIds: [],
  }))
  const [fullTextDetail, setFullTextDetail] = React.useState<FullTextDetail | null>(null)
  const reconciledColumnState = reconcileReferenceColumnState(
    columnState,
    baselineVersion.id,
    productIds
  )
  if (reconciledColumnState) {
    setColumnState(reconciledColumnState)
  }

  const hiddenProductIdSet = React.useMemo(
    () => new Set(columnState.hiddenProductIds),
    [columnState.hiddenProductIds]
  )
  const productIndexById = React.useMemo(
    () => new Map(products.map((product, index) => [product.id, index])),
    [products]
  )
  const selectedProducts = products.filter((product) => !hiddenProductIdSet.has(product.id))

  if (products.length === 0) {
    return (
      <section className="border-t pt-5" aria-label="Ma trận đối chiếu sản phẩm tham chiếu">
        <h3 className="text-base font-semibold">Đối chiếu theo tiêu chí</h3>
        <p className="mt-2 text-sm text-muted-foreground">Chưa có sản phẩm tham chiếu.</p>
      </section>
    )
  }

  return (
    <section className="space-y-4 border-t pt-5" aria-label="Ma trận đối chiếu sản phẩm tham chiếu">
      <div>
        <h3 className="text-base font-semibold">Đối chiếu theo tiêu chí</h3>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
          {products.map((product, index) => {
            const name = getTechnicalConfigurationReferenceProductName(product, index)
            const checkboxId = `reference-product-column-${product.id}`
            return (
              <div key={product.id} className="flex items-center gap-2">
                <Checkbox
                  id={checkboxId}
                  checked={!hiddenProductIdSet.has(product.id)}
                  aria-label={`Hiển thị ${name}`}
                  onCheckedChange={(checked) => {
                    setColumnState((current) => {
                      const hiddenProductIds = new Set(current.hiddenProductIds)
                      if (checked) {
                        hiddenProductIds.delete(product.id)
                      } else {
                        hiddenProductIds.add(product.id)
                      }
                      return {
                        ...current,
                        hiddenProductIds: [...hiddenProductIds],
                      }
                    })
                  }}
                />
                <Label htmlFor={checkboxId}>{name}</Label>
              </div>
            )
          })}
        </div>
      </div>

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
              {selectedProducts.map((product) => {
                const productIndex = productIndexById.get(product.id) ?? 0
                return (
                  <th
                    key={product.id}
                    className="w-[320px] min-w-[320px] border-b border-r bg-muted px-3 py-3 font-semibold last:border-r-0"
                  >
                    {getTechnicalConfigurationReferenceProductName(product, productIndex)}
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
                    colSpan={selectedProducts.length + 2}
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
                          setFullTextDetail({
                            title: `Yêu cầu ${criterion.criterion_code}`,
                            text: criterion.requirement_text,
                          })
                        }
                      >
                        <Maximize2 className="size-4" aria-hidden="true" />
                        Xem đầy đủ
                      </Button>
                    </td>
                    {selectedProducts.map((product) => {
                      const productIndex = productIndexById.get(product.id) ?? 0
                      const productName = getTechnicalConfigurationReferenceProductName(
                        product,
                        productIndex
                      )
                      return (
                        <td key={product.id} className="border-b border-r p-3 last:border-r-0">
                          <Textarea
                            value={product.responses[criterion.id] ?? ""}
                            disabled={readOnly}
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
                                setFullTextDetail({
                                  title: `${productName} · ${criterion.criterion_code}`,
                                  text: product.responses[criterion.id] ?? "",
                                })
                              }
                            >
                              <Maximize2 className="size-4" aria-hidden="true" />
                              Xem đầy đủ
                            </Button>
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

      <Dialog
        open={Boolean(fullTextDetail)}
        onOpenChange={(open) => !open && setFullTextDetail(null)}
      >
        <DialogContent closeLabel="Đóng">
          <DialogHeader>
            <DialogTitle>{fullTextDetail?.title}</DialogTitle>
            <DialogDescription className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words pt-2 text-foreground">
              {fullTextDetail?.text}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </section>
  )
}
