"use client"

import * as React from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import type { TechnicalConfigurationDossierCreateRpcArgs } from "../types"

type TechnicalConfigurationDossierFormProps = {
  open: boolean
  isSubmitting: boolean
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (args: TechnicalConfigurationDossierCreateRpcArgs) => Promise<void>
}

const EMPTY_FORM = {
  deviceTypeName: "",
  name: "",
  description: "",
}

/** Renders the explicit-save form for creating a configuration dossier. */
export function TechnicalConfigurationDossierForm({
  open,
  isSubmitting,
  errorMessage,
  onOpenChange,
  onSubmit,
}: Readonly<TechnicalConfigurationDossierFormProps>) {
  const [form, setForm] = React.useState(EMPTY_FORM)

  React.useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      await onSubmit({
        p_device_type_name: form.deviceTypeName.trim(),
        p_name: form.name.trim(),
        p_description: form.description.trim() || null,
        p_expected_revision: 0,
      })
    } catch {
      // The mutation error is rendered without clearing locally edited values.
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) {
      return
    }

    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
        closeLabel="Đóng"
        showCloseButton={!isSubmitting}
      >
        <DialogHeader>
          <DialogTitle>Tạo hồ sơ cấu hình</DialogTitle>
          <DialogDescription>
            Hồ sơ là gốc độc lập cho một dòng cấu hình thiết bị.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="technical-configuration-device-type">Loại thiết bị</Label>
            <Input
              id="technical-configuration-device-type"
              value={form.deviceTypeName}
              required
              disabled={isSubmitting}
              onChange={(event) =>
                setForm((current) => ({ ...current, deviceTypeName: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="technical-configuration-name">Tên hồ sơ</Label>
            <Input
              id="technical-configuration-name"
              value={form.name}
              required
              disabled={isSubmitting}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="technical-configuration-description">Mô tả</Label>
            <Textarea
              id="technical-configuration-description"
              value={form.description}
              rows={4}
              disabled={isSubmitting}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Lưu hồ sơ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
