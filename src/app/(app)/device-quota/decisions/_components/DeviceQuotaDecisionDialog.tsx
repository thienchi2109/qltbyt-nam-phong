/**
 * DeviceQuotaDecisionDialog.tsx
 *
 * Create/Edit dialog for device quota decisions
 * Uses react-hook-form + zod for form validation
 */

"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { useDeviceQuotaDecisionsContext } from "../_hooks/useDeviceQuotaDecisionsContext"

// ============================================
// Validation Schema
// ============================================

const decisionFormSchema = z.object({
  so_quyet_dinh: z.string().min(1, "Số quyết định không được để trống"),
  ngay_ban_hanh: z.date({
    required_error: "Vui lòng chọn ngày ban hành",
  }),
  ngay_hieu_luc: z.date({
    required_error: "Vui lòng chọn ngày hiệu lực",
  }),
  ngay_het_hieu_luc: z.date().optional().nullable(),
  nguoi_ky: z.string().min(1, "Người ký không được để trống"),
  chuc_vu_nguoi_ky: z.string().min(1, "Chức vụ người ký không được để trống"),
  ghi_chu: z.string().optional().nullable(),
}).refine(
  (data) => {
    // Validate ngay_hieu_luc >= ngay_ban_hanh
    if (data.ngay_hieu_luc && data.ngay_ban_hanh) {
      return data.ngay_hieu_luc >= data.ngay_ban_hanh
    }
    return true
  },
  {
    message: "Ngày hiệu lực phải sau hoặc bằng ngày ban hành",
    path: ["ngay_hieu_luc"],
  }
).refine(
  (data) => {
    // Validate ngay_het_hieu_luc > ngay_hieu_luc
    if (data.ngay_het_hieu_luc && data.ngay_hieu_luc) {
      return data.ngay_het_hieu_luc > data.ngay_hieu_luc
    }
    return true
  },
  {
    message: "Ngày hết hiệu lực phải sau ngày hiệu lực",
    path: ["ngay_het_hieu_luc"],
  }
)

type DecisionFormValues = z.infer<typeof decisionFormSchema>

// ============================================
// Component
// ============================================

export function DeviceQuotaDecisionDialog() {
  const {
    isCreateDialogOpen,
    isEditDialogOpen,
    selectedDecision,
    closeDialogs,
    createMutation,
    updateMutation,
  } = useDeviceQuotaDecisionsContext()

  const isOpen = isCreateDialogOpen || isEditDialogOpen
  const isEditMode = isEditDialogOpen && !!selectedDecision

  // Form initialization
  const form = useForm<DecisionFormValues>({
    resolver: zodResolver(decisionFormSchema),
    defaultValues: {
      so_quyet_dinh: "",
      ngay_ban_hanh: undefined,
      ngay_hieu_luc: undefined,
      ngay_het_hieu_luc: null,
      nguoi_ky: "",
      chuc_vu_nguoi_ky: "",
      ghi_chu: null,
    },
  })

  // Populate form in edit mode
  React.useEffect(() => {
    if (isEditMode && selectedDecision) {
      form.reset({
        so_quyet_dinh: selectedDecision.so_quyet_dinh,
        ngay_ban_hanh: new Date(selectedDecision.ngay_ban_hanh),
        ngay_hieu_luc: new Date(selectedDecision.ngay_hieu_luc),
        ngay_het_hieu_luc: selectedDecision.ngay_het_hieu_luc
          ? new Date(selectedDecision.ngay_het_hieu_luc)
          : null,
        nguoi_ky: selectedDecision.nguoi_ky,
        chuc_vu_nguoi_ky: selectedDecision.chuc_vu_nguoi_ky,
        ghi_chu: selectedDecision.ghi_chu || null,
      })
    } else if (isCreateDialogOpen) {
      form.reset({
        so_quyet_dinh: "",
        ngay_ban_hanh: undefined,
        ngay_hieu_luc: undefined,
        ngay_het_hieu_luc: null,
        nguoi_ky: "",
        chuc_vu_nguoi_ky: "",
        ghi_chu: null,
      })
    }
  }, [isEditMode, selectedDecision, isCreateDialogOpen, form])

  // Handle dialog close
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeDialogs()
      form.reset()
    }
  }

  // Form submission
  const onSubmit = (data: DecisionFormValues) => {
    const payload = {
      so_quyet_dinh: data.so_quyet_dinh,
      ngay_ban_hanh: format(data.ngay_ban_hanh, "yyyy-MM-dd"),
      ngay_hieu_luc: format(data.ngay_hieu_luc, "yyyy-MM-dd"),
      ngay_het_hieu_luc: data.ngay_het_hieu_luc
        ? format(data.ngay_het_hieu_luc, "yyyy-MM-dd")
        : null,
      nguoi_ky: data.nguoi_ky,
      chuc_vu_nguoi_ky: data.chuc_vu_nguoi_ky,
      ghi_chu: data.ghi_chu || null,
      thay_the_cho_id: null, // Not handled in form yet
    }

    if (isEditMode && selectedDecision) {
      updateMutation.mutate(
        {
          id: selectedDecision.id,
          ...payload,
        },
        {
          onSuccess: () => {
            closeDialogs()
            form.reset()
          },
        }
      )
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          closeDialogs()
          form.reset()
        },
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Chỉnh sửa quyết định" : "Tạo quyết định mới"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Cập nhật thông tin quyết định định mức thiết bị"
              : "Tạo quyết định định mức thiết bị mới"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Số quyết định */}
            <FormField
              control={form.control}
              name="so_quyet_dinh"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số quyết định *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="VD: 123/QĐ-BYT"
                      {...field}
                      disabled={isPending}
                      className="touch-target"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ngày ban hành */}
            <FormField
              control={form.control}
              name="ngay_ban_hanh"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày ban hành *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal touch-target",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isPending}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy")
                          ) : (
                            <span>Chọn ngày</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ngày hiệu lực */}
            <FormField
              control={form.control}
              name="ngay_hieu_luc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày hiệu lực *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal touch-target",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isPending}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy")
                          ) : (
                            <span>Chọn ngày</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => {
                          const banHanh = form.getValues("ngay_ban_hanh")
                          if (banHanh) {
                            return date < banHanh
                          }
                          return false
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ngày hết hiệu lực */}
            <FormField
              control={form.control}
              name="ngay_het_hieu_luc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày hết hiệu lực (tùy chọn)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal touch-target",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isPending}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy")
                          ) : (
                            <span>Chọn ngày (nếu có)</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={field.onChange}
                        disabled={(date) => {
                          const hieuLuc = form.getValues("ngay_hieu_luc")
                          if (hieuLuc) {
                            return date <= hieuLuc
                          }
                          return false
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Người ký */}
            <FormField
              control={form.control}
              name="nguoi_ky"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Người ký *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="VD: Nguyễn Văn A"
                      {...field}
                      disabled={isPending}
                      className="touch-target"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Chức vụ người ký */}
            <FormField
              control={form.control}
              name="chuc_vu_nguoi_ky"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chức vụ người ký *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="VD: Giám đốc Bệnh viện"
                      {...field}
                      disabled={isPending}
                      className="touch-target"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ghi chú */}
            <FormField
              control={form.control}
              name="ghi_chu"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Nhập ghi chú về quyết định (tùy chọn)"
                      rows={3}
                      {...field}
                      value={field.value || ""}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
                className="touch-target"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="touch-target"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? "Lưu thay đổi" : "Tạo quyết định"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
