import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import {
  TechnicalConfigurationReferenceComparisonTable,
  type TechnicalConfigurationReferenceFullTextDetail,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceComparisonTable"
import {
  TechnicalConfigurationReferenceEvidenceDialog,
  type TechnicalConfigurationReferenceEvidenceDetail,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceEvidence"
import {
  clampReferenceProductPageIndex,
  getReferenceProductDisplayLabels,
  reconcileReferenceColumnState,
  REFERENCE_PRODUCT_PAGE_SIZE,
  type ReferenceColumnState,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceComparisonUtils"
import { useTechnicalConfigurationDocuments } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDocuments"
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
type TechnicalConfigurationReferenceComparisonProps = {
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  products: TechnicalConfigurationReferenceProductDraft[]
  readOnly: boolean
  onResponseChange: (productId: string, criterionId: string, responseText: string) => void
  onRevisionChange?: (revision: number) => void
  onEvidenceDirtyChange?: (dirty: boolean) => void
  onEvidenceNavigationBlockedChange?: (blocked: boolean) => void
}

/** Renders the baseline-first comparison matrix with user-selectable product columns. */
export function TechnicalConfigurationReferenceComparison({
  baselineVersion,
  products,
  readOnly,
  onResponseChange,
  onRevisionChange,
  onEvidenceDirtyChange,
  onEvidenceNavigationBlockedChange,
}: Readonly<TechnicalConfigurationReferenceComparisonProps>) {
  const productIds = products.map((product) => product.id)
  const [columnState, setColumnState] = React.useState<ReferenceColumnState>(() => ({
    baselineVersionId: baselineVersion.id,
    productIds,
    hiddenProductIds: [],
    pageIndex: 0,
  }))
  const [fullTextDetail, setFullTextDetail] =
    React.useState<TechnicalConfigurationReferenceFullTextDetail | null>(null)
  const [evidenceDetail, setEvidenceDetail] =
    React.useState<TechnicalConfigurationReferenceEvidenceDetail | null>(null)
  const previousBaselineVersionIdRef = React.useRef(baselineVersion.id)
  const evidenceState = useTechnicalConfigurationDocuments({
    baselineVersion,
    onRevisionChange,
    onNavigationBlockedChange: onEvidenceNavigationBlockedChange,
  })
  React.useEffect(() => {
    if (previousBaselineVersionIdRef.current === baselineVersion.id) return
    previousBaselineVersionIdRef.current = baselineVersion.id
    setEvidenceDetail(null)
    setFullTextDetail(null)
    onEvidenceDirtyChange?.(false)
    onEvidenceNavigationBlockedChange?.(false)
  }, [baselineVersion.id, onEvidenceDirtyChange, onEvidenceNavigationBlockedChange])
  const reconciledColumnState = reconcileReferenceColumnState(
    columnState,
    baselineVersion.id,
    productIds
  )
  if (reconciledColumnState) {
    setColumnState(reconciledColumnState)
  }

  const activeColumnState = reconciledColumnState ?? columnState
  const hiddenProductIdSet = React.useMemo(
    () => new Set(activeColumnState.hiddenProductIds),
    [activeColumnState.hiddenProductIds]
  )
  const productIndexById = React.useMemo(
    () => new Map(products.map((product, index) => [product.id, index])),
    [products]
  )
  const productLabelById = React.useMemo(
    () => getReferenceProductDisplayLabels(products),
    [products]
  )
  const selectedProducts = products.filter((product) => !hiddenProductIdSet.has(product.id))
  const pageCount = Math.max(1, Math.ceil(selectedProducts.length / REFERENCE_PRODUCT_PAGE_SIZE))
  const pageIndex = Math.min(activeColumnState.pageIndex, pageCount - 1)
  const visibleProducts = selectedProducts.slice(
    pageIndex * REFERENCE_PRODUCT_PAGE_SIZE,
    (pageIndex + 1) * REFERENCE_PRODUCT_PAGE_SIZE
  )

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
            const name =
              productLabelById.get(product.id) ??
              getTechnicalConfigurationReferenceProductName(product, index)
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
                      const nextHiddenProductIds = [...hiddenProductIds]
                      return {
                        ...current,
                        hiddenProductIds: nextHiddenProductIds,
                        pageIndex: clampReferenceProductPageIndex(
                          current.pageIndex,
                          current.productIds,
                          nextHiddenProductIds
                        ),
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

      <TechnicalConfigurationReferenceComparisonTable
        baselineVersion={baselineVersion}
        visibleProducts={visibleProducts}
        productIndexById={productIndexById}
        productLabelById={productLabelById}
        readOnly={readOnly}
        evidenceState={evidenceState}
        onResponseChange={onResponseChange}
        onOpenFullText={setFullTextDetail}
        onOpenEvidence={setEvidenceDetail}
      />

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pageIndex === 0}
          onClick={() =>
            setColumnState((current) => ({
              ...current,
              pageIndex: Math.max(0, current.pageIndex - 1),
            }))
          }
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Trước
        </Button>
        <p className="min-w-24 text-center text-sm text-muted-foreground" aria-live="polite">
          Trang {pageIndex + 1} / {pageCount}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pageIndex >= pageCount - 1}
          onClick={() =>
            setColumnState((current) => ({
              ...current,
              pageIndex: Math.min(pageCount - 1, current.pageIndex + 1),
            }))
          }
        >
          Sau
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
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
      <TechnicalConfigurationReferenceEvidenceDialog
        detail={evidenceDetail}
        baselineVersion={baselineVersion}
        readOnly={readOnly}
        onClose={() => setEvidenceDetail(null)}
        onRevisionChange={onRevisionChange}
        onDirtyChange={onEvidenceDirtyChange}
        onNavigationBlockedChange={onEvidenceNavigationBlockedChange}
      />
    </section>
  )
}
