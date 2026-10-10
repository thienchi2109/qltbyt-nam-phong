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
import { getEquipmentStatusMetadata, type EquipmentStatusRow } from "@/lib/equipment-status"
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

const DECOMMISSIONED_STATUS = "Ngưng sử dụng"
/** Validation message for a decommission date on a non-terminal status. */
export const DECOMMISSION_DATE_STATUS_ERROR_MESSAGE =
  'Ngày ngừng sử dụng chỉ được phép khi tình trạng là "Ngưng sử dụng"'
/** Validation message for an out-of-order decommission date. */
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
  statusCatalog?: readonly EquipmentStatusRow[]
}

/** Adds decommission date validation issues to an equipment form. */
export function validateDecommissionDateRules(
  values: DecommissionDateValidationValues,
  ctx: z.RefinementCtx,
  statusCatalog: readonly EquipmentStatusRow[] = [],
  initialStatus?: string | null
): void {
  const { tinh_trang_hien_tai, ngay_dua_vao_su_dung, ngay_ngung_su_dung } = values
  const metadata = getEquipmentStatusMetadata(statusCatalog, tinh_trang_hien_tai ?? "")

  if (
    ngay_ngung_su_dung &&
    tinh_trang_hien_tai !== DECOMMISSIONED_STATUS &&
    !metadata?.is_terminal
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: DECOMMISSION_DATE_STATUS_ERROR_MESSAGE,
      path: ["ngay_ngung_su_dung"],
    })
  }

  if (metadata?.requires_end_date && tinh_trang_hien_tai !== initialStatus && !ngay_ngung_su_dung) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Ngày ngừng sử dụng là bắt buộc",
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

function getTodayDateForDecommissionField(): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  return formatter.format(new Date(Date.now()))
}

/** Keeps decommission dates synchronized with the selected status. */
export function useDecommissionDateAutofill<TFieldValues extends DecommissionDateFormValues>({
  control,
  setValue,
  initialStatus = null,
  statusCatalog = [],
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
  const metadata = getEquipmentStatusMetadata(statusCatalog, currentStatus ?? "")
  const requiresEndDate = currentStatus === DECOMMISSIONED_STATUS || !!metadata?.requires_end_date
  const isActiveNonterminal =
    !!metadata?.is_active && !metadata.is_terminal && currentStatus !== DECOMMISSIONED_STATUS

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

    if (previousStatusRef.current !== currentStatus && requiresEndDate && !hasDateValue) {
      setValue(
        "ngay_ngung_su_dung" as Path<TFieldValues>,
        getTodayDateForDecommissionField() as PathValue<TFieldValues, Path<TFieldValues>>,
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      )
    }

    const previousMetadata = getEquipmentStatusMetadata(
      statusCatalog,
      previousStatusRef.current ?? ""
    )
    if (
      previousStatusRef.current !== currentStatus &&
      isActiveNonterminal &&
      hasDateValue &&
      (previousStatusRef.current === DECOMMISSIONED_STATUS || previousMetadata?.is_terminal)
    ) {
      setValue(
        "ngay_ngung_su_dung" as Path<TFieldValues>,
        "" as PathValue<TFieldValues, Path<TFieldValues>>,
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      )
    }

    previousStatusRef.current = currentStatus ?? null
  }, [
    currentDecommissionDate,
    currentStatus,
    initialStatus,
    isActiveNonterminal,
    requiresEndDate,
    setValue,
    statusCatalog,
  ])
}
