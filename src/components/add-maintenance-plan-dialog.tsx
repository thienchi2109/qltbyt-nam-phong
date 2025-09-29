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
import { callRpc } from "@/lib/rpc-client"
import { useSession } from "next-auth/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { taskTypes } from "@/lib/data"

const planFormSchema = z.object({
  ten_ke_hoach: z.string().min(1, "Tên kế hoạch là bắt buộc."),
  nam: z.coerce.number().min(2000, "Năm không hợp lệ.").max(2100, "Năm không hợp lệ."),
  loai_cong_viec: z.enum(taskTypes, { required_error: "Loại công việc là bắt buộc." }),
  khoa_phong: z.string().optional(),
})

type PlanFormValues = z.infer<typeof planFormSchema>

interface AddMaintenancePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddMaintenancePlanDialog({ open, onOpenChange, onSuccess }: AddMaintenancePlanDialogProps) {
  const { toast } = useToast()
  const { data: session } = useSession()
  const user = session?.user as any // Cast NextAuth user to our User type
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      ten_ke_hoach: "",
      nam: new Date().getFullYear(),
      khoa_phong: "",
      loai_cong_viec: "Bảo trì", // Default to first option to prevent mobile crashes
    },
  })


  async function onSubmit(values: PlanFormValues) {
    if (!user) {
        toast({ variant: "destructive", title: "Lỗi", description: "Không tìm thấy thông tin người dùng." })
        return;
    }
    setIsSubmitting(true)
    try {
      const planId = await callRpc<number>({
        fn: 'maintenance_plan_create',
        args: {
          p_ten_ke_hoach: values.ten_ke_hoach,
          p_nam: values.nam,
          p_loai_cong_viec: values.loai_cong_viec,
          p_khoa_phong: values.khoa_phong || null,
          p_nguoi_lap_ke_hoach: user.full_name || user.username,
        }
      })

      if (!planId && planId !== 0) {
        throw new Error('Không nhận được ID kế hoạch mới')
      }

      toast({
        title: "Thành công",
        description: "Đã tạo kế hoạch mới.",
      })
      onSuccess()
      onOpenChange(false)
      form.reset({
        ten_ke_hoach: "",
        nam: new Date().getFullYear(),
        khoa_phong: "",
        loai_cong_viec: "Bảo trì",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tạo kế hoạch. " + error.message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tạo kế hoạch mới</DialogTitle>
          <DialogDescription>
            Điền thông tin để tạo một kế hoạch bảo trì/hiệu chuẩn/kiểm định mới.
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
                    <Input placeholder="VD: Khoa Xét nghiệm" {...field} />
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
                Lưu kế hoạch
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
