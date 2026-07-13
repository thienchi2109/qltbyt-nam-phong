"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type { TechnicalConfigurationDossierCreateRpcArgs } from "@/app/(app)/technical-configurations/types"
import { SideSheetShell } from "@/components/shared/SideSheetShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type TechnicalConfigurationDossierFormProps = {
  open: boolean
  isSubmitting: boolean
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (args: TechnicalConfigurationDossierCreateRpcArgs) => Promise<void>
}

const dossierFormSchema = z.object({
  deviceTypeName: z.string().trim().min(1, "Vui lòng nhập loại thiết bị."),
  name: z.string().trim().min(1, "Vui lòng nhập tên hồ sơ."),
  description: z.string().trim(),
})

type DossierFormValues = z.infer<typeof dossierFormSchema>

const EMPTY_FORM: DossierFormValues = {
  deviceTypeName: "",
  name: "",
  description: "",
}
const DOSSIER_FORM_ID = "technical-configuration-dossier-form"

/** Renders the explicit-save form for creating a configuration dossier. */
export function TechnicalConfigurationDossierForm({
  open,
  isSubmitting,
  errorMessage,
  onOpenChange,
  onSubmit,
}: Readonly<TechnicalConfigurationDossierFormProps>) {
  const form = useForm<DossierFormValues>({
    resolver: zodResolver(dossierFormSchema),
    defaultValues: EMPTY_FORM,
  })
  const { reset } = form

  React.useEffect(() => {
    if (!open) {
      reset(EMPTY_FORM)
    }
  }, [open, reset])

  async function submitForm(values: DossierFormValues) {
    try {
      await onSubmit({
        p_device_type_name: values.deviceTypeName,
        p_name: values.name,
        p_description: values.description || null,
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
    <SideSheetShell
      open={open}
      onOpenChange={handleOpenChange}
      title="Tạo hồ sơ cấu hình"
      description="Hồ sơ là gốc độc lập cho một dòng cấu hình thiết bị."
      closeLabel="Đóng"
      hideCloseButton={isSubmitting}
      contentClassName="sm:max-w-lg"
      bodyClassName="overflow-y-auto p-4"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button type="submit" form={DOSSIER_FORM_ID} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Lưu hồ sơ
          </Button>
        </div>
      }
    >
      <Form {...form}>
        <form id={DOSSIER_FORM_ID} className="space-y-5" onSubmit={form.handleSubmit(submitForm)}>
          <FormField
            control={form.control}
            name="deviceTypeName"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="technical-configuration-device-type">Loại thiết bị</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    id="technical-configuration-device-type"
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="technical-configuration-name">Tên hồ sơ</FormLabel>
                <FormControl>
                  <Input {...field} id="technical-configuration-name" disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="technical-configuration-description">Mô tả</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    id="technical-configuration-description"
                    rows={4}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </Form>
    </SideSheetShell>
  )
}
