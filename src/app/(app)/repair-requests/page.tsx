"use client"

import * as React from "react"
import type { ColumnDef, ColumnFiltersState, SortingState } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
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
import { ArrowUpDown, Building2, Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, Edit, FilterX, History, Loader2, MoreHorizontal, PlusCircle, Trash2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { vi } from 'date-fns/locale'
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
// Legacy auth-context removed; NextAuth is used throughout
import { useSession } from "next-auth/react"
import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { useSearchParams } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useSearchDebounce } from "@/hooks/use-debounce"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Column } from "@tanstack/react-table"
import { RepairRequestAlert } from "@/components/repair-request-alert"
import { MobileFiltersDropdown } from "@/components/mobile-filters-dropdown"
import { useFacilityFilter } from "@/hooks/useFacilityFilter"
// Auto department filter removed


type EquipmentSelectItem = {
  id: number;
  ma_thiet_bi: string;
  ten_thiet_bi: string;
  khoa_phong_quan_ly?: string | null;
}

// Export type để RepairRequestAlert có thể sử dụng nếu cần
export type RepairRequestWithEquipment = {
  id: number;
  thiet_bi_id: number;
  ngay_yeu_cau: string;
  trang_thai: string;
  mo_ta_su_co: string;
  hang_muc_sua_chua: string | null;
  ngay_mong_muon_hoan_thanh: string | null;
  nguoi_yeu_cau: string | null;
  ngay_duyet: string | null;
  ngay_hoan_thanh: string | null;
  nguoi_duyet: string | null;
  nguoi_xac_nhan: string | null;
  don_vi_thuc_hien: 'noi_bo' | 'thue_ngoai' | null;
  ten_don_vi_thue: string | null;
  ket_qua_sua_chua: string | null;
  ly_do_khong_hoan_thanh: string | null;
  thiet_bi: {
    ten_thiet_bi: string;
    ma_thiet_bi: string;
    model: string | null;
    serial: string | null;
    khoa_phong_quan_ly: string | null;
    facility_name: string | null;
    facility_id: number | null;
  } | null;
};

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>
  title?: string
  options: {
    label: string
    value: string
  }[]
}

function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const selectedValues = new Set(column?.getFilterValue() as string[])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed touch-target-sm md:h-8">
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}
          {selectedValues?.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedValues.size} đã chọn
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        <span className="truncate max-w-[100px]">{option.label}</span>
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="start">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => {
          const isSelected = selectedValues.has(option.value)
          return (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={isSelected}
              onCheckedChange={(checked) => {
                if (checked) {
                  selectedValues.add(option.value)
                } else {
                  selectedValues.delete(option.value)
                }
                const filterValues = Array.from(selectedValues)
                column?.setFilterValue(
                  filterValues.length ? filterValues : undefined
                )
              }}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="truncate">{option.label}</span>
            </DropdownMenuCheckboxItem>
          )
        })}
        {selectedValues.size > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => column?.setFilterValue(undefined)}
              className="justify-center text-center"
            >
              Xóa bộ lọc
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const requestStatuses = ['Chờ xử lý', 'Đã duyệt', 'Hoàn thành', 'Không HT'];

// Function to calculate days remaining and status
const calculateDaysRemaining = (desiredDate: string | null) => {
  if (!desiredDate) return null;

  const today = new Date();
  const targetDate = new Date(desiredDate);
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let status: 'success' | 'warning' | 'danger';
  let color: string;

  if (diffDays > 7) {
    status = 'success';
    color = 'bg-green-500';
  } else if (diffDays > 0) {
    status = 'warning';
    color = 'bg-orange-500';
  } else {
    status = 'danger';
    color = 'bg-red-500';
  }

  return {
    days: diffDays,
    status,
    color,
    text: diffDays > 0 ? `Còn ${diffDays} ngày` : diffDays === 0 ? 'Hôm nay' : `Quá hạn ${Math.abs(diffDays)} ngày`
  };
};

