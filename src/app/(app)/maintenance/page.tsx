
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
import { AlertTriangle, ArrowUpDown, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ClipboardList, Edit, FileText, Filter, Loader2, MoreHorizontal, PlusCircle, Save, Search, Trash2, Undo2, Users, X } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import { MaintenanceTask, taskTypes, type Equipment } from "@/lib/data"
import { callRpc } from "@/lib/rpc-client"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance" // ✅ Use hook's type for paginated data
import { useFeatureFlag } from "@/lib/feature-flags"
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
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  useMaintenancePlans,
  useCreateMaintenancePlan,
  useUpdateMaintenancePlan,
  maintenanceKeys,
  // MaintenancePlan type imported separately above to avoid duplication
  // useDeleteMaintenancePlan, useApproveMaintenancePlan, useRejectMaintenancePlan moved to useMaintenanceOperations hook
} from "@/hooks/use-cached-maintenance"
import { useQueryClient } from "@tanstack/react-query"
import { useSearchDebounce } from "@/hooks/use-debounce"
import { useMaintenanceOperations } from "./_hooks/use-maintenance-operations"
import { useMaintenancePrint } from "./_hooks/use-maintenance-print"
import { MobileMaintenanceLayout } from "./_components/mobile-maintenance-layout"
import { PlanFiltersBar } from "./_components/plan-filters-bar"
import { PlansTable } from "./_components/plans-table"
import { TasksTable } from "./_components/tasks-table"
import { usePlanColumns, useTaskColumns } from "./_components/maintenance-columns"
import { useTaskEditing } from "./_components/task-editing"
import { MaintenanceDialogs } from "./_components/maintenance-dialogs"

