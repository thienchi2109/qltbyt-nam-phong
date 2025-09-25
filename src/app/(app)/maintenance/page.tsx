
"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import type { ColumnDef, Row, SortingState, PaginationState, RowSelectionState } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { ArrowUpDown, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit, Loader2, MoreHorizontal, PlusCircle, Trash2, Save, X, AlertTriangle, Undo2, CalendarDays, Users, FileText, CheckCircle2 } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import { MaintenancePlan, MaintenanceTask, taskTypes, type Equipment } from "@/lib/data"
import { callRpc } from "@/lib/rpc-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { AddMaintenancePlanDialog } from "@/components/add-maintenance-plan-dialog"
import { EditMaintenancePlanDialog } from "@/components/edit-maintenance-plan-dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AddTasksDialog } from "@/components/add-tasks-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

// Memoized component để tránh re-render khi typing
const NotesInput = React.memo(({ taskId, value, onChange }: {
  taskId: number;
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8"
      autoFocus
    />
  );
});
import { BulkScheduleDialog } from "@/components/bulk-schedule-dialog"
import { useMaintenancePlans, useCreateMaintenancePlan, useUpdateMaintenancePlan, useDeleteMaintenancePlan, maintenanceKeys } from "@/hooks/use-cached-maintenance"
import { useQueryClient } from "@tanstack/react-query"
import { useMaintenanceRealtimeSync } from "@/hooks/use-realtime-sync"
import { useSearchDebounce } from "@/hooks/use-debounce"