export default function RepairRequestsPage() {
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const { data: branding } = useTenantBranding()
  const user = session?.user as any // Cast NextAuth user to our User type
  const router = useRouter()
  const isMobile = useIsMobile()

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
  const [requests, setRequests] = React.useState<RepairRequestWithEquipment[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [allEquipment, setAllEquipment] = React.useState<EquipmentSelectItem[]>([])

  // Form state
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedEquipment, setSelectedEquipment] = React.useState<EquipmentSelectItem | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [issueDescription, setIssueDescription] = React.useState("")
  const [repairItems, setRepairItems] = React.useState("")
  const [desiredDate, setDesiredDate] = React.useState<Date>()
  const [repairUnit, setRepairUnit] = React.useState<'noi_bo' | 'thue_ngoai'>('noi_bo')
  const [externalCompanyName, setExternalCompanyName] = React.useState("")

  // Edit/Delete state
  const [editingRequest, setEditingRequest] = React.useState<RepairRequestWithEquipment | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = React.useState(false);
  const [requestToDelete, setRequestToDelete] = React.useState<RepairRequestWithEquipment | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Detail dialog state
  const [requestToView, setRequestToView] = React.useState<RepairRequestWithEquipment | null>(null);

  // Edit form state
  const [editIssueDescription, setEditIssueDescription] = React.useState("");
  const [editRepairItems, setEditRepairItems] = React.useState("");
  const [editDesiredDate, setEditDesiredDate] = React.useState<Date | undefined>();
  const [editRepairUnit, setEditRepairUnit] = React.useState<'noi_bo' | 'thue_ngoai'>('noi_bo');
  const [editExternalCompanyName, setEditExternalCompanyName] = React.useState("");

  // Approval dialog state
  const [requestToApprove, setRequestToApprove] = React.useState<RepairRequestWithEquipment | null>(null);
  const [isApproving, setIsApproving] = React.useState(false);
  const [approvalRepairUnit, setApprovalRepairUnit] = React.useState<'noi_bo' | 'thue_ngoai'>('noi_bo');
  const [approvalExternalCompanyName, setApprovalExternalCompanyName] = React.useState("");

  // Completion dialog state
  const [requestToComplete, setRequestToComplete] = React.useState<RepairRequestWithEquipment | null>(null);
  const [completionType, setCompletionType] = React.useState<'Hoàn thành' | 'Không HT' | null>(null);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [completionResult, setCompletionResult] = React.useState("");
  const [nonCompletionReason, setNonCompletionReason] = React.useState("");

  // UI state
  const [showRequestsList, setShowRequestsList] = React.useState(false);

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "ngay_yeu_cau", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useSearchDebounce(searchTerm);

  // Regional leader facility filtering (server mode - matches Equipment page pattern)
  const { selectedFacilityId, setSelectedFacilityId } = useFacilityFilter({
    mode: 'server',
    userRole: (user?.role as string) || 'user',
  })

  // Backward compatibility: derive facility name and options from actual data
  const availableFacilities = React.useMemo(
    () => {
      const uniqueFacilities = new Map<number, string>();
      requests.forEach(r => {
        const facilityId = r.thiet_bi?.facility_id;
        const facilityName = r.thiet_bi?.facility_name;
        if (facilityId && facilityName) {
          uniqueFacilities.set(facilityId, facilityName);
        }
      });
      return Array.from(uniqueFacilities.values());
    },
    [requests]
  );

  const facilityOptions = React.useMemo(
    () => {
      const uniqueFacilities = new Map<number, string>();
      requests.forEach(r => {
        const facilityId = r.thiet_bi?.facility_id;
        const facilityName = r.thiet_bi?.facility_name;
        if (facilityId && facilityName) {
          uniqueFacilities.set(facilityId, facilityName);
        }
      });
      return Array.from(uniqueFacilities.entries()).map(([id, name]) => ({ id, name }));
    },
    [requests]
  );

  const selectedFacilityName = React.useMemo(() => {
    if (!selectedFacilityId) return null;
    const facility = facilityOptions.find(f => f.id === selectedFacilityId);
    return facility?.name ?? null;
  }, [selectedFacilityId, facilityOptions]);

  // Backward-compat aliases for existing UI code
  const selectedFacility = selectedFacilityName;

  // Memoize facility counts to prevent infinite re-renders
  const facilityCounts = React.useMemo(() => {
    const counts = new Map<number, number>();
    requests.forEach(r => {
      const facilityId = r.thiet_bi?.facility_id;
      if (facilityId) {
        counts.set(facilityId, (counts.get(facilityId) || 0) + 1);
      }
    });
    return counts;
  }, [requests]);

  // Align with repo roles: use 'global' instead of legacy 'admin'
  const canSetRepairUnit = !!user && ['global', 'to_qltb'].includes(user.role);
  // Regional leaders are read-only on this page (no create)
  const isRegionalLeader = !!user && user.role === 'regional_leader';
  // Show facility filter for regional leaders
  const showFacilityFilter = isRegionalLeader;

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

  // Force list view for regional leaders (no form creation allowed)
  React.useEffect(() => {
    if (isRegionalLeader) {
      setShowRequestsList(true)
    }
  }, [isRegionalLeader])

  const CACHE_KEY = 'repair_requests_data';

  const fetchRequests = React.useCallback(async () => {
    setIsLoading(true);

    // Unified cache key (tenant scoping enforced server-side)
    const cacheKey = CACHE_KEY;

    try {
      const cachedItemJSON = localStorage.getItem(cacheKey);
      if (cachedItemJSON) {
        const cachedItem = JSON.parse(cachedItemJSON);
        setRequests(cachedItem.data as RepairRequestWithEquipment[]);
        setIsLoading(false);
        // No return here, will still fetch in background to update
      }
    } catch (e) {
      console.error("Error reading cache for repair requests, fetching from network.", e);
      localStorage.removeItem(cacheKey);
    }

    try {
      // Fetch via RPC gateway with server-side facility filtering
      const data = await callRpc<any[]>({
        fn: 'repair_request_list',
        args: { 
          p_q: null, 
          p_status: null, 
          p_page: 1, 
          p_page_size: 5000,
          p_don_vi: selectedFacilityId // Server-side facility filter for regional leaders
        }
      })

      if (!data) {
        toast({
          variant: "destructive",
          title: "Lỗi tải danh sách yêu cầu",
          description: "Không thể tải danh sách yêu cầu.",
        });
        if (!localStorage.getItem(cacheKey)) {
          setRequests([]);
        }
      } else {
        const normalized: RepairRequestWithEquipment[] = (data || []).map((row: any) => ({
          id: row.id,
          thiet_bi_id: row.thiet_bi_id,
          ngay_yeu_cau: row.ngay_yeu_cau,
          trang_thai: row.trang_thai,
          mo_ta_su_co: row.mo_ta_su_co,
          hang_muc_sua_chua: row.hang_muc_sua_chua,
          ngay_mong_muon_hoan_thanh: row.ngay_mong_muon_hoan_thanh,
          nguoi_yeu_cau: row.nguoi_yeu_cau,
          ngay_duyet: row.ngay_duyet,
          ngay_hoan_thanh: row.ngay_hoan_thanh,
          nguoi_duyet: row.nguoi_duyet,
          nguoi_xac_nhan: row.nguoi_xac_nhan,
          don_vi_thuc_hien: row.don_vi_thuc_hien,
          ten_don_vi_thue: row.ten_don_vi_thue,
          ket_qua_sua_chua: row.ket_qua_sua_chua,
          ly_do_khong_hoan_thanh: row.ly_do_khong_hoan_thanh,
          thiet_bi: row.thiet_bi ? {
            ten_thiet_bi: row.thiet_bi.ten_thiet_bi,
            ma_thiet_bi: row.thiet_bi.ma_thiet_bi,
            model: row.thiet_bi.model ?? null,
            serial: row.thiet_bi.serial ?? null,
            khoa_phong_quan_ly: row.thiet_bi.khoa_phong_quan_ly ?? null,
            facility_name: row.thiet_bi.facility_name ?? null,
            facility_id: row.thiet_bi.facility_id ?? null,
          } : null,
        }))
        setRequests(normalized);
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ data }));
        } catch (e) {
          console.error("Error writing repair requests to localStorage", e);
        }
      }
    } catch (err: any) {
      console.error('Failed to load repair requests', err);
      toast({
        variant: 'destructive',
        title: 'Lỗi tải danh sách yêu cầu',
        description: err?.message || 'Không thể tải danh sách yêu cầu.',
      })
      if (!localStorage.getItem(cacheKey)) {
        setRequests([])
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast, user, selectedFacilityId]);

  const invalidateCacheAndRefetch = React.useCallback(() => {
    try {
      // Clear both general and department-specific cache
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error("Failed to invalidate repair requests cache", error);
    }
    fetchRequests();
  }, [fetchRequests]);

  const handleSelectEquipment = React.useCallback((equipment: EquipmentSelectItem) => {
    setSelectedEquipment(equipment);
    setSearchQuery(`${equipment.ten_thiet_bi} (${equipment.ma_thiet_bi})`);
  }, []);

  // Initial load: fetch a small equipment list via RPC, then load repair requests
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
      fetchRequests()
    }
    fetchInitialData()
  }, [toast, fetchRequests])

  // Support preselect by equipmentId query param using equipment_get RPC if needed
  React.useEffect(() => {
    const equipmentId = searchParams.get('equipmentId');
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
      try {
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
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Gửi yêu cầu thất bại",
          description: error?.message || 'Không thể tạo yêu cầu',
        });
      }
      if (true) {
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
      }
    } catch (error) {
      console.error("Repair request creation failed:", error);
      toast({
        variant: "destructive",
        title: "Lỗi hệ thống",
        description: "Không thể tạo yêu cầu sửa chữa. Vui lòng thử lại.",
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

  const getStatusVariant = (status: string | null) => {
    switch (status) {
      case 'Chờ xử lý': return 'destructive';
      case 'Đã duyệt': return 'secondary';
      case 'Hoàn thành': return 'default';
      case 'Không HT': return 'outline';
      default: return 'outline';
    }
  }

  const handleGenerateRequestSheet = (request: RepairRequestWithEquipment) => {
    // Use tenant branding if available, otherwise fall back to defaults
    const organizationName = branding?.name || "TRUNG TÂM KIỂM SOÁT BỆNH TẬT THÀNH PHỐ CẦN THƠ";
    const logoUrl = branding?.logo_url || "https://i.postimg.cc/26dHxmnV/89307731ad9526cb7f84-1-Photoroom.png";
    if (!request || !request.thiet_bi) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không đủ thông tin để tạo phiếu yêu cầu.",
      });
      return;
    }

    const formatValue = (value: any) => value ?? "";

    const requestDate = request.ngay_yeu_cau ? parseISO(request.ngay_yeu_cau) : new Date();
    const day = format(requestDate, 'dd');
    const month = format(requestDate, 'MM');
    const year = format(requestDate, 'yyyy');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Đề Nghị Sửa Chữa - ${formatValue(request.thiet_bi.ma_thiet_bi)}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
              body { font-family: 'Times New Roman', Times, serif; font-size: 14px; color: #000; line-height: 1.2; background-color: #e5e7eb; }
              .a4-page { width: 21cm; min-height: 29.7cm; padding: 1.5cm 2cm; margin: 1cm auto; background: white; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); position: relative; }
              .form-input-line { font-family: inherit; font-size: inherit; border: none; border-bottom: 1px dotted #000; background-color: transparent; padding: 2px 1px; outline: none; text-align: center; }
              .form-textarea { font-family: inherit; font-size: inherit; border: 1px dotted #000; background-color: transparent; padding: 8px; outline: none; width: 100%; resize: none; }
              .form-input-line:focus, .form-textarea:focus { border-style: solid; }
              h1, h2, h3, .font-bold { font-weight: 700; }
              .title-main { font-size: 20px; }
              .title-sub { font-size: 16px; }
              .signature-area { display: flex; flex-direction: column; align-items: center; }
              .signature-space { height: 65px; }
              .signature-name-input { border: none; background-color: transparent; text-align: center; font-weight: 700; width: 200px; }
              .signature-name-input:focus { outline: none; }
              .page-break { page-break-before: always; }
              .print-footer { position: absolute; bottom: 0; left: 0; right: 0; }
              @media print {
                  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: #e5e7eb !important; }
                  .a4-page { width: 21cm !important; height: 29.7cm !important; margin: 0 !important; padding: 1.5cm 2cm !important; box-shadow: none !important; border: none !important; position: relative !important; }
                  .page-break { page-break-before: always !important; }
                  .print-footer { position: absolute !important; bottom: 1.5cm !important; left: 2cm !important; right: 2cm !important; width: calc(100% - 4cm) !important; }
                  body > *:not(.a4-page) { display: none; }
                  .form-input-line, .form-textarea, input[type="date"] { border-bottom: 1px dotted #000 !important; }
                  .signature-name-input { border: none !important; }
                  .form-textarea { border: 1px dotted #000 !important; }
              }
          </style>
      </head>
      <body>
          <div class="a4-page">
              <header class="text-center mb-8">
                  <div class="flex justify-between items-start">
                      <div class="text-center">
                          <img src="${logoUrl}" alt="Logo" class="w-[70px] mx-auto mb-1" onerror="this.onerror=null;this.src='https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo';">
                      </div>
                      <div class="flex-grow">
                          <h2 class="title-sub uppercase font-bold">${organizationName}</h2>
                          <h1 class="title-main uppercase mt-4 font-bold">PHIẾU ĐỀ NGHỊ SỬA CHỮA THIẾT BỊ</h1>
                      </div>
                      <div class="w-16"></div> <!-- Spacer -->
                  </div>
                  <div class="flex items-baseline mt-6">
                      <label for="department-request" class="font-bold whitespace-nowrap">Khoa/Phòng đề nghị:</label>
                      <input type="text" id="department-request" class="form-input-line ml-2" value="${formatValue(request.thiet_bi.khoa_phong_quan_ly)}">
                  </div>
              </header>
              <section>
                  <h3 class="font-bold text-base">I. THÔNG TIN THIẾT BỊ</h3>
                  <div class="space-y-4 mt-3">
                      <div>
                          <label for="device-name" class="whitespace-nowrap">Tên thiết bị:</label>
                          <input type="text" id="device-name" class="form-input-line ml-2 w-full" value="${formatValue(request.thiet_bi.ten_thiet_bi)}">
                      </div>
                      <div class="grid grid-cols-3 gap-x-8">
                          <div class="flex items-baseline">
                              <label for="device-id" class="whitespace-nowrap">Mã TB:</label>
                              <input type="text" id="device-id" class="form-input-line ml-2" value="${formatValue(request.thiet_bi.ma_thiet_bi)}">
                          </div>
                          <div class="flex items-baseline">
                              <label for="model" class="whitespace-nowrap">Model:</label>
                              <input type="text" id="model" class="form-input-line ml-2" value="${formatValue(request.thiet_bi.model)}">
                          </div>
                          <div class="flex items-baseline">
                              <label for="serial-no" class="whitespace-nowrap">Serial N⁰:</label>
                              <input type="text" id="serial-no" class="form-input-line ml-2" value="${formatValue(request.thiet_bi.serial)}">
                          </div>
                      </div>
                      <div>
                          <label for="damage-description" class="block">Mô tả sự cố của thiết bị:</label>
                          <textarea id="damage-description" rows="1" class="form-textarea mt-1">${formatValue(request.mo_ta_su_co)}</textarea>
                      </div>
                      <div>
                          <label for="repair-request" class="block">Các hạng mục yêu cầu sửa chữa:</label>
                          <textarea id="repair-request" rows="1" class="form-textarea mt-1">${formatValue(request.hang_muc_sua_chua)}</textarea>
                      </div>
                      <div class="flex items-baseline">
                          <label for="completion-date" class="whitespace-nowrap">Ngày mong muốn hoàn thành (nếu có):</label>
                          <input type="date" id="completion-date" class="form-input-line ml-2" value="${formatValue(request.ngay_mong_muon_hoan_thanh)}">
                      </div>
                      
                      
                  </div>
              </section>
              <div class="mt-8">
                  <div class="flex justify-end mb-4">
                      <p class="italic">Cần Thơ, ngày <input type="text" class="w-8 form-input-line inline-block text-center" value="${day}"> tháng <input type="text" class="w-8 form-input-line inline-block text-center" value="${month}"> năm <input type="text" class="w-12 form-input-line inline-block text-center" value="${year}"></p>
                  </div>
                  <div class="flex justify-around">
                      <div class="signature-area">
                          <p class="font-bold">Lãnh đạo Khoa/phòng</p>
                          <div class="signature-space"></div>
                          <input type="text" id="leader-name" class="signature-name-input">
                      </div>
                      <div class="signature-area">
                          <p class="font-bold">Người đề nghị</p>
                          <div class="signature-space"></div>
                          <input type="text" id="requester-name" class="signature-name-input" value="${formatValue(request.nguoi_yeu_cau)}">
                      </div>
                  </div>
              </div>
              <section class="mt-6 border-t-2 border-dashed border-gray-400 pt-6">
                  <h3 class="font-bold text-base">II. BỘ PHẬN SỬA CHỮA</h3>
                  <div class="mt-4 flex items-center space-x-10">
                      <label class="flex items-center">
                          <input type="checkbox" class="h-4 w-4">
                          <span class="ml-2">Tự sửa chữa được</span>
                      </label>
                      <label class="flex items-center">
                          <input type="checkbox" class="h-4 w-4">
                          <span class="ml-2">Không tự sửa chữa được</span>
                      </label>
                  </div>
                  <div class="mt-4">
                      <label for="tbyt-opinion" class="block">Ý kiến của Tổ Quản lý TBYT:</label>
                      <input type='text' id="tbyt-opinion" class="form-input-line ml-2 min-w-[400px]" value="${request.don_vi_thuc_hien === 'noi_bo' ? 'Tự sửa chữa nội bộ' : request.don_vi_thuc_hien === 'thue_ngoai' && request.ten_don_vi_thue ? `Thuê đơn vị ${request.ten_don_vi_thue} sửa chữa` : ''}">
                  </div>
              </section>
              <div class="mt-8 flex justify-around">
                  <div class="signature-area">
                      <p class="font-bold">Tổ Quản lý TBYT</p>
                      <div class="signature-space"></div>
                      <input type="text" id="tbyt-name" class="signature-name-input">
                  </div>
                  <div class="signature-area">
                      <p class="font-bold">Người sửa chữa</p>
                      <div class="signature-space"></div>
                      <input type="text" id="repairer-name" class="signature-name-input">
                  </div>
              </div>
          </div>

          <!-- Page 2: Repair Result Form -->
          <div class="a4-page page-break">
              <div class="content-body">
                  <!-- Header -->
                  <header class="text-center mb-8">
                      <div class="flex items-center">
                          <div class="text-center">
                              <img src="${logoUrl}" alt="Logo" class="w-[70px] mx-auto mb-1" onerror="this.onerror=null;this.src='https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo';">
                          </div>
                          <div class="flex-grow">
                              <h2 class="title-sub uppercase font-bold">${organizationName}</h2>
                          </div>
                          <div class="w-16"></div> <!-- Spacer -->
                      </div>
                  </header>

                  <!-- Main Content -->
                  <main class="mt-8">
                      <h3 class="text-base font-bold">III. KẾT QUẢ, TÌNH TRẠNG THIẾT BỊ SAU KHI XỬ LÝ</h3>
                      <div class="mt-4">
                          <textarea class="form-textarea" rows="5" placeholder="Nhập kết quả và tình trạng thiết bị...">${request.ket_qua_sua_chua || request.ly_do_khong_hoan_thanh || ''}</textarea>
                      </div>
                  </main>

                  <!-- Signature section -->
                  <section class="mt-8">
                       <div class="flex justify-end mb-4">
                           <p class="italic">
                              Cần Thơ, ngày <input type="text" class="form-input-line w-12" value="${day}">
                              tháng <input type="text" class="form-input-line w-12" value="${month}">
                              năm <input type="text" class="form-input-line w-20" value="${year}">
                          </p>
                      </div>
                       <div class="flex justify-around">
                          <div class="signature-area w-1/2">
                              <p class="font-bold">Tổ Quản lý TBYT</p>
                              <p class="italic">(Ký, ghi rõ họ, tên)</p>
                              <div class="signature-space"></div>
                              <input type="text" class="signature-name-input" placeholder="(Họ và tên)">
                          </div>
                          <div class="signature-area w-1/2">
                               <p class="font-bold">Người đề nghị</p>
                               <p class="italic">(Ký, ghi rõ họ, tên)</p>
                               <div class="signature-space"></div>
                               <input type="text" class="signature-name-input" placeholder="(Họ và tên)" value="${formatValue(request.nguoi_yeu_cau)}">
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
  }

  const renderActions = (request: RepairRequestWithEquipment) => {
    if (!user) return null;
    // Regional leaders are read-only, hide all actions
    if (isRegionalLeader) return null;
    const canManage = user.role === 'global' || user.role === 'admin' || user.role === 'to_qltb';

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 touch-target-sm md:h-8 md:w-8">
            <span className="sr-only">Mở menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Hành động</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleGenerateRequestSheet(request)}>
            Xem phiếu yêu cầu
          </DropdownMenuItem>

          {request.trang_thai === 'Chờ xử lý' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setEditingRequest(request)}>
                <Edit className="mr-2 h-4 w-4" />
                Sửa
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRequestToDelete(request)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Xoá
              </DropdownMenuItem>
            </>
          )}

          {canManage && (
            <>
              <DropdownMenuSeparator />
              {request.trang_thai === 'Chờ xử lý' && (
                <DropdownMenuItem onClick={() => handleApproveRequest(request)}>
                  Duyệt
                </DropdownMenuItem>
              )}
              {request.trang_thai === 'Đã duyệt' && (
                <>
                  <DropdownMenuItem onClick={() => handleCompletion(request, 'Hoàn thành')}>
                    Hoàn thành
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCompletion(request, 'Không HT')}>
                    Không hoàn thành
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const columns: ColumnDef<RepairRequestWithEquipment>[] = [
    // 1. Thiết bị (với mô tả sự cố)
    {
      accessorFn: (row) => {
        // Safe null-checking to prevent "undefined undefined" in sorting/filtering
        const parts: string[] = [];
        if (row.thiet_bi?.ten_thiet_bi) {
          parts.push(String(row.thiet_bi.ten_thiet_bi));
        }
        if (row.mo_ta_su_co) {
          parts.push(String(row.mo_ta_su_co));
        }
        return parts.join(' ').trim() || 'N/A';
      },
      id: 'thiet_bi_va_mo_ta',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Thiết bị
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const request = row.original
        return (
          <div>
            <div className="font-medium">{request.thiet_bi?.ten_thiet_bi || 'N/A'}</div>
            <div className="text-sm text-muted-foreground truncate max-w-xs">{request.mo_ta_su_co}</div>
          </div>
        )
      },
      sortingFn: (rowA, rowB) => {
        const nameA = rowA.original.thiet_bi?.ten_thiet_bi || '';
        const nameB = rowB.original.thiet_bi?.ten_thiet_bi || '';
        return nameA.localeCompare(nameB);
      }
    },
    // 2. Người yêu cầu
    {
      accessorKey: "nguoi_yeu_cau",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Người yêu cầu
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const nguoiYeuCau = row.getValue("nguoi_yeu_cau") as string | null;
        return (
          <div className="text-sm">
            {nguoiYeuCau || <span className="text-muted-foreground italic">N/A</span>}
          </div>
        );
      },
    },
    // 3. Ngày yêu cầu
    {
      accessorKey: "ngay_yeu_cau",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Ngày yêu cầu
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="text-sm">{format(parseISO(row.getValue("ngay_yeu_cau")), 'dd/MM/yyyy HH:mm', { locale: vi })}</div>,
    },
    // 4. Ngày mong muốn hoàn thành
    {
      accessorKey: "ngay_mong_muon_hoan_thanh",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Ngày mong muốn HT
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const ngayMongMuon = row.getValue("ngay_mong_muon_hoan_thanh") as string | null;
        const request = row.original;

        if (!ngayMongMuon) {
          return (
            <div className="text-sm">
              <span className="text-muted-foreground italic">Không có</span>
            </div>
          );
        }

        // Chỉ hiển thị progress bar cho yêu cầu chưa hoàn thành
        const isCompleted = request.trang_thai === 'Hoàn thành' || request.trang_thai === 'Không HT';
        const daysInfo = !isCompleted ? calculateDaysRemaining(ngayMongMuon) : null;

        return (
          <div className="space-y-1">
            <div className="text-sm font-medium">
              {format(parseISO(ngayMongMuon), 'dd/MM/yyyy', { locale: vi })}
            </div>
            {daysInfo && (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${daysInfo.color} transition-all duration-300`}
                    style={{
                      width: daysInfo.days > 0
                        ? `${Math.min(100, Math.max(10, (daysInfo.days / 14) * 100))}%`
                        : '100%'
                    }}
                  />
                </div>
                <span className={`text-xs font-medium ${
                  daysInfo.status === 'success' ? 'text-green-600' :
                  daysInfo.status === 'warning' ? 'text-orange-600' : 'text-red-600'
                }`}>
                  {daysInfo.text}
                </span>
              </div>
            )}
          </div>
        );
      },
    },
    // 5. Trạng thái
    {
      accessorKey: "trang_thai",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Trạng thái
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const request = row.original
        return (
          <div className="flex flex-col gap-1">
            <Badge variant={getStatusVariant(request.trang_thai)} className="self-start">{request.trang_thai}</Badge>
            {request.trang_thai === 'Đã duyệt' && request.ngay_duyet && (
              <div className="text-xs text-muted-foreground">
                {format(parseISO(request.ngay_duyet), 'dd/MM/yyyy HH:mm', { locale: vi })}
                {request.nguoi_duyet && (
                  <div className="text-blue-600 font-medium">Duyệt bởi: {request.nguoi_duyet}</div>
                )}
              </div>
            )}
            {(request.trang_thai === 'Hoàn thành' || request.trang_thai === 'Không HT') && request.ngay_hoan_thanh && (
              <div className="text-xs text-muted-foreground">
                {format(parseISO(request.ngay_hoan_thanh), 'dd/MM/yyyy HH:mm', { locale: vi })}
                {request.nguoi_xac_nhan && (
                  <div className="text-green-600 font-medium">Xác nhận bởi: {request.nguoi_xac_nhan}</div>
                )}
              </div>
            )}
          </div>
        )
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          {renderActions(row.original)}
        </div>
      ),
    },
  ];

  // Use data from server (already filtered by facility if selected)
  const tableData = requests;

  // Create stable key for table to force remount when filter changes (prevents state corruption)
  const tableKey = React.useMemo(() => {
    return `${selectedFacilityId || 'all'}_${tableData.length}`;
  }, [selectedFacilityId, tableData.length]);

  // Debug logging for regional leader feature
  React.useEffect(() => {
    if (isRegionalLeader) {
      console.log('[Regional Leader Debug]', {
        role: user?.role,
        isRegionalLeader,
        requestsCount: requests.length,
        availableFacilitiesCount: availableFacilities.length,
        availableFacilities,
        sampleRequest: requests[0]
      });
    }
  }, [isRegionalLeader, requests.length, availableFacilities.length, user?.role]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: debouncedSearch,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: (value: string) => setSearchTerm(value),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const isFiltered = table.getState().columnFilters.length > 0 || debouncedSearch.length > 0;

  return (
    <>
      {editingRequest && (
        <Dialog open={!!editingRequest} onOpenChange={(open) => !open && setEditingRequest(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sửa yêu cầu sửa chữa</DialogTitle>
              <DialogDescription>
                Cập nhật thông tin cho yêu cầu của thiết bị: {editingRequest.thiet_bi?.ten_thiet_bi}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 mobile-card-spacing">
              <div className="space-y-2">
                <Label htmlFor="edit-issue">Mô tả sự cố</Label>
                <Textarea
                  id="edit-issue"
                  placeholder="Mô tả chi tiết vấn đề gặp phải..."
                  rows={4}
                  value={editIssueDescription}
                  onChange={(e) => setEditIssueDescription(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-repair-items">Các hạng mục yêu cầu sửa chữa</Label>
                <Textarea
                  id="edit-repair-items"
                  placeholder="VD: Thay màn hình, sửa nguồn..."
                  rows={3}
                  value={editRepairItems}
                  onChange={(e) => setEditRepairItems(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Ngày mong muốn hoàn thành (nếu có)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal touch-target",
                        !editDesiredDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editDesiredDate ? format(editDesiredDate, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={editDesiredDate}
                      onSelect={setEditDesiredDate}
                      initialFocus
                      disabled={(date) => {
                        const requestDate = editingRequest?.ngay_yeu_cau
                          ? new Date(editingRequest.ngay_yeu_cau)
                          : new Date();
                        return date < new Date(requestDate.setHours(0, 0, 0, 0));
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {canSetRepairUnit && (
                <div className="space-y-2">
                  <Label htmlFor="edit-repair-unit">Đơn vị thực hiện</Label>
                  <Select value={editRepairUnit} onValueChange={(value: 'noi_bo' | 'thue_ngoai') => setEditRepairUnit(value)}>
                    <SelectTrigger className="touch-target">
                      <SelectValue placeholder="Chọn đơn vị thực hiện" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="noi_bo">Nội bộ</SelectItem>
                      <SelectItem value="thue_ngoai">Thuê ngoài</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {canSetRepairUnit && editRepairUnit === 'thue_ngoai' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-external-company">Tên đơn vị được thuê</Label>
                  <Input
                    id="edit-external-company"
                    placeholder="Nhập tên đơn vị được thuê sửa chữa..."
                    value={editExternalCompanyName}
                    onChange={(e) => setEditExternalCompanyName(e.target.value)}
                    required
                    className="touch-target"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRequest(null)} disabled={isEditSubmitting} className="touch-target">Hủy</Button>
              <Button onClick={handleUpdateRequest} disabled={isEditSubmitting} className="touch-target">
                {isEditSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {requestToDelete && (
        <AlertDialog open={!!requestToDelete} onOpenChange={(open) => !open && setRequestToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
              <AlertDialogDescription>
                Hành động này không thể hoàn tác. Yêu cầu sửa chữa cho thiết bị
                <strong> {requestToDelete.thiet_bi?.ten_thiet_bi} </strong>
                sẽ bị xóa vĩnh viễn.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteRequest} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {requestToApprove && (
        <Dialog open={!!requestToApprove} onOpenChange={(open) => !open && setRequestToApprove(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Duyệt yêu cầu sửa chữa</DialogTitle>
              <DialogDescription>
                Duyệt yêu cầu sửa chữa cho thiết bị <strong>{requestToApprove.thiet_bi?.ten_thiet_bi}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {requestToApprove.nguoi_duyet && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm font-medium text-blue-800">Đã được duyệt bởi:</div>
                  <div className="text-sm text-blue-600">{requestToApprove.nguoi_duyet}</div>
                  {requestToApprove.ngay_duyet && (
                    <div className="text-xs text-blue-500">
                      {format(parseISO(requestToApprove.ngay_duyet), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </div>
                  )}
                </div>
              )}
              <div>
                <Label htmlFor="approval-repair-unit">Đơn vị thực hiện</Label>
                <Select value={approvalRepairUnit} onValueChange={(value: 'noi_bo' | 'thue_ngoai') => setApprovalRepairUnit(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="noi_bo">Nội bộ</SelectItem>
                    <SelectItem value="thue_ngoai">Thuê ngoài</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {approvalRepairUnit === 'thue_ngoai' && (
                <div>
                  <Label htmlFor="approval-external-company">Tên đơn vị thực hiện sửa chữa</Label>
                  <Input
                    id="approval-external-company"
                    value={approvalExternalCompanyName}
                    onChange={(e) => setApprovalExternalCompanyName(e.target.value)}
                    placeholder="Nhập tên đơn vị được thuê sửa chữa"
                    disabled={isApproving}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestToApprove(null)} disabled={isApproving}>
                Hủy
              </Button>
              <Button onClick={handleConfirmApproval} disabled={isApproving}>
                {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xác nhận duyệt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {requestToComplete && (
        <Dialog open={!!requestToComplete} onOpenChange={(open) => !open && setRequestToComplete(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {completionType === 'Hoàn thành' ? 'Ghi nhận hoàn thành sửa chữa' : 'Ghi nhận không hoàn thành'}
              </DialogTitle>
              <DialogDescription>
                {completionType === 'Hoàn thành'
                  ? `Ghi nhận kết quả sửa chữa cho thiết bị ${requestToComplete.thiet_bi?.ten_thiet_bi}`
                  : `Ghi nhận lý do không hoàn thành sửa chữa cho thiết bị ${requestToComplete.thiet_bi?.ten_thiet_bi}`
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {requestToComplete.nguoi_xac_nhan && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm font-medium text-green-800">Đã được xác nhận bởi:</div>
                  <div className="text-sm text-green-600">{requestToComplete.nguoi_xac_nhan}</div>
                  {requestToComplete.ngay_hoan_thanh && (
                    <div className="text-xs text-green-500">
                      {format(parseISO(requestToComplete.ngay_hoan_thanh), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </div>
                  )}
                </div>
              )}
              {completionType === 'Hoàn thành' ? (
                <div>
                  <Label htmlFor="completion-result">Kết quả sửa chữa</Label>
                  <Textarea
                    id="completion-result"
                    value={completionResult}
                    onChange={(e) => setCompletionResult(e.target.value)}
                    placeholder="Nhập kết quả và tình trạng thiết bị sau khi sửa chữa..."
                    rows={4}
                    disabled={isCompleting}
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="non-completion-reason">Lý do không hoàn thành</Label>
                  <Textarea
                    id="non-completion-reason"
                    value={nonCompletionReason}
                    onChange={(e) => setNonCompletionReason(e.target.value)}
                    placeholder="Nhập lý do không thể hoàn thành sửa chữa..."
                    rows={4}
                    disabled={isCompleting}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestToComplete(null)} disabled={isCompleting}>
                Hủy
              </Button>
              <Button onClick={handleConfirmCompletion} disabled={isCompleting}>
                {isCompleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {completionType === 'Hoàn thành' ? 'Xác nhận hoàn thành' : 'Xác nhận không hoàn thành'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Request Detail Dialog */}
      {requestToView && (
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
              <div className="space-y-6 py-4">
                {/* Equipment Information */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground border-b pb-2">
                    Thông tin thiết bị
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Tên thiết bị</Label>
                      <div className="text-sm font-medium">{requestToView.thiet_bi?.ten_thiet_bi || 'N/A'}</div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Mã thiết bị</Label>
                      <div className="text-sm">{requestToView.thiet_bi?.ma_thiet_bi || 'N/A'}</div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Model</Label>
                      <div className="text-sm">{requestToView.thiet_bi?.model || 'N/A'}</div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Serial</Label>
                      <div className="text-sm">{requestToView.thiet_bi?.serial || 'N/A'}</div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-sm font-medium text-muted-foreground">Khoa/Phòng quản lý</Label>
                      <div className="text-sm">{requestToView.thiet_bi?.khoa_phong_quan_ly || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                {/* Request Information */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground border-b pb-2">
                    Thông tin yêu cầu
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Trạng thái</Label>
                      <Badge variant={getStatusVariant(requestToView.trang_thai)} className="w-fit">
                        {requestToView.trang_thai}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Ngày yêu cầu</Label>
                      <div className="text-sm">
                        {format(parseISO(requestToView.ngay_yeu_cau), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Người yêu cầu</Label>
                      <div className="text-sm">{requestToView.nguoi_yeu_cau || 'N/A'}</div>
                    </div>
                    {requestToView.ngay_mong_muon_hoan_thanh && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Ngày mong muốn hoàn thành</Label>
                        <div className="text-sm">
                          {format(parseISO(requestToView.ngay_mong_muon_hoan_thanh), 'dd/MM/yyyy', { locale: vi })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Mô tả sự cố</Label>
                    <div className="text-sm bg-muted/50 p-3 rounded-md whitespace-pre-wrap break-words">
                      {requestToView.mo_ta_su_co}
                    </div>
                  </div>

                  {requestToView.hang_muc_sua_chua && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Hạng mục sửa chữa</Label>
                      <div className="text-sm bg-muted/50 p-3 rounded-md whitespace-pre-wrap break-words">
                        {requestToView.hang_muc_sua_chua}
                      </div>
                    </div>
                  )}
                </div>

                {/* Execution Information */}
                {(requestToView.don_vi_thuc_hien || requestToView.ten_don_vi_thue) && (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-foreground border-b pb-2">
                      Thông tin thực hiện
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {requestToView.don_vi_thuc_hien && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-muted-foreground">Đơn vị thực hiện</Label>
                          <Badge variant="outline" className="w-fit">
                            {requestToView.don_vi_thuc_hien === 'noi_bo' ? 'Nội bộ' : 'Thuê ngoài'}
                          </Badge>
                        </div>
                      )}
                      {requestToView.ten_don_vi_thue && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-muted-foreground">Tên đơn vị thuê</Label>
                          <div className="text-sm break-words">{requestToView.ten_don_vi_thue}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Approval Information */}
                {(requestToView.ngay_duyet || requestToView.nguoi_duyet) && (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-foreground border-b pb-2">
                      Thông tin phê duyệt
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {requestToView.nguoi_duyet && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-muted-foreground">Người duyệt</Label>
                          <div className="text-sm break-words">{requestToView.nguoi_duyet}</div>
                        </div>
                      )}
                      {requestToView.ngay_duyet && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-muted-foreground">Ngày duyệt</Label>
                          <div className="text-sm">
                            {format(parseISO(requestToView.ngay_duyet), 'dd/MM/yyyy HH:mm', { locale: vi })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Completion Information */}
                {(requestToView.ngay_hoan_thanh || requestToView.ket_qua_sua_chua || requestToView.ly_do_khong_hoan_thanh || requestToView.nguoi_xac_nhan) && (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-foreground border-b pb-2">
                      Thông tin hoàn thành
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {requestToView.nguoi_xac_nhan && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-muted-foreground">Người xác nhận</Label>
                          <div className="text-sm break-words">{requestToView.nguoi_xac_nhan}</div>
                        </div>
                      )}
                      {requestToView.ngay_hoan_thanh && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-muted-foreground">Ngày hoàn thành</Label>
                          <div className="text-sm">
                            {format(parseISO(requestToView.ngay_hoan_thanh), 'dd/MM/yyyy HH:mm', { locale: vi })}
                          </div>
                        </div>
                      )}
                    </div>

                    {requestToView.ket_qua_sua_chua && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Kết quả sửa chữa</Label>
                        <div className="text-sm bg-green-50 border border-green-200 p-3 rounded-md whitespace-pre-wrap break-words">
                          {requestToView.ket_qua_sua_chua}
                        </div>
                      </div>
                    )}

                    {requestToView.ly_do_khong_hoan_thanh && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Lý do không hoàn thành</Label>
                        <div className="text-sm bg-red-50 border border-red-200 p-3 rounded-md whitespace-pre-wrap break-words">
                          {requestToView.ly_do_khong_hoan_thanh}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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

      {/* Repair Request Alert */}
      <RepairRequestAlert requests={requests} />

      <div className="space-y-6">
  {/* Primary Action: Create Repair Request Form */}
  {!isRegionalLeader && (
  <div className="w-full max-w-2xl mx-auto">
          <Card className="border-2 border-primary/20 shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <PlusCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="heading-responsive-h2">Tạo yêu cầu sửa chữa</CardTitle>
                  <CardDescription className="body-responsive-sm">
                    Điền thông tin bên dưới để gửi yêu cầu mới.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="mobile-card-spacing">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search-equipment">Thiết bị</Label>
                  <div className="relative">
                    <Input
                      id="search-equipment"
                      placeholder={"Nhập tên hoặc mã để tìm kiếm..."}
                      value={searchQuery}
                      onChange={handleSearchChange}
                      autoComplete="off"
                      required
                    />
                    {filteredEquipment.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-1">
                          {filteredEquipment.map((equipment) => (
                            <div
                              key={equipment.id}
                              className="text-sm mobile-interactive hover:bg-accent rounded-sm cursor-pointer touch-target-sm"
                              onClick={() => handleSelectEquipment(equipment)}
                            >
                              <div className="font-medium">{equipment.ten_thiet_bi}</div>
                              <div className="text-xs text-muted-foreground">
                                {equipment.ma_thiet_bi}
                                {equipment.khoa_phong_quan_ly && (
                                  <span className="ml-2 text-blue-600">• {equipment.khoa_phong_quan_ly}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {shouldShowNoResults && (
                      <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg p-3">
                        <div className="text-sm text-muted-foreground text-center">
                          Không tìm thấy kết quả phù hợp
                        </div>
                      </div>
                    )}
                  </div>
                  {selectedEquipment && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                      <Check className="h-3.5 w-3.5 text-green-600" />
                      <span>Đã chọn: {selectedEquipment.ten_thiet_bi} ({selectedEquipment.ma_thiet_bi})</span>
                    </p>
                  )}
                  
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issue">Mô tả sự cố</Label>
                  <Textarea
                    id="issue"
                    placeholder="Mô tả chi tiết vấn đề gặp phải..."
                    rows={4}
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repair-items">Các hạng mục yêu cầu sửa chữa</Label>
                  <Textarea
                    id="repair-items"
                    placeholder="VD: Thay màn hình, sửa nguồn..."
                    rows={3}
                    value={repairItems}
                    onChange={(e) => setRepairItems(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ngày mong muốn hoàn thành (nếu có)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal touch-target",
                          !desiredDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {desiredDate ? format(desiredDate, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={desiredDate}
                        onSelect={setDesiredDate}
                        initialFocus
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {canSetRepairUnit && (
                  <div className="space-y-2">
                    <Label htmlFor="repair-unit">Đơn vị thực hiện</Label>
                    <Select value={repairUnit} onValueChange={(value: 'noi_bo' | 'thue_ngoai') => setRepairUnit(value)}>
                      <SelectTrigger className="touch-target">
                        <SelectValue placeholder="Chọn đơn vị thực hiện" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="noi_bo">Nội bộ</SelectItem>
                        <SelectItem value="thue_ngoai">Thuê ngoài</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {canSetRepairUnit && repairUnit === 'thue_ngoai' && (
                  <div className="space-y-2">
                    <Label htmlFor="external-company">Tên đơn vị được thuê</Label>
                    <Input
                      id="external-company"
                      placeholder="Nhập tên đơn vị được thuê sửa chữa..."
                      value={externalCompanyName}
                      onChange={(e) => setExternalCompanyName(e.target.value)}
                      required
                      className="touch-target"
                    />
                  </div>
                )}

                <Button type="submit" className="w-full touch-target" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Toggle Button for Requests List */}
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              onClick={() => setShowRequestsList(!showRequestsList)}
              className="touch-target gap-2 toggle-button w-full max-w-sm md:w-auto"
            >
              {showRequestsList ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  <span className="button-text-responsive">Ẩn danh sách yêu cầu</span>
                </>
              ) : (
                <>
                  <History className="h-4 w-4" />
                  <span className="button-text-responsive">
                    <span className="hidden sm:inline">Xem danh sách yêu cầu</span>
                    <span className="sm:hidden">Xem yêu cầu</span>
                    {requests.length > 0 && ` (${requests.length})`}
                  </span>
                </>
              )}
            </Button>
          </div>

          {/* Visual indicator when requests list is hidden */}
          {!showRequestsList && requests.length > 0 && (
            <div className="text-center mt-4">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="caption-responsive">
                  {requests.length} yêu cầu sửa chữa đã ghi nhận
                </span>
              </div>
            </div>
          )}
  </div>
  )}

        {/* Secondary Action: View Existing Requests */}
        {(showRequestsList || isRegionalLeader) && (
          <div className="w-full collapsible-enter">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="heading-responsive-h2">Tổng hợp các yêu cầu sửa chữa thiết bị</CardTitle>
                <CardDescription className="body-responsive-sm">
                  Tất cả các yêu cầu sửa chữa đã được ghi nhận.
                </CardDescription>

                {/* Facility filter for regional leaders */}
                {isRegionalLeader && (
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
                    {!selectedFacility && availableFacilities.length > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="shrink-0 cursor-help">
                              {availableFacilities.length} cơ sở • {requests.length} yêu cầu
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
                <div className="flex items-center justify-between gap-2 flex-wrap mb-3 md:mb-4">
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      placeholder="Tìm thiết bị, mô tả..."
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="h-8 w-[120px] md:w-[200px] lg:w-[250px] touch-target-sm md:h-8"
                    />

                    {/* Desktop: Show filters inline */}
                    {!isMobile && (
                      <>
                        <DataTableFacetedFilter
                          column={table.getColumn("trang_thai")}
                          title="Trạng thái"
                          options={requestStatuses.map(s => ({ label: s, value: s }))}
                        />
                      </>
                    )}

                    {/* Mobile: Show filters in dropdown */}
                    {isMobile && (
                      <MobileFiltersDropdown
                        activeFiltersCount={
                          ((table.getColumn("trang_thai")?.getFilterValue() as string[])?.length || 0)
                        }
                        onClearFilters={() => {
                          table.getColumn("trang_thai")?.setFilterValue([])
                        }}
                      >
                        <DataTableFacetedFilter
                          column={table.getColumn("trang_thai")}
                          title="Trạng thái"
                          options={requestStatuses.map(s => ({ label: s, value: s }))}
                        />
                      </MobileFiltersDropdown>
                    )}

                    {/* Clear all filters button */}
                    {isFiltered && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          table.resetColumnFilters();
                          setSearchTerm("");
                        }}
                        className="h-8 px-2 lg:px-3 touch-target-sm md:h-8"
                      >
                        <span className="hidden sm:inline">Xóa</span>
                        <FilterX className="h-4 w-4 sm:ml-2" />
                      </Button>
                    )}
                  </div>
                </div>
                {/* Mobile Card View */}
                {isMobile ? (
                  <div className="space-y-3">
                    {isLoading ? (
                      <div className="flex justify-center items-center gap-2 py-6">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Đang tải...</span>
                      </div>
                    ) : table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => {
                        const request = row.original;
                        return (
                          <Card
                            key={request.id}
                            className="mobile-repair-card cursor-pointer hover:bg-muted/50"
                            onClick={() => setRequestToView(request)}
                          >
                            <CardHeader className="mobile-repair-card-header flex flex-row items-start justify-between">
                              <div className="flex-1 min-w-0 pr-2">
                                <CardTitle className="mobile-repair-card-title truncate line-clamp-1">
                                  {request.thiet_bi?.ten_thiet_bi || 'N/A'}
                                </CardTitle>
                                <CardDescription className="mobile-repair-card-description truncate">
                                  {request.thiet_bi?.ma_thiet_bi || 'N/A'}
                                </CardDescription>
                              </div>
                              <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                {renderActions(request)}
                              </div>
                            </CardHeader>
                            <CardContent className="mobile-repair-card-content">
                              {/* Người yêu cầu */}
                              {request.nguoi_yeu_cau && (
                                <div className="mobile-repair-card-field">
                                  <span className="mobile-repair-card-label">Người yêu cầu</span>
                                  <span className="mobile-repair-card-value">{request.nguoi_yeu_cau}</span>
                                </div>
                              )}

                              {/* Ngày yêu cầu */}
                              <div className="mobile-repair-card-field">
                                <span className="mobile-repair-card-label">Ngày yêu cầu</span>
                                <span className="mobile-repair-card-value">
                                  {format(parseISO(request.ngay_yeu_cau), 'dd/MM/yyyy', { locale: vi })}
                                </span>
                              </div>

                              {/* Ngày mong muốn hoàn thành */}
                              {request.ngay_mong_muon_hoan_thanh && (
                                <div className="space-y-2">
                                  <div className="mobile-repair-card-field">
                                    <span className="mobile-repair-card-label">Ngày mong muốn HT</span>
                                    <span className="mobile-repair-card-value">
                                      {format(parseISO(request.ngay_mong_muon_hoan_thanh), 'dd/MM/yyyy', { locale: vi })}
                                    </span>
                                  </div>
                                  {(() => {
                                    // Chỉ hiển thị progress bar cho yêu cầu chưa hoàn thành
                                    const isCompleted = request.trang_thai === 'Hoàn thành' || request.trang_thai === 'Không HT';
                                    const daysInfo = !isCompleted ? calculateDaysRemaining(request.ngay_mong_muon_hoan_thanh) : null;
                                    return daysInfo && (
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                          <div
                                            className={`h-2 rounded-full ${daysInfo.color} transition-all duration-300`}
                                            style={{
                                              width: daysInfo.days > 0
                                                ? `${Math.min(100, Math.max(10, (daysInfo.days / 14) * 100))}%`
                                                : '100%'
                                            }}
                                          />
                                        </div>
                                        <span className={`text-xs font-medium ${
                                          daysInfo.status === 'success' ? 'text-green-600' :
                                          daysInfo.status === 'warning' ? 'text-orange-600' : 'text-red-600'
                                        }`}>
                                          {daysInfo.text}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* Trạng thái */}
                              <div className="mobile-repair-card-field">
                                <span className="mobile-repair-card-label">Trạng thái</span>
                                <Badge variant={getStatusVariant(request.trang_thai)} className="text-xs">
                                  {request.trang_thai}
                                </Badge>
                              </div>

                              {/* Mô tả sự cố */}
                              <div className="space-y-1">
                                <span className="mobile-repair-card-label">Mô tả sự cố:</span>
                                <p className="mobile-repair-card-value text-left text-xs leading-relaxed line-clamp-2">{request.mo_ta_su_co}</p>
                              </div>

                              {/* Hạng mục sửa chữa (optional) */}
                              {request.hang_muc_sua_chua && (
                                <div className="space-y-1">
                                  <span className="mobile-repair-card-label">Hạng mục sửa chữa:</span>
                                  <p className="mobile-repair-card-value text-left text-xs leading-relaxed line-clamp-2">{request.hang_muc_sua_chua}</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })
                    ) : (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        Không có kết quả.
                      </div>
                    )}
                  </div>
                ) : (
                  /* Desktop Table View */
                  <div key={tableKey} className="rounded-md border">
                    <Table>
                      <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
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
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                              <div className="flex justify-center items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Đang tải...</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : table.getRowModel().rows?.length ? (
                          table.getRowModel().rows.map((row) => (
                            <TableRow
                              key={row.id}
                              data-state={row.getIsSelected() && "selected"}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setRequestToView(row.original)}
                            >
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
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
                )}
              </CardContent>
              <CardFooter>
                <div className="flex items-center justify-between w-full">
                  <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} trên {requests.length} yêu cầu.
                  </div>
                  <div className="flex items-center space-x-6 lg:space-x-8">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium">Số dòng</p>
                      <Select
                        value={`${table.getState().pagination.pageSize}`}
                        onValueChange={(value) => {
                          table.setPageSize(Number(value))
                        }}
                      >
                        <SelectTrigger className="h-8 w-[70px] touch-target-sm md:h-8">
                          <SelectValue placeholder={table.getState().pagination.pageSize} />
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
                      Trang {table.getState().pagination.pageIndex + 1} /{" "}
                      {table.getPageCount()}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex touch-target-sm md:h-8 md:w-8"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                      >
                        <span className="sr-only">Go to first page</span>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0 touch-target-sm md:h-8 md:w-8"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                      >
                        <span className="sr-only">Go to previous page</span>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0 touch-target-sm md:h-8 md:w-8"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                      >
                        <span className="sr-only">Go to next page</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex touch-target-sm md:h-8 md:w-8"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                      >
                        <span className="sr-only">Go to last page</span>
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
