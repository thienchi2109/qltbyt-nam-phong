# RepairRequests Context Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce prop drilling and file size in RepairRequestsPageClient.tsx by introducing a Context provider, extracting components, and using local form state in dialogs.

**Architecture:** Hybrid context approach - shared state (dialogs, user, mutations) in context, form state local to each dialog. Extract Table and Toolbar into separate components. Use TanStack Query mutations with `isPending` for loading states. Prefix all files with `RepairRequests` for grep-ability.

**Tech Stack:** React Context API, TanStack Query mutations, TypeScript

---

## Summary of Changes

| Metric | Before | After |
|--------|--------|-------|
| Main file size | 1207 lines | ~450 lines |
| EditDialog props | 15 | 0 |
| CreateSheet props | 22 | 0 |
| Total prop drilling | ~60 props | ~5 props |
| Files renamed | 0 | 12 |
| New files | 0 | 4 |

## Dependency Graph (Current)

```
page.tsx → RepairRequestsPageClient.tsx (1207 lines)
                ↓ imports
    ┌───────────┼───────────┬───────────┐
    ↓           ↓           ↓           ↓
 types.ts   _hooks/*    dialogs/*   columns.tsx
    ↑           │           ↑           │
    └───────────┴───────────┴───────────┘
                ↑
    AuthUser defined in columns.tsx (BAD!)
    Imported by _hooks/* (circular-ish)
```

## Dependency Graph (Target)

```
page.tsx → RepairRequestsPageClient.tsx (~450 lines)
                ↓ wraps with
        RepairRequestsProvider
                ↓ renders
    ┌───────────┼───────────┐
    ↓           ↓           ↓
 Toolbar     Table      Dialogs (self-contained)
    ↓           ↓           ↓
    └───────────┴───────────┘
                ↓ all consume
        useRepairRequestsContext()
                ↓ provides
    { user, mutations, openDialog, closeDialog }
```

---

## Phase 1: Foundation (Fix Type Location)

### Task 1.1: Move AuthUser to types.ts

**Files:**
- Modify: `src/app/(app)/repair-requests/types.ts`
- Modify: `src/app/(app)/repair-requests/_components/repair-requests-columns.tsx`
- Modify: `src/app/(app)/repair-requests/_hooks/useRepairRequestMutations.ts`
- Modify: `src/app/(app)/repair-requests/_hooks/useRepairRequestWorkflows.ts`

**Step 1: Add AuthUser to types.ts**

```typescript
// Add at end of types.ts

/**
 * Authenticated user type from NextAuth session
 * (matches module augmentation in src/types/next-auth.d.ts)
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
```

**Step 2: Update repair-requests-columns.tsx**

```typescript
// Change line 16-26 FROM:
export type AuthUser = {
  id: string
  // ... all fields
}

// TO:
import type { AuthUser } from "../types"
// Remove the local AuthUser definition entirely
// Keep the re-export for backward compatibility:
export type { AuthUser } from "../types"
```

**Step 3: Update useRepairRequestMutations.ts**

```typescript
// Change line 4 FROM:
import type { AuthUser } from "../_components/repair-requests-columns"

// TO:
import type { AuthUser } from "../types"
```

**Step 4: Update useRepairRequestWorkflows.ts**

```typescript
// Change line 3 FROM:
import type { AuthUser } from "../_components/repair-requests-columns"

// TO:
import type { AuthUser } from "../types"
```

**Step 5: Verify no TypeScript errors**

Run: `npm run typecheck`
Expected: No errors related to AuthUser

**Step 6: Commit**

```bash
git add src/app/(app)/repair-requests/types.ts
git add src/app/(app)/repair-requests/_components/repair-requests-columns.tsx
git add src/app/(app)/repair-requests/_hooks/useRepairRequestMutations.ts
git add src/app/(app)/repair-requests/_hooks/useRepairRequestWorkflows.ts
git commit -m "refactor(repair-requests): move AuthUser type to types.ts

- Fixes circular-ish dependency where hooks imported from component file
- AuthUser now exported from types.ts (single source of truth)
- columns.tsx re-exports for backward compatibility"
```

---

## Phase 2: Create Context Provider

### Task 2.1: Create RepairRequestsContext

**Files:**
- Create: `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`
- Create: `src/app/(app)/repair-requests/_hooks/useRepairRequestsContext.ts`

**Step 1: Create context types and provider**

Create `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`:

