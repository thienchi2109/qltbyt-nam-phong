import type { ColumnDef } from "@tanstack/react-table"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ArrowUpDown, MoreHorizontal, Edit, Trash2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { vi } from 'date-fns/locale'
import type { RepairRequestWithEquipment } from "../types"
import { calculateDaysRemaining, getStatusVariant } from "../utils"
import { cn } from "@/lib/utils"

/**
 * Authenticated user type from NextAuth session (matches module augmentation in src/types/next-auth.d.ts)
 */
export type AuthUser = {
  id: string
  username: string
  role: string
  khoa_phong?: string | null
  don_vi?: string | number | null
  current_don_vi?: number | null
  dia_ban_id?: string | number | null
  dia_ban_ma?: string | null
  full_name?: string | null
}

/**
 * Options for repair request table columns.
 * All action callbacks are passed from parent component.
 */
export interface RepairRequestColumnOptions {
  /** Generate sheet for viewing/printing request */
  onGenerateSheet: (request: RepairRequestWithEquipment) => void
  /** Set request for editing */
  setEditingRequest: (req: RepairRequestWithEquipment | null) => void
  /** Set request for deletion */
  setRequestToDelete: (req: RepairRequestWithEquipment | null) => void
  /** Handle approval workflow */
  handleApproveRequest: (req: RepairRequestWithEquipment) => void
  /** Handle completion workflow */
  handleCompletion: (req: RepairRequestWithEquipment, type: 'Hoàn thành' | 'Không HT') => void
  /** Set request for detail view */
  setRequestToView: (req: RepairRequestWithEquipment | null) => void
  /** Current user from session (typed, not 'any') */
  user: AuthUser | null | undefined
  /** Whether current user is a regional leader (read-only) */
  isRegionalLeader: boolean
}

/**
 * Renders the actions dropdown menu for a repair request row.
 * Actions vary based on request status and user permissions.
 * Exported for use in mobile card view.
 */
export function renderActions(
  request: RepairRequestWithEquipment,
  options: RepairRequestColumnOptions
) {
  const {
    onGenerateSheet,
    setEditingRequest,
    setRequestToDelete,
    handleApproveRequest,
    handleCompletion,
    user,
    isRegionalLeader
  } = options

  if (!user) return null
  // Regional leaders are read-only, hide all actions
  if (isRegionalLeader) return null
  const canManage = user.role === 'global' || user.role === 'admin' || user.role === 'to_qltb'

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
        <DropdownMenuItem onClick={() => onGenerateSheet(request)}>
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
}

/**
 * Creates memoized column definitions for repair requests table.
 * Uses useMemo to prevent unnecessary re-renders.
 */
export function useRepairRequestColumns(options: RepairRequestColumnOptions): ColumnDef<RepairRequestWithEquipment>[] {
  const columns = useMemo<ColumnDef<RepairRequestWithEquipment>[]>(() => [
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
                <span className={`text-xs font-medium ${daysInfo.status === 'success' ? 'text-green-600' :
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
            <Badge
              variant="outline"
              className={cn(
                "self-start whitespace-nowrap font-normal",
                request.trang_thai === 'Chờ xử lý' && "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
                request.trang_thai === 'Đã duyệt' && "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
                request.trang_thai === 'Hoàn thành' && "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
                request.trang_thai === 'Không HT' && "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
              )}
            >
              {request.trang_thai}
            </Badge>
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
          {renderActions(row.original, options)}
        </div>
      ),
    },
  ], [options]) // Only recreate when options change

  return columns
}