export default function MaintenancePage() {
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const user = session?.user as any // Cast NextAuth user to our User type
  const isRegionalLeader = user?.role === 'regional_leader'
  // Regional leaders can VIEW maintenance plans but cannot manage them
  const canManagePlans = !!user && !isRegionalLeader && ((user.role === 'global' || user.role === 'admin') || user.role === 'to_qltb')
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const mobileMaintenanceEnabled = useFeatureFlag("mobile-maintenance-redesign")
  const shouldUseMobileMaintenance = isMobile && mobileMaintenanceEnabled
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

  // 🔄 SERVER-SIDE PAGINATION & FILTERING STATE
  const [planSearchTerm, setPlanSearchTerm] = React.useState("");
  const debouncedPlanSearch = useSearchDebounce(planSearchTerm);
  const [selectedFacilityId, setSelectedFacilityId] = React.useState<number | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [isMobileFilterSheetOpen, setIsMobileFilterSheetOpen] = React.useState(false)
  const [pendingFacilityFilter, setPendingFacilityFilter] = React.useState<number | null>(null)
  const [expandedTaskIds, setExpandedTaskIds] = React.useState<Record<number, boolean>>({})

  // 🚀 NEW: Server-side paginated hook with facility filtering
  const { data: paginatedResponse, isLoading: isLoadingPlans, refetch: refetchPlans } = useMaintenancePlans({
    search: debouncedPlanSearch || undefined,
    facilityId: selectedFacilityId,
    page: currentPage,
    pageSize,
  });

  // Extract data and pagination metadata from server response
  const plans = paginatedResponse?.data ?? [];
  const totalCount = paginatedResponse?.total ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // 🔄 Fetch facilities for dropdown (role-aware, includes regional_leader support)
  const [facilities, setFacilities] = React.useState<Array<{ id: number; name: string }>>([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = React.useState(false);

  React.useEffect(() => {
    // Only global and regional_leader users need the facility dropdown
    const canSeeFacilityFilter = user?.role === 'global' || user?.role === 'regional_leader';
    if (!canSeeFacilityFilter) return;

    setIsLoadingFacilities(true);
    callRpc<any[]>({ fn: 'get_facilities_with_equipment_count', args: {} })
      .then((result) => {
        const mapped = (result || []).map((f: any) => ({
          id: Number(f.id),
          name: String(f.name || `Cơ sở ${f.id}`),
        }));
        setFacilities(mapped);
      })
      .catch((err) => {
        console.error('[Maintenance] Failed to fetch facilities:', err);
        setFacilities([]);
      })
      .finally(() => setIsLoadingFacilities(false));
  }, [user?.role]);

  const showFacilityFilter = user?.role === 'global' || user?.role === 'regional_leader';
  const activeMobileFilterCount = React.useMemo(() => {
    let count = 0
    if (selectedFacilityId) count += 1
    return count
  }, [selectedFacilityId])

  // ✅ Plan operations moved to useMaintenanceOperations hook

  const [isAddPlanDialogOpen, setIsAddPlanDialogOpen] = React.useState(false)

  const [planSorting, setPlanSorting] = React.useState<SortingState>([])
  const [editingPlan, setEditingPlan] = React.useState<MaintenancePlan | null>(null)

  // ⚠️ REMOVED: Client-side pagination state (now server-controlled via currentPage/pageSize)

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

  // State for task deletion (isDeletingTasks used for single/bulk deletion from DRAFT)
  const [isDeletingTasks, setIsDeletingTasks] = React.useState(false);
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

  // ✅ Extracted hook for plan operations (approve, reject, delete)
  const operations = useMaintenanceOperations({
    selectedPlan,
    setSelectedPlan,
    setActiveTab,
    getDraftCacheKey,
    user,
  })

  // ✅ Extracted hook for print form generation
  const { generatePlanForm, isGenerating: isPrintGenerating } = useMaintenancePrint({
    selectedPlan,
    tasks,
    user,
  })

  const hasChanges = React.useMemo(() => {
    return JSON.stringify(tasks) !== JSON.stringify(draftTasks);
  }, [tasks, draftTasks]);

  // ✅ State preservation for dialog operations (defensive pattern similar to Equipment page)
  const [preserveUIState, setPreserveUIState] = React.useState<{
    selectedPlanId: number | null
    activeTab: string
  } | null>(null)

  // ✅ Defensive callback pattern: Save UI state before triggering refetch
  // This prevents crashes by operating on stable UI state instead of async callbacks
  const onPlanMutationSuccessWithStatePreservation = React.useCallback(() => {
    // Save current UI state to preserve across refetch
    const stateToSave = {
      selectedPlanId: selectedPlan?.id || null,
      activeTab: activeTab,
    }
    setPreserveUIState(stateToSave)
    
    // Trigger refetch - safe because it's called after state preservation
    refetchPlans()
  }, [selectedPlan, activeTab, refetchPlans])

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

  // Restore UI state after refetch completes
  React.useEffect(() => {
    if (preserveUIState && !isLoadingPlans && plans.length > 0) {
      // Restore selected plan if it was preserved
      if (preserveUIState.selectedPlanId) {
        const planToRestore = plans.find(p => p.id === preserveUIState.selectedPlanId)
        if (planToRestore) {
          setSelectedPlan(planToRestore)
        }
      }
      // Restore active tab
      if (preserveUIState.activeTab) {
        setActiveTab(preserveUIState.activeTab)
      }
      // Clear preserved state
      setPreserveUIState(null)
    }
  }, [preserveUIState, isLoadingPlans, plans])

  // Handle URL parameters for navigation from Dashboard
  // ✅ No loading guards needed - defensive callback pattern handles early calls gracefully
  React.useEffect(() => {
    const planIdParam = searchParams.get('planId')
    const tabParam = searchParams.get('tab')
    const actionParam = searchParams.get('action')

    // Handle quick action to create new plan - can open immediately
    if (actionParam === 'create') {
      setIsAddPlanDialogOpen(true)
      // Clear URL params after opening dialog
      window.history.replaceState({}, '', '/maintenance')
      return
    }

    // Handle plan selection from URL - waits for data naturally
    if (planIdParam && plans.length > 0) {
      const planId = parseInt(planIdParam, 10)
      const targetPlan = plans.find(p => p.id === planId)

      if (targetPlan) {
        setSelectedPlan(targetPlan)
        if (tabParam === 'tasks') {
          setActiveTab('tasks')
        }
        // Clear URL params after processing
        window.history.replaceState({}, '', '/maintenance')
      }
    }
  }, [searchParams, plans])

  // 🚀 SERVER-SIDE FILTERING: Plans already filtered by server via RPC
  // facility_name is included in response from server-side JOIN
  const tablePlans = plans;

  // 🔄 Reset to page 1 when filters change (triggers new server query)
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedFacilityId, debouncedPlanSearch]);

  React.useEffect(() => {
    if (isMobileFilterSheetOpen) {
      setPendingFacilityFilter(selectedFacilityId ?? null)
    }
  }, [isMobileFilterSheetOpen, selectedFacilityId])

  React.useEffect(() => {
    if (selectedPlan?.id) {
      setExpandedTaskIds({})
    }
  }, [selectedPlan?.id])

  // ✅ handleApprovePlan, handleRejectPlan, handleDeletePlan moved to useMaintenanceOperations hook

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
          const canManage = canManagePlans;

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
                            <DropdownMenuItem onSelect={() => operations.openApproveDialog(plan)}>
                              <Check className="mr-2 h-4 w-4" />
                              Duyệt
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => operations.openRejectDialog(plan)}>
                              <X className="mr-2 h-4 w-4" />
                              Không duyệt
                            </DropdownMenuItem>
                          </>
                        )}
                        {canManage && (
                          <>
                            <DropdownMenuItem onSelect={() => setEditingPlan(plan)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Sửa
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => operations.openDeleteDialog(plan)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Xóa
                            </DropdownMenuItem>
                          </>
                        )}
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
        loai_cong_viec: selectedPlan.loai_cong_viec as any, // ⚠️ Type assertion: string -> TaskType literal
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

  const handleMobileFilterApply = React.useCallback(() => {
    setSelectedFacilityId(pendingFacilityFilter ?? null)
    setCurrentPage(1)
    setIsMobileFilterSheetOpen(false)
  }, [pendingFacilityFilter, setSelectedFacilityId, setCurrentPage])

  const handleMobileFilterClear = React.useCallback(() => {
    setPendingFacilityFilter(null)
    setSelectedFacilityId(null)
    setCurrentPage(1)
    setIsMobileFilterSheetOpen(false)
  }, [setSelectedFacilityId, setCurrentPage])

  const toggleTaskExpansion = React.useCallback((taskId: number) => {
    setExpandedTaskIds(prev => ({
      ...prev,
      [taskId]: !prev[taskId],
    }))
  }, [])

  const planColumns = usePlanColumns({
    sorting: planSorting,
    setSorting: setPlanSorting,
    onRowClick: handleSelectPlan,
    openApproveDialog: operations.openApproveDialog,
    openRejectDialog: operations.openRejectDialog,
    openDeleteDialog: operations.openDeleteDialog,
    setEditingPlan,
    canManagePlans,
    isRegionalLeader,
  })

  // 🔄 TanStack Table for DISPLAY ONLY (no client-side pagination)
  // Server handles pagination via currentPage/pageSize state
  const planTable = useReactTable({
    data: tablePlans as MaintenancePlan[],
    columns: planColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setPlanSorting,
    state: {
      sorting: planSorting,
    },
    // ⚠️ manualPagination = true tells TanStack Table we handle pagination externally
    manualPagination: true,
    pageCount: totalPages, // Server provides total page count
  });

  const isPlanApproved = selectedPlan?.trang_thai === 'Đã duyệt';
  const canCompleteTask = !isRegionalLeader && user && ((user.role === 'global' || user.role === 'admin') || user.role === 'to_qltb');

  // ✅ Extracted hook for task inline editing (must be after isPlanApproved is declared)
  const taskEditing = useTaskEditing({
    draftTasks,
    setDraftTasks,
    canManagePlans,
    isPlanApproved,
  })

  const confirmDeleteSingleTask = React.useCallback(() => {
    const toDelete = taskEditing.taskToDelete;
    if (!toDelete) return;
    setIsDeletingTasks(true);
    setDraftTasks(currentDrafts => currentDrafts.filter(task => task.id !== toDelete.id));
    taskEditing.setTaskToDelete(null);
    setIsDeletingTasks(false);
    toast({ title: "Đã xóa khỏi bản nháp" });
  }, [taskEditing.taskToDelete, taskEditing.setTaskToDelete, toast]);

  const handleMarkAsCompleted = React.useCallback(async (task: MaintenanceTask, month: number) => {
    if (!selectedPlan || !user || !canCompleteTask) {
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


  const taskColumns = useTaskColumns({
    editingTaskId: taskEditing.editingTaskId,
    handleStartEdit: taskEditing.handleStartEdit,
    handleCancelEdit: taskEditing.handleCancelEdit,
    handleTaskDataChange: taskEditing.handleTaskDataChange,
    handleSaveTask: taskEditing.handleSaveTask,
    setTaskToDelete: taskEditing.setTaskToDelete,
    canManagePlans,
    isPlanApproved,
    canCompleteTask,
    handleMarkAsCompleted,
    isCompletingTask,
    completionStatus,
    isLoadingCompletion,
    selectedPlan,
  })

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

  // ✅ handleGeneratePlanForm moved to useMaintenancePrint hook

  const tableMeta = React.useMemo(() => ({
    editingTaskId: taskEditing.editingTaskId,
    editingTaskData: taskEditing.editingTaskData,
    isPlanApproved,
    setTaskToDelete: taskEditing.setTaskToDelete,
    handleTaskDataChange: taskEditing.handleTaskDataChange,
    handleSaveTask: taskEditing.handleSaveTask,
    handleCancelEdit: taskEditing.handleCancelEdit,
    handleStartEdit: taskEditing.handleStartEdit,
    completionStatus,
    isLoadingCompletion,
    handleMarkAsCompleted,
    isCompletingTask,
    canCompleteTask,
  }), [
    taskEditing.editingTaskId,
    taskEditing.editingTaskData,
    isPlanApproved,
    taskEditing.setTaskToDelete,
    taskEditing.handleTaskDataChange,
    taskEditing.handleSaveTask,
    taskEditing.handleCancelEdit,
    taskEditing.handleStartEdit,
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

  const modalContent = (
    <MaintenanceDialogs
      isAddPlanDialogOpen={isAddPlanDialogOpen}
      setIsAddPlanDialogOpen={setIsAddPlanDialogOpen}
      editingPlan={editingPlan}
      setEditingPlan={setEditingPlan}
      isAddTasksDialogOpen={isAddTasksDialogOpen}
      setIsAddTasksDialogOpen={setIsAddTasksDialogOpen}
      isBulkScheduleOpen={isBulkScheduleOpen}
      setIsBulkScheduleOpen={setIsBulkScheduleOpen}
      isConfirmingCancel={isConfirmingCancel}
      setIsConfirmingCancel={setIsConfirmingCancel}
      isConfirmingBulkDelete={isConfirmingBulkDelete}
      setIsConfirmingBulkDelete={setIsConfirmingBulkDelete}
      selectedPlan={selectedPlan}
      draftTasks={draftTasks}
      selectedTaskRowsCount={selectedTaskRowsCount}
      existingEquipmentIdsInDraft={existingEquipmentIdsInDraft}
      onAddPlanSuccess={onPlanMutationSuccessWithStatePreservation}
      onEditPlanSuccess={onPlanMutationSuccessWithStatePreservation}
      onAddTasksSuccess={handleAddTasksFromDialog}
      onBulkScheduleApply={handleBulkScheduleApply}
      onCancelConfirm={handleCancelAllChanges}
      confirmDeleteSingleTask={confirmDeleteSingleTask}
      confirmDeleteSelectedTasks={confirmDeleteSelectedTasks}
      taskToDelete={taskEditing.taskToDelete}
      setTaskToDelete={taskEditing.setTaskToDelete}
      operations={operations}
      isDeletingTasks={isDeletingTasks}
    />
  )

  if (shouldUseMobileMaintenance) {
    return (
      <>
        {modalContent}
        {/* Mobile layout rendered below */}
        <MobileMaintenanceLayout
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          plans={plans}
          selectedPlan={selectedPlan}
          handleSelectPlan={handleSelectPlan}
          canManagePlans={canManagePlans}
          isRegionalLeader={isRegionalLeader}
          isLoadingPlans={isLoadingPlans}
          planSearchTerm={planSearchTerm}
          setPlanSearchTerm={setPlanSearchTerm}
          onClearSearch={() => setPlanSearchTerm("")}
          totalPages={totalPages}
          totalCount={totalCount}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          showFacilityFilter={showFacilityFilter}
          facilities={facilities}
          selectedFacilityId={selectedFacilityId}
          isLoadingFacilities={isLoadingFacilities}
          isMobileFilterSheetOpen={isMobileFilterSheetOpen}
          setIsMobileFilterSheetOpen={setIsMobileFilterSheetOpen}
          pendingFacilityFilter={pendingFacilityFilter}
          setPendingFacilityFilter={setPendingFacilityFilter}
          handleMobileFilterApply={handleMobileFilterApply}
          handleMobileFilterClear={handleMobileFilterClear}
          activeMobileFilterCount={activeMobileFilterCount}
          setIsAddPlanDialogOpen={setIsAddPlanDialogOpen}
          openApproveDialog={operations.openApproveDialog}
          openRejectDialog={operations.openRejectDialog}
          openDeleteDialog={operations.openDeleteDialog}
          setEditingPlan={setEditingPlan}
          setIsAddTasksDialogOpen={setIsAddTasksDialogOpen}
          handleGeneratePlanForm={generatePlanForm}
          tasks={tasks}
          draftTasks={draftTasks}
          isLoadingTasks={isLoadingTasks}
          expandedTaskIds={expandedTaskIds}
          toggleTaskExpansion={toggleTaskExpansion}
          hasChanges={hasChanges}
          handleSaveAllChanges={handleSaveAllChanges}
          handleCancelAllChanges={handleCancelAllChanges}
          isSavingAll={isSavingAll}
          setIsConfirmingCancel={setIsConfirmingCancel}
          handleStartEdit={taskEditing.handleStartEdit}
          handleCancelEdit={taskEditing.handleCancelEdit}
          handleTaskDataChange={taskEditing.handleTaskDataChange}
          handleSaveTask={taskEditing.handleSaveTask}
          editingTaskId={taskEditing.editingTaskId}
          editingTaskData={taskEditing.editingTaskData}
          setTaskToDelete={taskEditing.setTaskToDelete}
          canCompleteTask={canCompleteTask}
          completionStatus={completionStatus}
          handleMarkAsCompleted={handleMarkAsCompleted}
          isCompletingTask={isCompletingTask}
          isPlanApprovedForTasks={isPlanApproved}
        />
      </>
    )
  }

  return (
    <>
      {modalContent}

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
              {canManagePlans && (
                <Button size="sm" className="h-8 gap-1 ml-auto" onClick={() => setIsAddPlanDialogOpen(true)}>
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Tạo kế hoạch mới
                  </span>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <PlanFiltersBar
                showFacilityFilter={showFacilityFilter}
                facilities={facilities}
                selectedFacilityId={selectedFacilityId}
                onFacilityChange={setSelectedFacilityId}
                isLoadingFacilities={isLoadingFacilities}
                totalCount={totalCount}
                searchTerm={planSearchTerm}
                onSearchChange={setPlanSearchTerm}
                isRegionalLeader={isRegionalLeader}
              />

              {isMobile ? (
                renderMobileCards()
              ) : (
                <PlansTable
                  table={planTable}
                  columns={planColumns}
                  isLoading={isLoadingPlans}
                  onRowClick={handleSelectPlan}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size)
                    setCurrentPage(1)
                  }}
                  displayCount={plans.length}
                  isFiltered={!!(debouncedPlanSearch || selectedFacilityId)}
                />
              )}
            </CardContent>
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
                  {hasChanges && !isPlanApproved && canManagePlans && (
                    <>
                      <Button variant="outline" onClick={() => setIsConfirmingCancel(true)} disabled={isSavingAll}>
                        <Undo2 className="mr-2 h-4 w-4" />
                        Hủy bỏ
                      </Button>
                      <Button onClick={handleSaveAllChanges} disabled={isSavingAll || !canManagePlans}>
                        {isSavingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Lưu thay đổi
                      </Button>
                    </>
                  )}
                  {tasks.length > 0 && !isRegionalLeader && (
                    <Button
                      variant="secondary"
                      onClick={generatePlanForm}
                      disabled={!!taskEditing.editingTaskId || isSavingAll}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Xuất phiếu KH
                    </Button>
                  )}
                  {!isPlanApproved && canManagePlans && (
                    <Button
                      onClick={() => setIsAddTasksDialogOpen(true)}
                      disabled={!!taskEditing.editingTaskId || isSavingAll}
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
                <TasksTable
                  table={taskTable}
                  columns={taskColumns}
                  editingTaskId={taskEditing.editingTaskId}
                  totalCount={draftTasks.length}
                  selectedCount={selectedTaskRowsCount}
                  showBulkActions={!isPlanApproved && canManagePlans}
                  onBulkSchedule={() => setIsBulkScheduleOpen(true)}
                  onBulkAssignUnit={handleBulkAssignUnit}
                  onBulkDelete={() => setIsConfirmingBulkDelete(true)}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