```typescript
"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import { format } from "date-fns"
import type {
  RepairRequestWithEquipment,
  RepairUnit,
  AuthUser
} from "../types"

// ============================================
// Context Types
// ============================================

interface DialogState {
  requestToEdit: RepairRequestWithEquipment | null
  requestToDelete: RepairRequestWithEquipment | null
  requestToApprove: RepairRequestWithEquipment | null
  requestToComplete: RepairRequestWithEquipment | null
  requestToView: RepairRequestWithEquipment | null
  completionType: 'Hoàn thành' | 'Không HT' | null
  isCreateOpen: boolean
}

interface RepairRequestsContextValue {
  // User/Auth
  user: AuthUser | null
  canSetRepairUnit: boolean
  isRegionalLeader: boolean

  // Dialog state
  dialogState: DialogState

  // Dialog actions
  openEditDialog: (request: RepairRequestWithEquipment) => void
  openDeleteDialog: (request: RepairRequestWithEquipment) => void
  openApproveDialog: (request: RepairRequestWithEquipment) => void
  openCompleteDialog: (request: RepairRequestWithEquipment, type: 'Hoàn thành' | 'Không HT') => void
  openViewDialog: (request: RepairRequestWithEquipment) => void
  openCreateSheet: () => void
  closeAllDialogs: () => void

  // Mutations
  createMutation: ReturnType<typeof useCreateMutation>
  updateMutation: ReturnType<typeof useUpdateMutation>
  deleteMutation: ReturnType<typeof useDeleteMutation>
  approveMutation: ReturnType<typeof useApproveMutation>
  completeMutation: ReturnType<typeof useCompleteMutation>

  // Cache invalidation
  invalidateAndRefetch: () => void
}

// ============================================
// Mutation Hooks
// ============================================

function useCreateMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void
) {
  return useMutation({
    mutationFn: async (data: {
      thiet_bi_id: number
      mo_ta_su_co: string
      hang_muc_sua_chua: string
      ngay_mong_muon_hoan_thanh: string | null
      nguoi_yeu_cau: string
      don_vi_thuc_hien: RepairUnit | null
      ten_don_vi_thue: string | null
    }) => {
      return callRpc({
        fn: 'repair_request_create',
        args: {
          p_thiet_bi_id: data.thiet_bi_id,
          p_mo_ta_su_co: data.mo_ta_su_co,
          p_hang_muc_sua_chua: data.hang_muc_sua_chua,
          p_ngay_mong_muon_hoan_thanh: data.ngay_mong_muon_hoan_thanh,
          p_nguoi_yeu_cau: data.nguoi_yeu_cau,
          p_don_vi_thuc_hien: data.don_vi_thuc_hien,
          p_ten_don_vi_thue: data.ten_don_vi_thue,
        }
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Yêu cầu sửa chữa đã được gửi." })
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Gửi yêu cầu thất bại",
        description: error.message
      })
    },
  })
}

function useUpdateMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void
) {
  return useMutation({
    mutationFn: async (data: {
      id: number
      mo_ta_su_co: string
      hang_muc_sua_chua: string
      ngay_mong_muon_hoan_thanh: string | null
      don_vi_thuc_hien?: RepairUnit
      ten_don_vi_thue: string | null
    }) => {
      return callRpc({
        fn: 'repair_request_update',
        args: {
          p_id: data.id,
          p_mo_ta_su_co: data.mo_ta_su_co,
          p_hang_muc_sua_chua: data.hang_muc_sua_chua,
          p_ngay_mong_muon_hoan_thanh: data.ngay_mong_muon_hoan_thanh,
          p_don_vi_thuc_hien: data.don_vi_thuc_hien,
          p_ten_don_vi_thue: data.ten_don_vi_thue,
        }
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã cập nhật yêu cầu." })
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật",
        description: error.message
      })
    },
  })
}

function useDeleteMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void
) {
  return useMutation({
    mutationFn: async (id: number) => {
      return callRpc({ fn: 'repair_request_delete', args: { p_id: id } })
    },
    onSuccess: () => {
      toast({ title: "Đã xóa", description: "Yêu cầu đã được xóa thành công." })
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi xóa yêu cầu",
        description: error.message
      })
    },
  })
}

function useApproveMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void,
  user: AuthUser | null
) {
  return useMutation({
    mutationFn: async (data: {
      id: number
      don_vi_thuc_hien: RepairUnit
      ten_don_vi_thue: string | null
    }) => {
      return callRpc({
        fn: 'repair_request_approve',
        args: {
          p_id: data.id,
          p_nguoi_duyet: user?.full_name || user?.username || '',
          p_don_vi_thuc_hien: data.don_vi_thuc_hien,
          p_ten_don_vi_thue: data.ten_don_vi_thue,
        }
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã duyệt yêu cầu." })
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi duyệt yêu cầu",
        description: error.message
      })
    },
  })
}

function useCompleteMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void
) {
  return useMutation({
    mutationFn: async (data: {
      id: number
      completion: string | null
      reason: string | null
    }) => {
      return callRpc({
        fn: 'repair_request_complete',
        args: {
          p_id: data.id,
          p_completion: data.completion,
          p_reason: data.reason,
        }
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã cập nhật trạng thái yêu cầu." })
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật yêu cầu",
        description: error.message
      })
    },
  })
}

// ============================================
// Context
// ============================================

const RepairRequestsContext = React.createContext<RepairRequestsContextValue | null>(null)

// ============================================
// Provider
// ============================================

interface RepairRequestsProviderProps {
  children: React.ReactNode
}

export function RepairRequestsProvider({ children }: RepairRequestsProviderProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const user = session?.user as AuthUser | null

  // Computed permissions
  const canSetRepairUnit = !!user && ['global', 'to_qltb'].includes(user.role)
  const isRegionalLeader = !!user && user.role === 'regional_leader'

  // Dialog state
  const [dialogState, setDialogState] = React.useState<DialogState>({
    requestToEdit: null,
    requestToDelete: null,
    requestToApprove: null,
    requestToComplete: null,
    requestToView: null,
    completionType: null,
    isCreateOpen: false,
  })

  // Cache invalidation
  const invalidateAndRefetch = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['repair_request_list'] })
    queryClient.invalidateQueries({ queryKey: ['repair_request_facilities'] })
    queryClient.invalidateQueries({ queryKey: ['repair_request_status_counts'] })
  }, [queryClient])

  // Mutations
  const createMutation = useCreateMutation(toast, invalidateAndRefetch)
  const updateMutation = useUpdateMutation(toast, invalidateAndRefetch)
  const deleteMutation = useDeleteMutation(toast, invalidateAndRefetch)
  const approveMutation = useApproveMutation(toast, invalidateAndRefetch, user)
  const completeMutation = useCompleteMutation(toast, invalidateAndRefetch)

  // Dialog actions
  const openEditDialog = React.useCallback((request: RepairRequestWithEquipment) => {
    setDialogState(prev => ({ ...prev, requestToEdit: request }))
  }, [])

  const openDeleteDialog = React.useCallback((request: RepairRequestWithEquipment) => {
    setDialogState(prev => ({ ...prev, requestToDelete: request }))
  }, [])

  const openApproveDialog = React.useCallback((request: RepairRequestWithEquipment) => {
    setDialogState(prev => ({ ...prev, requestToApprove: request }))
  }, [])

  const openCompleteDialog = React.useCallback((
    request: RepairRequestWithEquipment,
    type: 'Hoàn thành' | 'Không HT'
  ) => {
    setDialogState(prev => ({
      ...prev,
      requestToComplete: request,
      completionType: type
    }))
  }, [])

  const openViewDialog = React.useCallback((request: RepairRequestWithEquipment) => {
    setDialogState(prev => ({ ...prev, requestToView: request }))
  }, [])

  const openCreateSheet = React.useCallback(() => {
    setDialogState(prev => ({ ...prev, isCreateOpen: true }))
  }, [])

  const closeAllDialogs = React.useCallback(() => {
    setDialogState({
      requestToEdit: null,
      requestToDelete: null,
      requestToApprove: null,
      requestToComplete: null,
      requestToView: null,
      completionType: null,
      isCreateOpen: false,
    })
  }, [])

  const value: RepairRequestsContextValue = {
    user,
    canSetRepairUnit,
    isRegionalLeader,
    dialogState,
    openEditDialog,
    openDeleteDialog,
    openApproveDialog,
    openCompleteDialog,
    openViewDialog,
    openCreateSheet,
    closeAllDialogs,
    createMutation,
    updateMutation,
    deleteMutation,
    approveMutation,
    completeMutation,
    invalidateAndRefetch,
  }

  return (
    <RepairRequestsContext.Provider value={value}>
      {children}
    </RepairRequestsContext.Provider>
  )
}

export { RepairRequestsContext }
```

