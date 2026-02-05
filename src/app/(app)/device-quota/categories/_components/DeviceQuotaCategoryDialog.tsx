"use client"

import * as React from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Loader2 } from "lucide-react"

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"
import type { CategoryFormInput, CategoryListItem } from "../_types/categories"

const categoryFormSchema = z.object({
  ma_nhom: z.string().min(1, "Mã nhóm không được để trống"),
  ten_nhom: z.string().min(1, "Tên nhóm không được để trống"),
  parent_id: z.string().optional(),
  phan_loai: z.string().optional(),
  don_vi_tinh: z.string().optional(),
  thu_tu_hien_thi: z.coerce.number().int().min(0).default(0),
  mo_ta: z.string().optional(),
})

type CategoryFormValues = z.infer<typeof categoryFormSchema>

function normalizeParentId(value?: string) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

function buildPayload(values: CategoryFormValues): CategoryFormInput {
  return {
    ma_nhom: values.ma_nhom.trim(),
    ten_nhom: values.ten_nhom.trim(),
    parent_id: normalizeParentId(values.parent_id),
    phan_loai: values.phan_loai ? (values.phan_loai as "A" | "B" | "C" | "D") : null,
    don_vi_tinh: values.don_vi_tinh?.trim() || null,
    thu_tu_hien_thi: values.thu_tu_hien_thi ?? 0,
    mo_ta: values.mo_ta?.trim() || null,
  }
}

export function DeviceQuotaCategoryDialog() {
  const {
    dialogState,
    closeDialog,
    createMutation,
    updateMutation,
    categories,
    getDescendantIds,
  } = useDeviceQuotaCategoryContext()

  const isOpen = dialogState.mode !== "closed"
  const isEditMode = dialogState.mode === "edit"
  const editingCategory = isEditMode ? dialogState.category : null

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      ma_nhom: "",
      ten_nhom: "",
      parent_id: "",
      phan_loai: "B",
      don_vi_tinh: "Cái",
      thu_tu_hien_thi: 0,
      mo_ta: "",
    },
  })

  React.useEffect(() => {
    if (isEditMode && editingCategory) {
      form.reset({
        ma_nhom: editingCategory.ma_nhom,
        ten_nhom: editingCategory.ten_nhom,
        parent_id: editingCategory.parent_id ? String(editingCategory.parent_id) : "",
        phan_loai: editingCategory.phan_loai || "",
        don_vi_tinh: editingCategory.don_vi_tinh || "",
        thu_tu_hien_thi: editingCategory.thu_tu_hien_thi ?? 0,
        mo_ta: editingCategory.mo_ta || "",
      })
      return
    }

    if (dialogState.mode === "create") {
      form.reset({
        ma_nhom: "",
        ten_nhom: "",
        parent_id: "",
        phan_loai: "B",
        don_vi_tinh: "Cái",
        thu_tu_hien_thi: 0,
        mo_ta: "",
      })
    }
  }, [dialogState.mode, isEditMode, editingCategory, form])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeDialog()
      form.reset()
    }
  }

  const availableParents = React.useMemo(() => {
    if (!editingCategory) return categories
    const descendantIds = getDescendantIds(editingCategory.id)
    return categories.filter(
      (cat) => cat.id !== editingCategory.id && !descendantIds.has(cat.id)
    )
  }, [categories, editingCategory, getDescendantIds])

  const onSubmit = (values: CategoryFormValues) => {
    const payload = buildPayload(values)
    if (isEditMode && editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, ...payload })
      return
    }
    createMutation.mutate(payload)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Chỉnh sửa danh mục" : "Tạo danh mục mới"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Cập nhật thông tin danh mục thiết bị"
              : "Tạo danh mục thiết bị mới"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="ma_nhom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mã nhóm</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ten_nhom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên nhóm</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nhóm cha</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Không có" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Không có (nhóm gốc)</SelectItem>
                        {availableParents.map((cat: CategoryListItem) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>
                            {cat.ma_nhom} - {cat.ten_nhom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phan_loai"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phân loại</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn phân loại" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Không xác định</SelectItem>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="don_vi_tinh"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Đơn vị tính</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="thu_tu_hien_thi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Thứ tự hiển thị</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="mo_ta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mô tả</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
