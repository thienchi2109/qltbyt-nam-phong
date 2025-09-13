"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
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
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { type MaintenancePlan, taskTypes } from "@/lib/data"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"

const planFormSchema = z.object({
  ten_ke_hoach: z.string().min(1, "Tên kế hoạch là bắt buộc."),
  nam: z.coerce.number().min(2000, "Năm không hợp lệ.").max(2100, "Năm không hợp lệ."),
  loai_cong_viec: z.enum(taskTypes, { required_error: "Loại công việc là bắt buộc." }),
  khoa_phong: z.string().optional().nullable(),
})

type PlanFormValues = z.infer<typeof planFormSchema>

interface EditMaintenancePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  plan: MaintenancePlan | null
}

export function EditMaintenancePlanDialog({ open, onOpenChange, onSuccess, plan }: EditMaintenancePlanDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      ten_ke_hoach: "",
      nam: new Date().getFullYear(),
      khoa_phong: "",
    },
  })

  React.useEffect(() => {
    if (plan) {
      form.reset({
        ten_ke_hoach: plan.ten_ke_hoach,
        nam: plan.nam,
        loai_cong_viec: plan.loai_cong_viec,
        khoa_phong: plan.khoa_phong || "",
      });
    }
  }, [plan, form]);


  async function onSubmit(values: PlanFormValues) {
    if (!plan) return;
    
    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from("ke_hoach_bao_tri")
        .update({
            ...values,
            khoa_phong: values.khoa_phong || null,
        })
        .eq('id', plan.id)

      if (error) {
        throw error
      }

      toast({
        title: "Thành công",
        description: "Đã cập nhật kế hoạch.",
      })
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể cập nhật kế hoạch. " + error.message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Sửa Kế hoạch</DialogTitle>
          <DialogDescription>
            Chỉnh sửa thông tin cho kế hoạch của bạn.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="ten_ke_hoach"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên kế hoạch</FormLabel>
                  <FormControl>
                    <Input placeholder="VD: Kế hoạch Bảo trì năm 2025" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nam"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Năm</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="loai_cong_viec"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loại công việc</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn loại công việc" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {taskTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="khoa_phong"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Khoa/Phòng (nếu có)</FormLabel>
                  <FormControl>
                    <Input placeholder="VD: Khoa Xét nghiệm" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