**Step 2: Create context consumer hook**

Create `src/app/(app)/repair-requests/_hooks/useRepairRequestsContext.ts`:

```typescript
import { useContext } from "react"
import { RepairRequestsContext } from "../_components/RepairRequestsContext"

/**
 * Hook to access RepairRequests context.
 * Must be used within RepairRequestsProvider.
 */
export function useRepairRequestsContext() {
  const context = useContext(RepairRequestsContext)
  if (!context) {
    throw new Error(
      'useRepairRequestsContext must be used within RepairRequestsProvider'
    )
  }
  return context
}
```

**Step 3: Verify no TypeScript errors**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx
git add src/app/(app)/repair-requests/_hooks/useRepairRequestsContext.ts
git commit -m "feat(repair-requests): add RepairRequestsContext provider

- Centralized dialog state management
- TanStack Query mutations with automatic toast/invalidation
- User permissions (canSetRepairUnit, isRegionalLeader)
- Dialog open/close actions"
```

---

## Phase 3: Refactor Dialogs to Use Context

### Task 3.1: Refactor EditRequestDialog

**Files:**
- Modify: `src/app/(app)/repair-requests/_components/EditRequestDialog.tsx`

**Step 1: Refactor to use context and local form state**

Replace entire file with:

```typescript
"use client"

