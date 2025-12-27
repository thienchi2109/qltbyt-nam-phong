"use client"

import * as React from "react"
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
// Supabase client is not used directly; use RPC proxy instead
import { callRpc } from "@/lib/rpc-client"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Building2, Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, FilterX, History, Loader2, PlusCircle } from "lucide-react"
import { format, parseISO } from "date-fns"
import { vi } from 'date-fns/locale'
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
// Legacy auth-context removed; NextAuth is used throughout
import { useSession } from "next-auth/react"
import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { usePathname, useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSearchParams } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useSearchDebounce } from "@/hooks/use-debounce"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RepairRequestAlert } from "@/components/repair-request-alert"
import { useFacilityFilter, type FacilityOption } from "@/hooks/useFacilityFilter"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ErrorBoundary } from "@/components/error-boundary"
import { Sheet, SheetContent, SheetHeader as SheetHeaderUI, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { SummaryBar, type SummaryItem } from "@/components/summary/summary-bar"
import { FilterChips } from "./FilterChips"
import { FilterModal } from "./FilterModal"
import { RequestDetailContent } from "./RequestDetailContent"
import { EditRequestDialog } from "./EditRequestDialog"
import { DeleteRequestDialog } from "./DeleteRequestDialog"
import { ApproveRequestDialog } from "./ApproveRequestDialog"
import { CompleteRequestDialog } from "./CompleteRequestDialog"
import { CreateRequestSheet } from "./CreateRequestSheet"
import { buildRepairRequestSheetHtml } from "../request-sheet"
import type { EquipmentSelectItem, RepairRequestWithEquipment, RepairUnit } from "../types"
import { calculateDaysRemaining, getStatusVariant } from "../utils"
import { useRepairRequestShortcuts } from "../_hooks/useRepairRequestShortcuts"
import { useRepairRequestDialogs } from "../_hooks/useRepairRequestDialogs"
import { useRepairRequestColumns, renderActions } from "./repair-requests-columns"
import { RepairRequestsPagination } from "./RepairRequestsPagination"
import { MobileRequestList } from "./MobileRequestList"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  getUiFilters,
  setUiFilters,
  getColumnVisibility,
  setColumnVisibility,
  getTableDensity,
  setTableDensity,
  getTextWrap,
  setTextWrap,
  type UiFilters as UiFiltersPrefs,
  type ColumnVisibility as ColumnVisibilityPrefs,
  type ViewDensity,
  type TextWrap as TextWrapPref,
} from "@/lib/rr-prefs"
// Auto department filter removed



