"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Loader2 } from "lucide-react"
import { useSession } from "next-auth/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useDecommissionDateAutofill } from "@/components/equipment-decommission-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form } from "@/components/ui/form"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { isRegionalLeaderRole, ROLES } from "@/lib/rbac"
import { callRpc } from "@/lib/rpc-client"

import {
  fetchDepartmentNames,
  fetchTenantList,
  findCurrentTenant,
} from "./add-equipment-dialog.queries"
import {
  AddEquipmentAdditionalDetailsSection,
  AddEquipmentAssignmentSection,
  AddEquipmentBasicFieldsSection,
  AddEquipmentDateFinanceSection,
} from "./add-equipment-dialog.sections"
import {
  addEquipmentFormSchema,
  DEFAULT_ADD_EQUIPMENT_FORM_VALUES,
  type AddEquipmentFormValues,
} from "./add-equipment-dialog.schema"

interface AddEquipmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface CreateEquipmentArgs extends Record<string, unknown> {
  p_payload: AddEquipmentFormValues
}

export function AddEquipmentDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddEquipmentDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const user = session?.user
  const isRegionalLeader = isRegionalLeaderRole(user?.role)

  const { data: departments = [] } = useQuery({
    queryKey: ["departments_list"],
    queryFn: fetchDepartmentNames,
    enabled: open,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const { data: tenantList = [] } = useQuery({
    queryKey: ["tenant_list"],
    queryFn: fetchTenantList,
    enabled: open,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const currentTenant = React.useMemo(
    () => findCurrentTenant(tenantList, user?.don_vi),
    [tenantList, user?.don_vi]
  )

  const form = useForm<AddEquipmentFormValues>({
    resolver: zodResolver(addEquipmentFormSchema),
    defaultValues: DEFAULT_ADD_EQUIPMENT_FORM_VALUES,
  })

  useDecommissionDateAutofill({
    control: form.control,
    setValue: form.setValue,
    initialStatus: null,
  })

  React.useEffect(() => {
    if (!open) {
      form.reset()
    }
  }, [open, form])

  const createMutation = useMutation({
    mutationFn: async (payload: AddEquipmentFormValues) => {
      await callRpc<void, CreateEquipmentArgs>({
        fn: "equipment_create",
        args: { p_payload: payload },
      })
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Đã thêm thiết bị mới vào danh mục.",
      })
      queryClient.invalidateQueries({ queryKey: ["equipment_list"] })
      queryClient.invalidateQueries({ queryKey: ["equipment_list_enhanced"] })
      queryClient.invalidateQueries({ queryKey: ["equipment_count"] })
      queryClient.invalidateQueries({ queryKey: ["equipment_count_enhanced"] })
      onSuccess()
      onOpenChange(false)
      form.reset()
    },
    onError: (error: unknown) => {
      const message = getUnknownErrorMessage(error)
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: message ? `Không thể thêm thiết bị. ${message}` : "Không thể thêm thiết bị.",
      })
    },
  })

  async function onSubmit(values: AddEquipmentFormValues) {
    if (isRegionalLeader || user?.role === ROLES.USER) {
      toast({
        variant: "destructive",
        title: "Không có quyền",
        description:
          user?.role === ROLES.USER
            ? "Tài khoản người dùng không được phép thêm thiết bị."
            : "Tài khoản khu vực chỉ được phép xem dữ liệu thiết bị.",
      })
      return
    }

    try {
      await createMutation.mutateAsync(values)
    } catch {
      // The mutation toast is handled in onError; avoid leaking a rejected promise from submit.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Thêm thiết bị mới</DialogTitle>
          <DialogDescription>
            Điền các thông tin chi tiết cho thiết bị. Nhấn lưu để hoàn tất.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] pr-6">
              <div className="space-y-4">
                <AddEquipmentBasicFieldsSection currentTenant={currentTenant} />
                <AddEquipmentDateFinanceSection />
                <AddEquipmentAssignmentSection departments={departments} />
                <AddEquipmentAdditionalDetailsSection />
              </div>
            </ScrollArea>
            <DialogFooter className="pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createMutation.isPending}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={createMutation.isPending || isRegionalLeader}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
