"use client"

import React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Loader2, Clock } from "lucide-react"
import { format, differenceInMinutes } from "date-fns"
import { vi } from "date-fns/locale"

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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEndUsageSession } from "@/hooks/use-usage-logs"
import { type UsageLog } from "@/types/database"

const equipmentStatusOptions = [
  "Hoạt động",
  "Chờ sửa chữa", 
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
  "Ngưng sử dụng",
  "Chưa có nhu cầu sử dụng"
] as const

const endUsageSchema = z.object({
  tinh_trang_thiet_bi: z.string().optional(),
  ghi_chu: z.string().optional(),
})

type EndUsageFormData = z.infer<typeof endUsageSchema>

interface EndUsageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  usageLog: UsageLog | null
}

export function EndUsageDialog({
  open,
  onOpenChange,
  usageLog,
}: EndUsageDialogProps) {
  const endUsageMutation = useEndUsageSession()

  const form = useForm<EndUsageFormData>({
    resolver: zodResolver(endUsageSchema),
    defaultValues: {
      tinh_trang_thiet_bi: usageLog?.tinh_trang_thiet_bi || "",
      ghi_chu: usageLog?.ghi_chu || "",
    },
  })

  React.useEffect(() => {
    if (usageLog && open) {
      form.reset({
        tinh_trang_thiet_bi: usageLog.tinh_trang_thiet_bi || "",
        ghi_chu: usageLog.ghi_chu || "",
      })
    }
  }, [usageLog, open, form])

  const onSubmit = async (data: EndUsageFormData) => {
    if (!usageLog) return

    try {
      await endUsageMutation.mutateAsync({
        id: usageLog.id,
        tinh_trang_thiet_bi: data.tinh_trang_thiet_bi,
        ghi_chu: data.ghi_chu,
      })
      
      onOpenChange(false)
      form.reset()
    } catch (error) {
      // Error handling is done in the mutation
    }
  }

  const isLoading = endUsageMutation.isPending

  // Calculate usage duration
  const usageDuration = usageLog 
    ? differenceInMinutes(new Date(), new Date(usageLog.thoi_gian_bat_dau))
    : 0

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours} giờ ${mins} phút`
    }
    return `${mins} phút`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kết thúc sử dụng thiết bị</DialogTitle>
          <DialogDescription>
            Ghi nhận thời gian kết thúc sử dụng thiết bị: {usageLog?.thiet_bi?.ten_thiet_bi}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Usage Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Mã thiết bị</label>
                <p className="text-sm font-mono">{usageLog?.thiet_bi?.ma_thiet_bi}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Người sử dụng</label>
                <p className="text-sm">{usageLog?.nguoi_su_dung?.full_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Thời gian bắt đầu</label>
                <p className="text-sm">
                  {usageLog && format(new Date(usageLog.thoi_gian_bat_dau), "dd/MM/yyyy HH:mm", { locale: vi })}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Thời gian kết thúc</label>
                <p className="text-sm">{format(new Date(), "dd/MM/yyyy HH:mm", { locale: vi })}</p>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Thời gian sử dụng
                </label>
                <p className="text-sm font-medium text-primary">{formatDuration(usageDuration)}</p>
              </div>
            </div>

            {/* Equipment Status */}
            <FormField
              control={form.control}
              name="tinh_trang_thiet_bi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tình trạng thiết bị sau khi sử dụng</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn tình trạng thiết bị" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {equipmentStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="ghi_chu"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ghi chú về tình trạng thiết bị sau khi sử dụng..."
                      className="min-h-[80px]"
                      {...field}
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
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Kết thúc sử dụng
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