export default function RepairRequestsPageClient() {
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const { data: branding } = useTenantBranding()
  const user = session?.user as any // Cast NextAuth user to our User type
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const isSheetMobile = useMediaQuery("(max-width: 1279px)")
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
  // useRepairRealtimeSync()
  const searchParams = useSearchParams()
  const [allEquipment, setAllEquipment] = React.useState<EquipmentSelectItem[]>([])

  // Form state
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedEquipment, setSelectedEquipment] = React.useState<EquipmentSelectItem | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [issueDescription, setIssueDescription] = React.useState("")
  const [repairItems, setRepairItems] = React.useState("")
  const [desiredDate, setDesiredDate] = React.useState<Date>()
  const [repairUnit, setRepairUnit] = React.useState<RepairUnit>('noi_bo')
  const [externalCompanyName, setExternalCompanyName] = React.useState("")

  // Edit/Delete loading state (kept in parent for handlers)
  const [isEditSubmitting, setIsEditSubmitting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Approval loading state (kept in parent for handlers)
  const [isApproving, setIsApproving] = React.useState(false);

  // Completion loading state (kept in parent for handlers)
  const [isCompleting, setIsCompleting] = React.useState(false);

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "ngay_yeu_cau", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useSearchDebounce(searchTerm);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 });

  // UI filters (status/date) persisted
  const [uiFilters, setUiFiltersState] = React.useState<UiFiltersPrefs>(() => getUiFilters());
  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false);

  // Table presentation preferences
  const [columnVisibility, setColumnVisibilityState] = React.useState<ColumnVisibilityPrefs>(() => getColumnVisibility() || {});
  const [density, setDensity] = React.useState<ViewDensity>(() => getTableDensity());
  const [textWrap, setTextWrapState] = React.useState<TextWrapPref>(() => getTextWrap());

  const searchInputRef = React.useRef<HTMLInputElement | null>(null)

  // Dialog state (consolidated in hook)
  const dialogs = useRepairRequestDialogs()
  const {
    isCreateOpen, setIsCreateOpen,
    editingRequest, setEditingRequest,
    editIssueDescription, setEditIssueDescription,
    editRepairItems, setEditRepairItems,
    editDesiredDate, setEditDesiredDate,
    editRepairUnit, setEditRepairUnit,
    editExternalCompanyName, setEditExternalCompanyName,
    requestToDelete, setRequestToDelete,
    requestToApprove, setRequestToApprove,
    approvalRepairUnit, setApprovalRepairUnit,
    approvalExternalCompanyName, setApprovalExternalCompanyName,
    requestToComplete, setRequestToComplete,
    completionType, setCompletionType,
    completionResult, setCompletionResult,
    nonCompletionReason, setNonCompletionReason,
    requestToView, setRequestToView,
  } = dialogs

  // Regional leader facility filtering (server mode - matches Equipment page pattern)
  const effectiveTenantKey = user?.don_vi ?? user?.current_don_vi ?? 'none';

  // Separate query for facility options (unfiltered list) - uses dedicated lightweight RPC
  const { data: facilityOptionsData } = useQuery<FacilityOption[]>({
    queryKey: ['repair_request_facilities', { tenant: effectiveTenantKey }],
    queryFn: async () => {
      try {
        // Call dedicated RPC that returns only facility IDs and names (lightweight ~1-2KB vs ~500KB)
        const result = await callRpc<FacilityOption[]>({
          fn: 'get_repair_request_facilities',
          args: {},
        });

        return result || [];
      } catch (error) {
        console.error('[repair-requests] Failed to fetch facility options:', error);
        return [];
      }
    },
    enabled: !!user,
    staleTime: 5 * 60_000, // 5 minutes (facilities change rarely)
    gcTime: 10 * 60_000,
  });

  const { selectedFacilityId, setSelectedFacilityId: setFacilityId, showFacilityFilter } = useFacilityFilter({
    mode: 'server',
    userRole: (user?.role as string) || 'user',
    facilities: facilityOptionsData || [],
  })

  // Wrapper to trigger refetch when facility changes
  const setSelectedFacilityId = React.useCallback((id: number | null) => {
    setFacilityId(id);
    // Don't manually refetch - let queryKey change trigger it
  }, [setFacilityId]);

  // TanStack Query for repair requests (server-side pagination + facility filtering + date range)
  const {
    data: repairRequestsRes,
    isLoading,
    isFetching,
    refetch: refetchRequests
  } = useQuery<{ data: RepairRequestWithEquipment[], total: number, page: number, pageSize: number }>({
    queryKey: ['repair_request_list', {
      tenant: effectiveTenantKey,
      donVi: selectedFacilityId,
      statuses: uiFilters.status || [],
      q: debouncedSearch || null,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      dateFrom: uiFilters.dateRange?.from || null,
      dateTo: uiFilters.dateRange?.to || null,
    }],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const result = await callRpc<{ data: RepairRequestWithEquipment[], total: number, page: number, pageSize: number }>({
        fn: 'repair_request_list',
        args: {
          p_q: debouncedSearch || null,
          p_status: null,
          p_page: pagination.pageIndex + 1,
          p_page_size: pagination.pageSize,
          p_don_vi: selectedFacilityId,
          p_date_from: uiFilters.dateRange?.from || null,
          p_date_to: uiFilters.dateRange?.to || null,
          p_statuses: uiFilters.status && uiFilters.status.length ? uiFilters.status : null,
        },
        signal, // Pass signal in options object
      });
      return result;
    },
    enabled: !!user,
    placeholderData: (previousData) => previousData, // Keep previous data during refetch (prevents flash)
    staleTime: 30_000, // 30 seconds (repair requests change frequently)
    gcTime: 5 * 60_000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Extract data from query response
  const requests = repairRequestsRes?.data ?? [];

  // Use facilities from separate query (prevents circular dependency)
  const facilityOptions = facilityOptionsData || [];

  const selectedFacilityName = React.useMemo(() => {
    if (!selectedFacilityId) return null;
    const facility = facilityOptions.find((f: FacilityOption) => f.id === selectedFacilityId);
    return facility?.name ?? null;
  }, [selectedFacilityId, facilityOptions]);

  // Backward-compat aliases for existing UI code
  const selectedFacility = selectedFacilityName;

  // Memoize facility counts for display (from current filtered data only)
  const facilityCounts = React.useMemo(() => {
    const counts = new Map<number, number>();
    requests.forEach((r: RepairRequestWithEquipment) => {
      const facilityId = r.thiet_bi?.facility_id;
      if (facilityId) {
        counts.set(facilityId, (counts.get(facilityId) || 0) + 1);
      }
    });
    return counts;
  }, [requests]);

  // Align with repo roles: use 'global' instead of legacy 'admin'
  const canSetRepairUnit = !!user && ['global', 'to_qltb'].includes(user.role);

  // Status counts for summary (server-side via RPC per status)
  const STATUSES = ['Chờ xử lý', 'Đã duyệt', 'Hoàn thành', 'Không HT'] as const
  type Status = typeof STATUSES[number]
  const { data: statusCounts, isLoading: statusCountsLoading } = useQuery<Record<Status, number>>({
    queryKey: ['repair_request_status_counts', { facilityId: selectedFacilityId, search: debouncedSearch, dateFrom: uiFilters.dateRange?.from || null, dateTo: uiFilters.dateRange?.to || null }],
    queryFn: async () => {
      const res = await callRpc<Record<Status, number>>({
        fn: 'repair_request_status_counts',
        args: {
          p_q: debouncedSearch || null,
          p_don_vi: selectedFacilityId,
          p_date_from: uiFilters.dateRange?.from || null,
          p_date_to: uiFilters.dateRange?.to || null,
        },
      })
      return res as Record<Status, number>
    },
    staleTime: 30_000,
    enabled: !!user,
  })

  // Regional leaders are read-only on this page (no create)
  const isRegionalLeader = !!user && user.role === 'regional_leader';
  // Note: showFacilityFilter comes from useFacilityFilter hook above
  // It returns true for global, admin, and regional_leader roles

  React.useEffect(() => {
    if (editingRequest) {
      setEditIssueDescription(editingRequest.mo_ta_su_co);
      setEditRepairItems(editingRequest.hang_muc_sua_chua || "");
      setEditDesiredDate(
        editingRequest.ngay_mong_muon_hoan_thanh
          ? parseISO(editingRequest.ngay_mong_muon_hoan_thanh)
          : undefined
      );
      setEditRepairUnit(editingRequest.don_vi_thuc_hien || 'noi_bo');
      setEditExternalCompanyName(editingRequest.ten_don_vi_thue || "");
    }
  }, [editingRequest]);

  const totalRequests = repairRequestsRes?.total ?? 0;

  // Legacy function for backward compatibility (now uses refetch + cache invalidation)
  const invalidateCacheAndRefetch = React.useCallback(() => {
    // Refetch main repair requests query
    refetchRequests();
    // Invalidate facility options cache so new facilities appear in dropdown
    queryClient.invalidateQueries({ queryKey: ['repair_request_facilities'] });
    // Invalidate status counts so SummaryBar reflects latest changes immediately
    queryClient.invalidateQueries({ queryKey: ['repair_request_status_counts'] });
  }, [refetchRequests, queryClient]);

  const handleSelectEquipment = React.useCallback((equipment: EquipmentSelectItem) => {
    setSelectedEquipment(equipment);
    setSearchQuery(`${equipment.ten_thiet_bi} (${equipment.ma_thiet_bi})`);
  }, []);

  // Initial load: fetch a small equipment list via RPC
  React.useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const eq = await callRpc<any[]>({
          fn: 'equipment_list',
          args: { p_q: null, p_sort: 'ten_thiet_bi.asc', p_page: 1, p_page_size: 50 },
        })
        setAllEquipment((eq || []).map((row: any) => ({
          id: row.id,
          ma_thiet_bi: row.ma_thiet_bi,
          ten_thiet_bi: row.ten_thiet_bi,
          khoa_phong_quan_ly: row.khoa_phong_quan_ly,
        })))
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: 'Không thể tải danh sách thiết bị. ' + (error?.message || ''),
        })
      }
    }
    fetchInitialData()
  }, [toast])

  // Note: Removed manual fetchRequests useEffect - TanStack Query handles fetching automatically
  // Query will refetch when selectedFacilityId or debouncedSearch changes (via queryKey)

  // Support preselect by equipmentId query param using equipment_get RPC if needed
  React.useEffect(() => {
    const equipmentId = searchParams.get('equipmentId');
    const statusParam = searchParams.get('status');
    if (statusParam) {
      const decoded = decodeURIComponent(statusParam)
      const updated = { ...uiFilters, status: [decoded] }
      setUiFiltersState(updated); setUiFilters(updated)
    }
    const run = async () => {
      if (!equipmentId) return;
      const idNum = Number(equipmentId);
      if (selectedEquipment && selectedEquipment.id === idNum) return;
      const existing = allEquipment.find(eq => eq.id === idNum);
      if (existing) {
        handleSelectEquipment(existing);
        return;
      }
      try {
        const row: any = await callRpc({ fn: 'equipment_get', args: { p_id: idNum } })
        if (row) {
          const item: EquipmentSelectItem = {
            id: row.id,
            ma_thiet_bi: row.ma_thiet_bi,
            ten_thiet_bi: row.ten_thiet_bi,
            khoa_phong_quan_ly: row.khoa_phong_quan_ly,
          }
          setAllEquipment(prev => [item, ...prev.filter(x => x.id !== item.id)])
          handleSelectEquipment(item)
        }
      } catch (e) {
        // ignore; toast not necessary for deep link preselect
      }
    }
    run();
  }, [searchParams, allEquipment, handleSelectEquipment, selectedEquipment]);

  // Handle action=create param
  React.useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setIsCreateOpen(true)
      const params = new URLSearchParams(searchParams.toString())
      params.delete('action')
      const nextPath = params.size ? `${pathname}?${params.toString()}` : pathname
      router.replace(nextPath, { scroll: false })
    }
  }, [searchParams, router, pathname])


  const filteredEquipment = React.useMemo(() => {
    if (!searchQuery) return []
    if (selectedEquipment && searchQuery === `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`) {
      return []
    }
    return allEquipment
  }, [searchQuery, allEquipment, selectedEquipment])

  const shouldShowNoResults = React.useMemo(() => {
    if (!searchQuery) return false;
    if (selectedEquipment && searchQuery === `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`) {
      return false;
    }
    return filteredEquipment.length === 0;
  }, [searchQuery, selectedEquipment, filteredEquipment]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (selectedEquipment) {
      setSelectedEquipment(null);
    }
  }

  // Fetch equipment options via RPC when searchQuery changes
  React.useEffect(() => {
    const label = selectedEquipment ? `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})` : ''
    const q = searchQuery?.trim()
    if (!q || (label && q === label)) return
    const ctrl = new AbortController()
    const run = async () => {
      try {
        const eq = await callRpc<any[]>({
          fn: 'equipment_list',
          args: { p_q: q, p_sort: 'ten_thiet_bi.asc', p_page: 1, p_page_size: 20 },
        })
        if (ctrl.signal.aborted) return
        setAllEquipment((eq || []).map((row: any) => ({
          id: row.id,
          ma_thiet_bi: row.ma_thiet_bi,
          ten_thiet_bi: row.ten_thiet_bi,
          khoa_phong_quan_ly: row.khoa_phong_quan_ly,
        })))
      } catch (e) {
        // Silent fail for suggestions
      }
    }
    run()
    return () => ctrl.abort()
  }, [searchQuery, selectedEquipment])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEquipment || !issueDescription || !repairItems) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Vui lòng điền đầy đủ các trường bắt buộc.",
      })
      return
    }

    // Validate external company name when repair unit is external
    if (repairUnit === 'thue_ngoai' && !externalCompanyName.trim()) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Vui lòng nhập tên đơn vị được thuê sửa chữa.",
      })
      return
    }

    if (!user) {
      toast({ variant: "destructive", title: "Lỗi", description: "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại." });
      return;
    }

    setIsSubmitting(true)

    try {
      // Create repair request via RPC; server-side enforces tenant/role
      await callRpc({
        fn: 'repair_request_create',
        args: {
          p_thiet_bi_id: selectedEquipment.id,
          p_mo_ta_su_co: issueDescription,
          p_hang_muc_sua_chua: repairItems,
          p_ngay_mong_muon_hoan_thanh: desiredDate ? format(desiredDate, "yyyy-MM-dd") : null,
          p_nguoi_yeu_cau: user.full_name || user.username,
          p_don_vi_thuc_hien: canSetRepairUnit ? repairUnit : null,
          p_ten_don_vi_thue: canSetRepairUnit && repairUnit === 'thue_ngoai' ? externalCompanyName.trim() : null,
        }
      })

      toast({
        title: "Thành công",
        description: "Yêu cầu sửa chữa của bạn đã được gửi đi.",
      })
      // Reset form
      setSelectedEquipment(null)
      setSearchQuery("")
      setIssueDescription("")
      setRepairItems("")
      setDesiredDate(undefined)
      setRepairUnit('noi_bo')
      setExternalCompanyName("")
      // Invalidate cache and refetch requests
      invalidateCacheAndRefetch()
    } catch (error: any) {
      console.error("Repair request creation failed:", error);
      toast({
        variant: "destructive",
        title: "Gửi yêu cầu thất bại",
        description: error?.message || 'Không thể tạo yêu cầu sửa chữa. Vui lòng thử lại.',
      });
    }

    setIsSubmitting(false)
  }

  const handleApproveRequest = (request: RepairRequestWithEquipment) => {
    setRequestToApprove(request);
    setApprovalRepairUnit('noi_bo');
    setApprovalExternalCompanyName('');
  }

  const handleConfirmApproval = async () => {
    if (!requestToApprove) return;

    // Validate external company name when repair unit is external
    if (approvalRepairUnit === 'thue_ngoai' && !approvalExternalCompanyName.trim()) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Vui lòng nhập tên đơn vị được thuê sửa chữa.",
      });
      return;
    }

    setIsApproving(true);

    try {
      await callRpc({
        fn: 'repair_request_approve',
        args: {
          p_id: requestToApprove.id,
          p_nguoi_duyet: user?.full_name || user?.username || '',
          p_don_vi_thuc_hien: approvalRepairUnit,
          p_ten_don_vi_thue: approvalRepairUnit === 'thue_ngoai' ? approvalExternalCompanyName.trim() : null
        }
      })
    } catch (requestError: any) {
      toast({
        variant: "destructive",
        title: "Lỗi duyệt yêu cầu",
        description: "Không thể duyệt yêu cầu. " + (requestError?.message || ''),
      });
      setIsApproving(false);
      return;
    }

    toast({ title: "Thành công", description: "Đã duyệt yêu cầu." });

    setRequestToApprove(null);
    setApprovalRepairUnit('noi_bo');
    setApprovalExternalCompanyName('');
    setIsApproving(false);
    invalidateCacheAndRefetch();
  }

  const handleCompletion = (request: RepairRequestWithEquipment, newStatus: 'Hoàn thành' | 'Không HT') => {
    setRequestToComplete(request);
    setCompletionType(newStatus);
    setCompletionResult('');
    setNonCompletionReason('');
  }

  const handleConfirmCompletion = async () => {
    if (!requestToComplete || !completionType) return;

    // Validate input based on completion type
    if (completionType === 'Hoàn thành' && !completionResult.trim()) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Vui lòng nhập kết quả sửa chữa.",
      });
      return;
    }

    if (completionType === 'Không HT' && !nonCompletionReason.trim()) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Vui lòng nhập lý do không hoàn thành.",
      });
      return;
    }

    setIsCompleting(true);

    try {
      await callRpc({
        fn: 'repair_request_complete',
        args: {
          p_id: requestToComplete.id,
          p_completion: completionType === 'Hoàn thành' ? completionResult.trim() : null,
          p_reason: completionType === 'Không HT' ? nonCompletionReason.trim() : null,
        }
      })
    } catch (requestError: any) {
      toast({ variant: "destructive", title: "Lỗi cập nhật yêu cầu", description: requestError?.message || '' });
      setIsCompleting(false);
      return;
    }
    toast({ title: "Thành công", description: `Đã cập nhật trạng thái yêu cầu thành "${completionType}".` });

    setRequestToComplete(null);
    setCompletionType(null);
    setCompletionResult('');
    setNonCompletionReason('');
    setIsCompleting(false);
    invalidateCacheAndRefetch();
  }

  const handleUpdateRequest = async () => {
    if (!editingRequest || !editIssueDescription || !editRepairItems) {
      toast({ variant: "destructive", title: "Thiếu thông tin", description: "Mô tả sự cố và hạng mục không được để trống." });
      return;
    }

    // Validate external company name when repair unit is external
    if (editRepairUnit === 'thue_ngoai' && !editExternalCompanyName.trim()) {
      toast({ variant: "destructive", title: "Thiếu thông tin", description: "Vui lòng nhập tên đơn vị được thuê sửa chữa." });
      return;
    }

    setIsEditSubmitting(true);
    // Update via RPC
    try {
      await callRpc({
        fn: 'repair_request_update',
        args: {
          p_id: editingRequest.id,
          p_mo_ta_su_co: editIssueDescription,
          p_hang_muc_sua_chua: editRepairItems,
          p_ngay_mong_muon_hoan_thanh: editDesiredDate ? format(editDesiredDate, "yyyy-MM-dd") : null,
          p_don_vi_thuc_hien: canSetRepairUnit ? editRepairUnit : editingRequest.don_vi_thuc_hien,
          p_ten_don_vi_thue: canSetRepairUnit && editRepairUnit === 'thue_ngoai' ? editExternalCompanyName.trim() : (canSetRepairUnit ? null : editingRequest.ten_don_vi_thue),
        }
      })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi cập nhật", description: error?.message || 'Không thể cập nhật yêu cầu' });
      setIsEditSubmitting(false);
      return;
    }
    toast({ title: "Thành công", description: "Đã cập nhật yêu cầu." });
    setEditingRequest(null);
    invalidateCacheAndRefetch();
    setIsEditSubmitting(false);
  }

  const handleDeleteRequest = async () => {
    if (!requestToDelete) return;
    setIsDeleting(true);
    try {
      await callRpc({ fn: 'repair_request_delete', args: { p_id: requestToDelete.id } })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi xóa yêu cầu", description: error?.message || 'Không thể xóa yêu cầu' });
      setIsDeleting(false);
      setRequestToDelete(null);
      return;
    }

    toast({ title: "Đã xóa", description: "Yêu cầu đã được xóa thành công." });
    invalidateCacheAndRefetch();

    setIsDeleting(false);
    setRequestToDelete(null);
  }

  const handleGenerateRequestSheet = (request: RepairRequestWithEquipment) => {
    const organizationName = branding?.name || "TRUNG TÂM KIỂM SOÁT BỆNH TẬT THÀNH PHỐ CẦN THƠ"
    const logoUrl =
      branding?.logo_url ||
      "https://i.postimg.cc/26dHxmnV/89307731ad9526cb7f84-1-Photoroom.png"

    try {
      const htmlContent = buildRepairRequestSheetHtml(request, {
        organizationName,
        logoUrl,
      })

      const newWindow = window.open("", "_blank")
      if (newWindow) {
        newWindow.document.open()
        newWindow.document.write(htmlContent)
        newWindow.document.close()
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tạo phiếu yêu cầu.",
      })
    }
  }

  // Table columns (extracted to separate file)
  const columnOptions = React.useMemo(() => ({
    onGenerateSheet: handleGenerateRequestSheet,
    setEditingRequest,
    setRequestToDelete,
    handleApproveRequest,
    handleCompletion,
    setRequestToView,
    user,
    isRegionalLeader
  }), [
    handleGenerateRequestSheet,
    setEditingRequest,
    setRequestToDelete,
    handleApproveRequest,
    handleCompletion,
    setRequestToView,
    user,
    isRegionalLeader
  ])

  const columns = useRepairRequestColumns(columnOptions)

  // Use data from server (already filtered by facility if selected)
  const tableData = requests;

  // Create stable key for table to force remount when filter changes (prevents state corruption)
  const tableKey = React.useMemo(() => {
    return `${selectedFacilityId || 'all'}_${tableData.length}`;
  }, [selectedFacilityId, tableData.length]);

  // Calculate page count from server total
  const pageCount = React.useMemo(() => {
    const total = repairRequestsRes?.total ?? 0;
    return Math.max(1, Math.ceil(total / Math.max(pagination.pageSize, 1)));
  }, [repairRequestsRes?.total, pagination.pageSize]);

  // Reset pagination to first page when search, facility filter, or date range changes
  React.useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, selectedFacilityId, uiFilters.dateRange, uiFilters.status]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: debouncedSearch,
      pagination,
      columnVisibility,
    },
    pageCount,
    manualPagination: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === 'function' ? (updater as any)(columnFilters) : updater
      setColumnFilters(next)
      // Do not sync status via column filters; status is server-side now.
    },
    onGlobalFilterChange: (value: string) => setSearchTerm(value),
    onPaginationChange: setPagination,
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === 'function' ? (updater as any)(columnVisibility) : updater
      setColumnVisibilityState(next)
      setColumnVisibility(next)
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // getPaginationRowModel() removed - server handles pagination via manualPagination: true
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const isFiltered = table.getState().columnFilters.length > 0 || debouncedSearch.length > 0 || (uiFilters.dateRange?.from || uiFilters.dateRange?.to);

  // Server-side status filtering; no column filter syncing needed.

  // Persist density and text wrap changes
  React.useEffect(() => { setTableDensity(density) }, [density])
  React.useEffect(() => { setTextWrap(textWrap) }, [textWrap])

  // Keyboard shortcuts: '/', 'n'
  useRepairRequestShortcuts({
    searchInputRef,
    onCreate: () => setIsCreateOpen(true),
    isRegionalLeader
  })

  const summaryItems: SummaryItem[] = React.useMemo(() => {
    const toneMap: Record<Status, SummaryItem["tone"]> = {
      'Chờ xử lý': 'warning',
      'Đã duyệt': 'muted',
      'Hoàn thành': 'success',
      'Không HT': 'danger',
    }
    const base: SummaryItem[] = [
      { key: 'total', label: 'Tổng', value: totalRequests, tone: 'default', onClick: () => table.getColumn('trang_thai')?.setFilterValue([]) },
    ]
    const statusItems: SummaryItem[] = STATUSES.map((s) => ({
      key: s,
      label: s,
      value: statusCounts?.[s] ?? 0,
      tone: toneMap[s],
      onClick: () => table.getColumn('trang_thai')?.setFilterValue([s]),
    }))
    return [...base, ...statusItems]
  }, [totalRequests, statusCounts, table])

  return (
    <ErrorBoundary>
      <>
        <EditRequestDialog
          request={editingRequest}
          onClose={() => setEditingRequest(null)}
          issueDescription={editIssueDescription}
          setIssueDescription={setEditIssueDescription}
          repairItems={editRepairItems}
          setRepairItems={setEditRepairItems}
          desiredDate={editDesiredDate}
          setDesiredDate={setEditDesiredDate}
          repairUnit={editRepairUnit}
          setRepairUnit={setEditRepairUnit}
          externalCompanyName={editExternalCompanyName}
          setExternalCompanyName={setEditExternalCompanyName}
          isSubmitting={isEditSubmitting}
          onSubmit={handleUpdateRequest}
          canSetRepairUnit={canSetRepairUnit}
        />

        <DeleteRequestDialog
          request={requestToDelete}
          onClose={() => setRequestToDelete(null)}
          isDeleting={isDeleting}
          onConfirm={handleDeleteRequest}
        />

        <ApproveRequestDialog
          request={requestToApprove}
          onClose={() => setRequestToApprove(null)}
          repairUnit={approvalRepairUnit}
          setRepairUnit={setApprovalRepairUnit}
          externalCompanyName={approvalExternalCompanyName}
          setExternalCompanyName={setApprovalExternalCompanyName}
          isApproving={isApproving}
          onConfirm={handleConfirmApproval}
        />

        <CompleteRequestDialog
          request={requestToComplete}
          completionType={completionType}
          onClose={() => setRequestToComplete(null)}
          completionResult={completionResult}
          setCompletionResult={setCompletionResult}
          nonCompletionReason={nonCompletionReason}
          setNonCompletionReason={setNonCompletionReason}
          isCompleting={isCompleting}
          onConfirm={handleConfirmCompletion}
        />

        {/* Request Detail - Mobile */}
        {requestToView && isMobile && (
          <Dialog open={!!requestToView} onOpenChange={(open) => !open && setRequestToView(null)}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="text-lg font-semibold">
                  Chi tiết yêu cầu sửa chữa
                </DialogTitle>
                <DialogDescription>
                  Thông tin chi tiết về yêu cầu sửa chữa thiết bị
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-hidden pr-4">
                <ScrollArea className="h-full">
                  <RequestDetailContent request={requestToView} />
                </ScrollArea>
              </div>

              <DialogFooter className="flex-shrink-0 mt-4 border-t pt-4">
                <Button variant="outline" onClick={() => setRequestToView(null)}>
                  Đóng
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Request Detail - Desktop */}
        {requestToView && !isMobile && (
          <Sheet open={!!requestToView} onOpenChange={(open) => !open && setRequestToView(null)}>
            <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0">
              <div className="h-full flex flex-col">
                <div className="p-4 border-b">
                  <SheetTitle>Chi tiết yêu cầu sửa chữa</SheetTitle>
                  <SheetDescription>Thông tin chi tiết về yêu cầu sửa chữa thiết bị</SheetDescription>
                </div>
                <div className="flex-1 overflow-hidden px-4">
                  <ScrollArea className="h-full">
                    <RequestDetailContent request={requestToView} />
                  </ScrollArea>
                </div>
                <div className="p-4 border-t flex justify-end">
                  <Button variant="outline" onClick={() => setRequestToView(null)}>Đóng</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Repair Request Alert */}
        <RepairRequestAlert requests={requests} />

        <div className="space-y-6">
          {/* Header + Create Button */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">Yêu cầu sửa chữa</h1>
              {selectedFacilityName && (
                <p className="text-sm text-muted-foreground">{selectedFacilityName}</p>
              )}
            </div>
            {!isRegionalLeader && (
              <div className="hidden md:flex items-center gap-2">
                <Button onClick={() => setIsCreateOpen(true)} className="touch-target">
                  <PlusCircle className="mr-2 h-4 w-4" /> Tạo yêu cầu
                </Button>
              </div>
            )}
          </div>

          {/* Summary */}
          <SummaryBar items={summaryItems} loading={statusCountsLoading} />

          {/* Create Sheet */}
          {!isRegionalLeader && (
            <CreateRequestSheet
              open={isCreateOpen}
              onOpenChange={setIsCreateOpen}
              selectedEquipment={selectedEquipment}
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              onSelectEquipment={handleSelectEquipment}
              filteredEquipment={filteredEquipment}
              shouldShowNoResults={shouldShowNoResults}
              issueDescription={issueDescription}
              setIssueDescription={setIssueDescription}
              repairItems={repairItems}
              setRepairItems={setRepairItems}
              desiredDate={desiredDate}
              setDesiredDate={setDesiredDate}
              repairUnit={repairUnit}
              setRepairUnit={setRepairUnit}
              externalCompanyName={externalCompanyName}
              setExternalCompanyName={setExternalCompanyName}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
              canSetRepairUnit={canSetRepairUnit}
              isSheetMobile={isSheetMobile}
            />
          )}

          {/* Mobile FAB for quick create */}
          {!isRegionalLeader && isMobile && (
            <Button
              className="fixed right-6 fab-above-footer rounded-full h-14 w-14 shadow-lg"
              onClick={() => setIsCreateOpen(true)}
              aria-label="Tạo yêu cầu"
            >
              <PlusCircle className="h-6 w-6" />
            </Button>
          )}

          {/* Content area: Split on desktop, full on mobile or when aside collapsed/full mode */}
          <div className="grid grid-cols-1 gap-4">
            {/* Left: Requests List */}
            <div className="w-full">
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="heading-responsive-h2">Tổng hợp các yêu cầu sửa chữa thiết bị</CardTitle>
                  <CardDescription className="body-responsive-sm">
                    Tất cả các yêu cầu sửa chữa đã được ghi nhận.
                  </CardDescription>

                  {/* Facility filter for global, admin, and regional leaders */}
                  {showFacilityFilter && (
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Select
                          value={selectedFacilityId?.toString() || "all"}
                          onValueChange={(value) => setSelectedFacilityId(value === "all" ? null : Number(value))}
                          disabled={facilityOptions.length === 0}
                        >
                          <SelectTrigger className="h-9 border-dashed">
                            <SelectValue placeholder="Chọn cơ sở..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span>Tất cả cơ sở</span>
                              </div>
                            </SelectItem>
                            {facilityOptions.length === 0 ? (
                              <SelectItem value="empty" disabled>
                                <span className="text-muted-foreground italic">Chưa có yêu cầu</span>
                              </SelectItem>
                            ) : (
                              facilityOptions.map((facility) => {
                                const count = facilityCounts.get(facility.id) || 0;
                                return (
                                  <SelectItem key={facility.id} value={facility.id.toString()}>
                                    <div className="flex items-center justify-between w-full gap-4">
                                      <span className="truncate">{facility.name}</span>
                                      <span className="text-xs text-muted-foreground shrink-0">{count}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedFacilityName && selectedFacilityId && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="shrink-0 cursor-help">
                                {facilityCounts.get(selectedFacilityId) || 0} yêu cầu
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Số yêu cầu hiển thị ở cơ sở này</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {!selectedFacility && facilityOptions.length > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="shrink-0 cursor-help">
                                {facilityOptions.length} cơ sở • {totalRequests} yêu cầu
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Tổng số cơ sở và yêu cầu hiển thị</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-3 md:p-6 gap-3 md:gap-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2 md:mb-3">
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        ref={searchInputRef}
                        placeholder="Tìm thiết bị, mô tả..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        className="h-8 w-[120px] md:w-[200px] lg:w-[250px] touch-target-sm md:h-8"
                      />

                      <Button variant="outline" size="sm" className="h-8 touch-target-sm" onClick={() => setIsFilterModalOpen(true)}>Bộ lọc</Button>

                      {/* Advanced filters only: open modal/sheet */}

                      {/* Clear all filters button */}
                      {isFiltered && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            table.resetColumnFilters();
                            setUiFiltersState({ status: [], dateRange: null });
                            setUiFilters({ status: [], dateRange: null });
                            if (showFacilityFilter) setSelectedFacilityId(null);
                            setSearchTerm("");
                          }}
                          className="h-8 px-2 lg:px-3 touch-target-sm md:h-8"
                          aria-label="Xóa bộ lọc"
                        >
                          <span className="hidden sm:inline">Xóa</span>
                          <FilterX className="h-4 w-4 sm:ml-2" />
                        </Button>
                      )}

                      {/* Display menu: presets, density, wrap */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 touch-target-sm">Hiển thị</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Preset cột</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => {
                            const next: any = { thiet_bi_va_mo_ta: true, ngay_yeu_cau: true, trang_thai: true, nguoi_yeu_cau: false, ngay_mong_muon_hoan_thanh: false, actions: true }
                            setColumnVisibilityState(next); setColumnVisibility(next)
                          }}>Compact</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => {
                            const next: any = { thiet_bi_va_mo_ta: true, nguoi_yeu_cau: true, ngay_yeu_cau: true, ngay_mong_muon_hoan_thanh: true, trang_thai: true, actions: true }
                            setColumnVisibilityState(next); setColumnVisibility(next)
                          }}>Standard</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => {
                            const next: any = { thiet_bi_va_mo_ta: true, nguoi_yeu_cau: true, ngay_yeu_cau: true, ngay_mong_muon_hoan_thanh: true, trang_thai: true, actions: true }
                            setColumnVisibilityState(next); setColumnVisibility(next)
                          }}>Full</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Mật độ</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => setDensity('compact')}>
                            {density === 'compact' ? '✓ ' : ''}Compact
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDensity('standard')}>
                            {density === 'standard' ? '✓ ' : ''}Standard
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDensity('spacious')}>
                            {density === 'spacious' ? '✓ ' : ''}Spacious
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Văn bản</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => setTextWrapState('truncate')}>
                            {textWrap === 'truncate' ? '✓ ' : ''}Thu gọn
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setTextWrapState('wrap')}>
                            {textWrap === 'wrap' ? '✓ ' : ''}Xuống dòng
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Chips under search */}
                    <div className="w-full pt-2">
                      <FilterChips
                        value={{
                          status: uiFilters.status,
                          facilityName: selectedFacilityName,
                          dateRange: uiFilters.dateRange ? { from: uiFilters.dateRange.from ?? null, to: uiFilters.dateRange.to ?? null } : null,
                        }}
                        showFacility={showFacilityFilter}
                        onRemove={(key, sub) => {
                          if (key === 'status' && sub) {
                            const next = uiFilters.status.filter(s => s !== sub)
                            const updated = { ...uiFilters, status: next }
                            setUiFiltersState(updated); setUiFilters(updated)
                          } else if (key === 'facilityName') {
                            setSelectedFacilityId(null)
                          } else if (key === 'dateRange') {
                            const updated = { ...uiFilters, dateRange: null }
                            setUiFiltersState(updated); setUiFilters(updated)
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Filter Modal */}
                  <FilterModal
                    open={isFilterModalOpen}
                    onOpenChange={setIsFilterModalOpen}
                    value={{
                      status: uiFilters.status,
                      facilityId: selectedFacilityId ?? null,
                      dateRange: uiFilters.dateRange ? {
                        from: uiFilters.dateRange.from ? new Date(uiFilters.dateRange.from) : null,
                        to: uiFilters.dateRange.to ? new Date(uiFilters.dateRange.to) : null,
                      } : { from: null, to: null },
                    }}
                    onChange={(v) => {
                      // sync facility
                      if (showFacilityFilter) setSelectedFacilityId(v.facilityId ?? null)
                      // persist date range and status
                      const updated: UiFiltersPrefs = {
                        status: v.status,
                        dateRange: v.dateRange ? {
                          from: v.dateRange.from ? format(v.dateRange.from, 'yyyy-MM-dd') : null,
                          to: v.dateRange.to ? format(v.dateRange.to, 'yyyy-MM-dd') : null,
                        } : null,
                      }
                      setUiFiltersState(updated); setUiFilters(updated)
                    }}
                    showFacility={showFacilityFilter}
                    facilities={facilityOptions.map(f => ({ id: f.id, name: f.name }))}
                    variant={isMobile ? 'sheet' : 'dialog'}
                  />
                  {/* Mobile Card View */}
                  {isMobile ? (
                    <MobileRequestList
                      requests={table.getRowModel().rows.map(row => row.original)}
                      isLoading={isLoading}
                      setRequestToView={setRequestToView}
                      renderActions={(req) => renderActions(req, columnOptions)}
                    />
                  ) : (
                    /* Desktop Table View */
                    <div key={tableKey} className="rounded-md border overflow-x-auto">
                      <div className="min-w-[1100px]">
                        <Table>
                          <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                              <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header, colIdx) => (
                                  <TableHead
                                    key={header.id}
                                    className={cn(
                                      density === 'compact' ? 'py-1' : density === 'spacious' ? 'py-3' : 'py-2',
                                      colIdx === 0 && 'sticky left-0 z-20 bg-background w-[20rem] min-w-[20rem] max-w-[20rem] border-r',
                                      colIdx === 1 && 'sticky left-[20rem] z-20 bg-background w-[14rem] min-w-[14rem] max-w-[14rem] border-r'
                                    )}
                                    style={undefined}
                                  >
                                    {header.isPlaceholder ? null : flexRender(
                                      header.column.columnDef.header,
                                      header.getContext()
                                    )}
                                  </TableHead>
                                ))}
                              </TableRow>
                            ))}
                          </TableHeader>
                          <TableBody>
                            {isLoading ? (
                              <TableRow>
                                <TableCell colSpan={columns.length} className={cn("h-24 text-center", density === 'compact' ? 'py-1' : density === 'spacious' ? 'py-3' : 'py-2')}>
                                  <div className="flex justify-center items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Đang tải...</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : table.getRowModel().rows?.length ? (
                              table.getRowModel().rows.map((row) => {
                                const req = row.original
                                const isCompleted = req.trang_thai === 'Hoàn thành' || req.trang_thai === 'Không HT'
                                const daysInfo = !isCompleted && req.ngay_mong_muon_hoan_thanh ? calculateDaysRemaining(req.ngay_mong_muon_hoan_thanh) : null
                                const stripeClass = daysInfo ? (daysInfo.status === 'success' ? 'border-l-4 border-green-500' : daysInfo.status === 'warning' ? 'border-l-4 border-orange-500' : 'border-l-4 border-red-500') : ''
                                return (
                                  <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    tabIndex={0}
                                    className={cn("cursor-pointer hover:bg-muted/50 focus:outline-none", stripeClass)}
                                    onClick={() => setRequestToView(row.original)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') setRequestToView(row.original) }}
                                  >
                                    {row.getVisibleCells().map((cell, colIdx) => (
                                      <TableCell
                                        key={cell.id}
                                        className={cn(
                                          density === 'compact' ? 'py-1' : density === 'spacious' ? 'py-3' : 'py-2',
                                          colIdx === 0 && 'sticky left-0 z-10 bg-background w-[20rem] min-w-[20rem] max-w-[20rem] border-r',
                                          colIdx === 1 && 'sticky left-[20rem] z-10 bg-background w-[14rem] min-w-[14rem] max-w-[14rem] border-r',
                                          textWrap === 'truncate' ? 'truncate' : 'whitespace-normal break-words'
                                        )}
                                      >
                                        {flexRender(
                                          cell.column.columnDef.cell,
                                          cell.getContext()
                                        )}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                )
                              })
                            ) : (
                              <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                  Không có kết quả.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="py-4">
                  <RepairRequestsPagination
                    table={table}
                    totalRequests={totalRequests}
                    pagination={pagination}
                  />
                </CardFooter>
              </Card>
            </div>

          </div>

          {/* Fall-back (mobile/tablet): keep FAB + Sheet for create */}

        </div>

      </>
    </ErrorBoundary>
  )
}
