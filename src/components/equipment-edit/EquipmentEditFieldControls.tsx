"use client"

import * as React from "react"
import { type Path, useFormContext } from "react-hook-form"

import { RequiredFormLabel } from "@/components/ui/required-form-label"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import type { EquipmentFormValues } from "./EquipmentEditTypes"
import { toNullableNumber } from "./EquipmentEditFieldUtils"

interface EquipmentEditFieldProps {
  name: Path<EquipmentFormValues>
  label: string
  placeholder?: string
  required?: boolean
}

function EquipmentEditLabel({
  children,
  required,
}: {
  children: React.ReactNode
  required?: boolean
}) {
  return required ? (
    <RequiredFormLabel required>{children}</RequiredFormLabel>
  ) : (
    <FormLabel>{children}</FormLabel>
  )
}

/** Renders a controlled text input bound to the shared equipment edit form. */
export function EquipmentEditTextField({
  name,
  label,
  placeholder,
  required,
}: EquipmentEditFieldProps) {
  const form = useFormContext<EquipmentFormValues>()

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <EquipmentEditLabel required={required}>{label}</EquipmentEditLabel>
          <FormControl>
            <Input
              placeholder={placeholder}
              {...field}
              value={field.value == null ? "" : String(field.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

/** Renders a controlled number input that stores empty values as null. */
export function EquipmentEditNullableNumberField({
  name,
  label,
  required,
}: EquipmentEditFieldProps) {
  const form = useFormContext<EquipmentFormValues>()

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <EquipmentEditLabel required={required}>{label}</EquipmentEditLabel>
          <FormControl>
            <Input
              type="number"
              {...field}
              value={field.value ?? ""}
              onChange={(event) => field.onChange(toNullableNumber(event.target.value))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

/** Renders a controlled textarea bound to the shared equipment edit form. */
export function EquipmentEditTextareaField({
  name,
  label,
  placeholder,
  rows = 3,
  className,
}: EquipmentEditFieldProps & {
  rows?: number
  className?: string
}) {
  const form = useFormContext<EquipmentFormValues>()

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              rows={rows}
              placeholder={placeholder}
              className={className}
              {...field}
              value={field.value == null ? "" : String(field.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
