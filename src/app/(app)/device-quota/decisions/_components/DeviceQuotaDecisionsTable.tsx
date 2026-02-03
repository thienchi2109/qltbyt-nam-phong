"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Eye, Edit, CheckCircle, Trash2, Loader2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeviceQuotaDecisionsContext } from "../_hooks/useDeviceQuotaDecisionsContext"
import type { Decision } from "./DeviceQuotaDecisionsContext"

// ============================================
// Helper: Format date to DD/MM/YYYY
// ============================================

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  try {
    const [year, month, day] = dateStr.split("-")
    return `${day}/${month}/${year}`
  } catch {
    return dateStr
  }
}

// ============================================
// Helper: Status Badge
// ============================================

function StatusBadge({ status }: { status: Decision["trang_thai"] }) {
  const variants = {
    draft: { variant: "outline" as const, label: "Nháp", className: "border-gray-400 text-gray-700" },
    active: { variant: "default" as const, label: "Đang áp dụng", className: "bg-green-600 hover:bg-green-700" },
    inactive: { variant: "outline" as const, label: "Không áp dụng", className: "border-gray-400 text-gray-600" },
  }

  const config = variants[status] || variants.draft

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}

// ============================================
// Loading Skeleton
// ============================================

function TableLoadingSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, idx) => (
        <TableRow key={idx}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-6 w-28" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

// ============================================
// Empty State
// ============================================

function EmptyState() {
  return (
    <TableRow>
      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
        <div className="flex flex-col items-center justify-center gap-2">
          <span className="text-lg font-medium">Chưa có quyết định nào</span>
          <span className="text-sm">Nhấn &quot;Thêm quyết định&quot; để tạo mới</span>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ============================================
// Mobile Card View (Responsive)
// ============================================

interface MobileDecisionCardProps {
  decision: Decision
  onView: () => void
  onEdit: () => void
  onActivate: () => void
  onDelete: () => void
}

function MobileDecisionCard({ decision, onView, onEdit, onActivate, onDelete }: MobileDecisionCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <p className="font-medium text-base">{decision.so_quyet_dinh}</p>
          <p className="text-sm text-muted-foreground">
            Ngày ban hành: {formatDate(decision.ngay_ban_hanh)}
          </p>
          <p className="text-sm text-muted-foreground">
            Ngày hiệu lực: {formatDate(decision.ngay_hieu_luc)}
          </p>
        </div>
        <StatusBadge status={decision.trang_thai} />
      </div>

      <div className="flex gap-2 flex-wrap pt-2">
        <Button variant="outline" size="sm" onClick={onView} className="flex-1">
          <Eye className="mr-2 h-4 w-4" />
          Xem
        </Button>
        {decision.trang_thai === "draft" && (
          <>
            <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
              <Edit className="mr-2 h-4 w-4" />
              Sửa
            </Button>
            <Button variant="outline" size="sm" onClick={onActivate}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Kích hoạt
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Xóa
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================
// Actions Dropdown
// ============================================

interface ActionsDropdownProps {
  decision: Decision
  onView: () => void
  onEdit: () => void
  onActivate: () => void
  onDelete: () => void
}

function ActionsDropdown({ decision, onView, onEdit, onActivate, onDelete }: ActionsDropdownProps) {
  const isDraft = decision.trang_thai === "draft"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Mở menu hành động</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}>
          <Eye className="mr-2 h-4 w-4" />
          Xem chi tiết
        </DropdownMenuItem>

        {isDraft && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Chỉnh sửa
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onActivate}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Kích hoạt
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Xóa
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ============================================
// Main Table Component
// ============================================

export function DeviceQuotaDecisionsTable() {
  const router = useRouter()
  const {
    decisions,
    isLoading,
    openEditDialog,
    activateMutation,
    deleteMutation,
  } = useDeviceQuotaDecisionsContext()

  // Confirmation dialogs state
  const [activateDialog, setActivateDialog] = React.useState<Decision | null>(null)
  const [deleteDialog, setDeleteDialog] = React.useState<Decision | null>(null)

  // Navigate to decision detail page
  const handleViewDetails = React.useCallback((decisionId: number) => {
    router.push(`/device-quota/decisions/${decisionId}`)
  }, [router])

  const handleActivateConfirm = React.useCallback(() => {
    if (!activateDialog) return
    activateMutation.mutate(activateDialog.id)
    setActivateDialog(null)
  }, [activateDialog, activateMutation])

  const handleDeleteConfirm = React.useCallback(() => {
    if (!deleteDialog) return
    deleteMutation.mutate(deleteDialog.id)
    setDeleteDialog(null)
  }, [deleteDialog, deleteMutation])

  return (
    <>
      {/* Desktop Table View (hidden on mobile) */}
      <div className="hidden md:block rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-muted/50 border-b border-border/60">
              <TableHead className="text-xs font-semibold uppercase tracking-wider">
                Số quyết định
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">
                Ngày ban hành
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">
                Ngày hiệu lực
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">
                Trạng thái
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider w-[60px]">
                <span className="sr-only">Hành động</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoadingSkeleton />
            ) : decisions.length === 0 ? (
              <EmptyState />
            ) : (
              decisions.map((decision) => (
                <TableRow key={decision.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">{decision.so_quyet_dinh}</TableCell>
                  <TableCell>{formatDate(decision.ngay_ban_hanh)}</TableCell>
                  <TableCell>{formatDate(decision.ngay_hieu_luc)}</TableCell>
                  <TableCell>
                    <StatusBadge status={decision.trang_thai} />
                  </TableCell>
                  <TableCell>
                    <ActionsDropdown
                      decision={decision}
                      onView={() => handleViewDetails(decision.id)}
                      onEdit={() => openEditDialog(decision)}
                      onActivate={() => setActivateDialog(decision)}
                      onDelete={() => setDeleteDialog(decision)}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="h-40 w-full" />
            ))}
          </div>
        ) : decisions.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            <p className="font-medium">Chưa có quyết định nào</p>
            <p className="text-sm mt-1">Nhấn &quot;Thêm quyết định&quot; để tạo mới</p>
          </div>
        ) : (
          decisions.map((decision) => (
            <MobileDecisionCard
              key={decision.id}
              decision={decision}
              onView={() => handleViewDetails(decision.id)}
              onEdit={() => openEditDialog(decision)}
              onActivate={() => setActivateDialog(decision)}
              onDelete={() => setDeleteDialog(decision)}
            />
          ))
        )}
      </div>

      {/* Activate Confirmation Dialog */}
      <AlertDialog open={!!activateDialog} onOpenChange={(open) => !open && setActivateDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kích hoạt quyết định</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn kích hoạt quyết định <strong>{activateDialog?.so_quyet_dinh}</strong>?
              <br />
              <br />
              Khi kích hoạt, quyết định cũ sẽ tự động ngưng áp dụng và quyết định này sẽ có hiệu lực.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleActivateConfirm}
              disabled={activateMutation.isPending}
            >
              {activateMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Kích hoạt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa quyết định</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa quyết định <strong>{deleteDialog?.so_quyet_dinh}</strong>?
              <br />
              <br />
              Hành động này không thể hoàn tác. Tất cả dữ liệu định mức liên quan sẽ bị xóa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
