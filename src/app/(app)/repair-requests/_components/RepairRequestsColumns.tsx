import type { ColumnDef } from "@tanstack/react-table"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ArrowUpDown, MoreHorizontal, Edit, Trash2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { vi } from 'date-fns/locale'
import type { RepairRequestWithEquipment, AuthUser } from "../types"
import { calculateDaysRemaining, getStatusVariant } from "../utils"
import { cn } from "@/lib/utils"

// Re-export for backward compatibility
export type { AuthUser } from "../types"

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
          <div className="space-y-0.5">
            <div className="font-medium text-base text-foreground/90">{request.thiet_bi?.ten_thiet_bi || 'N/A'}</div>
            <div className="text-sm text-muted-foreground truncate max-w-[16rem]">{request.mo_ta_su_co}</div>
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
        <Button variant="ghost" className="hover:bg-transparent px-0 font-semibold text-muted-foreground" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Người yêu cầu
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const nguoiYeuCau = row.getValue("nguoi_yeu_cau") as string | null;
        return (
          <div className="text-sm font-medium text-foreground/80">
            {nguoiYeuCau || <span className="text-muted-foreground italic font-normal">N/A</span>}
          </div>
        );
      },
    },
    // 3. Ngày yêu cầu
    {
      accessorKey: "ngay_yeu_cau",
      header: ({ column }) => (
        <Button variant="ghost" className="hover:bg-transparent px-0 font-semibold text-muted-foreground" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Ngày yêu cầu
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => <div className="text-sm text-foreground/80">{format(parseISO(row.getValue("ngay_yeu_cau")), 'dd/MM/yyyy HH:mm', { locale: vi })}</div>,
    },
    // 4. Ngày mong muốn hoàn thành
    {
      accessorKey: "ngay_mong_muon_hoan_thanh",
      header: ({ column }) => (
        <Button variant="ghost" className="hover:bg-transparent px-0 font-semibold text-muted-foreground" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Hạn hoàn thành
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
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
          <div className="space-y-1.5 w-[180px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground/90 whitespace-nowrap">
                {format(parseISO(ngayMongMuon), 'dd/MM/yyyy', { locale: vi })}
              </span>
              {daysInfo && (
                <span className={`text-[10px] uppercase font-bold tracking-tight whitespace-nowrap ${daysInfo.status === 'success' ? 'text-emerald-600' :
                  daysInfo.status === 'warning' ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                  {daysInfo.text}
                </span>
              )}
            </div>

            {daysInfo && (
              <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${daysInfo.color} transition-all duration-500 ease-out`}
                  style={{
                    width: daysInfo.days > 0
                      ? `${Math.min(100, Math.max(5, (daysInfo.days / 14) * 100))}%`
                      : '100%'
                  }}
                />
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
        <Button variant="ghost" className="hover:bg-transparent px-0 font-semibold text-muted-foreground" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Trạng thái
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const request = row.original
        return (
          <div className="flex flex-col gap-1.5 item-start">
            <Badge
              variant="secondary"
              className={cn(
                "w-fit whitespace-nowrap px-2.5 py-0.5 text-xs font-semibold rounded-md border-0 ring-0 shadow-none",
                request.trang_thai === 'Chờ xử lý' && "bg-orange-50 text-orange-700 hover:bg-orange-100",
                request.trang_thai === 'Đã duyệt' && "bg-blue-50 text-blue-700 hover:bg-blue-100",
                request.trang_thai === 'Hoàn thành' && "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                request.trang_thai === 'Không HT' && "bg-rose-50 text-rose-700 hover:bg-rose-100",
              )}
            >
              {request.trang_thai}
            </Badge>
            {request.trang_thai === 'Đã duyệt' && request.ngay_duyet && (
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground/80">
                <span>{format(parseISO(request.ngay_duyet), 'dd/MM/yyyy HH:mm', { locale: vi })}</span>
                {request.nguoi_duyet && (
                  <span className="text-blue-600/90 font-medium">Bởi: {request.nguoi_duyet}</span>
                )}
              </div>
            )}
            {(request.trang_thai === 'Hoàn thành' || request.trang_thai === 'Không HT') && request.ngay_hoan_thanh && (
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground/80">
                <span>{format(parseISO(request.ngay_hoan_thanh), 'dd/MM/yyyy HH:mm', { locale: vi })}</span>
                {request.nguoi_xac_nhan && (
                  <span className="text-emerald-600/90 font-medium">Bởi: {request.nguoi_xac_nhan}</span>
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
