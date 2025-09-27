"use client"

import * as React from "react"
import type { Column, ColumnDef } from "@tanstack/react-table"
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal,
  File,
  PlusCircle,
  FilterX,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Printer,
  QrCode,
  AlertCircle,
  Link as LinkIcon,
  Trash2,
  Loader2,
  Edit,
  Wrench,
  Settings,
  ArrowRightLeft,
  CheckCircle,
  Calendar,
} from "lucide-react"
import Link from 'next/link'
import { useRouter, useSearchParams } from "next/navigation"
import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'

import { cn } from "@/lib/utils"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { RequiredFormLabel } from "@/components/ui/required-form-label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type Equipment } from "@/types/database"
// supabase removed from this module for attachments/history flows (RPC-only)
import { callRpc } from "@/lib/rpc-client"
import { useEquipmentRealtimeSync } from "@/hooks/use-realtime-sync"
import { useActiveUsageLogs } from "@/hooks/use-usage-logs"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AddEquipmentDialog } from "@/components/add-equipment-dialog"
import { ImportEquipmentDialog } from "@/components/import-equipment-dialog"
import { useSession } from "next-auth/react"
import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { EditEquipmentDialog } from "@/components/edit-equipment-dialog"
import { MobileFiltersDropdown } from "@/components/mobile-filters-dropdown"
import { ResponsivePaginationInfo } from "@/components/responsive-pagination-info"
import { useIsMobile } from "@/hooks/use-mobile"
import { useMediaQuery } from "@/hooks/use-media-query"
import { exportArrayToExcel, exportToExcel } from "@/lib/excel-utils"
import { UsageHistoryTab } from "@/components/usage-history-tab"
import { StartUsageDialog } from "@/components/start-usage-dialog"
import { ActiveUsageIndicator } from "@/components/active-usage-indicator"
import { MobileUsageActions } from "@/components/mobile-usage-actions"
import { useSearchDebounce } from "@/hooks/use-debounce"
// Auto department filter removed
import { MobileEquipmentListItem } from "@/components/mobile-equipment-list-item"
import { callRpc as rpc } from "@/lib/rpc-client"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"

type Attachment = {
  id: string;
  ten_file: string;
  duong_dan_luu_tru: string;
  thiet_bi_id: number;
};

type HistoryItem = {
    id: number;
    ngay_thuc_hien: string;
    loai_su_kien: string;
    mo_ta: string;
    chi_tiet: {
      // Repair request fields
      mo_ta_su_co?: string;
      hang_muc_sua_chua?: string;
      nguoi_yeu_cau?: string;
      // Maintenance fields
      cong_viec_id?: number;
      thang?: number;
      ten_ke_hoach?: string;
      khoa_phong?: string;
      nam?: number;
      // Transfer fields
      ma_yeu_cau?: string;
      loai_hinh?: string;
      khoa_phong_hien_tai?: string;
      khoa_phong_nhan?: string;
      don_vi_nhan?: string;
    } | null;
  };

const getStatusVariant = (status: Equipment["tinh_trang_hien_tai"]) => {
  switch (status) {
    case "Hoạt động":
      return "default"
    case "Chờ bảo trì":
    case "Chờ hiệu chuẩn/kiểm định":
      return "secondary"
    case "Chờ sửa chữa":
      return "destructive"
    case "Ngưng sử dụng":
    case "Chưa có nhu cầu sử dụng":
      return "outline"
    default:
      return "outline"
  }
}

const getClassificationVariant = (classification: Equipment["phan_loai_theo_nd98"]) => {
  if (!classification) return "outline"
  const trimmed = classification.trim().toUpperCase();
  if (trimmed === 'A' || trimmed === 'LOẠI A') return "default"
  if (trimmed === 'B' || trimmed === 'LOẠI B' || trimmed === 'C' || trimmed === 'LOẠI C') return "secondary"
  if (trimmed === 'D' || trimmed === 'LOẠI D') return "destructive"
  return "outline"
}

const columnLabels: Record<string, string> = {
  id: 'ID',
  ma_thiet_bi: 'Mã thiết bị',
  ten_thiet_bi: 'Tên thiết bị',
  model: 'Model',
  serial: 'Serial',
  cau_hinh_thiet_bi: 'Cấu hình',
  phu_kien_kem_theo: 'Phụ kiện kèm theo',
  hang_san_xuat: 'Hãng sản xuất',
  noi_san_xuat: 'Nơi sản xuất',
  nam_san_xuat: 'Năm sản xuất',
  ngay_nhap: 'Ngày nhập',
  ngay_dua_vao_su_dung: 'Ngày đưa vào sử dụng',
  nguon_kinh_phi: 'Nguồn kinh phí',
  gia_goc: 'Giá gốc',
  nam_tinh_hao_mon: 'Năm tính hao mòn',
  ty_le_hao_mon: 'Tỷ lệ hao mòn theo TT23',
  han_bao_hanh: 'Hạn bảo hành',
  vi_tri_lap_dat: 'Vị trí lắp đặt',
  nguoi_dang_truc_tiep_quan_ly: 'Người sử dụng',
  khoa_phong_quan_ly: 'Khoa/phòng quản lý',
  tinh_trang_hien_tai: 'Tình trạng',
  ghi_chu: 'Ghi chú',
  chu_ky_bt_dinh_ky: 'Chu kỳ BT định kỳ (ngày)',
  ngay_bt_tiep_theo: 'Ngày BT tiếp theo',
  chu_ky_hc_dinh_ky: 'Chu kỳ HC định kỳ (ngày)',
  ngay_hc_tiep_theo: 'Ngày HC tiếp theo',
  chu_ky_kd_dinh_ky: 'Chu kỳ KĐ định kỳ (ngày)',
  ngay_kd_tiep_theo: 'Ngày KĐ tiếp theo',
  phan_loai_theo_nd98: 'Phân loại theo NĐ98',
}

// Inline edit support: schema and helpers shared with edit dialog (duplicated here for inline mode)
const equipmentStatusOptions = [
  "Hoạt động",
  "Chờ sửa chữa",
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
  "Ngưng sử dụng",
  "Chưa có nhu cầu sử dụng"
] as const;

const normalizeDate = (v: string | null | undefined) => {
  if (!v) return null
  const s = String(v).trim()
  if (s === '') return null
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const d = m[1].padStart(2, '0')
    const mo = m[2].padStart(2, '0')
    const y = m[3]
    return `${y}-${mo}-${d}`
  }
  return s
}

const equipmentFormSchema = z.object({
  ma_thiet_bi: z.string().min(1, "Mã thiết bị là bắt buộc"),
  ten_thiet_bi: z.string().min(1, "Tên thiết bị là bắt buộc"),
  model: z.string().optional().nullable(),
  serial: z.string().optional().nullable(),
  hang_san_xuat: z.string().optional().nullable(),
  noi_san_xuat: z.string().optional().nullable(),
  nam_san_xuat: z.coerce.number().optional().nullable(),
  ngay_nhap: z.string().optional().nullable().transform(normalizeDate),
  ngay_dua_vao_su_dung: z.string().optional().nullable().transform(normalizeDate),
  nguon_kinh_phi: z.string().optional().nullable(),
  gia_goc: z.coerce.number().optional().nullable(),
  han_bao_hanh: z.string().optional().nullable().transform(normalizeDate),
  vi_tri_lap_dat: z.string().min(1, "Vị trí lắp đặt là bắt buộc").nullable().transform(val => val || ""),
  khoa_phong_quan_ly: z.string().min(1, "Khoa/Phòng quản lý là bắt buộc").nullable().transform(val => val || ""),
  nguoi_dang_truc_tiep_quan_ly: z.string().min(1, "Người trực tiếp quản lý (sử dụng) là bắt buộc").nullable().transform(val => val || ""),
  tinh_trang_hien_tai: z.enum(equipmentStatusOptions, { required_error: "Tình trạng hiện tại là bắt buộc" }).nullable().transform(val => val || "" as any),
  cau_hinh_thiet_bi: z.string().optional().nullable(),
  phu_kien_kem_theo: z.string().optional().nullable(),
  ghi_chu: z.string().optional().nullable(),
  // Maintenance cycles and next dates
  chu_ky_bt_dinh_ky: z.coerce.number().optional().nullable(),
  ngay_bt_tiep_theo: z.string().optional().nullable().transform(normalizeDate),
  chu_ky_hc_dinh_ky: z.coerce.number().optional().nullable(),
  ngay_hc_tiep_theo: z.string().optional().nullable().transform(normalizeDate),
  chu_ky_kd_dinh_ky: z.coerce.number().optional().nullable(),
  ngay_kd_tiep_theo: z.string().optional().nullable().transform(normalizeDate),
  phan_loai_theo_nd98: z.enum(['A', 'B', 'C', 'D']).optional().nullable(),
});

type EquipmentFormValues = z.infer<typeof equipmentFormSchema>

const filterableColumns: (keyof Equipment)[] = [
    'khoa_phong_quan_ly',
    'vi_tri_lap_dat',
    'nguoi_dang_truc_tiep_quan_ly',
    'phan_loai_theo_nd98',
    'tinh_trang_hien_tai'
];

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
      <DropdownMenuContent className="w-[200px] max-h-[300px] overflow-y-auto" align="start">
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