export default function MaintenancePage() {
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const user = session?.user as any // Cast NextAuth user to our User type
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()

  // Redirect if not authenticated
  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-32 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  }

  if (status === "unauthenticated") {
    router.push("/")
    return null
  }

  // Temporarily disable useRealtimeSync to avoid conflict with RealtimeProvider
  // useMaintenanceRealtimeSync()

  // Search state for plans
  const [planSearchTerm, setPlanSearchTerm] = React.useState("");
  const debouncedPlanSearch = useSearchDebounce(planSearchTerm);

  // ✅ Use cached hooks for data fetching, keep manual mutations for now
  const { data: plans = [], isLoading: isLoadingPlans, refetch: refetchPlans } = useMaintenancePlans(
    debouncedPlanSearch ? { search: debouncedPlanSearch } : undefined
  )
  // TODO: Migrate to cached mutations later
  // const createMaintenancePlan = useCreateMaintenancePlan()
  // const updateMaintenancePlan = useUpdateMaintenancePlan()
  // const deleteMaintenancePlan = useDeleteMaintenancePlan()
  const [isAddPlanDialogOpen, setIsAddPlanDialogOpen] = React.useState(false)
  const [planSorting, setPlanSorting] = React.useState<SortingState>([])
  const [editingPlan, setEditingPlan] = React.useState<MaintenancePlan | null>(null)
  const [planToDelete, setPlanToDelete] = React.useState<MaintenancePlan | null>(null)
  const [isDeletingPlan, setIsDeletingPlan] = React.useState(false)
  const [planToApprove, setPlanToApprove] = React.useState<MaintenancePlan | null>(null)
  const [isApprovingPlan, setIsApprovingPlan] = React.useState(false);
  const [planToReject, setPlanToReject] = React.useState<MaintenancePlan | null>(null)
  const [isRejectingPlan, setIsRejectingPlan] = React.useState(false);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [planPagination, setPlanPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  // State for tasks
  const [activeTab, setActiveTab] = React.useState("plans");
  const [selectedPlan, setSelectedPlan] = React.useState<MaintenancePlan | null>(null);
  const [tasks, setTasks] = React.useState<MaintenanceTask[]>([]); // Original from DB
  const [draftTasks, setDraftTasks] = React.useState<MaintenanceTask[]>([]); // Working copy
  const [isLoadingTasks, setIsLoadingTasks] = React.useState(false);
  const [isAddTasksDialogOpen, setIsAddTasksDialogOpen] = React.useState(false)
  const [taskPagination, setTaskPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [taskRowSelection, setTaskRowSelection] = React.useState<RowSelectionState>({});

  // State for inline editing
  const [editingTaskId, setEditingTaskId] = React.useState<number | null>(null);
  const [editingTaskData, setEditingTaskData] = React.useState<Partial<MaintenanceTask> | null>(null);

  // State for task deletion
  const [taskToDelete, setTaskToDelete] = React.useState<MaintenanceTask | null>(null);
  const [isDeletingTasks, setIsDeletingTasks] = React.useState(false); // Used for single/bulk deletion from DRAFT
  const [isConfirmingBulkDelete, setIsConfirmingBulkDelete] = React.useState(false);

  // State for bulk editing
  const [isBulkScheduleOpen, setIsBulkScheduleOpen] = React.useState(false);

  // State for global save/cancel
  const [isSavingAll, setIsSavingAll] = React.useState(false);
  const [isConfirmingCancel, setIsConfirmingCancel] = React.useState(false);

  // State for completion status
  const [completionStatus, setCompletionStatus] = React.useState<Record<string, { historyId: number }>>({});
  const [isLoadingCompletion, setIsLoadingCompletion] = React.useState(false);
  const [isCompletingTask, setIsCompletingTask] = React.useState<string | null>(null);

  const getDraftCacheKey = React.useCallback((planId: number) => `maintenance_draft_${planId}`, []);

  const hasChanges = React.useMemo(() => {
    return JSON.stringify(tasks) !== JSON.stringify(draftTasks);
  }, [tasks, draftTasks]);

  // ✅ Remove manual fetchPlans - now handled by cached hook

  const fetchPlanDetails = React.useCallback(async (plan: MaintenancePlan) => {
    setIsLoadingTasks(true);
    setCompletionStatus({}); // Reset on new plan select

    // 1. Fetch tasks via RPC
    const cacheKey = getDraftCacheKey(plan.id);
    const cachedDraft = localStorage.getItem(cacheKey);

    try {
      const data = await callRpc<any[]>({ fn: 'maintenance_tasks_list_with_equipment', args: { p_ke_hoach_id: plan.id, p_thiet_bi_id: null, p_loai_cong_viec: plan.loai_cong_viec, p_don_vi_thuc_hien: null } })
      const dbTasks = (data || []) as MaintenanceTask[];
      setTasks(dbTasks);
      if (cachedDraft) {
        try {
          setDraftTasks(JSON.parse(cachedDraft));
          toast({ title: "Thông báo", description: "Đã tải lại bản nháp chưa lưu của bạn." });
        } catch (e) {
          setDraftTasks(dbTasks);
        }
      } else {
        setDraftTasks(dbTasks);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi tải công việc", description: error.message });
      setTasks([]);
      setDraftTasks([]);
    }
    setIsLoadingTasks(false);

    // 2. If plan is approved, compute completion status from tasks themselves
    if (plan.trang_thai === 'Đã duyệt') {
      setIsLoadingCompletion(true);
      const statusMap: Record<string, { historyId: number }> = {};
      (tasks || []).forEach((t: any) => {
        for (let m = 1; m <= 12; m++) {
          const completed = t[`thang_${m}_hoan_thanh`];
          const dateVal = t[`ngay_hoan_thanh_${m}`];
          if (completed && dateVal) {
            const key = `${t.id}-${m}`;
            statusMap[key] = { historyId: 0 };
          }
        }
      });
      setCompletionStatus(statusMap);
      setIsLoadingCompletion(false);
    }
  }, [toast, getDraftCacheKey]);

  React.useEffect(() => {
    if (selectedPlan && hasChanges) {
      const cacheKey = getDraftCacheKey(selectedPlan.id);
      localStorage.setItem(cacheKey, JSON.stringify(draftTasks));
    }
    if (selectedPlan && !hasChanges) {
      const cacheKey = getDraftCacheKey(selectedPlan.id);
      localStorage.removeItem(cacheKey);
    }
  }, [draftTasks, selectedPlan, hasChanges, getDraftCacheKey]);

  // ✅ Remove useEffect for fetchPlans - data loaded automatically by cached hook

  React.useEffect(() => {
    if (selectedPlan) {
      fetchPlanDetails(selectedPlan);
      setTaskRowSelection({});
    } else {
      setTasks([]);
      setDraftTasks([]);
    }
  }, [selectedPlan, fetchPlanDetails]);

  // Handle URL parameters for navigation from Dashboard
  React.useEffect(() => {
    const params = new URLSearchParams(searchParamsString)
    const planIdParam = params.get('planId')
    const tabParam = params.get('tab')
    const actionParam = params.get('action')

    // Handle quick action to create new plan
    if (actionParam === 'create') {
      if (!isAddPlanDialogOpen) {
        setIsAddPlanDialogOpen(true)
      }
      router.replace('/maintenance', { scroll: false })
      return
    }

    if (planIdParam && plans.length > 0) {
      const planId = parseInt(planIdParam, 10)
      const targetPlan = plans.find(p => p.id === planId)

      if (targetPlan) {
        setSelectedPlan(targetPlan)
        if (tabParam === 'tasks') {
          setActiveTab('tasks')
        }
        // Clear URL params after processing
        router.replace('/maintenance', { scroll: false })
      }
    }
  }, [searchParamsString, plans, router, isAddPlanDialogOpen])

  const handleStartEdit = React.useCallback((task: MaintenanceTask) => {
    setEditingTaskId(task.id);
    setEditingTaskData({ ...task });
  }, []);

  const handleCancelEdit = React.useCallback(() => {
    setEditingTaskId(null);
    setEditingTaskData(null);
  }, []);

  const handleTaskDataChange = React.useCallback((field: keyof MaintenanceTask, value: any) => {
    setEditingTaskData(prev => prev ? { ...prev, [field]: value } : null);
  }, []);

  const handleSaveTask = React.useCallback(() => {
    if (!editingTaskId || !editingTaskData) return;

    setDraftTasks(currentDrafts =>
      currentDrafts.map(task =>
        task.id === editingTaskId ? { ...task, ...editingTaskData } : task
      )
    );
    handleCancelEdit();
  }, [editingTaskId, editingTaskData, handleCancelEdit]);

  const handleApprovePlan = React.useCallback(async (planToApprove: MaintenancePlan) => {
    if (!planToApprove) return;
    setIsApprovingPlan(true);

    try {
      await callRpc<void>({ fn: 'maintenance_plan_approve', args: { p_id: planToApprove.id, p_nguoi_duyet: user?.full_name || user?.username || '' } })
      toast({ title: "Thành công", description: "Kế hoạch đã được duyệt." });
      refetchPlans(); // ✅ Use cached hook refetch
      if (selectedPlan && selectedPlan.id === planToApprove.id) {
        const updatedPlan = { ...selectedPlan, trang_thai: 'Đã duyệt' as const, ngay_phe_duyet: new Date().toISOString() };
        setSelectedPlan(updatedPlan);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi duyệt kế hoạch", description: error.message, });
    }
    setPlanToApprove(null);
    setIsApprovingPlan(false);
  }, [toast, refetchPlans, selectedPlan]); // ✅ Use refetchPlans

  const handleRejectPlan = React.useCallback(async () => {
    if (!planToReject || !rejectionReason.trim()) return;
    setIsRejectingPlan(true);

    try {
      await callRpc<void>({ fn: 'maintenance_plan_reject', args: { p_id: planToReject.id, p_nguoi_duyet: user?.full_name || user?.username || '', p_ly_do: rejectionReason.trim() } })
      toast({ title: "Đã từ chối", description: "Kế hoạch đã được từ chối." });
      refetchPlans();
      if (selectedPlan && selectedPlan.id === planToReject.id) {
        const updatedPlan = { ...selectedPlan, trang_thai: 'Không duyệt' as const, ngay_phe_duyet: new Date().toISOString() };
        setSelectedPlan(updatedPlan);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi từ chối kế hoạch", description: error.message });
    }
    setPlanToReject(null);
    setRejectionReason("");
    setIsRejectingPlan(false);
  }, [planToReject, rejectionReason, toast, refetchPlans, selectedPlan]);


  const handleDeletePlan = React.useCallback(async () => {
    if (!planToDelete) return;
    setIsDeletingPlan(true);

    try {
      await callRpc<void>({ fn: 'maintenance_plan_delete', args: { p_id: planToDelete.id } })
      toast({ title: "Đã xóa", description: "Kế hoạch đã được xóa thành công." });
      localStorage.removeItem(getDraftCacheKey(planToDelete.id));
      refetchPlans(); // ✅ Use cached hook refetch
      if (selectedPlan && selectedPlan.id === planToDelete.id) {
        setSelectedPlan(null);
        setActiveTab("plans");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi xóa kế hoạch", description: error.message });
    }

    setIsDeletingPlan(false);
    setPlanToDelete(null);
  }, [planToDelete, toast, refetchPlans, selectedPlan, getDraftCacheKey]); // ✅ Use refetchPlans

  const handleCancelAllChanges = React.useCallback(() => {
    setDraftTasks(tasks);
    if (selectedPlan) {
      localStorage.removeItem(getDraftCacheKey(selectedPlan.id));
    }
    setIsConfirmingCancel(false);
    toast({ title: "Đã hủy", description: "Mọi thay đổi chưa lưu đã được hủy bỏ." });
  }, [tasks, selectedPlan, getDraftCacheKey, toast]);

  const handleSelectPlan = React.useCallback((plan: MaintenancePlan) => {
    if (hasChanges && selectedPlan) {
      if (confirm(`Bạn có các thay đổi chưa lưu trong kế hoạch "${selectedPlan.ten_ke_hoach}". Bạn có muốn hủy các thay đổi và chuyển sang kế hoạch khác không?`)) {
        handleCancelAllChanges();
        setSelectedPlan(plan);
        setActiveTab("tasks");
      } else {
        setActiveTab("tasks");
        return;
      }
    } else {
      setSelectedPlan(plan);
      setActiveTab("tasks");
    }
  }, [hasChanges, selectedPlan, handleCancelAllChanges]);

  const getStatusVariant = (status: MaintenancePlan["trang_thai"]) => {
    switch (status) {
      case "Bản nháp":
        return "secondary"
      case "Đã duyệt":
        return "default"
      case "Không duyệt":
        return "destructive"
      default:
        return "outline"
    }
  }

  // Mobile card rendering function
  const renderMobileCards = () => {
    if (isLoadingPlans) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="mobile-card-spacing">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    if (!planTable.getRowModel().rows?.length) {
      return (
        <Card className="mobile-card-spacing">
          <CardContent className="flex items-center justify-center h-24">
            <p className="text-muted-foreground text-center">Chưa có kế hoạch nào.</p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {planTable.getRowModel().rows.map((row) => {
          const plan = row.original;
          const canManage = user && ((user.role === 'global' || user.role === 'admin') || user.role === 'to_qltb');

          return (
            <Card
              key={plan.id}
              className="mobile-card-spacing cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleSelectPlan(plan)}
            >
              <CardHeader className="flex flex-row items-start justify-between pb-4 mobile-interactive">
                <div className="max-w-[calc(100%-40px)]">
                  <CardTitle className="heading-responsive-h4 font-bold leading-tight truncate">
                    {plan.ten_ke_hoach}
                  </CardTitle>
                  <CardDescription className="body-responsive-sm">
                    Năm {plan.nam} • {plan.khoa_phong || "Tổng thể"}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" className="h-8 w-8 p-0 touch-target-sm">
                      <span className="sr-only">Mở menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => handleSelectPlan(plan)}>
                      Xem chi tiết công việc
                    </DropdownMenuItem>
                    {plan.trang_thai === 'Bản nháp' && (
                      <>
                        <DropdownMenuSeparator />
                        {canManage && (
                          <>
                            <DropdownMenuItem onSelect={() => setPlanToApprove(plan)}>
                              <Check className="mr-2 h-4 w-4" />
                              Duyệt
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setPlanToReject(plan)}>
                              <X className="mr-2 h-4 w-4" />
                              Không duyệt
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem onSelect={() => setEditingPlan(plan)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Sửa
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => setPlanToDelete(plan)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Xóa
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="body-responsive-sm space-y-3 mobile-interactive">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Loại công việc:</span>
                  <Badge variant="outline">{plan.loai_cong_viec}</Badge>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Trạng thái:</span>
                  <div className="text-right space-y-1">
                    <Badge variant={getStatusVariant(plan.trang_thai)}>{plan.trang_thai}</Badge>
                    {plan.trang_thai === "Không duyệt" && plan.ly_do_khong_duyet && (
                      <div className="text-xs text-muted-foreground italic max-w-[150px] break-words">
                        Lý do: {plan.ly_do_khong_duyet}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Ngày phê duyệt:</span>
                  <div className="text-right space-y-1">
                    {plan.ngay_phe_duyet ? (
                      <>
                        <div>{format(parseISO(plan.ngay_phe_duyet), 'dd/MM/yyyy HH:mm', { locale: vi })}</div>
                        {plan.nguoi_duyet && (
                          <div className="text-xs text-blue-600 font-medium">
                            Duyệt: {plan.nguoi_duyet}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">Chưa duyệt</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    )
  }

  const existingEquipmentIdsInDraft = React.useMemo(() => draftTasks.map(task => task.thiet_bi_id).filter((id): id is number => id !== null), [draftTasks]);

  const handleAddTasksFromDialog = React.useCallback((newlySelectedEquipment: Equipment[]) => {
    if (!selectedPlan) return;

    let tempIdCounter = Math.min(-1, ...draftTasks.map(t => t.id).filter(id => id < 0), 0) - 1;

    const tasksToAdd: MaintenanceTask[] = newlySelectedEquipment.map((equipment) => {
      const newTask: MaintenanceTask = {
        id: tempIdCounter--,
        ke_hoach_id: selectedPlan.id,
        thiet_bi_id: equipment.id,
        loai_cong_viec: selectedPlan.loai_cong_viec,
        diem_hieu_chuan: null,
        don_vi_thuc_hien: null,
        thang_1: false, thang_2: false, thang_3: false, thang_4: false,
        thang_5: false, thang_6: false, thang_7: false, thang_8: false,
        thang_9: false, thang_10: false, thang_11: false, thang_12: false,
        ghi_chu: null,
        thiet_bi: {
          ma_thiet_bi: equipment.ma_thiet_bi,
          ten_thiet_bi: equipment.ten_thiet_bi,
          khoa_phong_quan_ly: equipment.khoa_phong_quan_ly,
        },
      };
      return newTask;
    });

    setDraftTasks(currentDrafts => [...currentDrafts, ...tasksToAdd]);
    setIsAddTasksDialogOpen(false);
    toast({
      title: "Đã thêm vào bản nháp",
      description: `Đã thêm ${newlySelectedEquipment.length} thiết bị. Nhấn "Lưu thay đổi" để xác nhận.`
    });
  }, [selectedPlan, draftTasks, toast]);

  const confirmDeleteSingleTask = React.useCallback(() => {
    if (!taskToDelete) return;
    setIsDeletingTasks(true);
    setDraftTasks(currentDrafts => currentDrafts.filter(task => task.id !== taskToDelete.id));
    setTaskToDelete(null);
    setIsDeletingTasks(false);
    toast({ title: "Đã xóa khỏi bản nháp" });
  }, [taskToDelete, toast]);

  const planColumns: ColumnDef<MaintenancePlan>[] = React.useMemo(() => [
    {
      accessorKey: "ten_ke_hoach",
      header: "Tên kế hoạch",
      cell: ({ row }) => <div className="font-medium">{row.getValue("ten_ke_hoach")}</div>,
    },
    {
      accessorKey: "nguoi_lap_ke_hoach",
      header: "Người lập",
      cell: ({ row }) => {
        const nguoiLap = row.getValue("nguoi_lap_ke_hoach") as string | null;
        return nguoiLap ? (
          <div className="text-sm">{nguoiLap}</div>
        ) : (
          <span className="text-muted-foreground italic text-xs">Chưa có</span>
        );
      },
    },
    {
      accessorKey: "nam",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Năm
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="text-center">{row.getValue("nam")}</div>
    },
    {
      accessorKey: "khoa_phong",
      header: "Khoa/Phòng",
      cell: ({ row }) => row.getValue("khoa_phong") || <span className="text-muted-foreground italic">Tổng thể</span>,
    },
    {
      accessorKey: "loai_cong_viec",
      header: "Loại CV",
      cell: ({ row }) => <Badge variant="outline">{row.getValue("loai_cong_viec")}</Badge>,
    },
    {
      accessorKey: "trang_thai",
      header: "Trạng thái",
      cell: ({ row }) => {
        const status = row.getValue("trang_thai") as MaintenancePlan["trang_thai"]
        const plan = row.original
        return (
          <div className="space-y-1">
            <Badge variant={getStatusVariant(status)}>{status}</Badge>
            {status === "Không duyệt" && plan.ly_do_khong_duyet && (
              <div className="text-xs text-muted-foreground italic max-w-[200px] break-words">
                Lý do: {plan.ly_do_khong_duyet}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "ngay_phe_duyet",
      header: "Ngày phê duyệt",
      cell: ({ row }) => {
        const date = row.getValue("ngay_phe_duyet") as string | null
        const plan = row.original
        return date ? (
          <div className="space-y-1">
            <div>{format(parseISO(date), 'dd/MM/yyyy HH:mm', { locale: vi })}</div>
            {plan.nguoi_duyet && (
              <div className="text-xs text-blue-600 font-medium">
                Duyệt: {plan.nguoi_duyet}
              </div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground italic">Chưa duyệt</span>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const plan = row.original
  const canManage = user && ((user.role === 'global' || user.role === 'admin') || user.role === 'to_qltb');

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="sr-only">Mở menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Hành động</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => handleSelectPlan(plan)}>
                Xem chi tiết công việc
              </DropdownMenuItem>
              {plan.trang_thai === 'Bản nháp' && (
                <>
                  <DropdownMenuSeparator />
                  {canManage && (
                    <>
                      <DropdownMenuItem onSelect={() => setPlanToApprove(plan)}>
                        <Check className="mr-2 h-4 w-4" />
                        Duyệt
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setPlanToReject(plan)}>
                        <X className="mr-2 h-4 w-4" />
                        Không duyệt
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onSelect={() => setEditingPlan(plan)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Sửa
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setPlanToDelete(plan)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Xoá
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], [user, handleSelectPlan, setEditingPlan, setPlanToDelete, setPlanToApprove]);

  const planTable = useReactTable({
    data: plans as MaintenancePlan[],
    columns: planColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setPlanSorting,
    onPaginationChange: setPlanPagination,
    state: {
      sorting: planSorting,
      pagination: planPagination,
    },
  })

  const isPlanApproved = selectedPlan?.trang_thai === 'Đã duyệt';
  const canCompleteTask = user && ((user.role === 'global' || user.role === 'admin') || user.role === 'to_qltb');

  const handleMarkAsCompleted = React.useCallback(async (task: MaintenanceTask, month: number) => {
    console.log('handleMarkAsCompleted called:', { taskId: task.id, month, canCompleteTask, user: user?.role });

    if (!selectedPlan || !user || !canCompleteTask) {
      console.log('Permission denied:', { selectedPlan: !!selectedPlan, user: !!user, canCompleteTask });
      toast({
        variant: "destructive",
        title: "Không có quyền",
        description: "Bạn không có quyền thực hiện hành động này."
      });
      return;
    }

    const completionKey = `${task.id}-${month}`;
    if (completionStatus[completionKey] || isCompletingTask) return;

    setIsCompletingTask(completionKey);

    try {
      const completionDate = new Date().toISOString();

      // 1. Cập nhật trạng thái hoàn thành trong bảng cong_viec_bao_tri
      const completionFieldName = `thang_${month}_hoan_thanh`;
      const completionDateFieldName = `ngay_hoan_thanh_${month}`;

      await callRpc<void>({ fn: 'maintenance_task_complete', args: { p_task_id: task.id, p_month: month } })

      const historyData = { id: 0 } as any;

      toast({
        title: "Ghi nhận thành công",
        description: `Đã ghi nhận hoàn thành ${selectedPlan.loai_cong_viec} cho thiết bị tháng ${month}.`,
      });

      setCompletionStatus(prev => ({
        ...prev,
        [completionKey]: { historyId: historyData.id },
      }));

      // Refresh tasks data to reflect the completion status
      if (selectedPlan) {
        await fetchPlanDetails(selectedPlan);
      }

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể ghi nhận hoàn thành. " + error.message,
      });
    } finally {
      setIsCompletingTask(null);
    }
  }, [selectedPlan, user, canCompleteTask, completionStatus, isCompletingTask, toast, fetchPlanDetails]);


  const taskColumns: ColumnDef<MaintenanceTask>[] = React.useMemo(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          disabled={isPlanApproved || !!editingTaskId}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          disabled={isPlanApproved || !!editingTaskId}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      id: 'stt',
      header: 'STT',
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;
        return pageIndex * pageSize + row.index + 1;
      },
      size: 50,
    },
    {
      accessorKey: 'thiet_bi.ma_thiet_bi',
      header: 'Mã TB',
      cell: ({ row }) => row.original.thiet_bi?.ma_thiet_bi || '',
      size: 120,
    },
    {
      accessorKey: 'thiet_bi.ten_thiet_bi',
      header: 'Tên thiết bị',
      cell: ({ row }) => row.original.thiet_bi?.ten_thiet_bi || '',
      size: 250,
    },
    {
      accessorKey: 'loai_cong_viec',
      header: 'Loại CV',
      cell: ({ row }) => <Badge variant="outline">{row.getValue("loai_cong_viec")}</Badge>,
      size: 140,
    },
    ...Array.from({ length: 12 }, (_, i) => i + 1).map((month) => ({
      id: `thang_${month}`,
      header: () => <div className="text-center">{month}</div>,
      cell: ({ row, table }: { row: Row<MaintenanceTask>, table: any }) => {
        const meta = table.options.meta as any;
        const {
          editingTaskId, editingTaskData, handleTaskDataChange,
          isPlanApproved, completionStatus, isLoadingCompletion,
          handleMarkAsCompleted, isCompletingTask, canCompleteTask,
        } = meta;
        const fieldName = `thang_${month}` as keyof MaintenanceTask;

        if (isPlanApproved) {
          const isScheduled = !!row.original[fieldName];
          if (!isScheduled) return null;

          if (isLoadingCompletion) return <Skeleton className="h-4 w-4 mx-auto" />;

          // Check completion status from actual database field
          const completionFieldName = `thang_${month}_hoan_thanh` as keyof MaintenanceTask;
          const isCompletedFromDB = !!row.original[completionFieldName];

          // Debug logging
          if (month === 5 || month === 12) { // Only log for specific months to avoid spam
            console.log(`Row ${row.index + 1}, Month ${month}:`, {
              taskId: row.original.id,
              isScheduled,
              completionFieldName,
              isCompletedFromDB,
              rawValue: row.original[completionFieldName],
              canCompleteTask,
              rowData: row.original
            });
          }

          const completionKey = `${row.original.id}-${month}`;
          const isUpdating = isCompletingTask === completionKey;

          if (isUpdating) {
            return (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            );
          }

          if (isCompletedFromDB) {
            const completionDateField = `ngay_hoan_thanh_${month}` as keyof MaintenanceTask;
            const completionDate = row.original[completionDateField] as string;
            const formattedDate = completionDate ? new Date(completionDate).toLocaleDateString('vi-VN') : '';

            return (
              <div className="flex justify-center items-center h-full">
                <div title={`Đã hoàn thành${formattedDate ? ` ngày ${formattedDate}` : ''}`}>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
              </div>
            );
          }

          // Interactive checkbox for scheduled but not completed tasks
          return (
            <div className="flex justify-center items-center h-full">
              <Checkbox
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleMarkAsCompleted(row.original, month);
                  }
                }}
                disabled={!canCompleteTask}
                title={canCompleteTask ? "Nhấp để ghi nhận hoàn thành" : "Bạn không có quyền thực hiện"}
              />
            </div>
          );
        }

        // Draft mode logic
        const isEditing = editingTaskId === row.original.id;
        const isChecked = isEditing ? editingTaskData?.[fieldName] : row.original[fieldName];
        return (
          <div className="flex justify-center items-center h-full">
            <Checkbox
              key={`checkbox-${row.original.id}-${fieldName}`}
              checked={!!isChecked}
              onCheckedChange={(value) => isEditing && handleTaskDataChange(fieldName, !!value)}
              disabled={!isEditing}
            />
          </div>
        );
      },
      size: 40,
    })),
    {
      accessorKey: 'don_vi_thuc_hien',
      header: 'Đơn vị TH',
      cell: ({ row, table }) => {
        const meta = table.options.meta as any;
        const { editingTaskId, editingTaskData, handleTaskDataChange } = meta;
        const isEditing = editingTaskId === row.original.id;
        return isEditing ? (
          <Select
            key={`select-don-vi-${row.original.id}`}
            value={editingTaskData?.don_vi_thuc_hien || ""}
            onValueChange={(value) => handleTaskDataChange('don_vi_thuc_hien', value === 'none' ? null : value)}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Chọn đơn vị" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Nội bộ">Nội bộ</SelectItem>
              <SelectItem value="Thuê ngoài">Thuê ngoài</SelectItem>
              <SelectItem value="none">Xóa</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          row.original.don_vi_thuc_hien
        )
      },
      size: 150,
    },
    {
      accessorKey: 'ghi_chu',
      header: 'Ghi chú',
      cell: ({ row, table }) => {
        const meta = table.options.meta as any;
        const { editingTaskId, editingTaskData, handleTaskDataChange } = meta;
        const isEditing = editingTaskId === row.original.id;

        if (!isEditing) {
          return row.original.ghi_chu;
        }

        return (
          <NotesInput
            taskId={row.original.id}
            value={editingTaskData?.ghi_chu || ""}
            onChange={(value) => handleTaskDataChange('ghi_chu', value)}
          />
        );
      },
      size: 200,
    },
    {
      id: "actions",
      cell: ({ row, table }) => {
        const meta = table.options.meta as any;
        const { editingTaskId, handleSaveTask, handleCancelEdit, handleStartEdit, isPlanApproved, setTaskToDelete } = meta;
        const task = row.original;
        const isEditing = editingTaskId === task.id;

        if (isPlanApproved) return null;

        if (isEditing) {
          return (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-100 hover:text-green-700" onClick={handleSaveTask}>
                <Save className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-600 hover:bg-gray-100" onClick={handleCancelEdit}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        }

        return (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartEdit(task)} disabled={!!editingTaskId}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setTaskToDelete(task)} disabled={!!editingTaskId}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
      size: 100,
    }
  ], [isPlanApproved, canCompleteTask, editingTaskId, handleCancelEdit, handleSaveTask, handleStartEdit, handleMarkAsCompleted, completionStatus, isLoadingCompletion, isCompletingTask]);

  const handleSaveAllChanges = React.useCallback(async () => {
    if (!selectedPlan || !hasChanges) return;
    setIsSavingAll(true);

    // 1. Find tasks to insert (new tasks with negative IDs)
    const tasksToInsert = draftTasks
      .filter(t => t.id < 0)
      .map(task => {
        const { id, thiet_bi, ...dbData } = task; // remove temp id and nested thiet_bi
        return dbData;
      });

    // 2. Find tasks to update (existing tasks that might have changed)
    const tasksToUpdate = draftTasks
      .filter(t => t.id > 0 && tasks.find(original => original.id === t.id && JSON.stringify(original) !== JSON.stringify(t)))
      .map(task => {
        const { thiet_bi, ...dbData } = task;
        return dbData;
      });

    // 3. Find tasks to delete (tasks in original list but not in draft)
    const draftTaskIds = new Set(draftTasks.map(t => t.id));
    const idsToDelete = tasks
      .map(t => t.id)
      .filter(id => !draftTaskIds.has(id));

    let hasError = false;

    // Perform operations via RPCs
    if (tasksToInsert.length > 0) {
      try {
        await callRpc<void>({ fn: 'maintenance_tasks_bulk_insert', args: { p_tasks: tasksToInsert } as any })
      } catch (e: any) {
        toast({ variant: "destructive", title: "Lỗi thêm công việc mới", description: e.message, duration: 10000 });
        hasError = true;
      }
    }

    if (tasksToUpdate.length > 0 && !hasError) {
      for (const taskToUpdate of tasksToUpdate) {
        try {
          await callRpc<void>({ fn: 'maintenance_task_update', args: { p_id: taskToUpdate.id, p_task: taskToUpdate } as any })
        } catch (e: any) {
          toast({ variant: "destructive", title: `Lỗi cập nhật công việc ID ${taskToUpdate.id}`, description: e.message, duration: 10000 });
          hasError = true;
          break;
        }
      }
    }

    if (idsToDelete.length > 0 && !hasError) {
      try {
        await callRpc<void>({ fn: 'maintenance_tasks_delete', args: { p_ids: idsToDelete } as any })
      } catch (e: any) {
        toast({ variant: "destructive", title: "Lỗi xóa công việc cũ", description: e.message, duration: 10000 });
        hasError = true;
      }
    }

    if (!hasError) {
      toast({ title: "Thành công", description: "Đã lưu tất cả thay đổi vào cơ sở dữ liệu." });
      localStorage.removeItem(getDraftCacheKey(selectedPlan.id));
      await fetchPlanDetails(selectedPlan);
    }

    setIsSavingAll(false);
  }, [selectedPlan, hasChanges, draftTasks, tasks, toast, getDraftCacheKey, fetchPlanDetails]);

  const handleGeneratePlanForm = React.useCallback(() => {
    if (!selectedPlan || tasks.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Vui lòng đảm bảo kế hoạch đã có thiết bị và đã được lưu vào database."
      });
      return;
    }

    const formatValue = (value: any) => value ?? "";

    // Generate table rows from saved tasks
    const generateTableRows = () => {
      return tasks.map((task, index) => {
        const checkboxes = Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
          const fieldName = `thang_${month}` as keyof MaintenanceTask;
          const isChecked = task[fieldName] ? 'checked' : '';
          return `<td><input type="checkbox" ${isChecked}></td>`;
        }).join('');

        const noiBoChecked = task.don_vi_thuc_hien === 'Nội bộ' ? 'checked' : '';
        const thueNgoaiChecked = task.don_vi_thuc_hien === 'Thuê ngoài' ? 'checked' : '';

        return `
          <tr>
            <td>${index + 1}</td>
            <td>${formatValue(task.thiet_bi?.ma_thiet_bi)}</td>
            <td>${formatValue(task.thiet_bi?.ten_thiet_bi)}</td>
            <td>${formatValue(task.thiet_bi?.khoa_phong_quan_ly)}</td>
            <td><input type="checkbox" ${noiBoChecked}></td>
            <td><input type="checkbox" ${thueNgoaiChecked}></td>
            ${checkboxes}
            <td><textarea class="auto-resize-textarea" rows="2" style="width: 100%; border: none; outline: none; background: transparent; resize: none; word-wrap: break-word; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-all; line-height: 1.2; padding: 4px; font-family: inherit; font-size: 10px; overflow: visible;">${formatValue(task.ghi_chu)}</textarea></td>
          </tr>
        `;
      }).join('');
    };

    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kế Hoạch ${selectedPlan.loai_cong_viec} Thiết Bị - ${selectedPlan.ten_ke_hoach}</title>
    <!-- Import Tailwind CSS for styling -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12px;
            color: #000;
            background-color: #e5e7eb;
            line-height: 1.4;
        }
        .a4-landscape-page {
            width: 29.7cm;
            min-height: 21cm;
            padding: 1cm; /* Lề 1cm cho tất cả các cạnh */
            margin: 1cm auto;
            background: white;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            position: relative;
            display: flex;
            flex-direction: column;
        }
        .content-body {
            flex-grow: 1; /* Cho phép khối nội dung chính giãn ra */
        }
        .form-input-line {
            font-family: inherit;
            font-size: inherit;
            border: none;
            border-bottom: 1px dotted #000;
            background-color: transparent;
            padding: 1px;
            outline: none;
            text-align: center;
        }
        /* Footer styling - normal display */
        .print-footer {
            padding: 8px 12px;
            font-size: 11px;
            margin-top: 20px;
        }

        /* Special styling for page number inputs */
        .print-footer .form-input-line {
            border-bottom: 1px solid #000;
            min-width: 20px;
            font-weight: bold;
        }
        .print-footer .form-input-line:focus {
            background-color: #f0f9ff;
            border-bottom: 2px solid #3b82f6;
        }
        h1, h2, .font-bold {
            font-weight: 700;
        }
        .title-main { font-size: 18px; }
        .title-sub { font-size: 16px; }

        /* Table styles */
        .data-table {
            border: 1px solid #000;
            border-collapse: collapse;
            table-layout: fixed;
            width: 100%;
        }
        .data-table th, .data-table td {
            border: 1px solid #000;
            border-collapse: collapse;
        }
        .data-table th, .data-table td {
            padding: 4px;
            text-align: center;
            vertical-align: middle;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .data-table tbody tr {
             min-height: 35px; /* Chiều cao tối thiểu cho các dòng dữ liệu */
             height: auto !important; /* Cho phép chiều cao tự động mở rộng */
        }
        /* Đặc biệt cho các row có text dài trong cột cuối */
        .data-table tbody tr:has(td:last-child textarea[value*=" "]) {
             height: auto !important;
             min-height: 50px !important;
        }
        /* Đặc biệt cho cột Điểm BT/HC/KĐ */
        .data-table td:last-child {
            width: 150px !important;
            min-width: 150px;
            max-width: 200px;
            padding: 8px !important;
            vertical-align: top !important;
            word-break: break-word;
            overflow-wrap: break-word;
            white-space: normal;
        }
        .data-table input[type="text"] {
            width: 100%;
            min-height: 30px;
            height: auto !important;
            border: none;
            outline: none;
            background-color: transparent;
            text-align: left !important;
            word-wrap: break-word;
            white-space: normal !important;
            overflow-wrap: break-word;
            line-height: 1.3;
            padding: 2px 4px;
            resize: none;
            overflow: visible;
        }
        /* Đặc biệt cho input trong cột cuối cùng (Điểm BT/HC/KĐ) */
        .data-table td:last-child input[type="text"] {
            text-align: left !important;
            white-space: pre-wrap !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            min-height: 40px;
            height: auto !important;
            line-height: 1.4;
            padding: 4px;
        }
        /* CSS cho textarea trong cột cuối */
        .data-table td:last-child textarea {
            width: 100% !important;
            min-height: 40px !important;
            height: auto !important;
            border: none !important;
            outline: none !important;
            background: transparent !important;
            resize: none !important;
            word-wrap: break-word !important;
            white-space: pre-wrap !important;
            overflow-wrap: anywhere !important;
            word-break: break-all !important;
            line-height: 1.2 !important;
            padding: 4px !important;
            font-family: inherit !important;
            font-size: 10px !important; /* Thu nhỏ font size cho cột này */
            text-align: left !important;
            overflow: visible !important;
            max-height: none !important;
        }

        /* Signature styles */
        .signature-area {
            text-align: center;
        }
        .signature-space {
            height: 60px; /* Không gian để ký tay */
        }

        /* Page numbering notice styles */
        .page-numbering-notice {
            border-radius: 4px;
            font-size: 13px;
        }

        /* Animation for page numbering notice */
        @keyframes pulse {
            0%, 100% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.4);
            }
            50% {
                transform: scale(1.02);
                box-shadow: 0 0 0 8px rgba(251, 191, 36, 0);
            }
        }

        /* CSS for printing */
        @media print {
            body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                background-color: #fff !important;
            }
            /* Hide page numbering notice when printing */
            .page-numbering-notice {
                display: none !important;
            }
            .a4-landscape-page {
                width: 100%;
                height: 100%;
                margin: 0 !important;
                padding: 1cm !important;
                box-shadow: none !important;
                border: none !important;
            }
             body > *:not(.a4-landscape-page) {
                display: none;
            }
            /* Lặp lại tiêu đề bảng trên mỗi trang */
            .data-table thead {
                display: table-header-group;
            }
            /* Ngăn các mục bị vỡ qua trang */
            .data-table tr, .signature-area {
                page-break-inside: avoid;
            }
            /* Đặc biệt cho print: đảm bảo text trong cột cuối không bị cắt */
            .data-table td:last-child {
                width: 15% !important;
                min-width: 150px !important;
                max-width: none !important;
            }
            .data-table td:last-child input[type="text"],
            .data-table td:last-child textarea {
                white-space: pre-wrap !important;
                word-break: break-word !important;
                overflow-wrap: anywhere !important;
                height: auto !important;
                min-height: 40px !important;
                line-height: 1.3 !important;
                overflow: visible !important;
            }
            /* Đảm bảo textarea hiển thị đầy đủ khi in */
            .data-table td:last-child textarea {
                resize: none !important;
                border: none !important;
                background: transparent !important;
                font-family: inherit !important;
                font-size: 10px !important; /* Font nhỏ hơn khi in */
                max-height: none !important;
                height: auto !important;
                overflow: visible !important;
            }
            /* Đảm bảo row có thể mở rộng khi in */
            .data-table tbody tr {
                height: auto !important;
                min-height: 40px !important;
                page-break-inside: avoid;
            }
            /* Footer styling for print - MS Word style */
            .print-footer {
                position: fixed;
                bottom: 0.5cm;
                left: 0;
                right: 0;
                width: 100%;
                background-color: #f8f9fa !important;
                color: #6c757d !important;
                border-top: 1px solid #dee2e6 !important;
                padding: 8px 1cm !important;
                font-size: 10px !important;
                z-index: 1000;
            }
            .print-footer .form-input-line {
                color: #6c757d !important;
                border-bottom-color: #6c757d !important;
            }
             .content-body {
                padding-bottom: 50px; /* Khoảng đệm cho footer */
            }
        }
    </style>
    <script>
        // Auto-resize textarea function
        function autoResizeTextarea(textarea) {
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            const minHeight = 40;
            const maxHeight = 120;
            const newHeight = Math.max(minHeight, Math.min(maxHeight, scrollHeight));
            textarea.style.height = newHeight + 'px';

            // Adjust font size based on content length
            const textLength = textarea.value.length;
            if (textLength > 100) {
                textarea.style.fontSize = '9px';
            } else if (textLength > 50) {
                textarea.style.fontSize = '10px';
            } else {
                textarea.style.fontSize = '11px';
            }
        }

        // Initialize auto-resize for all textareas when page loads
        document.addEventListener('DOMContentLoaded', function() {
            const textareas = document.querySelectorAll('.auto-resize-textarea');
            textareas.forEach(function(textarea) {
                // Initial resize
                autoResizeTextarea(textarea);

                // Add event listeners for dynamic resizing
                textarea.addEventListener('input', function() {
                    autoResizeTextarea(this);
                });

                textarea.addEventListener('paste', function() {
                    setTimeout(() => autoResizeTextarea(this), 10);
                });
            });

            // Add functionality for page number inputs
            const pageInputs = document.querySelectorAll('.print-footer .form-input-line');
            pageInputs.forEach(function(input) {
                // Auto-select content when focused
                input.addEventListener('focus', function() {
                    this.select();
                    this.style.backgroundColor = '#ffffff';
                    this.style.color = '#000';
                });

                // Reset style when blur
                input.addEventListener('blur', function() {
                    this.style.backgroundColor = 'transparent';
                    this.style.color = '#6c757d';
                });

                // Only allow numbers
                input.addEventListener('input', function() {
                    this.value = this.value.replace(/[^0-9]/g, '');
                    if (this.value === '') this.value = '1';
                });
            });

            // Show a subtle highlight on the page numbering notice for 3 seconds
            const notice = document.querySelector('.page-numbering-notice');
            if (notice) {
                setTimeout(() => {
                    notice.style.animation = 'pulse 2s ease-in-out 3';
                }, 500);
            }
        });
    </script>
</head>
<body>

    <div class="a4-landscape-page">
        <div class="content-body">
            <!-- Header -->
            <header>
                 <div class="flex justify-between items-start">
                    <div class="text-center w-1/4">
                        <img src="https://i.postimg.cc/26dHxmnV/89307731ad9526cb7f84-1-Photoroom.png" alt="Logo CDC" class="w-16" onerror="this.onerror=null;this.src='https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo';">
                    </div>
                    <div class="text-center w-1/2">
                         <h2 class="title-sub uppercase font-bold">TRUNG TÂM KIỂM SOÁT BỆNH TẬT THÀNH PHỐ CẦN THƠ</h2>
                         <div class="flex items-baseline justify-center font-bold text-base">
                            <label for="department-name">KHOA/PHÒNG:</label>
                            <input type="text" id="department-name" class="form-input-line flex-grow ml-2" value="${formatValue(selectedPlan.khoa_phong)}">
                         </div>
                    </div>
                    <div class="w-1/4"></div> <!-- Spacer -->
                </div>
                 <div class="text-center mt-4">
                     <h1 class="title-main uppercase font-bold flex justify-center items-baseline">
                        KẾ HOẠCH ${selectedPlan.loai_cong_viec.toUpperCase()} THIẾT BỊ NĂM
                        <input type="text" class="form-input-line w-24 ml-2" value="${selectedPlan.nam}">
                    </h1>
                </div>
            </header>

            <!-- Main Table -->
            <section class="mt-4">
                <table class="w-full data-table">
                    <thead class="font-bold">
                        <tr>
                            <th rowspan="2" class="w-[3%]">TT</th>
                            <th rowspan="2" class="w-[7%]">Mã TB</th>
                            <th rowspan="2" class="w-[12%]">Tên TB</th>
                            <th rowspan="2" class="w-[10%]">Khoa/Phòng</th>
                            <th colspan="2">Đơn vị thực hiện</th>
                            <th colspan="12">Thời gian dự kiến ${selectedPlan.loai_cong_viec.toLowerCase()} (tháng)</th>
                            <th rowspan="2" class="w-[16%]">Điểm BT/HC/KĐ</th>
                        </tr>
                        <tr>
                            <th class="w-[7%]">Nội bộ</th>
                            <th class="w-[7%]">Thuê ngoài</th>
                            <th class="w-[0.75%]">1</th>
                            <th class="w-[0.75%]">2</th>
                            <th class="w-[0.75%]">3</th>
                            <th class="w-[0.75%]">4</th>
                            <th class="w-[0.75%]">5</th>
                            <th class="w-[0.75%]">6</th>
                            <th class="w-[0.75%]">7</th>
                            <th class="w-[0.75%]">8</th>
                            <th class="w-[0.75%]">9</th>
                            <th class="w-[0.75%]">10</th>
                            <th class="w-[0.75%]">11</th>
                            <th class="w-[0.75%]">12</th>
                        </tr>
                    </thead>
                    <tbody id="plan-table-body">
                        ${generateTableRows()}
                    </tbody>
                </table>
            </section>

             <!-- Signature section -->
            <section class="mt-4">
                 <div class="flex justify-between">
                    <div class="signature-area w-1/3">
                        <p class="font-bold">Lãnh đạo Khoa/Phòng</p>
                        <div class="signature-space"></div>
                    </div>
                     <div class="w-1/3"></div> <!-- Spacer -->
                    <div class="signature-area w-1/3">
                         <p class="italic mb-2">
                            Cần Thơ, ngày <input type="text" class="form-input-line w-12" value="${new Date().getDate()}">
                            tháng <input type="text" class="form-input-line w-12" value="${new Date().getMonth() + 1}">
                            năm <input type="text" class="form-input-line w-20" value="${new Date().getFullYear()}">
                        </p>
                         <p class="font-bold">Người lập</p>
                         <div class="signature-space"></div>
                         <input type="text" class="form-input-line" value="${formatValue(user?.full_name)}" style="border-bottom: none; text-align: center; font-weight: bold;">
                     </div>
                </div>
            </section>
        </div>

    </div>

</body>
</html>
    `;

    const newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.open();
      newWindow.document.write(htmlContent);
      newWindow.document.close();
    }
  }, [selectedPlan, tasks, toast, user]);

  const tableMeta = React.useMemo(() => ({
    editingTaskId,
    editingTaskData,
    isPlanApproved,
    setTaskToDelete,
    handleTaskDataChange,
    handleSaveTask,
    handleCancelEdit,
    handleStartEdit,
    completionStatus,
    isLoadingCompletion,
    handleMarkAsCompleted,
    isCompletingTask,
    canCompleteTask,
  }), [
    editingTaskId,
    editingTaskData,
    isPlanApproved,
    setTaskToDelete,
    handleTaskDataChange,
    handleSaveTask,
    handleCancelEdit,
    handleStartEdit,
    completionStatus,
    isLoadingCompletion,
    handleMarkAsCompleted,
    isCompletingTask,
    canCompleteTask,
  ]);

  const taskTable = useReactTable({
    data: draftTasks,
    columns: taskColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setTaskPagination,
    onRowSelectionChange: setTaskRowSelection,
    state: {
      pagination: taskPagination,
      rowSelection: taskRowSelection,
    },
    meta: tableMeta
  });

  const handleBulkScheduleApply = React.useCallback((months: Record<string, boolean>) => {
    const selectedIds = new Set(taskTable.getFilteredSelectedRowModel().rows.map(row => row.original.id));
    setDraftTasks(currentDrafts =>
      currentDrafts.map(task =>
        selectedIds.has(task.id) ? { ...task, ...months } : task
      )
    );
    setIsBulkScheduleOpen(false);
    toast({ title: "Đã áp dụng lịch", description: "Lịch trình đã được cập nhật vào bản nháp." });
  }, [taskTable, toast]);

  const handleBulkAssignUnit = React.useCallback((unit: string | null) => {
    const selectedIds = new Set(taskTable.getFilteredSelectedRowModel().rows.map(row => row.original.id));
    setDraftTasks(currentDrafts =>
      currentDrafts.map(task =>
        selectedIds.has(task.id) ? { ...task, don_vi_thuc_hien: unit } : task
      )
    );
    toast({ title: "Đã gán đơn vị", description: `Đã cập nhật đơn vị thực hiện vào bản nháp.` });
  }, [taskTable, toast]);

  const confirmDeleteSelectedTasks = React.useCallback(() => {
    if (Object.keys(taskRowSelection).length === 0) return;
    setIsDeletingTasks(true);
    const tableModel = taskTable.getRowModel();
    const idsToDelete = Object.keys(taskRowSelection).map(idx => tableModel.rows[parseInt(idx, 10)].original.id);
    setDraftTasks(currentDrafts => currentDrafts.filter(task => !idsToDelete.includes(task.id)));
    setTaskRowSelection({});
    setIsConfirmingBulkDelete(false);
    setIsDeletingTasks(false);
    toast({ title: "Đã xóa khỏi bản nháp", description: `Đã xóa ${idsToDelete.length} công việc.` });
  }, [taskTable, taskRowSelection, toast]);

  const selectedTaskRowsCount = Object.keys(taskRowSelection).length;

  return (
    <>
      <AddMaintenancePlanDialog
        open={isAddPlanDialogOpen}
        onOpenChange={setIsAddPlanDialogOpen}
        onSuccess={refetchPlans} // ✅ Use cached hook refetch
      />
      <EditMaintenancePlanDialog
        open={!!editingPlan}
        onOpenChange={(open) => !open && setEditingPlan(null)}
        onSuccess={refetchPlans} // ✅ Use cached hook refetch
        plan={editingPlan}
      />
      {planToApprove && (
        <AlertDialog open={!!planToApprove} onOpenChange={(open) => !open && setPlanToApprove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bạn có chắc chắn muốn duyệt kế hoạch này?</AlertDialogTitle>
              <AlertDialogDescription>
                Sau khi duyệt, kế hoạch <strong>{planToApprove.ten_ke_hoach}</strong> sẽ bị khóa. Bạn sẽ không thể thêm, sửa, hoặc xóa công việc khỏi kế hoạch này nữa. Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {planToApprove.nguoi_duyet && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm font-medium text-blue-800">Đã được duyệt bởi:</div>
                <div className="text-sm text-blue-600">{planToApprove.nguoi_duyet}</div>
                {planToApprove.ngay_phe_duyet && (
                  <div className="text-xs text-blue-500">
                    {format(parseISO(planToApprove.ngay_phe_duyet), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </div>
                )}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isApprovingPlan}>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleApprovePlan(planToApprove)} disabled={isApprovingPlan}>
                {isApprovingPlan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xác nhận duyệt
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {planToReject && (
        <AlertDialog open={!!planToReject} onOpenChange={(open) => !open && setPlanToReject(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Không duyệt kế hoạch</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn đang từ chối kế hoạch <strong>{planToReject.ten_ke_hoach}</strong>. Vui lòng nhập lý do không duyệt:
              </AlertDialogDescription>
            </AlertDialogHeader>
            {planToReject.nguoi_duyet && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="text-sm font-medium text-red-800">Đã được từ chối bởi:</div>
                <div className="text-sm text-red-600">{planToReject.nguoi_duyet}</div>
                {planToReject.ngay_phe_duyet && (
                  <div className="text-xs text-red-500">
                    {format(parseISO(planToReject.ngay_phe_duyet), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </div>
                )}
              </div>
            )}
            <div className="py-4">
              <textarea
                className="w-full min-h-[100px] p-3 border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="Nhập lý do không duyệt kế hoạch này..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                disabled={isRejectingPlan}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRejectingPlan}>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRejectPlan}
                disabled={isRejectingPlan || !rejectionReason.trim()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isRejectingPlan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xác nhận không duyệt
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <BulkScheduleDialog
        open={isBulkScheduleOpen}
        onOpenChange={setIsBulkScheduleOpen}
        onApply={handleBulkScheduleApply}
      />
      {planToDelete && (
        <AlertDialog open={!!planToDelete} onOpenChange={(open) => !open && setPlanToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
              <AlertDialogDescription>
                Hành động này không thể hoàn tác. Kế hoạch
                <strong> {planToDelete.ten_ke_hoach} </strong>
                sẽ bị xóa vĩnh viễn, bao gồm tất cả công việc liên quan. Mọi bản nháp chưa lưu cũng sẽ bị xóa.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingPlan}>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeletePlan} disabled={isDeletingPlan} className="bg-destructive hover:bg-destructive/90">
                {isDeletingPlan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {(taskToDelete || isConfirmingBulkDelete) && (
        <AlertDialog open={!!taskToDelete || isConfirmingBulkDelete} onOpenChange={(open) => {
          if (!open) {
            setTaskToDelete(null);
            setIsConfirmingBulkDelete(false);
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
              <AlertDialogDescription>
                {taskToDelete ? `Hành động này sẽ xóa công việc của thiết bị "${taskToDelete.thiet_bi?.ten_thiet_bi}" khỏi bản nháp.` : `Hành động này sẽ xóa ${Object.keys(taskRowSelection).length} công việc đã chọn khỏi bản nháp.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingTasks}>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={taskToDelete ? confirmDeleteSingleTask : confirmDeleteSelectedTasks}
                disabled={isDeletingTasks}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeletingTasks && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {isConfirmingCancel && (
        <AlertDialog open={isConfirmingCancel} onOpenChange={setIsConfirmingCancel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hủy bỏ mọi thay đổi?</AlertDialogTitle>
              <AlertDialogDescription>
                Hành động này sẽ loại bỏ tất cả các thay đổi bạn đã thực hiện trong bản nháp này và khôi phục lại dữ liệu gốc.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Ở lại</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelAllChanges}>Xác nhận hủy</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <AddTasksDialog
        open={isAddTasksDialogOpen}
        onOpenChange={setIsAddTasksDialogOpen}
        plan={selectedPlan}
        existingEquipmentIds={existingEquipmentIdsInDraft}
        onSuccess={handleAddTasksFromDialog}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="plans">Lập Kế hoạch</TabsTrigger>
            <TabsTrigger value="tasks" disabled={!selectedPlan}>Danh sách TB trong Kế hoạch</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="plans" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center">
              <div className="grid gap-2">
                <CardTitle>Danh sách Kế hoạch</CardTitle>
                <CardDescription>
                  Quản lý các kế hoạch bảo trì, hiệu chuẩn, kiểm định. Nhấp vào một hàng để xem chi tiết.
                </CardDescription>
              </div>
              <Button size="sm" className="h-8 gap-1 ml-auto" onClick={() => setIsAddPlanDialogOpen(true)}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Tạo kế hoạch mới
                </span>
              </Button>
            </CardHeader>
            <CardContent>
              {/* Search Section */}
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Tìm kiếm theo tên kế hoạch, khoa/phòng, người lập..."
                    value={planSearchTerm}
                    onChange={(e) => setPlanSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                {planSearchTerm && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPlanSearchTerm("")}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Xóa tìm kiếm
                  </Button>
                )}
              </div>

              {isMobile ? (
                renderMobileCards()
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      {planTable.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {isLoadingPlans ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell colSpan={planColumns.length}>
                              <Skeleton className="h-8 w-full" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : planTable.getRowModel().rows?.length ? (
                        planTable.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            data-state={row.getIsSelected() && "selected"}
                            onClick={() => handleSelectPlan(row.original)}
                            className="cursor-pointer"
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={planColumns.length} className="h-24 text-center">
                            Chưa có kế hoạch nào.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <div className="flex items-center justify-between w-full">
                <div className="flex-1 text-sm text-muted-foreground">
                  {planTable.getFilteredRowModel().rows.length} trên {plans.length} kế hoạch.
                </div>
                <div className="flex items-center gap-x-6 lg:gap-x-8">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">Số dòng</p>
                    <Select
                      value={`${planTable.getState().pagination.pageSize}`}
                      onValueChange={(value) => {
                        planTable.setPageSize(Number(value))
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={planTable.getState().pagination.pageSize} />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {[10, 20, 50, 100].map((pageSize) => (
                          <SelectItem key={pageSize} value={`${pageSize}`}>
                            {pageSize}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                    Trang {planTable.getState().pagination.pageIndex + 1} /{" "}
                    {planTable.getPageCount()}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      className="hidden h-8 w-8 p-0 lg:flex"
                      onClick={() => planTable.setPageIndex(0)}
                      disabled={!planTable.getCanPreviousPage()}
                    >
                      <span className="sr-only">Go to first page</span>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => planTable.previousPage()}
                      disabled={!planTable.getCanPreviousPage()}
                    >
                      <span className="sr-only">Go to previous page</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => planTable.nextPage()}
                      disabled={!planTable.getCanNextPage()}
                    >
                      <span className="sr-only">Go to next page</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="hidden h-8 w-8 p-0 lg:flex"
                      onClick={() => planTable.setPageIndex(planTable.getPageCount() - 1)}
                      disabled={!planTable.getCanNextPage()}
                    >
                      <span className="sr-only">Go to last page</span>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <CardTitle>Danh sách Thiết bị trong Kế hoạch: {selectedPlan?.ten_ke_hoach || '...'}</CardTitle>
                  <CardDescription className="mt-1">
                    {isPlanApproved
                      ? 'Kế hoạch đã được duyệt. Nhấp vào các ô checkbox để ghi nhận hoàn thành công việc theo thực tế.'
                      : 'Chế độ nháp: Mọi thay đổi được lưu tạm thời. Nhấn "Lưu thay đổi" để cập nhật vào cơ sở dữ liệu hoặc "Hủy bỏ" để loại bỏ các thay đổi chưa lưu.'
                    }
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {hasChanges && !isPlanApproved && (
                    <>
                      <Button variant="outline" onClick={() => setIsConfirmingCancel(true)} disabled={isSavingAll}>
                        <Undo2 className="mr-2 h-4 w-4" />
                        Hủy bỏ
                      </Button>
                      <Button onClick={handleSaveAllChanges} disabled={isSavingAll}>
                        {isSavingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Lưu thay đổi
                      </Button>
                    </>
                  )}
                  {tasks.length > 0 && (
                    <Button
                      variant="secondary"
                      onClick={handleGeneratePlanForm}
                      disabled={!!editingTaskId || isSavingAll}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Xuất phiếu KH
                    </Button>
                  )}
                  {!isPlanApproved && (
                    <Button
                      onClick={() => setIsAddTasksDialogOpen(true)}
                      disabled={!!editingTaskId || isSavingAll}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Thêm thiết bị
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTasks ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {selectedTaskRowsCount > 0 && !isPlanApproved && (
                    <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-md border">
                      <span className="text-sm font-medium">
                        Đã chọn {selectedTaskRowsCount} mục:
                      </span>
                      <Button size="sm" variant="outline" onClick={() => setIsBulkScheduleOpen(true)}>
                        <CalendarDays className="mr-2 h-4 w-4" />
                        Lên lịch hàng loạt
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Users className="mr-2 h-4 w-4" />
                            Gán ĐVTH
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => handleBulkAssignUnit('Nội bộ')}>Nội bộ</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleBulkAssignUnit('Thuê ngoài')}>Thuê ngoài</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => handleBulkAssignUnit(null)}>Xóa đơn vị</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button size="sm" variant="destructive" className="ml-auto" onClick={() => setIsConfirmingBulkDelete(true)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Xóa ({selectedTaskRowsCount})
                      </Button>
                    </div>
                  )}
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        {taskTable.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                              <TableHead key={header.id} style={{ minWidth: `${header.getSize()}px`, width: `${header.getSize()}px` }}>
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                              </TableHead>
                            ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {taskTable.getRowModel().rows?.length ? (
                          taskTable.getRowModel().rows.map((row) => (
                            <TableRow
                              key={row.original.id}
                              data-state={row.getIsSelected() && "selected"}
                              className={editingTaskId === row.original.id ? "bg-muted/50" : ""}
                            >
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={taskColumns.length} className="h-24 text-center">
                              Chưa có công việc nào trong kế hoạch này.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter>
              <div className="flex items-center justify-between w-full">
                <div className="flex-1 text-sm text-muted-foreground">
                  Đã chọn {taskTable.getFilteredSelectedRowModel().rows.length} trên {draftTasks.length} công việc.
                </div>
                <div className="flex items-center gap-x-6 lg:gap-x-8">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">Số dòng</p>
                    <Select
                      value={`${taskTable.getState().pagination.pageSize}`}
                      onValueChange={(value) => {
                        taskTable.setPageSize(Number(value))
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={taskTable.getState().pagination.pageSize} />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {[10, 20, 50, 100].map((pageSize) => (
                          <SelectItem key={pageSize} value={`${pageSize}`}>
                            {pageSize}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                    Trang {taskTable.getState().pagination.pageIndex + 1} /{" "}
                    {taskTable.getPageCount()}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      className="hidden h-8 w-8 p-0 lg:flex"
                      onClick={() => taskTable.setPageIndex(0)}
                      disabled={!taskTable.getCanPreviousPage()}
                    >
                      <span className="sr-only">Go to first page</span>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => taskTable.previousPage()}
                      disabled={!taskTable.getCanPreviousPage()}
                    >
                      <span className="sr-only">Go to previous page</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => taskTable.nextPage()}
                      disabled={!taskTable.getCanNextPage()}
                    >
                      <span className="sr-only">Go to next page</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="hidden h-8 w-8 p-0 lg:flex"
                      onClick={() => taskTable.setPageIndex(taskTable.getPageCount() - 1)}
                      disabled={!taskTable.getCanNextPage()}
                    >
                      <span className="sr-only">Go to last page</span>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
