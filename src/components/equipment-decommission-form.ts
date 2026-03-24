"use client"

import * as React from "react"
import {
  useWatch,
  type Control,
  type FieldValues,
  type Path,
  type PathValue,
  type UseFormSetValue,
} from "react-hook-form"
import { z } from "zod"
import {
  FULL_DATE_ERROR_MESSAGE,
  isValidFullDate,
  normalizeFullDateForForm,
} from "@/lib/date-utils"

export {
  FULL_DATE_ERROR_MESSAGE,
  isValidFullDate,
  normalizeFullDateForForm,
} from "@/lib/date-utils"

export const DECOMMISSIONED_STATUS = "Ngưng sử dụng"
export const DECOMMISSION_DATE_STATUS_ERROR_MESSAGE =
  'Ngày ngừng sử dụng chỉ được phép khi tình trạng là "Ngưng sử dụng"'
export const DECOMMISSION_DATE_CHRONOLOGICAL_ERROR_MESSAGE =
  "Ngày ngừng sử dụng phải sau hoặc bằng ngày đưa vào sử dụng"

interface DecommissionDateValidationValues {
  tinh_trang_hien_tai?: string | null | undefined
  ngay_dua_vao_su_dung?: string | null | undefined
  ngay_ngung_su_dung?: string | null | undefined
}

interface DecommissionDateFormValues extends FieldValues {
  tinh_trang_hien_tai?: string | null | undefined
  ngay_ngung_su_dung?: string | null | undefined
}

interface UseDecommissionDateAutofillArgs<TFieldValues extends DecommissionDateFormValues> {
  control: Control<TFieldValues>
  setValue: UseFormSetValue<TFieldValues>
  initialStatus?: string | null
}

export function validateDecommissionDateRules(
  values: DecommissionDateValidationValues,
  ctx: z.RefinementCtx
): void {
  const { tinh_trang_hien_tai, ngay_dua_vao_su_dung, ngay_ngung_su_dung } = values

  if (
    ngay_ngung_su_dung &&
    tinh_trang_hien_tai !== DECOMMISSIONED_STATUS
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: DECOMMISSION_DATE_STATUS_ERROR_MESSAGE,
      path: ["ngay_ngung_su_dung"],
    })
  }

  if (
    ngay_ngung_su_dung &&
    ngay_dua_vao_su_dung &&
    /^\d{4}-\d{2}-\d{2}$/.test(ngay_dua_vao_su_dung) &&
    ngay_ngung_su_dung < ngay_dua_vao_su_dung
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: DECOMMISSION_DATE_CHRONOLOGICAL_ERROR_MESSAGE,
      path: ["ngay_ngung_su_dung"],
    })
  }
}

export function getTodayDateForDecommissionField(): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  return formatter.format(new Date(Date.now()))
}

export function useDecommissionDateAutofill<TFieldValues extends DecommissionDateFormValues>({
  control,
  setValue,
  initialStatus = null,
}: UseDecommissionDateAutofillArgs<TFieldValues>): void {
  const currentStatus = useWatch({
    control,
    name: "tinh_trang_hien_tai" as Path<TFieldValues>,
  }) as string | null | undefined
  const currentDecommissionDate = useWatch({
    control,
    name: "ngay_ngung_su_dung" as Path<TFieldValues>,
  }) as string | null | undefined
  const previousStatusRef = React.useRef<string | null>(initialStatus)

  React.useEffect(() => {
    previousStatusRef.current = initialStatus ?? null
  }, [initialStatus])

  React.useEffect(() => {
    if (currentStatus === undefined && initialStatus !== null) {
      return
    }

    const hasDateValue =
      typeof currentDecommissionDate === "string"
        ? currentDecommissionDate.trim() !== ""
        : Boolean(currentDecommissionDate)

    if (
      previousStatusRef.current !== DECOMMISSIONED_STATUS &&
      currentStatus === DECOMMISSIONED_STATUS &&
      !hasDateValue
    ) {
      setValue(
        "ngay_ngung_su_dung" as Path<TFieldValues>,
        getTodayDateForDecommissionField() as PathValue<TFieldValues, Path<TFieldValues>>,
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      )
    }

    previousStatusRef.current = currentStatus ?? null
  }, [currentDecommissionDate, currentStatus, setValue])
}