export default function EquipmentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const user = session?.user as any // Cast NextAuth user to our User type
  const isRegionalLeader = (user as any)?.role === 'regional_leader'
  const { toast } = useToast()
  const { data: tenantBranding } = useTenantBranding()
  // Global/admin role check computed early so hooks below can depend on it safely
  const isGlobal = (user as any)?.role === 'global' || (user as any)?.role === 'admin'

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

  // Enable realtime sync to invalidate cache on external changes
  // TODO: Temporarily disabled - uncomment to re-enable
  // useEquipmentRealtimeSync()
  const queryClient = useQueryClient()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const debouncedSearch = useSearchDebounce(searchTerm)
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false)
  const [selectedEquipment, setSelectedEquipment] = React.useState<Equipment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [isStartUsageDialogOpen, setIsStartUsageDialogOpen] = React.useState(false);
  const [startUsageEquipment, setStartUsageEquipment] = React.useState<Equipment | null>(null);
  const [editingEquipment, setEditingEquipment] = React.useState<Equipment | null>(null)
  const [currentTab, setCurrentTab] = React.useState<string>("details")
  const [isEditingDetails, setIsEditingDetails] = React.useState(false)
  const editForm = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      // Required fields with empty string defaults
      ma_thiet_bi: "",
      ten_thiet_bi: "",
      vi_tri_lap_dat: "",
      khoa_phong_quan_ly: "",
      nguoi_dang_truc_tiep_quan_ly: "",
      tinh_trang_hien_tai: "" as any,
      
      // Optional fields with null defaults (consistent with schema)
      model: null,
      serial: null,
      hang_san_xuat: null,
      noi_san_xuat: null,
      nguon_kinh_phi: null,
      cau_hinh_thiet_bi: null,
      phu_kien_kem_theo: null,
      ghi_chu: null,
      ngay_nhap: null,
      ngay_dua_vao_su_dung: null,
      han_bao_hanh: null,
      ngay_bt_tiep_theo: null,
      ngay_hc_tiep_theo: null,
      ngay_kd_tiep_theo: null,
      nam_san_xuat: null,
      gia_goc: null,
      chu_ky_bt_dinh_ky: null,
      chu_ky_hc_dinh_ky: null,
      chu_ky_kd_dinh_ky: null,
      phan_loai_theo_nd98: null,
    },
  })

  // Moved from below to fix variable declaration order
  const tenantKey = (user as any)?.don_vi ? String((user as any).don_vi) : 'none'
  const [tenantFilter, setTenantFilter] = React.useState<string>(() => (isGlobal ? 'unset' : tenantKey))
  const selectedDonViUI = React.useMemo(() => {
    if (!isGlobal) return null
    if (tenantFilter === 'all') return null
    const v = parseInt(tenantFilter, 10)
    return Number.isFinite(v) ? v : null
  }, [isGlobal, tenantFilter])

  // Optimized active usage logs with tenant filtering and reduced polling
  const currentTenantId = React.useMemo(() => {
    if (!isGlobal) return user?.don_vi ? Number(user.don_vi) : null
    // For global users, use the selected tenant filter if available
    if (selectedDonViUI !== null) return selectedDonViUI
    return null // Global users see all by default
  }, [isGlobal, user?.don_vi, selectedDonViUI])
  
  const { data: activeUsageLogs, isLoading: isLoadingActiveUsage } = useActiveUsageLogs({
    tenantId: currentTenantId,
    enabled: true,
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes instead of 10 seconds
  })

  React.useEffect(() => {
    if (selectedEquipment && isEditingDetails) {
      editForm.reset({
        // Required string fields - use empty string as fallback
        ma_thiet_bi: selectedEquipment.ma_thiet_bi || "",
        ten_thiet_bi: selectedEquipment.ten_thiet_bi || "",
        vi_tri_lap_dat: selectedEquipment.vi_tri_lap_dat || "",
        khoa_phong_quan_ly: selectedEquipment.khoa_phong_quan_ly || "",
        nguoi_dang_truc_tiep_quan_ly: selectedEquipment.nguoi_dang_truc_tiep_quan_ly || "",
        tinh_trang_hien_tai: selectedEquipment.tinh_trang_hien_tai || "" as any,
        
        // Optional string fields - use null for consistency with schema
        model: selectedEquipment.model || null,
        serial: selectedEquipment.serial || null,
        hang_san_xuat: selectedEquipment.hang_san_xuat || null,
        noi_san_xuat: selectedEquipment.noi_san_xuat || null,
        nguon_kinh_phi: selectedEquipment.nguon_kinh_phi || null,
        cau_hinh_thiet_bi: selectedEquipment.cau_hinh_thiet_bi || null,
        phu_kien_kem_theo: selectedEquipment.phu_kien_kem_theo || null,
        ghi_chu: selectedEquipment.ghi_chu || null,
        
        // Date fields - use null for consistency
        ngay_nhap: selectedEquipment.ngay_nhap || null,
        ngay_dua_vao_su_dung: selectedEquipment.ngay_dua_vao_su_dung || null,
        han_bao_hanh: selectedEquipment.han_bao_hanh || null,
        ngay_bt_tiep_theo: (selectedEquipment as any).ngay_bt_tiep_theo || null,
        ngay_hc_tiep_theo: (selectedEquipment as any).ngay_hc_tiep_theo || null,
        ngay_kd_tiep_theo: (selectedEquipment as any).ngay_kd_tiep_theo || null,
        
        // Numeric fields - use null for consistency
        nam_san_xuat: selectedEquipment.nam_san_xuat || null,
        gia_goc: selectedEquipment.gia_goc || null,
        chu_ky_bt_dinh_ky: (selectedEquipment as any).chu_ky_bt_dinh_ky || null,
        chu_ky_hc_dinh_ky: (selectedEquipment as any).chu_ky_hc_dinh_ky || null,
        chu_ky_kd_dinh_ky: (selectedEquipment as any).chu_ky_kd_dinh_ky || null,
        
        // Enum field - validate and use null if invalid
        phan_loai_theo_nd98: (
          selectedEquipment.phan_loai_theo_nd98 && ['A','B','C','D'].includes(String(selectedEquipment.phan_loai_theo_nd98).toUpperCase())
            ? (String(selectedEquipment.phan_loai_theo_nd98).toUpperCase() as 'A'|'B'|'C'|'D')
            : null
        ),
      })
    }
  }, [selectedEquipment, isEditingDetails, editForm])

  const updateEquipmentMutation = useMutation({
    mutationFn: async (vars: { id: number; patch: EquipmentFormValues }) => {
      await callRpc<any>({ fn: 'equipment_update', args: { p_id: vars.id, p_patch: vars.patch as any } })
    },
    onSuccess: (_res, vars) => {
      toast({ title: 'Thành công', description: 'Đã cập nhật thông tin thiết bị.' })
      setIsEditingDetails(false)
      // Update current selected equipment optimistically
      setSelectedEquipment(prev => prev ? ({ ...prev, ...(vars?.patch || {}) } as any) : prev)
      // Invalidate current-tenant equipment queries
      onDataMutationSuccess()
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể cập nhật thiết bị. ' + (error?.message || '') })
    },
  })

  const onSubmitInlineEdit = async (values: EquipmentFormValues) => {
    if (!selectedEquipment) return
    await updateEquipmentMutation.mutateAsync({ id: selectedEquipment.id, patch: values })
  }

  const handleDetailDialogOpenChange = React.useCallback((open: boolean) => {
    if (open) {
      setIsDetailModalOpen(true)
      return
    }
    if (isEditingDetails && (editForm.formState.isDirty)) {
      const ok = confirm('Bạn có chắc muốn đóng? Các thay đổi chưa lưu sẽ bị mất.')
      if (!ok) {
        // Keep dialog open
        return
      }
    }
    setIsEditingDetails(false)
    setIsDetailModalOpen(false)
  }, [isEditingDetails, editForm.formState.isDirty])

  const requestCloseDetailDialog = React.useCallback(() => handleDetailDialogOpenChange(false), [handleDetailDialogOpenChange])

  const isMobile = useIsMobile();
  const useTabletFilters = useMediaQuery("(min-width: 768px) and (max-width: 1024px)");
  // Card view breakpoint (switch to cards below 1280px)
  const isCardView = useMediaQuery("(max-width: 1279px)");

  // Columns dialog state for unified toolbar "Tùy chọn"
  const [isColumnsDialogOpen, setIsColumnsDialogOpen] = React.useState(false);

  // Attachment form state
  const [newFileName, setNewFileName] = React.useState("");
  const [newFileUrl, setNewFileUrl] = React.useState("");
  const [deletingAttachmentId, setDeletingAttachmentId] = React.useState<string | null>(null);

  // State to preserve pagination during data reload
  const [preservePageState, setPreservePageState] = React.useState<{
    pageIndex: number;
    pageSize: number;
  } | null>(null);

  // Medium screen detection using useMediaQuery hook for better performance
  // Target tablet and small laptop screens (768px - 1800px) where column space is limited
  // This covers most 12-15 inch laptops and tablets in landscape mode
  const isMediumScreen = useMediaQuery("(min-width: 768px) and (max-width: 1800px)");

  // Load tenant options for global select using TanStack Query
  const { data: tenantList, isLoading: isTenantsLoading } = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ['tenant_list'],
    queryFn: async () => {
      const list = await rpc<any[]>({ fn: 'tenant_list', args: {} })
      return (list || []).map((t: any) => ({ id: t.id, name: t.name, code: t.code }))
    },
    enabled: isGlobal,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const tenantOptions = (tenantList ?? []) as { id: number; name: string; code: string }[]

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    id: false,
    ma_thiet_bi: true,           // Mã thiết bị ✅
    ten_thiet_bi: true,          // Tên thiết bị ✅
    model: true,                 // Model ✅
    serial: true,                // Serial ✅
    cau_hinh_thiet_bi: false,
    phu_kien_kem_theo: false,
    hang_san_xuat: false,
    noi_san_xuat: false,
    nam_san_xuat: false,
    ngay_nhap: false,
    ngay_dua_vao_su_dung: false,
    nguon_kinh_phi: false,
    gia_goc: false,
    nam_tinh_hao_mon: false,
    ty_le_hao_mon: false,
    han_bao_hanh: false,
    vi_tri_lap_dat: true,        // Vị trí lắp đặt ✅
    nguoi_dang_truc_tiep_quan_ly: true,  // Người sử dụng ✅
    khoa_phong_quan_ly: true,    // Khoa/phòng ✅
    tinh_trang_hien_tai: true,   // Tình trạng ✅
    ghi_chu: false,
    chu_ky_bt_dinh_ky: false,
    ngay_bt_tiep_theo: false,
    chu_ky_hc_dinh_ky: false,
    ngay_hc_tiep_theo: false,
    chu_ky_kd_dinh_ky: false,
    ngay_kd_tiep_theo: false,
    phan_loai_theo_nd98: true,   // Phân loại theo NĐ98 ✅
  });

  // Auto-hide columns on medium screens
  React.useEffect(() => {
    if (isMediumScreen) {
      setColumnVisibility(prev => ({
        ...prev,
        model: false,                // Hide Model on medium screens
        serial: false,               // Hide Serial on medium screens
        phan_loai_theo_nd98: false,  // Hide Phân loại theo NĐ98 on medium screens
      }));
    } else {
      // Restore default visibility when not on medium screen
      setColumnVisibility(prev => ({
        ...prev,
        model: true,                 // Show Model on other screens
        serial: true,                // Show Serial on other screens
        phan_loai_theo_nd98: true,   // Show Phân loại theo NĐ98 on other screens
      }));
    }
  }, [isMediumScreen]);

  const handleDownloadTemplate = async () => {
    try {
      const templateHeaders = Object.entries(columnLabels)
        .filter(([key]) => key !== 'id')
        .map(([, label]) => label);

      const colWidths = templateHeaders.map(header => Math.max(header.length, 25));

      await exportArrayToExcel(
        [templateHeaders],
        "Mau_Nhap_Thiet_Bi.xlsx",
        "Template Thiết Bị",
        colWidths
      );
    } catch (error) {
      console.error('Error downloading template:', error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tải template. Vui lòng thử lại.",
      });
    }
  };

  const handleGenerateProfileSheet = (equipment: Equipment) => {
    if (!equipment) return;

    const formatValue = (value: any) => value ?? "";
    const formatCurrency = (value: any) => {
        if (value === null || value === undefined || value === "") return "";
        return Number(value).toLocaleString('vi-VN') + ' VNĐ';
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Phiếu Lý Lịch Thiết Bị - ${formatValue(equipment.ma_thiet_bi)}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
              body { font-family: 'Times New Roman', Times, serif; font-size: 14px; color: #000; background-color: #e5e7eb; line-height: 1.5; }
              .a4-page { width: 21cm; min-height: 29.7cm; padding: 1cm 2cm; margin: 1cm auto; background: white; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); position: relative; display: flex; flex-direction: column; }
              .content-body { flex-grow: 1; }
              .form-input-line { font-family: inherit; font-size: inherit; border: none; border-bottom: 1px dotted #000; background-color: transparent; padding: 1px; outline: none; width: 100%; }
              h1, h2, .font-bold { font-weight: 700; }
              .title-main { font-size: 20px; }
              .title-sub { font-size: 16px; }
              .form-section { border: 1px solid #000; padding: 8px; }
              .long-text { white-space: pre-wrap; word-break: break-word; min-height: 22px; }
              .signature-box { border: 1px solid #000; border-top: none; }
              .signature-area { text-align: center; padding: 12px; }
              .signature-space { height: 80px; }
              .signature-name-input { border: none; background-color: transparent; text-align: center; font-weight: 700; width: 100%; margin-top: 8px; }
              .signature-name-input:focus { outline: none; }
              @media print {
                  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: #fff !important; }
                  .a4-page { display: block !important; width: auto; height: auto; min-height: 0; margin: 0 !important; padding: 1cm 2cm !important; box-shadow: none !important; border: none !important; }
                  body > *:not(.a4-page) { display: none; }
                  .print-footer { position: fixed; bottom: 1cm; left: 2cm; right: 2cm; width: calc(100% - 4cm); }
                  .content-body { padding-bottom: 3cm; }
                  .form-section, .signature-box, header { page-break-inside: avoid; }
              }
          </style>
      </head>
      <body>
          <div class="a4-page">
              <div class="content-body">
                  <header class="text-center">
                      <div class="flex justify-between items-center">
                          <img src="${tenantBranding?.logo_url || 'https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo'}" alt="Logo ${tenantBranding?.name || 'Organization'}" class="w-20 h-20" onerror="this.onerror=null;this.src='https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo';">
                          <div class="flex-grow">
                              <h2 class="title-sub uppercase font-bold text-xl">${tenantBranding?.name || 'ĐƠN VỊ'}</h2>
                              <div class="flex items-baseline justify-center mt-2">
                                  <label class="font-bold whitespace-nowrap">KHOA/PHÒNG:</label>
                                  <div class="w-1/2 ml-2"><input type="text" class="form-input-line" value="${formatValue(equipment.khoa_phong_quan_ly)}"></div>
                              </div>
                          </div>
                      </div>
                  </header>
                  <main class="mt-4">
                      <div class="form-section">
                          <h1 class="title-main uppercase font-bold text-center">PHIẾU LÝ LỊCH THIẾT BỊ</h1>
                      </div>
                      <div class="form-section border-t-0">
                          <div class="flex items-baseline">
                              <label class="whitespace-nowrap w-28">1. Tên thiết bị:</label>
                              <input type="text" class="form-input-line ml-2" value="${formatValue(equipment.ten_thiet_bi)}">
                          </div>
                           <div class="grid grid-cols-2 gap-x-8 mt-2">
                              <div class="flex items-baseline">
                                 <label class="whitespace-nowrap w-28">Mã số TB:</label>
                                 <input type="text" class="form-input-line ml-2" value="${formatValue(equipment.ma_thiet_bi)}">
                              </div>
                               <div class="flex items-baseline">
                                 <label class="whitespace-nowrap">Mã số TB ban đầu:</label>
                                 <input type="text" class="form-input-line ml-2" value="">
                              </div>
                          </div>
                      </div>
                      <div class="form-section border-t-0">
                          <div class="grid grid-cols-2 gap-x-8">
                              <div class="flex items-baseline"><label class="w-28">2. Model:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.model)}"></div>
                              <div class="flex items-baseline"><label class="w-36">7. Ngày nhập:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.ngay_nhap)}"></div>
                              <div class="flex items-baseline mt-2"><label class="w-28">3. Serial N⁰:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.serial)}"></div>
                              <div class="flex items-baseline mt-2"><label class="w-36">8. Ngày đưa vào sử dụng:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.ngay_dua_vao_su_dung)}"></div>
                              <div class="flex items-baseline mt-2"><label class="w-28">4. Hãng SX:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.hang_san_xuat)}"></div>
                              <div class="flex items-baseline mt-2"><label class="w-36">9. Vị trí lắp đặt:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.vi_tri_lap_dat)}"></div>
                              <div class="flex items-baseline mt-2"><label class="w-28">5. Nơi SX:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.noi_san_xuat)}"></div>
                              <div class="flex items-baseline mt-2"><label class="w-36">10. Giá gốc:</label><input type="text" class="form-input-line ml-2" value="${formatCurrency(equipment.gia_goc)}"></div>
                              <div class="flex items-baseline mt-2"><label class="w-28">6. Năm SX:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.nam_san_xuat)}"></div>
                              <div class="flex items-baseline mt-2"><label class="w-36">11. Nguồn kinh phí:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.nguon_kinh_phi)}"></div>
                          </div>
                      </div>
                      <div class="form-section border-t-0">
                          <div class="flex items-center">
                              <label class="whitespace-nowrap">12. Bảo hành:</label>
                              <div class="ml-10 flex items-center gap-x-10">
                                   <label class="flex items-center"><input type="checkbox" class="h-4 w-4 mr-2" ${!equipment.han_bao_hanh ? 'checked' : ''}>Không</label>
                                   <label class="flex items-center"><input type="checkbox" class="h-4 w-4 mr-2" ${equipment.han_bao_hanh ? 'checked' : ''}>Có ( Ngày BH cuối cùng: <span class="inline-block w-48 ml-2"><input type="text" class="form-input-line" value="${formatValue(equipment.han_bao_hanh)}"></span>)</label>
                              </div>
                          </div>
                      </div>
                       <div class="form-section border-t-0">
                          <div class="flex items-center">
                              <label class="whitespace-nowrap">13. Hiệu chuẩn thiết bị:</label>
                              <div class="ml-10 flex items-center gap-x-10">
                                   <label class="flex items-center"><input type="checkbox" class="h-4 w-4 mr-2">Không cần</label>
                                   <label class="flex items-center"><input type="checkbox" class="h-4 w-4 mr-2">Cần hiệu chuẩn</label>
                              </div>
                          </div>
                      </div>
                      <div class="form-section border-t-0">
                          <div class="flex items-baseline"><label class="whitespace-nowrap">14. Cấu hình thiết bị:</label>
                              <div class="form-input-line long-text ml-2">${formatValue(equipment.cau_hinh_thiet_bi)}</div>
                          </div>
                      </div>
                       <div class="form-section border-t-0">
                           <div class="flex items-baseline"><label class="whitespace-nowrap">15. Phụ kiện kèm theo:</label>
                              <div class="form-input-line long-text ml-2">${formatValue(equipment.phu_kien_kem_theo)}</div>
                          </div>
                      </div>
                      <div class="form-section border-t-0">
                           <div class="flex items-center">
                              <label class="whitespace-nowrap">16. Tình trạng khi nhận:</label>
                              <div class="ml-10 flex items-center gap-x-10">
                                   <label class="flex items-center"><input type="checkbox" class="h-4 w-4 mr-2">Mới 100%</label>
                                   <label class="flex items-center"><input type="checkbox" class="h-4 w-4 mr-2">Thiết bị cũ ( phần trăm còn lại: <span class="inline-block w-24 ml-2"><input type="text" class="form-input-line"></span>%)</label>
                              </div>
                          </div>
                      </div>
                       <div class="form-section border-t-0">
                          <div class="flex items-baseline"><label class="whitespace-nowrap">17. Tình trạng thiết bị hiện tại:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.tinh_trang_hien_tai)}"></div>
                      </div>
                      <div class="signature-box">
                          <div class="flex justify-end pt-2 pr-2">
                              <p class="italic">Cần Thơ, ngày <span class="inline-block w-8"><input type="text" class="form-input-line text-center"></span> tháng <span class="inline-block w-8"><input type="text" class="form-input-line text-center"></span> năm <span class="inline-block w-16"><input type="text" class="form-input-line text-center"></span></p>
                          </div>
                          <div class="flex">
                              <div class="w-1/2 signature-area border-r border-gray-400">
                                   <p class="font-bold">Lãnh đạo khoa/ phòng</p>
                                   <p class="italic">(Ký, ghi rõ họ và tên)</p>
                                   <div class="signature-space"></div>
                                   <input type="text" class="signature-name-input" placeholder="(Họ và tên)">
                              </div>
                               <div class="w-1/2 signature-area">
                                   <p class="font-bold">Người trực tiếp quản lý</p>
                                   <p class="italic">(Ký, ghi rõ họ và tên)</p>
                                   <div class="signature-space"></div>
                                   <input type="text" class="signature-name-input" value="${formatValue(equipment.nguoi_dang_truc_tiep_quan_ly)}">
                              </div>
                          </div>
                      </div>
                  </main>
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

  const handleGenerateDeviceLabel = (equipment: Equipment) => {
    if (!equipment) return;

    const formatValue = (value: any) => value ?? "";
    
    const qrText = formatValue(equipment.ma_thiet_bi);
    const qrSize = 112;
    const qrUrl = qrText 
        ? `https://quickchart.io/qr?text=${encodeURIComponent(qrText)}&caption=${encodeURIComponent(qrText)}&captionFontFamily=mono&captionFontSize=12&size=${qrSize}&ecLevel=H&margin=2` 
        : `https://placehold.co/${qrSize}x${qrSize}/ffffff/cccccc?text=QR+Code`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nhãn Thiết Bị - ${formatValue(equipment.ma_thiet_bi)}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&display=swap" rel="stylesheet">
          <style>
              body { font-family: 'Roboto Slab', serif; }
              .form-input-line { border-bottom: 1px dotted #333; width: 100%; min-height: 24px; padding: 1px 0.25rem; }
              .long-text-label { white-space: pre-wrap; word-break: break-word; line-height: 1.4; }
              @media print {
                  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: #fff !important; margin: 0; }
                  .label-container { box-shadow: none !important; border: 3px double #000 !important; margin: 0; page-break-inside: avoid; }
                  body > *:not(.label-container) { display: none; }
              }
          </style>
      </head>
      <body class="bg-gray-200 flex items-center justify-center min-h-screen p-4">
          <div class="w-full max-w-md bg-white p-4 shadow-lg label-container" style="border: 3px double #000;">
              <header class="flex items-start justify-between gap-3 border-b-2 border-black pb-3">
                  <div class="flex-shrink-0">
                      <img src="${tenantBranding?.logo_url || 'https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo'}" alt="Logo ${tenantBranding?.name || 'Organization'}" class="w-16 h-auto" onerror="this.onerror=null;this.src='https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo';">
                  </div>
                  <div class="text-center flex-grow">
                      <h1 class="text-2xl font-bold tracking-wider">NHÃN THIẾT BỊ</h1>
                      <div class="flex items-baseline mt-2">
                          <label class="text-base font-semibold whitespace-nowrap">Khoa:</label>
                          <div class="form-input-line ml-2 text-center uppercase">${formatValue(equipment.khoa_phong_quan_ly)}</div>
                      </div>
                  </div>
              </header>
              <main class="mt-4 space-y-3">
                  <div class="flex items-baseline">
                      <label class="text-base font-semibold w-40 shrink-0">Tên thiết bị:</label>
                      <div class="form-input-line long-text-label flex-grow">${formatValue(equipment.ten_thiet_bi)}</div>
                  </div>
                  <div class="flex items-baseline">
                      <label class="text-base font-semibold w-40 shrink-0">Mã số TB:</label>
                      <div class="form-input-line">${formatValue(equipment.ma_thiet_bi)}</div>
                  </div>
                  <div class="flex items-baseline">
                      <label class="text-base font-semibold w-40 shrink-0">Model:</label>
                      <div class="form-input-line">${formatValue(equipment.model)}</div>
                  </div>
                  <div class="flex items-baseline">
                      <label class="text-base font-semibold w-40 shrink-0">Serial N⁰:</label>
                      <div class="form-input-line">${formatValue(equipment.serial)}</div>
                  </div>
                  <div class="flex items-baseline">
                      <label class="text-base font-semibold w-40 shrink-0">Ngày hiệu chuẩn:</label>
                      <div class="form-input-line">${formatValue(equipment.ngay_hc_tiep_theo)}</div>
                  </div>
                  <div class="flex items-baseline">
                      <label class="text-base font-semibold w-40 shrink-0">Ngày hết hạn:</label>
                      <div class="form-input-line"></div>
                  </div>
                  <div class="flex items-baseline">
                      <label class="text-base font-semibold w-40 shrink-0">Tình trạng hiện tại:</label>
                      <div class="form-input-line font-medium">${formatValue(equipment.tinh_trang_hien_tai)}</div>
                  </div>
              </main>
              <div class="mt-4 flex items-center justify-between gap-4 border-t-2 border-gray-300 pt-3">
                  <div class="flex flex-col items-center">
                       <label class="text-sm font-semibold">Mã QR của TB</label>
                       <img id="qr-image" 
                           src="${qrUrl}"
                           alt="Mã QR của ${qrText}" 
                           class="w-28 h-28 border rounded-md p-1 bg-white mt-1"
                           onerror="this.onerror=null;this.src='https://placehold.co/112x112/ffffff/cccccc?text=QR+Code';"
                       >
                  </div>
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

  const handleShowDetails = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setIsDetailModalOpen(true);
  };

  const handleStartUsage = (equipment: Equipment) => {
    setStartUsageEquipment(equipment);
    setIsStartUsageDialogOpen(true);
  };

  const renderActions = (equipment: Equipment) => {
    const canEdit = user && (
  user.role === 'global' || user.role === 'admin' ||
      user.role === 'to_qltb' ||
      (user.role === 'qltb_khoa' && user.khoa_phong === equipment.khoa_phong_quan_ly)
    );

    const activeUsageLog = activeUsageLogs?.find(
      (log) => log.thiet_bi_id === equipment.id && log.trang_thai === 'dang_su_dung'
    );
  const startUsageDisabled = isLoadingActiveUsage || !user || !!activeUsageLog || isRegionalLeader;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 touch-target-sm md:h-8 md:w-8"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuLabel>Hành động</DropdownMenuLabel>
           <DropdownMenuItem onSelect={() => handleShowDetails(equipment)}>
            Xem chi tiết
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={startUsageDisabled}
            onSelect={() => {
              if (startUsageDisabled) return;
              handleStartUsage(equipment);
            }}
            title={activeUsageLog ? "Thiết bị đang được sử dụng" : undefined}
          >
            Viết nhật ký SD
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isRegionalLeader}
            onSelect={() => {
              if (isRegionalLeader) return
              router.push(`/repair-requests?equipmentId=${equipment.id}`)
            }}
          >
            Tạo yêu cầu sửa chữa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };
  
  const columns: ColumnDef<Equipment>[] = [
    ...(Object.keys(columnLabels) as Array<keyof Equipment>).map((key) => {
      const columnDef: ColumnDef<Equipment> = {
        accessorKey: key,
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              {columnLabels[key]}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const value = row.getValue(key)
  
          if (key === 'tinh_trang_hien_tai') {
            const statusValue = value as Equipment["tinh_trang_hien_tai"];
            if (!statusValue) {
              return <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
            }
            return (
              <Badge variant={getStatusVariant(statusValue)}>
                {statusValue}
              </Badge>
            )
          }
          
          if (key === 'phan_loai_theo_nd98') {
            const classification = value as Equipment["phan_loai_theo_nd98"];
            if (!classification) {
              return <div className="italic text-muted-foreground">Chưa có dữ liệu</div>;
            }
            return (
              <Badge variant={getClassificationVariant(classification)}>
                {classification.trim()}
              </Badge>
            );
          }
  
          if (key === 'gia_goc') {
            if (value === null || value === undefined) {
               return <div className="text-right italic text-muted-foreground">Chưa có dữ liệu</div>
            }
            return <div className="text-right">{Number(value).toLocaleString()}đ</div>
          }
          
          if (value === null || value === undefined || value === "") {
              return <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
          }
  
          return <div className="truncate max-w-xs">{String(value)}</div>
        },
      }
  
      // Server-side filtering is handled by equipment_list_enhanced RPC
      // No client-side filterFn needed since we use manualPagination
  
      return columnDef;
    }),
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => renderActions(row.original),
    },
  ]

  // Moved above to fix variable declaration order - these are now declared earlier
  const shouldFetchEquipment = React.useMemo(() => {
    if (!isGlobal) return true
    if (tenantFilter === 'all') return true
    return /^\d+$/.test(tenantFilter)
  }, [isGlobal, tenantFilter])
  const effectiveTenantKey = isGlobal ? (shouldFetchEquipment ? tenantFilter : 'unset') : tenantKey


  // Equipment list query (TanStack Query) - server-side pagination via equipment_list_enhanced
  type EquipmentListRes = { data: Equipment[]; total: number; page: number; pageSize: number }

  // Server-side pagination state
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 })

  // Extract server-filterable values from columnFilters
  const getSingleFilter = React.useCallback((id: string): string | null => {
    const entry = (columnFilters || []).find((f) => f.id === id)
    const vals = (entry?.value as string[] | undefined) || []
    return vals.length === 1 ? vals[0] : null
  }, [columnFilters])

  // Get array of selected values for multi-select filters
  const getArrayFilter = React.useCallback((id: string): string[] => {
    const entry = (columnFilters || []).find((f) => f.id === id)
    return (entry?.value as string[] | undefined) || []
  }, [columnFilters])

  const selectedDonVi = React.useMemo(() => {
    if (!isGlobal) return null
    if (tenantFilter === 'all') return null
    const v = parseInt(tenantFilter, 10)
    return Number.isFinite(v) ? v : null
  }, [isGlobal, tenantFilter])

  const sortParam = React.useMemo(() => {
    if (!sorting || sorting.length === 0) return 'id.asc'
    const s = sorting[0]
    return `${s.id}.${s.desc ? 'desc' : 'asc'}`
  }, [sorting])

  const selectedDepartments = getArrayFilter('khoa_phong_quan_ly')
  const selectedUsers = getArrayFilter('nguoi_dang_truc_tiep_quan_ly')
  const selectedLocations = getArrayFilter('vi_tri_lap_dat')
  const selectedStatuses = getArrayFilter('tinh_trang_hien_tai')
  const selectedClassifications = getArrayFilter('phan_loai_theo_nd98')
  
  const { data: equipmentRes, isLoading: isEqLoading, isFetching } = useQuery<EquipmentListRes>({
    queryKey: ['equipment_list_enhanced', {
      tenant: effectiveTenantKey,
      page: pagination.pageIndex,
      size: pagination.pageSize,
      q: debouncedSearch || null,
      khoa_phong_array: selectedDepartments,
      nguoi_su_dung_array: selectedUsers,
      vi_tri_lap_dat_array: selectedLocations,
      tinh_trang_array: selectedStatuses,
      phan_loai_array: selectedClassifications,
      sort: sortParam,
    }],
    enabled: shouldFetchEquipment,
    queryFn: async ({ signal }) => {
      const result = await callRpc<EquipmentListRes>({ fn: 'equipment_list_enhanced', args: {
        p_q: debouncedSearch || null,
        p_sort: sortParam,
        p_page: pagination.pageIndex + 1,
        p_page_size: pagination.pageSize,
        p_don_vi: selectedDonVi,
        p_khoa_phong_array: selectedDepartments.length > 0 ? selectedDepartments : null,
        p_nguoi_su_dung_array: selectedUsers.length > 0 ? selectedUsers : null,
        p_vi_tri_lap_dat_array: selectedLocations.length > 0 ? selectedLocations : null,
        p_tinh_trang_array: selectedStatuses.length > 0 ? selectedStatuses : null,
        p_phan_loai_array: selectedClassifications.length > 0 ? selectedClassifications : null,
      }, signal })
      return result
    },
    placeholderData: keepPreviousData,
    staleTime: 120_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })

  const data = (equipmentRes?.data ?? []) as Equipment[]
  const total = equipmentRes?.total ?? 0
  const isLoading = isEqLoading

  // Granular cache invalidation for current tenant
  const invalidateEquipmentForCurrentTenant = React.useCallback(() => {
    if (isGlobal && !shouldFetchEquipment) return
    queryClient.invalidateQueries({
      predicate: (q) => {
        const key = (q as any)?.queryKey
        if (!Array.isArray(key)) return false
        if (key[0] !== 'equipment_list_enhanced') return false
        const params = key[1] as any
        return params?.tenant === effectiveTenantKey
      },
      refetchType: 'active',
    })
  }, [queryClient, effectiveTenantKey, isGlobal, shouldFetchEquipment])


  const onDataMutationSuccess = React.useCallback(() => {
    // Invalidate only current-tenant queries
    invalidateEquipmentForCurrentTenant()
  }, [invalidateEquipmentForCurrentTenant]);

  // Listen for realtime cache invalidation events (invalidate queries)
  React.useEffect(() => {
    const handleCacheInvalidation = () => {
      console.log('[EquipmentPage] Cache invalidated by realtime, invalidating equipment_list_enhanced...')
      invalidateEquipmentForCurrentTenant()
    };

    window.addEventListener('equipment-cache-invalidated', handleCacheInvalidation);
    const handleTenantSwitched = () => {
      console.log('[EquipmentPage] Tenant switched, invalidating equipment_list_enhanced...')
      invalidateEquipmentForCurrentTenant()
    }
    window.addEventListener('tenant-switched', handleTenantSwitched as EventListener)

    return () => {
      window.removeEventListener('equipment-cache-invalidated', handleCacheInvalidation);
      window.removeEventListener('tenant-switched', handleTenantSwitched as EventListener)
    };
  }, [queryClient, invalidateEquipmentForCurrentTenant]);


  // Debug: log when tenant filter changes
  React.useEffect(() => {
    if (!isGlobal) return
    console.log('[EquipmentPage] tenantFilter changed ->', tenantFilter)
    // Refetch equipment list when filter changes by invalidating queries for current tenant
    invalidateEquipmentForCurrentTenant()
  }, [tenantFilter, isGlobal, queryClient, effectiveTenantKey, invalidateEquipmentForCurrentTenant])

  // Show a user-friendly toast when applying specific tenant filter
  React.useEffect(() => {
    if (!isGlobal) return
    if (selectedDonViUI !== null) {
      try {
        const selectedTenant = tenantOptions.find(t => t.id === selectedDonViUI)
        const tenantName = selectedTenant ? selectedTenant.name : `Đơn vị ${selectedDonViUI}`
        toast({ 
          variant: 'default', 
          title: '✅ Đã áp dụng bộ lọc đơn vị', 
          description: `Hiển thị thiết bị thuộc ${tenantName}` 
        })
      } catch {}
    }
  }, [selectedDonViUI, isGlobal, toast, tenantOptions])

  // Log when refetch effect triggers due to tenant changes
  React.useEffect(() => {
    if (!isGlobal) return
    console.log('[EquipmentPage] Refetch effect triggered for tenantFilter:', tenantFilter)
  }, [tenantFilter, isGlobal])

  // Persist tenant selection for global/admin users
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (isGlobal) {
      try { localStorage.setItem('equipment_tenant_filter', tenantFilter) } catch {}
    } else {
      try { localStorage.removeItem('equipment_tenant_filter') } catch {}
    }
  }, [isGlobal, tenantFilter])

  // Restore tenant selection on first load for global/admin
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isGlobal) return
    try {
      const saved = localStorage.getItem('equipment_tenant_filter')
      if (saved && (saved === 'unset' || saved === 'all' || /^\d+$/.test(saved))) {
        setTenantFilter(saved)
      }
    } catch {}
  }, [isGlobal])

  // When tenant filter changes for global users, clear column filters to avoid cross-tenant stale filters causing empty results
  React.useEffect(() => {
    if (!isGlobal) return
    try {
      table.resetColumnFilters()
    } catch {}
  }, [tenantFilter, isGlobal])

  // Handle URL parameters for quick actions
  React.useEffect(() => {
    const actionParam = searchParams.get('action')
    const highlightParam = searchParams.get('highlight')
    const tabParam = searchParams.get('tab')
    
    if (actionParam === 'add') {
      setIsAddDialogOpen(true)
      // Clear URL params after opening dialog
      router.replace('/equipment', { scroll: false })
    }
    
    // Handle QR Scanner highlights
    if (highlightParam && data.length > 0) {
      const equipmentToHighlight = data.find(eq => eq.id === Number(highlightParam))
      if (equipmentToHighlight) {
        setSelectedEquipment(equipmentToHighlight)
        setIsDetailModalOpen(true)
        
        // Set tab from URL parameter
        if (tabParam && ['details', 'files', 'history', 'usage'].includes(tabParam)) {
          setCurrentTab(tabParam)
        } else {
          setCurrentTab('details')
        }
        
        // Clear URL params after opening modal
        router.replace('/equipment', { scroll: false })
        
        // Auto scroll to equipment in table (with delay for modal to open)
        setTimeout(() => {
          const element = document.querySelector(`[data-equipment-id="${highlightParam}"]`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 300)
      }
    }
  }, [searchParams, router, data])

  // Attachments & history queries (fetch only when detail modal open)
  const attachmentsQuery = useQuery({
    queryKey: ['attachments', selectedEquipment?.id],
    queryFn: async () => {
      const data = await callRpc<any[]>({ fn: 'equipment_attachments_list', args: { p_thiet_bi_id: selectedEquipment!.id } })
      return data || []
    },
    enabled: !!selectedEquipment && isDetailModalOpen,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
  const historyQuery = useQuery({
    queryKey: ['history', selectedEquipment?.id],
    queryFn: async () => {
      const data = await callRpc<any[]>({ fn: 'equipment_history_list', args: { p_thiet_bi_id: selectedEquipment!.id } })
      return (data || []) as HistoryItem[]
    },
    enabled: !!selectedEquipment && isDetailModalOpen,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })

  const attachments = (attachmentsQuery.data ?? []) as Attachment[]
  const isLoadingAttachments = attachmentsQuery.isLoading
  const history = (historyQuery.data ?? []) as HistoryItem[]
  const isLoadingHistory = historyQuery.isLoading


  // Mutations for attachments
  const addAttachmentMutation = useMutation({
    mutationFn: async (vars: { id: number; name: string; url: string }) => {
      await callRpc<string>({ fn: 'equipment_attachment_create', args: { p_thiet_bi_id: vars.id, p_ten_file: vars.name, p_duong_dan: vars.url } })
    },
    onSuccess: (_res, vars) => {
      toast({ title: 'Thành công', description: 'Đã thêm liên kết mới.' })
      setNewFileName('')
      setNewFileUrl('')
      queryClient.invalidateQueries({ queryKey: ['attachments', vars.id] })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Lỗi thêm liên kết', description: error?.message })
    },
  })

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName || !newFileUrl || !selectedEquipment) return;

    // Basic URL validation
    try {
      new URL(newFileUrl);
    } catch (_) {
      toast({ variant: 'destructive', title: 'URL không hợp lệ', description: 'Vui lòng nhập một đường dẫn URL hợp lệ.' });
      return;
    }

    await addAttachmentMutation.mutateAsync({ id: selectedEquipment.id, name: newFileName, url: newFileUrl })
  };

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (vars: { attachmentId: string }) => {
      await callRpc<void>({ fn: 'equipment_attachment_delete', args: { p_id: String(vars.attachmentId) } })
    },
    onSuccess: async (_res, _vars) => {
      toast({ title: 'Đã xóa', description: 'Đã xóa liên kết thành công.' })
      if (selectedEquipment) {
        await queryClient.invalidateQueries({ queryKey: ['attachments', selectedEquipment.id] })
      }
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Lỗi xóa liên kết', description: error?.message })
    },
  })

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!selectedEquipment || deletingAttachmentId) return;
    if (!confirm('Bạn có chắc chắn muốn xóa file đính kèm này không?')) return;
    setDeletingAttachmentId(attachmentId);
    try {
      await deleteAttachmentMutation.mutateAsync({ attachmentId })
    } finally {
      setDeletingAttachmentId(null)
    }
  };

  const pageCount = Math.max(1, Math.ceil((total || 0) / Math.max(pagination.pageSize, 1)))

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Remove client-side filtering since we use server-side filtering
    // getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: (value: string) => setSearchTerm(value),
    // Remove faceted models since they're for client-side filtering
    // getFacetedRowModel: getFacetedRowModel(),
    // getFacetedUniqueValues: getFacetedUniqueValues(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter: debouncedSearch,
      pagination,
    },
    manualPagination: true,
    manualFiltering: true, // Enable server-side filtering
    pageCount,
  })
  
  // Reset pagination to page 1 when filters change
  const filterKey = React.useMemo(() => 
    JSON.stringify({ filters: columnFilters, search: debouncedSearch }),
    [columnFilters, debouncedSearch]
  )
  const [lastFilterKey, setLastFilterKey] = React.useState(filterKey)
  
  React.useEffect(() => {
    if (filterKey !== lastFilterKey && pagination.pageIndex > 0) {
      setPagination(prev => ({ ...prev, pageIndex: 0 }))
      setLastFilterKey(filterKey)
    } else if (filterKey !== lastFilterKey) {
      setLastFilterKey(filterKey)
    }
  }, [filterKey, lastFilterKey, pagination.pageIndex])
  
  // Auto department filter removed; no role-based table filter adjustments
  
  // Restore table state after data changes
  React.useEffect(() => {
    if (preservePageState && !isLoading && data.length > 0) {
      setTimeout(() => {
        table.setPageIndex(preservePageState.pageIndex);
        table.setPageSize(preservePageState.pageSize);
        setPreservePageState(null);
      }, 150);
    }
  }, [preservePageState, isLoading, data.length, table]);
  
  const onDataMutationSuccessWithStatePreservation = React.useCallback(() => {
    const currentState = table.getState();
    const stateToSave = {
      pageIndex: currentState.pagination.pageIndex,
      pageSize: currentState.pagination.pageSize,
    };
    setPreservePageState(stateToSave);
    onDataMutationSuccess();
  }, [table, onDataMutationSuccess]);
  
  const handleExportData = async () => {
    // Use server-filtered data instead of client-side filtered model
    const dataToExport = data; // This is already server-filtered
    if (dataToExport.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Không có dữ liệu phù hợp để xuất.",
      });
      return;
    }

    try {

      const dbKeysInOrder = (Object.keys(columnLabels) as Array<keyof Equipment>).filter(key => key !== 'id');
      const headers = dbKeysInOrder.map(key => columnLabels[key]);

      const formattedData = dataToExport.map(item => {
          const rowData: Record<string, any> = {};
          dbKeysInOrder.forEach(key => {
              const header = columnLabels[key];
              let value = item[key];
              rowData[header] = value ?? "";
          });
          return rowData;
      });

      const colWidths = headers.map(header => Math.max(header.length, 20));
      const fileName = `Danh_sach_thiet_bi_${new Date().toISOString().slice(0,10)}.xlsx`;

      await exportToExcel(formattedData, fileName, "Danh sách thiết bị", colWidths);

      toast({
        title: "Xuất dữ liệu thành công",
        description: `Đã tạo file ${fileName}`,
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể xuất dữ liệu. Vui lòng thử lại.",
      });
    }
  };

  // Load departments for current tenant via RPC (tenant-aware filtering)
  const { data: departmentsData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['departments_list_for_tenant', selectedDonVi],
    queryFn: async () => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: 'departments_list_for_tenant',
        args: { p_don_vi: selectedDonVi }
      })
      return result || []
    },
    enabled: shouldFetchEquipment, // Same gating as equipment query
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const departments = React.useMemo(() => 
    (departmentsData || []).map(x => x.name).filter(Boolean),
    [departmentsData]
  )

  // Load all filter options via tenant-aware RPCs
  const { data: usersData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['equipment_users_list_for_tenant', selectedDonVi],
    queryFn: async () => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: 'equipment_users_list_for_tenant',
        args: { p_don_vi: selectedDonVi }
      })
      return result || []
    },
    enabled: shouldFetchEquipment,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const users = React.useMemo(() => 
    (usersData || []).map(x => x.name).filter(Boolean),
    [usersData]
  )

  const { data: locationsData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['equipment_locations_list_for_tenant', selectedDonVi],
    queryFn: async () => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: 'equipment_locations_list_for_tenant',
        args: { p_don_vi: selectedDonVi }
      })
      return result || []
    },
    enabled: shouldFetchEquipment,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const locations = React.useMemo(() => 
    (locationsData || []).map(x => x.name).filter(Boolean),
    [locationsData]
  )

  const { data: classificationsData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['equipment_classifications_list_for_tenant', selectedDonVi],
    queryFn: async () => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: 'equipment_classifications_list_for_tenant',
        args: { p_don_vi: selectedDonVi }
      })
      return result || []
    },
    enabled: shouldFetchEquipment,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const classifications = React.useMemo(() => 
    (classificationsData || []).map(x => x.name).filter(Boolean),
    [classificationsData]
  )

  const { data: statusesData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['equipment_statuses_list_for_tenant', selectedDonVi],
    queryFn: async () => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: 'equipment_statuses_list_for_tenant',
        args: { p_don_vi: selectedDonVi }
      })
      return result || []
    },
    enabled: shouldFetchEquipment,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const statuses = React.useMemo(() => 
    (statusesData || []).map(x => x.name).filter(Boolean),
    [statusesData]
  )
  
  const isFiltered = table.getState().columnFilters.length > 0;

  const renderContent = () => {
    if (isGlobal && !shouldFetchEquipment) {
      return (
        <div className="p-4 border rounded-md bg-muted/30 text-sm text-muted-foreground">
          Vui lòng chọn đơn vị cụ thể ở bộ lọc để xem dữ liệu thiết bị
        </div>
      )
    }
    if (isLoading) {
      return isCardView ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-start justify-between pb-4">
                <div>
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <Skeleton className="h-5 w-full" />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={columns.length}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    if (table.getRowModel().rows.length === 0) {
      return (
        <div className="flex items-center justify-center h-96 text-muted-foreground">
          Không tìm thấy kết quả phù hợp
        </div>
      );
    }

    return isCardView ? (
      <div className="relative space-y-2">
        {isFetching && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex items-center justify-center z-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {table.getRowModel().rows.map((row) => (
          <MobileEquipmentListItem
            key={row.original.id}
            equipment={row.original}
            onShowDetails={handleShowDetails}
            onEdit={setEditingEquipment}
          />
        ))}
      </div>
    ) : (
      <div className="relative overflow-x-auto rounded-md border">
        {isFetching && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex items-center justify-center z-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted hover:bg-muted">
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
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                data-equipment-id={row.original.id}
                className="hover:bg-muted cursor-pointer"
                onClick={() => handleShowDetails(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const getHistoryIcon = (eventType: string) => {
    switch (eventType) {
        case 'Sửa chữa':
            return <Wrench className="h-4 w-4 text-muted-foreground" />;
        case 'Bảo trì':
        case 'Bảo trì định kỳ':
        case 'Bảo trì dự phòng':
            return <Settings className="h-4 w-4 text-muted-foreground" />;
        case 'Luân chuyển':
        case 'Luân chuyển nội bộ':
        case 'Luân chuyển bên ngoài':
            return <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />;
        case 'Hiệu chuẩn':
        case 'Kiểm định':
            return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
        case 'Thanh lý':
            return <Trash2 className="h-4 w-4 text-muted-foreground" />;
        default:
            return <Calendar className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <>
       <AddEquipmentDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={onDataMutationSuccessWithStatePreservation}
      />
      <ImportEquipmentDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onSuccess={onDataMutationSuccessWithStatePreservation}
      />
      <EditEquipmentDialog
        open={!!editingEquipment}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEquipment(null);
          }
        }}
        onSuccess={() => {
          setEditingEquipment(null);
          onDataMutationSuccessWithStatePreservation();
        }}
        equipment={editingEquipment}
      />
      {selectedEquipment && (
        <Dialog open={isDetailModalOpen} onOpenChange={handleDetailDialogOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Chi tiết thiết bị: {selectedEquipment.ten_thiet_bi}</DialogTitle>
                    <DialogDescription>
                        Mã thiết bị: {selectedEquipment.ma_thiet_bi}
                    </DialogDescription>
                </DialogHeader>
                <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-grow flex flex-col overflow-hidden">
                    <TabsList className="shrink-0">
                        <TabsTrigger value="details">Thông tin chi tiết</TabsTrigger>
                        <TabsTrigger value="files">File đính kèm</TabsTrigger>
                        <TabsTrigger value="history">Lịch sử</TabsTrigger>
                        <TabsTrigger value="usage">Nhật ký sử dụng</TabsTrigger>
                    </TabsList>
                    <TabsContent value="details" className="flex-grow overflow-hidden">
                      {isEditingDetails ? (
                        <Form {...editForm}>
<form id="equipment-inline-edit-form" className="h-full flex flex-col overflow-hidden" onSubmit={editForm.handleSubmit(onSubmitInlineEdit)}>
                            <ScrollArea className="flex-1 pr-4">
                              <div className="space-y-4 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <FormField control={editForm.control} name="ma_thiet_bi" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Mã thiết bị</FormLabel>
                                      <FormControl>
                                        <Input placeholder="VD: EQP-001" {...field} value={field.value ?? ''} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                  <FormField control={editForm.control} name="ten_thiet_bi" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Tên thiết bị</FormLabel>
                                      <FormControl>
                                        <Input placeholder="VD: Máy siêu âm" {...field} value={field.value ?? ''} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <FormField control={editForm.control} name="model" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Model</FormLabel>
                                      <FormControl>
                                        <Input {...field} value={field.value ?? ''} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                  <FormField control={editForm.control} name="serial" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Serial</FormLabel>
                                      <FormControl>
                                        <Input {...field} value={field.value ?? ''} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <FormField control={editForm.control} name="hang_san_xuat" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Hãng sản xuất</FormLabel>
                                      <FormControl>
                                        <Input {...field} value={field.value ?? ''} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                  <FormField control={editForm.control} name="noi_san_xuat" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Nơi sản xuất</FormLabel>
                                      <FormControl>
                                        <Input {...field} value={field.value ?? ''} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </div>

                                <FormField control={editForm.control} name="nam_san_xuat" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Năm sản xuất</FormLabel>
                                    <FormControl>
                                      <Input type="number" {...field} value={field.value ?? ''} onChange={event => field.onChange(event.target.value === '' ? null : +event.target.value)} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <FormField control={editForm.control} name="ngay_nhap" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Ngày nhập</FormLabel>
                                      <FormControl>
                                        <Input placeholder="DD/MM/YYYY" {...field} value={field.value ?? ''} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                  <FormField control={editForm.control} name="ngay_dua_vao_su_dung" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Ngày đưa vào sử dụng</FormLabel>
                                      <FormControl>
                                        <Input placeholder="DD/MM/YYYY" {...field} value={field.value ?? ''} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <FormField control={editForm.control} name="nguon_kinh_phi" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Nguồn kinh phí</FormLabel>
                                      <FormControl>
                                        <Input {...field} value={field.value ?? ''} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                  <FormField control={editForm.control} name="gia_goc" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Giá gốc (VNĐ)</FormLabel>
                                      <FormControl>
                                        <Input type="number" {...field} value={field.value ?? ''} onChange={event => field.onChange(event.target.value === '' ? null : +event.target.value)} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </div>

                                <FormField control={editForm.control} name="han_bao_hanh" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Hạn bảo hành</FormLabel>
                                    <FormControl>
                                      <Input placeholder="DD/MM/YYYY" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <FormField control={editForm.control} name="khoa_phong_quan_ly" render={({ field }) => (
                                    <FormItem>
                                      <RequiredFormLabel required>Khoa/Phòng quản lý</RequiredFormLabel>
                                      <FormControl>
                                        <Input {...field} value={field.value ?? ''} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                  <FormField control={editForm.control} name="vi_tri_lap_dat" render={({ field }) => (
                                    <FormItem>
                                      <RequiredFormLabel required>Vị trí lắp đặt</RequiredFormLabel>
                                      <FormControl>
                                        <Input {...field} value={field.value ?? ''} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </div>

                                <FormField control={editForm.control} name="nguoi_dang_truc_tiep_quan_ly" render={({ field }) => (
                                  <FormItem>
                                    <RequiredFormLabel required>Người trực tiếp quản lý (sử dụng)</RequiredFormLabel>
                                    <FormControl>
                                      <Input {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />

                                <FormField control={editForm.control} name="tinh_trang_hien_tai" render={({ field }) => (
                                  <FormItem>
                                    <RequiredFormLabel required>Tình trạng hiện tại</RequiredFormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Chọn tình trạng" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {equipmentStatusOptions.map(status => (
                                          <SelectItem key={status!} value={status!}>
                                            {status}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )} />

                                <FormField control={editForm.control} name="cau_hinh_thiet_bi" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Cấu hình thiết bị</FormLabel>
                                    <FormControl>
                                      <Textarea rows={4} {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={editForm.control} name="phu_kien_kem_theo" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Phụ kiện kèm theo</FormLabel>
                                    <FormControl>
                                      <Textarea rows={3} {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={editForm.control} name="ghi_chu" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Ghi chú</FormLabel>
                                    <FormControl>
                                      <Textarea rows={3} {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />

                                <FormField control={editForm.control} name="phan_loai_theo_nd98" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Phân loại TB theo NĐ 98</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Chọn phân loại" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {['A', 'B', 'C', 'D'].map(type => (
                                          <SelectItem key={type} value={type}>
                                            {`Loại ${type}`}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                              </div>
                            </ScrollArea>
                          </form>
                        </Form>
                      ) : (
                        <ScrollArea className="h-full pr-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 py-4">
                            {(Object.keys(columnLabels) as Array<keyof Equipment>).map(key => {
                              if (key === 'id') return null;

                              const renderValue = () => {
                                const value = selectedEquipment[key];
                                if (key === 'tinh_trang_hien_tai') {
                                  const statusValue = value as Equipment["tinh_trang_hien_tai"];
                                  return statusValue ? <Badge variant={getStatusVariant(statusValue)}>{statusValue}</Badge> : <div className="italic text-muted-foreground">Chưa có dữ liệu</div>;
                                }
                                if (key === 'phan_loai_theo_nd98') {
                                  const classification = value as Equipment["phan_loai_theo_nd98"];
                                  return classification ? <Badge variant={getClassificationVariant(classification)}>{classification.trim()}</Badge> : <div className="italic text-muted-foreground">Chưa có dữ liệu</div>;
                                }
                                if (key === 'gia_goc') {
                                  return value ? `${Number(value).toLocaleString()} đ` : <div className="italic text-muted-foreground">Chưa có dữ liệu</div>;
                                }
                                if (value === null || value === undefined || value === "") {
                                  return <div className="italic text-muted-foreground">Chưa có dữ liệu</div>;
                                }
                                return String(value);
                              };

                              return (
                                <div key={key} className="border-b pb-2">
                                  <p className="text-xs font-medium text-muted-foreground">{columnLabels[key]}</p>
                                  <div className="font-semibold break-words">{renderValue()}</div>
                                </div>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </TabsContent>
                    <TabsContent value="files" className="flex-grow overflow-hidden">
                        <div className="h-full flex flex-col gap-4 py-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Thêm file đính kèm mới</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleAddAttachment} className="space-y-4">
                                        <div className="space-y-1">
                                            <Label htmlFor="file-name">Tên file</Label>
<Input id="file-name" placeholder="VD: Giấy chứng nhận hiệu chuẩn" value={newFileName} onChange={e => setNewFileName(e.target.value)} required disabled={addAttachmentMutation.isPending}/>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="file-url">Đường dẫn (URL)</Label>
<Input id="file-url" type="url" placeholder="https://..." value={newFileUrl} onChange={e => setNewFileUrl(e.target.value)} required disabled={addAttachmentMutation.isPending}/>
                                        </div>
                                        <Alert>
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertTitle>Làm thế nào để lấy URL?</AlertTitle>
                                            <AlertDescription>
                                                Tải file của bạn lên{" "}
                                                <a href="https://drive.google.com/open?id=1-lgEygGCIfxCbIIdgaCmh3GFJgAMr63e&usp=drive_fs" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                                                    thư mục Drive chung
                                                </a>
                                                , sau đó lấy link chia sẻ công khai và dán vào đây.
                                            </AlertDescription>
                                        </Alert>
                                        <Button type="submit" disabled={addAttachmentMutation.isPending || !newFileName || !newFileUrl}>
                                            {addAttachmentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Lưu liên kết
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                             <div className="flex-grow overflow-hidden">
                        <p className="font-medium mb-2">Danh sách file đã đính kèm</p>
                                <ScrollArea className="h-full pr-4">
                                    {isLoadingAttachments ? (
                                        <div className="space-y-2">
                                            <Skeleton className="h-10 w-full" />
                                            <Skeleton className="h-10 w-full" />
                                            <Skeleton className="h-10 w-full" />
                                        </div>
                                    ) : attachments.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic text-center py-4">Chưa có file nào được đính kèm.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {attachments.map(file => (
                                                <div key={file.id} className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                                                     <Link href={file.duong_dan_luu_tru} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline truncate">
                                                        <LinkIcon className="h-4 w-4 shrink-0"/>
                                                        <span className="truncate">{file.ten_file}</span>
                                                    </Link>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                                                        onClick={() => handleDeleteAttachment(file.id)}
                                                        disabled={!!deletingAttachmentId || deleteAttachmentMutation.isPending}
                                                    >
                                                        {deletingAttachmentId === file.id || deleteAttachmentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="history" className="flex-grow overflow-hidden">
                       <ScrollArea className="h-full pr-4 py-4">
                            {isLoadingHistory ? (
                                <div className="space-y-4">
                                    <Skeleton className="h-20 w-full" />
                                    <Skeleton className="h-20 w-full" />
                                    <Skeleton className="h-20 w-full" />
                                </div>
                            ) : history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                                    <p className="font-semibold">Chưa có lịch sử</p>
                                    <p className="text-sm">Mọi hoạt động sửa chữa, bảo trì sẽ được ghi lại tại đây.</p>
                                </div>
                            ) : (
                                <div className="relative pl-6">
                                    <div className="absolute left-0 top-0 h-full w-0.5 bg-border -translate-x-1/2 ml-3"></div>
                                    {history.map((item) => (
                                        <div key={item.id} className="relative mb-8 last:mb-0">
                                            <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-background -translate-x-1/2 ml-3"></div>
                                            <div className="pl-2">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
                                                        {getHistoryIcon(item.loai_su_kien)}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold">{item.loai_su_kien}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {format(parseISO(item.ngay_thuc_hien), 'dd/MM/yyyy HH:mm', { locale: vi })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="mt-2 ml-10 p-3 rounded-md bg-muted/50 border">
                                                    <p className="text-sm font-medium">{item.mo_ta}</p>

                                                    {/* Repair request details */}
                                                    {item.chi_tiet?.mo_ta_su_co && <p className="text-sm text-muted-foreground mt-1">Sự cố: {item.chi_tiet.mo_ta_su_co}</p>}
                                                    {item.chi_tiet?.hang_muc_sua_chua && <p className="text-sm text-muted-foreground">Hạng mục: {item.chi_tiet.hang_muc_sua_chua}</p>}
                                                    {item.chi_tiet?.nguoi_yeu_cau && <p className="text-sm text-muted-foreground">Người yêu cầu: {item.chi_tiet.nguoi_yeu_cau}</p>}

                                                    {/* Maintenance details */}
                                                    {item.chi_tiet?.ten_ke_hoach && <p className="text-sm text-muted-foreground mt-1">Kế hoạch: {item.chi_tiet.ten_ke_hoach}</p>}
                                                    {item.chi_tiet?.thang && <p className="text-sm text-muted-foreground">Tháng: {item.chi_tiet.thang}/{item.chi_tiet.nam}</p>}

                                                    {/* Transfer details */}
                                                    {item.chi_tiet?.ma_yeu_cau && <p className="text-sm text-muted-foreground mt-1">Mã yêu cầu: {item.chi_tiet.ma_yeu_cau}</p>}
                                                    {item.chi_tiet?.loai_hinh && <p className="text-sm text-muted-foreground">Loại hình: {item.chi_tiet.loai_hinh === 'noi_bo' ? 'Nội bộ' : item.chi_tiet.loai_hinh === 'ben_ngoai' ? 'Bên ngoài' : 'Thanh lý'}</p>}
                                                    {item.chi_tiet?.khoa_phong_hien_tai && item.chi_tiet?.khoa_phong_nhan && (
                                                        <p className="text-sm text-muted-foreground">Từ: {item.chi_tiet.khoa_phong_hien_tai} → {item.chi_tiet.khoa_phong_nhan}</p>
                                                    )}
                                                    {item.chi_tiet?.don_vi_nhan && <p className="text-sm text-muted-foreground">Đơn vị nhận: {item.chi_tiet.don_vi_nhan}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>
                    <TabsContent value="usage" className="flex-grow overflow-hidden">
                        <div className="h-full py-4">
                            <UsageHistoryTab equipment={selectedEquipment} />
                        </div>
                    </TabsContent>
                </Tabs>
                <DialogFooter className="shrink-0 pt-4 border-t">
                  <div className="w-full flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      {user && (user.role === 'global' || user.role === 'admin' || user.role === 'to_qltb' || (user.role === 'qltb_khoa' && user.khoa_phong === selectedEquipment.khoa_phong_quan_ly)) && (
                        !isEditingDetails ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setCurrentTab('details')
                              setIsEditingDetails(true)
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Sửa thông tin
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              type="button"
                              onClick={() => setIsEditingDetails(false)}
                              disabled={updateEquipmentMutation.isPending}
                            >
                              Hủy
                            </Button>
                            <Button
                              type="submit"
                              form="equipment-inline-edit-form"
                              disabled={updateEquipmentMutation.isPending}
                            >
                              {updateEquipmentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Lưu thay đổi
                            </Button>
                          </>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => handleGenerateDeviceLabel(selectedEquipment)}>
                        <QrCode className="mr-2 h-4 w-4" />
                        Tạo nhãn thiết bị
                      </Button>
                      <Button onClick={() => handleGenerateProfileSheet(selectedEquipment)}>
                        <Printer className="mr-2 h-4 w-4" />
                        In lý lịch
                      </Button>
                      <Button variant="outline" onClick={requestCloseDetailDialog}>Đóng</Button>
                    </div>
                  </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="heading-responsive-h2">Danh mục thiết bị</CardTitle>
          <CardDescription className="body-responsive-sm">
            Quản lý danh sách các trang thiết bị y tế.
          </CardDescription>

          {/* Department auto-filter removed */}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Unified toolbar */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between">
              {/* Left: search + filters */}
              <div className="order-1 w-full flex flex-col gap-2 md:flex-row md:flex-1 md:flex-wrap md:items-center md:gap-2 md:min-w-0">
                <div className="w-full md:w-auto md:min-w-[260px]">
                  <Input
                    placeholder="Tìm kiếm chung..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="h-8 w-full"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {(isMobile || useTabletFilters) ? (
                    <MobileFiltersDropdown
                      activeFiltersCount={
                        ((table.getColumn("tinh_trang_hien_tai")?.getFilterValue() as string[])?.length || 0) +
                        ((table.getColumn("khoa_phong_quan_ly")?.getFilterValue() as string[])?.length || 0) +
                        ((table.getColumn("nguoi_dang_truc_tiep_quan_ly")?.getFilterValue() as string[])?.length || 0) +
                        ((table.getColumn("phan_loai_theo_nd98")?.getFilterValue() as string[])?.length || 0)
                      }
                      onClearFilters={() => {
                        table.getColumn("tinh_trang_hien_tai")?.setFilterValue([])
                        table.getColumn("khoa_phong_quan_ly")?.setFilterValue([])
                        table.getColumn("nguoi_dang_truc_tiep_quan_ly")?.setFilterValue([])
                        table.getColumn("phan_loai_theo_nd98")?.setFilterValue([])
                      }}
                    >
                      <DataTableFacetedFilter
                        column={table.getColumn("tinh_trang_hien_tai")}
                        title="Tình trạng"
                        options={statuses.map(s => ({label: s!, value: s!}))}
                      />
                      <DataTableFacetedFilter
                        column={table.getColumn("khoa_phong_quan_ly")}
                        title="Khoa/Phòng"
                        options={departments.filter((d): d is string => !!d).map(d => ({label: d, value: d}))}
                      />
                      <DataTableFacetedFilter
                        column={table.getColumn("nguoi_dang_truc_tiep_quan_ly")}
                        title="Người sử dụng"
                        options={users.filter((d): d is string => !!d).map(d => ({label: d, value: d}))}
                      />
                      <DataTableFacetedFilter
                        column={table.getColumn("phan_loai_theo_nd98")}
                        title="Phân loại"
                        options={classifications.filter((c): c is string => !!c).map(c => ({label: c, value: c}))}
                      />
                    </MobileFiltersDropdown>
                  ) : (
                    <>
                      <DataTableFacetedFilter
                        column={table.getColumn("tinh_trang_hien_tai")}
                        title="Tình trạng"
                        options={statuses.map(s => ({label: s!, value: s!}))}
                      />
                      <DataTableFacetedFilter
                        column={table.getColumn("khoa_phong_quan_ly")}
                        title="Khoa/Phòng"
                        options={departments.filter((d): d is string => !!d).map(d => ({label: d, value: d}))}
                      />
                      <DataTableFacetedFilter
                        column={table.getColumn("nguoi_dang_truc_tiep_quan_ly")}
                        title="Người sử dụng"
                        options={users.filter((d): d is string => !!d).map(d => ({label: d, value: d}))}
                      />
                      <DataTableFacetedFilter
                        column={table.getColumn("phan_loai_theo_nd98")}
                        title="Phân loại"
                        options={classifications.filter((c): c is string => !!c).map(c => ({label: c, value: c}))}
                      />
                      {isFiltered && (
                        <Button
                          variant="ghost"
                          onClick={() => table.resetColumnFilters()}
                          className="h-8 px-2 lg:px-3"
                        >
                          <span className="hidden sm:inline">Xóa tất cả</span>
                          <FilterX className="h-4 w-4 sm:ml-2" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Right: tenant select + actions */}
              <div className="order-3 w-full md:order-2 md:w-auto flex items-center gap-2 justify-between md:justify-end">
                {isGlobal && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Đơn vị</Label>
                    <Select
                      value={tenantFilter}
                      onValueChange={(v) => {
                        console.log('[EquipmentPage] tenant select onValueChange ->', v)
                        React.startTransition(() => setTenantFilter(v))
                      }}
                    >
                      <SelectTrigger className="h-8 w-full md:w-[220px]" disabled={isTenantsLoading}>
                        <SelectValue placeholder="— Chọn đơn vị —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">— Chọn đơn vị —</SelectItem>
                        <SelectItem value="all">Tất cả đơn vị</SelectItem>
                        {isTenantsLoading ? (
                          <SelectItem value="__loading" disabled>Đang tải danh sách đơn vị...</SelectItem>
                        ) : (
                          tenantOptions.map(t => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.name} {t.code ? `(${t.code})` : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Add button */}
                {!isRegionalLeader && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="h-8 gap-1 touch-target-sm md:h-8">
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                          Thêm thiết bị
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setIsAddDialogOpen(true)}>
                        Thêm thủ công
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setIsImportDialogOpen(true)}>
                        Nhập từ Excel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Options menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-8 gap-1 touch-target-sm md:h-8">
                      <Settings className="h-3.5 w-3.5" />
                      Tùy chọn
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onSelect={() => setIsColumnsDialogOpen(true)}>
                      Hiện/ẩn cột
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleDownloadTemplate()}>
                      Tải Excel mẫu
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleExportData()}>
                      Tải về dữ liệu
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Columns dialog */}
          <Dialog open={isColumnsDialogOpen} onOpenChange={setIsColumnsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hiện/Ẩn cột</DialogTitle>
                <DialogDescription>Chọn các cột muốn hiển thị trong bảng.</DialogDescription>
              </DialogHeader>
              <div className="max-h-[50vh] overflow-y-auto space-y-1">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <div key={column.id} className="flex items-center justify-between py-1">
                      <span className="text-sm text-muted-foreground">
                        {columnLabels[column.id as keyof Equipment] || column.id}
                      </span>
                      <Button
                        variant={column.getIsVisible() ? 'secondary' : 'outline'}
                        size="sm"
                        className="h-7"
                        onClick={() => column.toggleVisibility(!column.getIsVisible())}
                      >
                        {column.getIsVisible() ? 'Ẩn' : 'Hiện'}
                      </Button>
                    </div>
                  ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsColumnsDialogOpen(false)}>Đóng</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="mt-4">
            {renderContent()}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          {shouldFetchEquipment ? (
            <>
              {/* Records count - responsive position */}
              <div className="order-2 sm:order-1">
                <ResponsivePaginationInfo
                  currentCount={data.length}
                  totalCount={total}
                  currentPage={pagination.pageIndex + 1}
                  totalPages={pageCount}
                />
              </div>
              
              {/* Export and pagination controls */}
              <div className="flex flex-col gap-3 items-center order-1 sm:order-2 sm:items-end">
                <button
                  onClick={handleExportData}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                  disabled={table.getFilteredRowModel().rows.length === 0 || isEqLoading}
                >
                  Tải về file Excel
                </button>
                
                {/* Mobile-optimized pagination */}
                <div className="flex flex-col gap-3 items-center sm:flex-row sm:gap-6">
                  {/* Page size selector */}
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">Số dòng</p>
                    <Select
                      value={`${pagination.pageSize}`}
                      onValueChange={(value) => {
                        setPagination((p) => ({ ...p, pageSize: Number(value), pageIndex: 0 }))
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={pagination.pageSize} />
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
                  
                  {/* Page info and navigation */}
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
                    <div className="text-sm font-medium hidden sm:block">
                      Trang {pagination.pageIndex + 1} / {pageCount}
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 sm:flex"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                      >
                        <span className="sr-only">Go to first page</span>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                      >
                        <span className="sr-only">Go to previous page</span>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                      >
                        <span className="sr-only">Go to next page</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 sm:flex"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                      >
                        <span className="sr-only">Go to last page</span>
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </CardFooter>
      </Card>
      <StartUsageDialog
        open={isStartUsageDialogOpen}
        onOpenChange={(open) => {
          setIsStartUsageDialogOpen(open);
          if (!open) {
            setStartUsageEquipment(null);
          }
        }}
        equipment={startUsageEquipment}
      />

    </>
  )
}
