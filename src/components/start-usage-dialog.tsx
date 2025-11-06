"use client"

import React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { CalendarIcon, Loader2 } from "lucide-react"
import { format } from "date-fns"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSession } from "next-auth/react"
import { useStartUsageSession } from "@/hooks/use-usage-logs"
import { useToast } from "@/hooks/use-toast"
import type { Equipment as DbEquipment } from "@/types/database"

const equipmentStatusOptions = [
  "Hoạt động",
  "Chờ sửa chữa", 
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
  "Ngưng sử dụng",
  "Chưa có nhu cầu sử dụng"
] as const

const startUsageSchema = z.object({
  tinh_trang_thiet_bi: z.string().optional(),
  ghi_chu: z.string().optional(),
})

type StartUsageFormData = z.infer<typeof startUsageSchema>

type EquipmentForStart = Pick<DbEquipment, 'id' | 'ten_thiet_bi' | 'ma_thiet_bi'> & { tinh_trang_hien_tai?: string | null }

interface StartUsageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: EquipmentForStart | null
}

export function StartUsageDialog({
  open,
  onOpenChange,
  equipment,
}: StartUsageDialogProps) {
  const { data: session } = useSession()
  const user = session?.user as any
  const isRegionalLeader = user?.role === 'regional_leader'
  const { toast } = useToast()
  const currentUserId = React.useMemo(() => {
    const rawId = user?.id
    if (typeof rawId === "number" && Number.isFinite(rawId)) {
      return rawId
    }
    if (typeof rawId === "string" && /^\d+$/.test(rawId)) {
      return parseInt(rawId, 10)
    }
    return null
  }, [user?.id])
  const startUsageMutation = useStartUsageSession()

  const form = useForm<StartUsageFormData>({
    resolver: zodResolver(startUsageSchema),
    defaultValues: {
      tinh_trang_thiet_bi: equipment?.tinh_trang_hien_tai || "",
      ghi_chu: "",
    },
  })

  React.useEffect(() => {
    if (equipment && open) {
      form.reset({
        tinh_trang_thiet_bi: equipment.tinh_trang_hien_tai || "",
        ghi_chu: "",
      })
    }
  }, [equipment, open, form])

  const onSubmit = async (data: StartUsageFormData) => {
    if (isRegionalLeader) {
      return
    }
    if (!equipment || !user) return

    const requesterId = currentUserId
    if (requesterId == null) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không xác định được người dùng hiện tại."
      })
      return
    }

    try {
      await startUsageMutation.mutateAsync({
        thiet_bi_id: equipment.id,
        nguoi_su_dung_id: requesterId,
        tinh_trang_thiet_bi: data.tinh_trang_thiet_bi,
        ghi_chu: data.ghi_chu,
      })
      
      onOpenChange(false)
      form.reset()
    } catch (error) {
      // Error handling is done in the mutation
    }
  }

  const isLoading = startUsageMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bắt đầu sử dụng thiết bị</DialogTitle>
          <DialogDescription>
            Ghi nhận thời gian bắt đầu sử dụng thiết bị: {equipment?.ten_thiet_bi}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Equipment Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Mã thiết bị</label>
                <p className="text-sm font-mono">{equipment?.ma_thiet_bi}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Người sử dụng</label>
                <p className="text-sm">{user?.full_name}</p>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Thời gian bắt đầu</label>
                <p className="text-sm">{format(new Date(), "dd/MM/yyyy HH:mm", { locale: vi })}</p>
              </div>
            </div>

            {/* Equipment Status */}
            <FormField
              control={form.control}
              name="tinh_trang_thiet_bi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tình trạng thiết bị</FormLabel>
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
                      placeholder="Ghi chú về việc sử dụng thiết bị..."
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
              <Button type="submit" disabled={isLoading || isRegionalLeader}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Bắt đầu sử dụng
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
