"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type {
  TechnicalConfigurationDossierCreateRpcArgs,
  TechnicalConfigurationDossierUpdateRpcArgs,
  TechnicalConfigurationDossierWire,
} from "@/app/(app)/technical-configurations/types"
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

type TechnicalConfigurationDossierFormCommonProps = {
  open: boolean
  isSubmitting: boolean
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
}

type TechnicalConfigurationDossierFormProps = TechnicalConfigurationDossierFormCommonProps &
  (
    | {
        mode: "create"
        onSubmit: (args: TechnicalConfigurationDossierCreateRpcArgs) => Promise<void>
      }
    | {
        mode: "edit"
        dossier: TechnicalConfigurationDossierWire
        onSubmit: (args: TechnicalConfigurationDossierUpdateRpcArgs) => Promise<void>
      }
  )

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

/** Renders the shared explicit-save form for dossier create and metadata edit. */
export function TechnicalConfigurationDossierForm(
  props: Readonly<TechnicalConfigurationDossierFormProps>
) {
  const editDossier = props.mode === "edit" ? props.dossier : null
  const initialValues = React.useMemo<DossierFormValues>(
    () =>
      editDossier
        ? {
            deviceTypeName: editDossier.device_type_name,
            name: editDossier.name,
            description: editDossier.description ?? "",
          }
        : EMPTY_FORM,
    [
      editDossier?.description,
      editDossier?.device_type_name,
      editDossier?.id,
      editDossier?.name,
      editDossier?.revision,
    ]
  )
  const form = useForm<DossierFormValues>({
    resolver: zodResolver(dossierFormSchema),
    defaultValues: initialValues,
  })
  const { reset } = form
  const resetTargetRef = React.useRef<string | null>(null)
  const resetTarget = props.mode === "edit" ? `edit:${props.dossier.id}` : "create"

  React.useEffect(() => {
    if (!props.open) {
      resetTargetRef.current = null
      return
    }

    if (resetTargetRef.current !== resetTarget) {
      reset(initialValues)
      resetTargetRef.current = resetTarget
    }
  }, [initialValues, props.open, reset, resetTarget])

  async function submitForm(values: DossierFormValues) {
    const metadata = {
      p_device_type_name: values.deviceTypeName,
      p_name: values.name,
      p_description: values.description || null,
    }

    try {
      if (props.mode === "create") {
        await props.onSubmit({
          ...metadata,
          p_expected_revision: 0,
        })
      } else {
        await props.onSubmit({
          ...metadata,
          p_id: props.dossier.id,
          p_expected_revision: props.dossier.revision,
        })
      }
    } catch {
      // The mutation error is rendered without clearing locally edited values.
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && props.isSubmitting) {
      return
    }

    props.onOpenChange(nextOpen)
  }

  return (
    <SideSheetShell
      open={props.open}
      onOpenChange={handleOpenChange}
      title={props.mode === "create" ? "Tạo hồ sơ cấu hình" : "Sửa metadata hồ sơ"}
      description={
        props.mode === "create"
          ? "Hồ sơ là gốc độc lập cho một dòng cấu hình thiết bị."
          : "Cập nhật loại thiết bị, tên và mô tả của hồ sơ đang hoạt động."
      }
      closeLabel="Đóng"
      hideCloseButton={props.isSubmitting}
      contentClassName="sm:max-w-lg"
      bodyClassName="overflow-y-auto p-4"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={props.isSubmitting}
            onClick={() => handleOpenChange(false)}
          >
            Hủy
          </Button>
          <Button type="submit" form={DOSSIER_FORM_ID} disabled={props.isSubmitting}>
            {props.isSubmitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {props.mode === "create" ? "Lưu hồ sơ" : "Lưu thay đổi"}
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
                    disabled={props.isSubmitting}
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
                  <Input
                    {...field}
                    id="technical-configuration-name"
                    disabled={props.isSubmitting}
                  />
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
                    disabled={props.isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {props.errorMessage ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{props.errorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </Form>
    </SideSheetShell>
  )
}
