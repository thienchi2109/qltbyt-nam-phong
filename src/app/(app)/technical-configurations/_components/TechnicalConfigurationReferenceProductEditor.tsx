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
  const disabled = readOnly || navigationBlocked

  return (
    <section className="rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold">{productName}</h3>
          {invalid ? (
            <p className="mt-1 text-sm text-destructive">
              Nhập ít nhất model, hãng sản xuất hoặc mô tả.
            </p>
          ) : null}
        </div>
        {!readOnly ? (
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
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${fieldPrefix}-model`}>Model</Label>
          <Input
            id={`${fieldPrefix}-model`}
            value={product.model}
            disabled={disabled}
            onChange={(event) => onUpdate(product.id, { model: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${fieldPrefix}-manufacturer`}>Hãng sản xuất</Label>
          <Input
            id={`${fieldPrefix}-manufacturer`}
            value={product.manufacturer}
            disabled={disabled}
            onChange={(event) => onUpdate(product.id, { manufacturer: event.target.value })}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={`${fieldPrefix}-description`}>Mô tả</Label>
          <Textarea
            id={`${fieldPrefix}-description`}
            value={product.description}
            disabled={disabled}
            onChange={(event) => onUpdate(product.id, { description: event.target.value })}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={`${fieldPrefix}-notes`}>Ghi chú</Label>
          <Textarea
            id={`${fieldPrefix}-notes`}
            value={product.notes}
            disabled={disabled}
            onChange={(event) => onUpdate(product.id, { notes: event.target.value })}
          />
        </div>
      </div>
    </section>
  )
}