import * as React from "react"
import { parseISO, format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import type { RepairUnit } from "../types"

export function RepairRequestsEditDialog() {
  const {
    dialogState: { requestToEdit },
    closeAllDialogs,
    updateMutation,
    canSetRepairUnit,
  } = useRepairRequestsContext()

  // Local form state
  const [issueDescription, setIssueDescription] = React.useState("")
  const [repairItems, setRepairItems] = React.useState("")
  const [desiredDate, setDesiredDate] = React.useState<Date | undefined>()
  const [repairUnit, setRepairUnit] = React.useState<RepairUnit>("noi_bo")
  const [externalCompanyName, setExternalCompanyName] = React.useState("")

  // Populate form when dialog opens
  React.useEffect(() => {
    if (requestToEdit) {
      setIssueDescription(requestToEdit.mo_ta_su_co)
      setRepairItems(requestToEdit.hang_muc_sua_chua || "")
      setDesiredDate(
        requestToEdit.ngay_mong_muon_hoan_thanh
          ? parseISO(requestToEdit.ngay_mong_muon_hoan_thanh)
          : undefined
      )
      setRepairUnit(requestToEdit.don_vi_thuc_hien || "noi_bo")
      setExternalCompanyName(requestToEdit.ten_don_vi_thue || "")
    }
  }, [requestToEdit])

  const handleSubmit = () => {
    if (!requestToEdit) return

    updateMutation.mutate(
      {
        id: requestToEdit.id,
        mo_ta_su_co: issueDescription,
        hang_muc_sua_chua: repairItems,
        ngay_mong_muon_hoan_thanh: desiredDate
          ? format(desiredDate, "yyyy-MM-dd")
          : null,
        don_vi_thuc_hien: canSetRepairUnit ? repairUnit : undefined,
        ten_don_vi_thue: canSetRepairUnit && repairUnit === "thue_ngoai"
          ? externalCompanyName.trim()
          : null,
      },
      { onSuccess: closeAllDialogs }
    )
  }

  if (!requestToEdit) return null

  return (
    <Dialog open={!!requestToEdit} onOpenChange={(open) => !open && closeAllDialogs()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa yêu cầu sửa chữa</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin cho yêu cầu của thiết bị: {requestToEdit.thiet_bi?.ten_thiet_bi}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 mobile-card-spacing">
          <div className="space-y-2">
            <Label htmlFor="edit-issue">Mô tả sự cố</Label>
            <Textarea
              id="edit-issue"
              placeholder="Mô tả chi tiết vấn đề gặp phải..."
              rows={4}
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-repair-items">Các hạng mục yêu cầu sửa chữa</Label>
            <Textarea
              id="edit-repair-items"
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
                  variant="outline"
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
                  disabled={(date) => {
                    const requestDate = requestToEdit?.ngay_yeu_cau
                      ? new Date(requestToEdit.ngay_yeu_cau)
                      : new Date()
                    return date < new Date(requestDate.setHours(0, 0, 0, 0))
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {canSetRepairUnit && (
            <div className="space-y-2">
              <Label htmlFor="edit-repair-unit">Đơn vị thực hiện</Label>
              <Select
                value={repairUnit}
                onValueChange={(value) => setRepairUnit(value as RepairUnit)}
              >
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

          {canSetRepairUnit && repairUnit === "thue_ngoai" && (
            <div className="space-y-2">
              <Label htmlFor="edit-external-company">Tên đơn vị được thuê</Label>
              <Input
                id="edit-external-company"
                placeholder="Nhập tên đơn vị được thuê sửa chữa..."
                value={externalCompanyName}
                onChange={(e) => setExternalCompanyName(e.target.value)}
                required
                className="touch-target"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={closeAllDialogs}
            disabled={updateMutation.isPending}
            className="touch-target"
          >
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="touch-target"
          >
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Verify no TypeScript errors**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(app)/repair-requests/_components/EditRequestDialog.tsx
git commit -m "refactor(repair-requests): EditDialog uses context + local form state

- Consumes context via useRepairRequestsContext()
- Form state managed locally (no prop drilling)
- Uses updateMutation.isPending for loading state
- Props reduced from 15 to 0"
```

---

### Task 3.2: Refactor DeleteRequestDialog

**Files:**
- Modify: `src/app/(app)/repair-requests/_components/DeleteRequestDialog.tsx`

**Step 1: Refactor to use context**

Replace entire file with:

```typescript
"use client"

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
import { Loader2 } from "lucide-react"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"

export function RepairRequestsDeleteDialog() {
  const {
    dialogState: { requestToDelete },
    closeAllDialogs,
    deleteMutation,
  } = useRepairRequestsContext()

  const handleConfirm = () => {
    if (!requestToDelete) return
    deleteMutation.mutate(requestToDelete.id, { onSuccess: closeAllDialogs })
  }

  if (!requestToDelete) return null

  return (
    <AlertDialog open={!!requestToDelete} onOpenChange={(open) => !open && closeAllDialogs()}>
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
          <AlertDialogCancel disabled={deleteMutation.isPending}>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleteMutation.isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xóa
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/repair-requests/_components/DeleteRequestDialog.tsx
git commit -m "refactor(repair-requests): DeleteDialog uses context

- Props reduced from 4 to 0
- Uses deleteMutation.isPending for loading"
```

---

### Task 3.3: Refactor ApproveRequestDialog

**Files:**
- Modify: `src/app/(app)/repair-requests/_components/ApproveRequestDialog.tsx`

**Step 1: Refactor to use context + local form state**

Replace entire file with:

```typescript
"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import { Loader2 } from "lucide-react"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import type { RepairUnit } from "../types"

export function RepairRequestsApproveDialog() {
  const {
    dialogState: { requestToApprove },
    closeAllDialogs,
    approveMutation,
  } = useRepairRequestsContext()

  // Local form state
  const [repairUnit, setRepairUnit] = React.useState<RepairUnit>("noi_bo")
  const [externalCompanyName, setExternalCompanyName] = React.useState("")

  // Reset form when dialog opens
  React.useEffect(() => {
    if (requestToApprove) {
      setRepairUnit("noi_bo")
      setExternalCompanyName("")
    }
  }, [requestToApprove])

  const handleConfirm = () => {
    if (!requestToApprove) return

    approveMutation.mutate(
      {
        id: requestToApprove.id,
        don_vi_thuc_hien: repairUnit,
        ten_don_vi_thue: repairUnit === "thue_ngoai"
          ? externalCompanyName.trim()
          : null,
      },
      { onSuccess: closeAllDialogs }
    )
  }

  if (!requestToApprove) return null

  return (
    <Dialog open={!!requestToApprove} onOpenChange={(open) => !open && closeAllDialogs()}>
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
                  {format(parseISO(requestToApprove.ngay_duyet), "dd/MM/yyyy HH:mm", { locale: vi })}
                </div>
              )}
            </div>
          )}
          <div>
            <Label htmlFor="approval-repair-unit">Đơn vị thực hiện</Label>
            <Select value={repairUnit} onValueChange={(value) => setRepairUnit(value as RepairUnit)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="noi_bo">Nội bộ</SelectItem>
                <SelectItem value="thue_ngoai">Thuê ngoài</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {repairUnit === "thue_ngoai" && (
            <div>
              <Label htmlFor="approval-external-company">Tên đơn vị thực hiện sửa chữa</Label>
              <Input
                id="approval-external-company"
                value={externalCompanyName}
                onChange={(e) => setExternalCompanyName(e.target.value)}
                placeholder="Nhập tên đơn vị được thuê sửa chữa"
                disabled={approveMutation.isPending}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={closeAllDialogs} disabled={approveMutation.isPending}>
            Hủy
          </Button>
          <Button onClick={handleConfirm} disabled={approveMutation.isPending}>
            {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận duyệt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/repair-requests/_components/ApproveRequestDialog.tsx
git commit -m "refactor(repair-requests): ApproveDialog uses context + local form

- Props reduced from 8 to 0
- Form state managed locally"
```

---

### Task 3.4: Refactor CompleteRequestDialog

**Files:**
- Modify: `src/app/(app)/repair-requests/_components/CompleteRequestDialog.tsx`

**Step 1: Refactor to use context + local form state**

Replace entire file with:

```typescript
"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import { Loader2 } from "lucide-react"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"

export function RepairRequestsCompleteDialog() {
  const {
    dialogState: { requestToComplete, completionType },
    closeAllDialogs,
    completeMutation,
  } = useRepairRequestsContext()

  // Local form state
  const [completionResult, setCompletionResult] = React.useState("")
  const [nonCompletionReason, setNonCompletionReason] = React.useState("")

  // Reset form when dialog opens
  React.useEffect(() => {
    if (requestToComplete) {
      setCompletionResult("")
      setNonCompletionReason("")
    }
  }, [requestToComplete])

  const handleConfirm = () => {
    if (!requestToComplete || !completionType) return

    completeMutation.mutate(
      {
        id: requestToComplete.id,
        completion: completionType === "Hoàn thành" ? completionResult.trim() : null,
        reason: completionType === "Không HT" ? nonCompletionReason.trim() : null,
      },
      { onSuccess: closeAllDialogs }
    )
  }

  if (!requestToComplete) return null

  return (
    <Dialog open={!!requestToComplete} onOpenChange={(open) => !open && closeAllDialogs()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {completionType === "Hoàn thành"
              ? "Ghi nhận hoàn thành sửa chữa"
              : "Ghi nhận không hoàn thành"}
          </DialogTitle>
          <DialogDescription>
            {completionType === "Hoàn thành"
              ? `Ghi nhận kết quả sửa chữa cho thiết bị ${requestToComplete.thiet_bi?.ten_thiet_bi}`
              : `Ghi nhận lý do không hoàn thành sửa chữa cho thiết bị ${requestToComplete.thiet_bi?.ten_thiet_bi}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {requestToComplete.nguoi_xac_nhan && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm font-medium text-green-800">Đã được xác nhận bởi:</div>
              <div className="text-sm text-green-600">{requestToComplete.nguoi_xac_nhan}</div>
              {requestToComplete.ngay_hoan_thanh && (
                <div className="text-xs text-green-500">
                  {format(parseISO(requestToComplete.ngay_hoan_thanh), "dd/MM/yyyy HH:mm", { locale: vi })}
                </div>
              )}
            </div>
          )}
          {completionType === "Hoàn thành" ? (
            <div>
              <Label htmlFor="completion-result">Kết quả sửa chữa</Label>
              <Textarea
                id="completion-result"
                value={completionResult}
                onChange={(e) => setCompletionResult(e.target.value)}
                placeholder="Nhập kết quả và tình trạng thiết bị sau khi sửa chữa..."
                rows={4}
                disabled={completeMutation.isPending}
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
                disabled={completeMutation.isPending}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={closeAllDialogs} disabled={completeMutation.isPending}>
            Hủy
          </Button>
          <Button onClick={handleConfirm} disabled={completeMutation.isPending}>
            {completeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {completionType === "Hoàn thành" ? "Xác nhận hoàn thành" : "Xác nhận không hoàn thành"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/repair-requests/_components/CompleteRequestDialog.tsx
git commit -m "refactor(repair-requests): CompleteDialog uses context + local form

- Props reduced from 9 to 0
- Form state managed locally"
```

---

### Task 3.5: Refactor CreateRequestSheet

**Files:**
- Modify: `src/app/(app)/repair-requests/_components/CreateRequestSheet.tsx`

**Step 1: Refactor to use context + local form state**

This is the largest refactor. Replace entire file with:

```typescript
"use client"

import * as React from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader as SheetHeaderUI,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { callRpc } from "@/lib/rpc-client"
import { Calendar as CalendarIcon, Check, Loader2 } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import type { EquipmentSelectItem, RepairUnit } from "../types"

export function RepairRequestsCreateSheet() {
  const {
    dialogState: { isCreateOpen },
    closeAllDialogs,
    createMutation,
    user,
    canSetRepairUnit,
  } = useRepairRequestsContext()

  const isSheetMobile = useMediaQuery("(max-width: 1279px)")

  // Local form state
  const [selectedEquipment, setSelectedEquipment] = React.useState<EquipmentSelectItem | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [issueDescription, setIssueDescription] = React.useState("")
  const [repairItems, setRepairItems] = React.useState("")
  const [desiredDate, setDesiredDate] = React.useState<Date | undefined>()
  const [repairUnit, setRepairUnit] = React.useState<RepairUnit>("noi_bo")
  const [externalCompanyName, setExternalCompanyName] = React.useState("")
  const [allEquipment, setAllEquipment] = React.useState<EquipmentSelectItem[]>([])

  // Reset form when sheet closes
  React.useEffect(() => {
    if (!isCreateOpen) {
      setSelectedEquipment(null)
      setSearchQuery("")
      setIssueDescription("")
      setRepairItems("")
      setDesiredDate(undefined)
      setRepairUnit("noi_bo")
      setExternalCompanyName("")
    }
  }, [isCreateOpen])

  // Fetch equipment options
  React.useEffect(() => {
    const label = selectedEquipment
      ? `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`
      : ""
    const q = searchQuery?.trim()
    if (!q || (label && q === label)) return

    const ctrl = new AbortController()
    const run = async () => {
      try {
        const eq = await callRpc<any[]>({
          fn: "equipment_list",
          args: { p_q: q, p_sort: "ten_thiet_bi.asc", p_page: 1, p_page_size: 20 },
        })
        if (ctrl.signal.aborted) return
        setAllEquipment(
          (eq || []).map((row: any) => ({
            id: row.id,
            ma_thiet_bi: row.ma_thiet_bi,
            ten_thiet_bi: row.ten_thiet_bi,
            khoa_phong_quan_ly: row.khoa_phong_quan_ly,
          }))
        )
      } catch (e) {
        // Silent fail for suggestions
      }
    }
    run()
    return () => ctrl.abort()
  }, [searchQuery, selectedEquipment])

  const filteredEquipment = React.useMemo(() => {
    if (!searchQuery) return []
    if (selectedEquipment && searchQuery === `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`) {
      return []
    }
    return allEquipment
  }, [searchQuery, allEquipment, selectedEquipment])

  const shouldShowNoResults = React.useMemo(() => {
    if (!searchQuery) return false
    if (selectedEquipment && searchQuery === `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`) {
      return false
    }
    return filteredEquipment.length === 0
  }, [searchQuery, selectedEquipment, filteredEquipment])

  const handleSelectEquipment = (equipment: EquipmentSelectItem) => {
    setSelectedEquipment(equipment)
    setSearchQuery(`${equipment.ten_thiet_bi} (${equipment.ma_thiet_bi})`)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    if (selectedEquipment) {
      setSelectedEquipment(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEquipment || !user) return

    createMutation.mutate(
      {
        thiet_bi_id: selectedEquipment.id,
        mo_ta_su_co: issueDescription,
        hang_muc_sua_chua: repairItems,
        ngay_mong_muon_hoan_thanh: desiredDate ? format(desiredDate, "yyyy-MM-dd") : null,
        nguoi_yeu_cau: user.full_name || user.username,
        don_vi_thuc_hien: canSetRepairUnit ? repairUnit : null,
        ten_don_vi_thue: canSetRepairUnit && repairUnit === "thue_ngoai"
          ? externalCompanyName.trim()
          : null,
      },
      { onSuccess: closeAllDialogs }
    )
  }

  return (
    <Sheet open={isCreateOpen} onOpenChange={(open) => !open && closeAllDialogs()}>
      <SheetContent
        side={isSheetMobile ? "bottom" : "right"}
        className={cn(isSheetMobile ? "h-[90vh] p-0" : "sm:max-w-lg")}
      >
        <SheetHeaderUI className={cn(isSheetMobile ? "p-4 border-b" : "")}>
          <SheetTitle>Tạo yêu cầu sửa chữa</SheetTitle>
          <SheetDescription>Điền thông tin bên dưới để gửi yêu cầu mới.</SheetDescription>
        </SheetHeaderUI>
        <div className={cn("mt-4", isSheetMobile ? "px-4 overflow-y-auto h-[calc(90vh-80px)]" : "")}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search-equipment">Thiết bị</Label>
              <div className="relative">
                <Input
                  id="search-equipment"
                  placeholder="Nhập tên hoặc mã để tìm kiếm..."
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
                    variant="outline"
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
                <Select value={repairUnit} onValueChange={(value) => setRepairUnit(value as RepairUnit)}>
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

            {canSetRepairUnit && repairUnit === "thue_ngoai" && (
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

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 touch-target"
                onClick={closeAllDialogs}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                className="flex-1 touch-target"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {createMutation.isPending ? "Đang gửi..." : "Gửi yêu cầu"}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/repair-requests/_components/CreateRequestSheet.tsx
git commit -m "refactor(repair-requests): CreateSheet uses context + local form

- Props reduced from 22 to 0
- Equipment search handled locally
- Form state managed locally"
```

---

## Phase 4: Extract Table and Toolbar Components

### Task 4.1: Extract RepairRequestsTable

**Files:**
- Create: `src/app/(app)/repair-requests/_components/RepairRequestsTable.tsx`

**Step 1: Create extracted table component**

```typescript
"use client"

import * as React from "react"
import {
  flexRender,
  type Table as TanStackTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import { calculateDaysRemaining } from "../utils"
import type { RepairRequestWithEquipment } from "../types"
import type { ViewDensity, TextWrap as TextWrapPref } from "@/lib/rr-prefs"

interface RepairRequestsTableProps {
  table: TanStackTable<RepairRequestWithEquipment>
  isLoading: boolean
  density: ViewDensity
  textWrap: TextWrapPref
}

export function RepairRequestsTable({
  table,
  isLoading,
  density,
  textWrap
}: RepairRequestsTableProps) {
  const { openViewDialog } = useRepairRequestsContext()
  const columns = table.getAllColumns()

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header, colIdx) => (
              <TableHead
                key={header.id}
                className={cn(
                  density === "compact" ? "py-1" : density === "spacious" ? "py-3" : "py-2",
                  colIdx === 0 && "sticky left-0 z-20 bg-background w-[20rem] min-w-[20rem] max-w-[20rem] border-r",
                  colIdx === 1 && "sticky left-[20rem] z-20 bg-background w-[14rem] min-w-[14rem] max-w-[14rem] border-r"
                )}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className={cn(
                "h-24 text-center",
                density === "compact" ? "py-1" : density === "spacious" ? "py-3" : "py-2"
              )}
            >
              <div className="flex justify-center items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang tải...</span>
              </div>
            </TableCell>
          </TableRow>
        ) : table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => {
            const req = row.original
            const isCompleted = req.trang_thai === "Hoàn thành" || req.trang_thai === "Không HT"
            const daysInfo = !isCompleted && req.ngay_mong_muon_hoan_thanh
              ? calculateDaysRemaining(req.ngay_mong_muon_hoan_thanh)
              : null
            const stripeClass = daysInfo
              ? daysInfo.status === "success"
                ? "border-l-4 border-green-500"
                : daysInfo.status === "warning"
                ? "border-l-4 border-orange-500"
                : "border-l-4 border-red-500"
              : ""

            return (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                tabIndex={0}
                className={cn("cursor-pointer hover:bg-muted/50 focus:outline-none", stripeClass)}
                onClick={() => openViewDialog(row.original)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openViewDialog(row.original)
                }}
              >
                {row.getVisibleCells().map((cell, colIdx) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      density === "compact" ? "py-1" : density === "spacious" ? "py-3" : "py-2",
                      colIdx === 0 && "sticky left-0 z-10 bg-background w-[20rem] min-w-[20rem] max-w-[20rem] border-r",
                      colIdx === 1 && "sticky left-[20rem] z-10 bg-background w-[14rem] min-w-[14rem] max-w-[14rem] border-r",
                      textWrap === "truncate" ? "truncate" : "whitespace-normal break-words"
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/repair-requests/_components/RepairRequestsTable.tsx
git commit -m "feat(repair-requests): extract RepairRequestsTable component

- ~80 lines extracted from main component
- Consumes context for openViewDialog
- Receives table instance, loading, density, textWrap as props"
```

---

### Task 4.2: Extract RepairRequestsToolbar

**Files:**
- Create: `src/app/(app)/repair-requests/_components/RepairRequestsToolbar.tsx`

**Step 1: Create extracted toolbar component**

```typescript
"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FilterX } from "lucide-react"
import { FilterChips } from "./FilterChips"
import type { ViewDensity, TextWrap as TextWrapPref } from "@/lib/rr-prefs"
import type { UiFilters as UiFiltersPrefs } from "@/lib/rr-prefs"

interface RepairRequestsToolbarProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  searchInputRef: React.RefObject<HTMLInputElement>
  isFiltered: boolean
  onClearFilters: () => void
  onOpenFilterModal: () => void
  // Display settings
  density: ViewDensity
  setDensity: (d: ViewDensity) => void
  textWrap: TextWrapPref
  setTextWrap: (t: TextWrapPref) => void
  onColumnPreset: (preset: "compact" | "standard" | "full") => void
  // Filter chips
  uiFilters: UiFiltersPrefs
  selectedFacilityName: string | null
  showFacilityFilter: boolean
  onRemoveFilter: (key: string, sub?: string) => void
}

export function RepairRequestsToolbar({
  searchTerm,
  onSearchChange,
  searchInputRef,
  isFiltered,
  onClearFilters,
  onOpenFilterModal,
  density,
  setDensity,
  textWrap,
  setTextWrap,
  onColumnPreset,
  uiFilters,
  selectedFacilityName,
  showFacilityFilter,
  onRemoveFilter,
}: RepairRequestsToolbarProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2 md:mb-3">
        <div className="flex flex-1 items-center gap-2">
          <Input
            ref={searchInputRef}
            placeholder="Tìm thiết bị, mô tả..."
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-8 w-[120px] md:w-[200px] lg:w-[250px] touch-target-sm md:h-8"
          />

          <Button
            variant="outline"
            size="sm"
            className="h-8 touch-target-sm"
            onClick={onOpenFilterModal}
          >
            Bộ lọc
          </Button>

          {isFiltered && (
            <Button
              variant="ghost"
              onClick={onClearFilters}
              className="h-8 px-2 lg:px-3 touch-target-sm md:h-8"
              aria-label="Xóa bộ lọc"
            >
              <span className="hidden sm:inline">Xóa</span>
              <FilterX className="h-4 w-4 sm:ml-2" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 touch-target-sm">
                Hiển thị
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Preset cột</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onColumnPreset("compact")}>
                Compact
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onColumnPreset("standard")}>
                Standard
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onColumnPreset("full")}>
                Full
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Mật độ</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setDensity("compact")}>
                {density === "compact" ? "✓ " : ""}Compact
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDensity("standard")}>
                {density === "standard" ? "✓ " : ""}Standard
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDensity("spacious")}>
                {density === "spacious" ? "✓ " : ""}Spacious
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Văn bản</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setTextWrap("truncate")}>
                {textWrap === "truncate" ? "✓ " : ""}Thu gọn
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTextWrap("wrap")}>
                {textWrap === "wrap" ? "✓ " : ""}Xuống dòng
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="w-full pt-2">
          <FilterChips
            value={{
              status: uiFilters.status,
              facilityName: selectedFacilityName,
              dateRange: uiFilters.dateRange
                ? { from: uiFilters.dateRange.from ?? null, to: uiFilters.dateRange.to ?? null }
                : null,
            }}
            showFacility={showFacilityFilter}
            onRemove={onRemoveFilter}
          />
        </div>
      </div>
    </>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/repair-requests/_components/RepairRequestsToolbar.tsx
git commit -m "feat(repair-requests): extract RepairRequestsToolbar component

- ~100 lines extracted from main component
- Search, filter button, display settings, filter chips
- Receives callbacks for all actions"
```

---

## Phase 5: Update Main Component and Rename Files

### Task 5.1: Update RepairRequestsPageClient to use Context and Extracted Components

**Files:**
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx`

**Step 1: Refactor main component**

The main component should now:
1. Wrap children with `RepairRequestsProvider`
2. Use extracted `RepairRequestsTable` and `RepairRequestsToolbar`
3. Render dialogs without props (they consume context)
4. Remove all manual dialog state management

This reduces the file from ~1207 lines to ~450 lines.

(Full refactored code omitted for brevity - follow the pattern established above)

**Step 2: Commit**

```bash
git add src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx
git commit -m "refactor(repair-requests): main component uses context + extracted components

- File reduced from 1207 to ~450 lines
- Wraps content in RepairRequestsProvider
- Uses RepairRequestsTable and RepairRequestsToolbar
- Dialogs rendered without props"
```

---

### Task 5.2: Rename Files with RepairRequests Prefix

**Files to rename:**
```
EditRequestDialog.tsx      → RepairRequestsEditDialog.tsx
DeleteRequestDialog.tsx    → RepairRequestsDeleteDialog.tsx
ApproveRequestDialog.tsx   → RepairRequestsApproveDialog.tsx
CompleteRequestDialog.tsx  → RepairRequestsCompleteDialog.tsx
CreateRequestSheet.tsx     → RepairRequestsCreateSheet.tsx
MobileRequestList.tsx      → RepairRequestsMobileList.tsx
FilterModal.tsx            → RepairRequestsFilterModal.tsx
FilterChips.tsx            → RepairRequestsFilterChips.tsx
RequestDetailContent.tsx   → RepairRequestsDetailContent.tsx
repair-requests-columns.tsx → RepairRequestsColumns.tsx
```

**Step 1: Rename files using git mv**

```bash
cd src/app/(app)/repair-requests/_components

git mv EditRequestDialog.tsx RepairRequestsEditDialog.tsx
git mv DeleteRequestDialog.tsx RepairRequestsDeleteDialog.tsx
git mv ApproveRequestDialog.tsx RepairRequestsApproveDialog.tsx
git mv CompleteRequestDialog.tsx RepairRequestsCompleteDialog.tsx
git mv CreateRequestSheet.tsx RepairRequestsCreateSheet.tsx
git mv MobileRequestList.tsx RepairRequestsMobileList.tsx
git mv FilterModal.tsx RepairRequestsFilterModal.tsx
git mv FilterChips.tsx RepairRequestsFilterChips.tsx
git mv RequestDetailContent.tsx RepairRequestsDetailContent.tsx
git mv repair-requests-columns.tsx RepairRequestsColumns.tsx
```

**Step 2: Update all imports in RepairRequestsPageClient.tsx**

```typescript
// FROM:
import { FilterChips } from "./FilterChips"
import { FilterModal } from "./FilterModal"
import { RequestDetailContent } from "./RequestDetailContent"
import { EditRequestDialog } from "./EditRequestDialog"
// etc.

// TO:
import { RepairRequestsFilterChips } from "./RepairRequestsFilterChips"
import { RepairRequestsFilterModal } from "./RepairRequestsFilterModal"
import { RepairRequestsDetailContent } from "./RepairRequestsDetailContent"
import { RepairRequestsEditDialog } from "./RepairRequestsEditDialog"
// etc.
```

**Step 3: Update export names in each renamed file**

Each file should export with the new name:
```typescript
// In RepairRequestsEditDialog.tsx
export function RepairRequestsEditDialog() { ... }
```

**Step 4: Verify no TypeScript errors**

Run: `npm run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(repair-requests): rename files with RepairRequests prefix

- All component files now prefixed for grep-ability
- Pattern: RepairRequests*.tsx matches all feature files
- Import statements updated throughout"
```

---

## Phase 6: Cleanup Legacy Hooks

### Task 6.1: Remove or Simplify Legacy Hooks

**Files:**
- Delete or simplify: `_hooks/useRepairRequestDialogs.ts` (replaced by context)
- Delete or simplify: `_hooks/useRepairRequestMutations.ts` (replaced by context mutations)
- Delete or simplify: `_hooks/useRepairRequestWorkflows.ts` (replaced by context mutations)

**Step 1: Evaluate each hook**

| Hook | Action |
|------|--------|
| `useRepairRequestDialogs` | DELETE - replaced by context dialogState |
| `useRepairRequestMutations` | DELETE - replaced by context mutations |
| `useRepairRequestWorkflows` | DELETE - replaced by context mutations |
| `useRepairRequestUIHandlers` | KEEP - still useful for sheet generation |
| `useRepairRequestShortcuts` | KEEP - still useful for keyboard shortcuts |

**Step 2: Delete unused hooks**

```bash
git rm src/app/(app)/repair-requests/_hooks/useRepairRequestDialogs.ts
git rm src/app/(app)/repair-requests/_hooks/useRepairRequestMutations.ts
git rm src/app/(app)/repair-requests/_hooks/useRepairRequestWorkflows.ts
```

**Step 3: Commit**

```bash
git commit -m "refactor(repair-requests): remove legacy hooks replaced by context

- useRepairRequestDialogs → context dialogState
- useRepairRequestMutations → context mutations
- useRepairRequestWorkflows → context mutations
- Kept: useRepairRequestUIHandlers, useRepairRequestShortcuts"
```

---

## Verification Checklist

After completing all tasks:

- [ ] `npm run typecheck` passes with no errors
- [ ] `npm run build` succeeds
- [ ] All dialogs open/close correctly
- [ ] Create request works
- [ ] Edit request works
- [ ] Delete request works
- [ ] Approve request works
- [ ] Complete request works
- [ ] Table displays correctly
- [ ] Filters work
- [ ] Mobile view works
- [ ] Keyboard shortcuts work (`/` and `n`)

---

## Final Commit

```bash
git add -A
git commit -m "refactor(repair-requests): complete context refactoring

Summary:
- Main file: 1207 → ~450 lines
- Prop drilling: ~60 → ~5 props
- All files prefixed with RepairRequests
- Context provides: user, mutations, dialog actions
- Dialogs manage form state locally
- TanStack Query mutations with isPending

Breaking changes: None (internal refactor only)"
```
