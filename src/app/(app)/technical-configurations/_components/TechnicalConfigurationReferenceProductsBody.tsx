import * as React from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { TechnicalConfigurationReferenceComparison } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceComparison"
import { TechnicalConfigurationReferenceProductEditor } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceProductEditor"
import type { useTechnicalConfigurationReferenceProducts } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationReferenceProducts"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type TechnicalConfigurationReferenceProductsBodyProps = {
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  referenceState: ReturnType<typeof useTechnicalConfigurationReferenceProducts>
  navigationBlocked: boolean
}

/** Renders reference-product query states, metadata editors, and comparison matrix. */
export function TechnicalConfigurationReferenceProductsBody({
  baselineVersion,
  referenceState,
  navigationBlocked,
}: Readonly<TechnicalConfigurationReferenceProductsBodyProps>) {
  const invalidProductIdSet = React.useMemo(
    () => new Set(referenceState.invalidProductIds),
    [referenceState.invalidProductIds]
  )
  const hasInitialQueryError =
    referenceState.productsQuery.isError && referenceState.productsQuery.data === undefined
  const canRenderProducts = !referenceState.productsQuery.isLoading && !hasInitialQueryError

  return (
    <>
      {referenceState.productsQuery.isLoading ? (
        <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang tải sản phẩm tham chiếu...
        </div>
      ) : null}

      {hasInitialQueryError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>Không thể tải sản phẩm tham chiếu</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>Vui lòng thử lại.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void referenceState.productsQuery.refetch()
              }}
            >
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {canRenderProducts ? (
        <div className="space-y-4">
          {referenceState.products.map((product, index) => (
            <TechnicalConfigurationReferenceProductEditor
              key={product.id}
              product={product}
              index={index}
              invalid={invalidProductIdSet.has(product.id)}
              readOnly={referenceState.isReadOnly}
              navigationBlocked={navigationBlocked}
              onUpdate={referenceState.updateProduct}
              onRemove={referenceState.removeProduct}
            />
          ))}
        </div>
      ) : null}

      {canRenderProducts ? (
        <TechnicalConfigurationReferenceComparison
          baselineVersion={baselineVersion}
          products={referenceState.products}
          readOnly={referenceState.isReadOnly || navigationBlocked}
          onResponseChange={referenceState.updateResponse}
        />
      ) : null}
    </>
  )
}
