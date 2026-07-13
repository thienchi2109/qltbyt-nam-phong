"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type { TechnicalConfigurationDossierCreateRpcArgs } from "@/app/(app)/technical-configurations/types"
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

        <Form {...form}>
          <form className="space-y-5" onSubmit={form.handleSubmit(submitForm)}>
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
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Lưu hồ sơ
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
