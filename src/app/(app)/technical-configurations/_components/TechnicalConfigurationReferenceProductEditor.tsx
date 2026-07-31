import { Trash2 } from "lucide-react"

import {
  getTechnicalConfigurationReferenceProductName,
  type TechnicalConfigurationReferenceProductDraft,
  type TechnicalConfigurationReferenceProductPatch,
} from "@/app/(app)/technical-configurations/technical-configuration-reference-product-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type TechnicalConfigurationReferenceProductEditorProps = {
  product: TechnicalConfigurationReferenceProductDraft
  index: number
  invalid: boolean
  readOnly: boolean
  navigationBlocked: boolean
  onUpdate: (productId: string, patch: TechnicalConfigurationReferenceProductPatch) => void
  onRemove: (productId: string) => void
}

/** Renders editable metadata for one reference product. */
export function TechnicalConfigurationReferenceProductEditor({
  product,
  index,
  invalid,
  readOnly,
  navigationBlocked,
  onUpdate,
  onRemove,
}: Readonly<TechnicalConfigurationReferenceProductEditorProps>) {
  const productName = getTechnicalConfigurationReferenceProductName(product, index)
  const fieldPrefix = `reference-product-${product.id}`

  return (
    <section
      className="flex min-h-full flex-col p-4 sm:p-5"
      aria-label="Chi tiết sản phẩm tham chiếu"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Chi tiết sản phẩm</h3>
          <p className="mt-1 break-words text-sm text-muted-foreground">{productName}</p>
          {invalid ? (
            <p className="mt-1 text-sm text-destructive">
              Nhập ít nhất model, hãng sản xuất hoặc mô tả.
            </p>
          ) : null}
        </div>
        {!readOnly ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Xóa ${productName}`}
                  disabled={navigationBlocked}
                  onClick={() => onRemove(product.id)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Xóa sản phẩm</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${fieldPrefix}-model`}>Model</Label>
          <Input
            id={`${fieldPrefix}-model`}
            value={product.model}
            readOnly={readOnly}
            disabled={navigationBlocked}
            onChange={(event) => onUpdate(product.id, { model: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${fieldPrefix}-manufacturer`}>Hãng sản xuất</Label>
          <Input
            id={`${fieldPrefix}-manufacturer`}
            value={product.manufacturer}
            readOnly={readOnly}
            disabled={navigationBlocked}
            onChange={(event) => onUpdate(product.id, { manufacturer: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${fieldPrefix}-description`}>Mô tả</Label>
          <Textarea
            id={`${fieldPrefix}-description`}
            value={product.description}
            readOnly={readOnly}
            disabled={navigationBlocked}
            className="min-h-24 resize-y"
            onChange={(event) => onUpdate(product.id, { description: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${fieldPrefix}-notes`}>Ghi chú</Label>
          <Textarea
            id={`${fieldPrefix}-notes`}
            value={product.notes}
            readOnly={readOnly}
            disabled={navigationBlocked}
            className="min-h-24 resize-y"
            onChange={(event) => onUpdate(product.id, { notes: event.target.value })}
          />
        </div>
      </div>

      <p className="mt-auto pt-5 text-xs text-muted-foreground">
        Thay đổi được lưu cùng toàn bộ danh sách.
      </p>
    </section>
  )
}
