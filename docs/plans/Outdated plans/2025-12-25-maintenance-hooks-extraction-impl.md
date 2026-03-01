# Maintenance Hooks Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract business logic from maintenance/page.tsx into three reusable hooks to reduce file complexity by ~870 lines.

**Architecture:** Create `_hooks/` directory with granular hooks for operations (approve/reject/delete), drafts (localStorage-backed inline editing), and print (HTML template generation). Each hook encapsulates state and callbacks, exposing a clean interface to the page component.

**Tech Stack:** React 18, TypeScript, TanStack Query mutations, localStorage, window.open() for print

---

## Task 1: Create Directory Structure

**Files:**
- Create: `src/app/(app)/maintenance/_hooks/.gitkeep`

**Step 1: Create the _hooks directory**

```bash
mkdir -p src/app/(app)/maintenance/_hooks
```

**Step 2: Verify directory exists**

Run: `ls src/app/(app)/maintenance/`
Expected: `_hooks/` directory visible

**Step 3: Commit**

```bash
git add src/app/(app)/maintenance/_hooks
git commit -m "chore: create _hooks directory for maintenance page refactoring"
```

---

## Task 2: Extract use-maintenance-operations Hook

**Files:**
- Create: `src/app/(app)/maintenance/_hooks/use-maintenance-operations.ts`
- Modify: `src/app/(app)/maintenance/page.tsx:180-520` (remove extracted code, add import)

**Step 1: Create the hook file with types**

Create `src/app/(app)/maintenance/_hooks/use-maintenance-operations.ts`:

```typescript
"use client"

import * as React from "react"
import {
  useApproveMaintenancePlan,
  useRejectMaintenancePlan,
  useDeleteMaintenancePlan,
  type MaintenancePlan,
} from "@/hooks/use-cached-maintenance"

interface UseMaintenanceOperationsParams {
  selectedPlan: MaintenancePlan | null
  setSelectedPlan: React.Dispatch<React.SetStateAction<MaintenancePlan | null>>
  setActiveTab: React.Dispatch<React.SetStateAction<string>>
  getDraftCacheKey: (planId: number) => string
  user: { full_name?: string; username?: string } | null
}

interface ConfirmDialogState {
  type: 'approve' | 'reject' | 'delete' | null
  plan: MaintenancePlan | null
  rejectionReason: string
}

export function useMaintenanceOperations({
  selectedPlan,
  setSelectedPlan,
  setActiveTab,
  getDraftCacheKey,
  user,
}: UseMaintenanceOperationsParams) {
  // Dialog state
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmDialogState>({
    type: null,
    plan: null,
    rejectionReason: "",
  })

  // Mutations from cached hook
  const approvePlanMutation = useApproveMaintenancePlan()
  const rejectPlanMutation = useRejectMaintenancePlan()
  const deletePlanMutation = useDeleteMaintenancePlan()

  // Dialog openers
  const openApproveDialog = React.useCallback((plan: MaintenancePlan) => {
    setConfirmDialog({ type: 'approve', plan, rejectionReason: "" })
  }, [])

  const openRejectDialog = React.useCallback((plan: MaintenancePlan) => {
    setConfirmDialog({ type: 'reject', plan, rejectionReason: "" })
  }, [])

  const openDeleteDialog = React.useCallback((plan: MaintenancePlan) => {
    setConfirmDialog({ type: 'delete', plan, rejectionReason: "" })
  }, [])

  const closeDialog = React.useCallback(() => {
    setConfirmDialog({ type: null, plan: null, rejectionReason: "" })
  }, [])

  const setRejectionReason = React.useCallback((reason: string) => {
    setConfirmDialog(prev => ({ ...prev, rejectionReason: reason }))
  }, [])

  // Approve handler
  const handleApprovePlan = React.useCallback(() => {
    const planToApprove = confirmDialog.plan
    if (!planToApprove) return

    approvePlanMutation.mutate(
      {
        id: planToApprove.id,
        nguoi_duyet: user?.full_name || user?.username || ''
      },
      {
        onSuccess: () => {
          if (selectedPlan && selectedPlan.id === planToApprove.id) {
            const updatedPlan = {
              ...selectedPlan,
              trang_thai: 'Đã duyệt' as const,
              ngay_phe_duyet: new Date().toISOString()
            }
            setSelectedPlan(updatedPlan)
          }
          closeDialog()
        },
        onError: () => {
          closeDialog()
        }
      }
    )
  }, [confirmDialog.plan, approvePlanMutation, selectedPlan, setSelectedPlan, user, closeDialog])

  // Reject handler
  const handleRejectPlan = React.useCallback(() => {
    const planToReject = confirmDialog.plan
    const reason = confirmDialog.rejectionReason
    if (!planToReject || !reason.trim()) return

    rejectPlanMutation.mutate(
      {
        id: planToReject.id,
        nguoi_duyet: user?.full_name || user?.username || '',
        ly_do: reason.trim()
      },
      {
        onSuccess: () => {
          if (selectedPlan && selectedPlan.id === planToReject.id) {
            const updatedPlan = {
              ...selectedPlan,
              trang_thai: 'Không duyệt' as const,
              ngay_phe_duyet: new Date().toISOString()
            }
            setSelectedPlan(updatedPlan)
          }
          closeDialog()
        },
        onError: () => {
          closeDialog()
        }
      }
    )
  }, [confirmDialog.plan, confirmDialog.rejectionReason, rejectPlanMutation, selectedPlan, setSelectedPlan, user, closeDialog])

  // Delete handler
  const handleDeletePlan = React.useCallback(() => {
    const planToDelete = confirmDialog.plan
    if (!planToDelete) return

    deletePlanMutation.mutate(
      planToDelete.id,
      {
        onSuccess: () => {
          localStorage.removeItem(getDraftCacheKey(planToDelete.id))
          if (selectedPlan && selectedPlan.id === planToDelete.id) {
            setSelectedPlan(null)
            setActiveTab("plans")
          }
          closeDialog()
        },
        onError: () => {
          closeDialog()
        }
      }
    )
  }, [confirmDialog.plan, deletePlanMutation, selectedPlan, setSelectedPlan, setActiveTab, getDraftCacheKey, closeDialog])

  return {
    // Dialog state
    confirmDialog,
    setRejectionReason,
    closeDialog,

    // Dialog openers (for row actions)
    openApproveDialog,
    openRejectDialog,
    openDeleteDialog,

    // Confirmed actions (for dialog buttons)
    handleApprovePlan,
    handleRejectPlan,
    handleDeletePlan,

    // Loading states
    isApproving: approvePlanMutation.isPending,
    isRejecting: rejectPlanMutation.isPending,
    isDeleting: deletePlanMutation.isPending,
  }
}
```

**Step 2: Run typecheck to verify no errors**

Run: `npm run typecheck`
Expected: No errors related to use-maintenance-operations.ts

**Step 3: Commit the new hook**

```bash
git add src/app/(app)/maintenance/_hooks/use-maintenance-operations.ts
git commit -m "feat(maintenance): add use-maintenance-operations hook"
```

---

## Task 3: Integrate use-maintenance-operations into page.tsx

**Files:**
- Modify: `src/app/(app)/maintenance/page.tsx`

**Step 1: Add import for the new hook**

At the top of imports section (after line 91), add:

```typescript
import { useMaintenanceOperations } from "./_hooks/use-maintenance-operations"
```

**Step 2: Replace mutation declarations and dialog state**

Remove these lines (approximately 180-192):
- `const approvePlanMutation = useApproveMaintenancePlan()`
- `const rejectPlanMutation = useRejectMaintenancePlan()`
- `const deletePlanMutation = useDeleteMaintenancePlan()`
- `const [planToDelete, setPlanToDelete] = ...`
- `const [planToApprove, setPlanToApprove] = ...`
- `const [planToReject, setPlanToReject] = ...`
- `const [rejectionReason, setRejectionReason] = ...`

**Step 3: Add hook call after existing state declarations**

After `const queryClient = useQueryClient()` (around line 105), add:

```typescript
const operations = useMaintenanceOperations({
  selectedPlan,
  setSelectedPlan,
  setActiveTab,
  getDraftCacheKey,
  user,
})
```

**Step 4: Remove the old handler functions**

Delete these functions (lines 425-520 approximately):
- `handleApprovePlan`
- `handleRejectPlan`
- `handleDeletePlan`

**Step 5: Update all references to use the hook**

Replace throughout the file:
- `setPlanToApprove(plan)` → `operations.openApproveDialog(plan)`
- `setPlanToReject(plan)` → `operations.openRejectDialog(plan)`
- `setPlanToDelete(plan)` → `operations.openDeleteDialog(plan)`
- `planToApprove` → `operations.confirmDialog.type === 'approve'`
- `planToReject` → `operations.confirmDialog.type === 'reject'`
- `planToDelete` → `operations.confirmDialog.type === 'delete'`
- `rejectionReason` → `operations.confirmDialog.rejectionReason`
- `setRejectionReason` → `operations.setRejectionReason`
- `handleApprovePlan(planToApprove)` → `operations.handleApprovePlan()`
- `handleRejectPlan()` → `operations.handleRejectPlan()`
- `handleDeletePlan()` → `operations.handleDeletePlan()`

**Step 6: Update AlertDialog components**

The approve/reject/delete dialogs need to use the new hook interface. Example for approve dialog:

```typescript
<AlertDialog
  open={operations.confirmDialog.type === 'approve'}
  onOpenChange={(open) => !open && operations.closeDialog()}
>
```

**Step 7: Run typecheck**

Run: `npm run typecheck`
Expected: PASS with no errors

**Step 8: Test manually**

1. Navigate to /maintenance
2. Try approving a draft plan
3. Try rejecting a plan with reason
4. Try deleting a plan
5. Verify all operations work correctly

**Step 9: Commit**

```bash
git add src/app/(app)/maintenance/page.tsx
git commit -m "refactor(maintenance): integrate use-maintenance-operations hook"
```

---

## Task 4: Extract use-maintenance-print Hook

**Files:**
- Create: `src/app/(app)/maintenance/_hooks/use-maintenance-print.ts`

**Step 1: Create the hook file**

Create `src/app/(app)/maintenance/_hooks/use-maintenance-print.ts`:

```typescript
"use client"

import * as React from "react"
import { callRpc } from "@/lib/rpc-client"
import { useToast } from "@/hooks/use-toast"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"

interface UseMaintenancePrintParams {
  selectedPlan: MaintenancePlan | null
  tasks: MaintenanceTask[]
  user: { full_name?: string } | null
}

function formatValue(value: any): string {
  return value ?? ""
}

function buildPrintTemplate(params: {
  selectedPlan: MaintenancePlan
  tasks: MaintenanceTask[]
  user: { full_name?: string } | null
  logoUrl: string
  organizationName: string
}): string {
  const { selectedPlan, tasks, user, logoUrl, organizationName } = params

  const generateTableRows = () => {
    return tasks.map((task, index) => {
      const checkboxes = Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
        const fieldName = `thang_${month}` as keyof MaintenanceTask
        const isChecked = task[fieldName] ? 'checked' : ''
        return `<td><input type="checkbox" ${isChecked}></td>`
      }).join('')

      const noiBoChecked = task.don_vi_thuc_hien === 'Nội bộ' ? 'checked' : ''
      const thueNgoaiChecked = task.don_vi_thuc_hien === 'Thuê ngoài' ? 'checked' : ''

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
      `
    }).join('')
  }

  // NOTE: Full HTML template (~400 lines) extracted from page.tsx lines 1329-1752
  // This is the complete Vietnamese maintenance form template
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kế Hoạch ${selectedPlan.loai_cong_viec} Thiết Bị - ${selectedPlan.ten_ke_hoach}</title>
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
            padding: 1cm;
            margin: 1cm auto;
            background: white;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            position: relative;
            display: flex;
            flex-direction: column;
        }
        .content-body { flex-grow: 1; }
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
        .print-footer {
            padding: 8px 12px;
            font-size: 11px;
            margin-top: 20px;
        }
        h1, h2, .font-bold { font-weight: 700; }
        .title-main { font-size: 18px; }
        .title-sub { font-size: 16px; }
        .data-table {
            border: 1px solid #000;
            border-collapse: collapse;
            table-layout: fixed;
            width: 100%;
        }
        .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 4px;
            text-align: center;
            vertical-align: middle;
            word-wrap: break-word;
        }
        .data-table tbody tr { min-height: 35px; height: auto !important; }
        .data-table td:last-child {
            width: 150px !important;
            min-width: 150px;
            max-width: 200px;
            padding: 8px !important;
            vertical-align: top !important;
        }
        .signature-area { text-align: center; }
        .signature-space { height: 60px; }
        @media print {
            body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                background-color: #fff !important;
            }
            .a4-landscape-page {
                width: 100%;
                height: 100%;
                margin: 0 !important;
                padding: 1cm !important;
                box-shadow: none !important;
            }
            .data-table thead { display: table-header-group; }
            .data-table tr, .signature-area { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="a4-landscape-page">
        <div class="content-body">
            <header>
                <div class="flex justify-between items-start">
                    <div class="text-center w-1/4">
                        <img src="${logoUrl}" alt="Logo" class="w-16" onerror="this.onerror=null;this.src='https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo';">
                    </div>
                    <div class="text-center w-1/2">
                        <h2 class="title-sub uppercase font-bold">${organizationName}</h2>
                        <div class="flex items-baseline justify-center font-bold text-base">
                            <label for="department-name">KHOA/PHÒNG:</label>
                            <input type="text" id="department-name" class="form-input-line flex-grow ml-2" value="${formatValue(selectedPlan.khoa_phong)}">
                        </div>
                    </div>
                    <div class="w-1/4"></div>
                </div>
                <div class="text-center mt-4">
                    <h1 class="title-main uppercase font-bold flex justify-center items-baseline">
                        KẾ HOẠCH ${selectedPlan.loai_cong_viec.toUpperCase()} THIẾT BỊ NĂM
                        <input type="text" class="form-input-line w-24 ml-2" value="${selectedPlan.nam}">
                    </h1>
                </div>
            </header>

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
                            <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th>
                            <th>7</th><th>8</th><th>9</th><th>10</th><th>11</th><th>12</th>
                        </tr>
                    </thead>
                    <tbody id="plan-table-body">
                        ${generateTableRows()}
                    </tbody>
                </table>
            </section>

            <section class="mt-4">
                <div class="flex justify-between">
                    <div class="signature-area w-1/3">
                        <p class="font-bold">Lãnh đạo Khoa/Phòng</p>
                        <div class="signature-space"></div>
                    </div>
                    <div class="w-1/3"></div>
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
  `
}

export function useMaintenancePrint({
  selectedPlan,
  tasks,
  user,
}: UseMaintenancePrintParams) {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = React.useState(false)

  const generatePlanForm = React.useCallback(async () => {
    if (!selectedPlan || tasks.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Vui lòng đảm bảo kế hoạch đã có thiết bị và đã được lưu vào database."
      })
      return
    }

    setIsGenerating(true)

    // Open window immediately to preserve user gesture
    const newWindow = window.open("", "_blank")
    if (!newWindow) {
      toast({
        variant: "destructive",
        title: "Không thể mở cửa sổ in",
        description: "Trình duyệt đã chặn popup. Vui lòng bật popup cho trang này và thử lại."
      })
      setIsGenerating(false)
      return
    }

    // Show loading content immediately
    newWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Đang tải...</title></head>
      <body style="font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f8f9fa;">
        <div style="text-align: center;">
          <div style="width: 32px; height: 32px; border: 4px solid #e2e8f0; border-top: 4px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
          <p style="color: #6b7280; margin: 0;">Đang tải kế hoạch...</p>
        </div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
      </body></html>
    `)

    // Fetch tenant branding asynchronously
    let tenantBranding = null
    try {
      const brandingResult = await callRpc<any[]>({ fn: 'don_vi_branding_get', args: { p_id: null } })
      tenantBranding = Array.isArray(brandingResult) ? brandingResult[0] : null
    } catch (error) {
      console.error('Failed to fetch tenant branding:', error)
    }

    const logoUrl = tenantBranding?.logo_url || "https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo"
    const organizationName = tenantBranding?.name || "Nền tảng QLTBYT"

    // Check if window is still open before writing content
    if (newWindow.closed) {
      toast({
        variant: "destructive",
        title: "Cửa sổ in đã bị đóng",
        description: "Vui lòng thử lại và không đóng cửa sổ trong quá trình tải."
      })
      setIsGenerating(false)
      return
    }

    const htmlContent = buildPrintTemplate({
      selectedPlan,
      tasks,
      user,
      logoUrl,
      organizationName,
    })

    newWindow.document.open()
    newWindow.document.write(htmlContent)
    newWindow.document.close()

    setIsGenerating(false)
  }, [selectedPlan, tasks, toast, user])

  return {
    generatePlanForm,
    isGenerating,
  }
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS with no errors

**Step 3: Commit**

```bash
git add src/app/(app)/maintenance/_hooks/use-maintenance-print.ts
git commit -m "feat(maintenance): add use-maintenance-print hook with HTML template"
```

---

## Task 5: Integrate use-maintenance-print into page.tsx

**Files:**
- Modify: `src/app/(app)/maintenance/page.tsx`

**Step 1: Add import**

```typescript
import { useMaintenancePrint } from "./_hooks/use-maintenance-print"
```

**Step 2: Add hook call**

After the operations hook call, add:

```typescript
const { generatePlanForm, isGenerating: isPrintGenerating } = useMaintenancePrint({
  selectedPlan,
  tasks,
  user,
})
```

**Step 3: Remove handleGeneratePlanForm function**

Delete the entire `handleGeneratePlanForm` callback (lines 1252-1768, approximately 500 lines).

**Step 4: Update references**

Replace `handleGeneratePlanForm` with `generatePlanForm` throughout the file.

**Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 6: Test print functionality**

1. Navigate to /maintenance
2. Select a plan with tasks
3. Click print button
4. Verify print preview opens correctly

**Step 7: Commit**

```bash
git add src/app/(app)/maintenance/page.tsx
git commit -m "refactor(maintenance): integrate use-maintenance-print hook"
```

---

## Task 6: Extract use-maintenance-drafts Hook (Bonus - Larger Refactor)

**Files:**
- Create: `src/app/(app)/maintenance/_hooks/use-maintenance-drafts.ts`

**Note:** This is a more complex extraction involving task editing state, localStorage sync, and save/cancel operations. The hook should encapsulate:
- `draftTasks` state
- `hasChanges` computed
- `getDraftCacheKey` function
- `handleSaveAllChanges` callback
- `handleCancelAllChanges` callback
- localStorage sync effects

**Step 1: Create hook file**

Create `src/app/(app)/maintenance/_hooks/use-maintenance-drafts.ts`:

```typescript
"use client"

import * as React from "react"
import { callRpc } from "@/lib/rpc-client"
import { useToast } from "@/hooks/use-toast"
import type { MaintenanceTask } from "@/lib/data"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"

interface UseMaintenanceDraftsParams {
  selectedPlan: MaintenancePlan | null
  onSaveSuccess?: () => void
}

export function useMaintenanceDrafts({
  selectedPlan,
  onSaveSuccess,
}: UseMaintenanceDraftsParams) {
  const { toast } = useToast()

  const [tasks, setTasks] = React.useState<MaintenanceTask[]>([])
  const [draftTasks, setDraftTasks] = React.useState<MaintenanceTask[]>([])
  const [isSaving, setIsSaving] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  const getDraftCacheKey = React.useCallback(
    (planId: number) => `maintenance_draft_${planId}`,
    []
  )

  const hasChanges = React.useMemo(() => {
    return JSON.stringify(tasks) !== JSON.stringify(draftTasks)
  }, [tasks, draftTasks])

  // Sync drafts to localStorage
  React.useEffect(() => {
    if (selectedPlan && hasChanges) {
      const cacheKey = getDraftCacheKey(selectedPlan.id)
      localStorage.setItem(cacheKey, JSON.stringify(draftTasks))
    }
    if (selectedPlan && !hasChanges) {
      const cacheKey = getDraftCacheKey(selectedPlan.id)
      localStorage.removeItem(cacheKey)
    }
  }, [draftTasks, selectedPlan, hasChanges, getDraftCacheKey])

  // Fetch tasks when plan changes
  const fetchTasks = React.useCallback(async (plan: MaintenancePlan) => {
    setIsLoading(true)
    const cacheKey = getDraftCacheKey(plan.id)
    const cachedDraft = localStorage.getItem(cacheKey)

    try {
      const data = await callRpc<any[]>({
        fn: 'maintenance_tasks_list_with_equipment',
        args: {
          p_ke_hoach_id: plan.id,
          p_thiet_bi_id: null,
          p_loai_cong_viec: plan.loai_cong_viec,
          p_don_vi_thuc_hien: null
        }
      })
      const dbTasks = (data || []) as MaintenanceTask[]
      setTasks(dbTasks)

      if (cachedDraft) {
        try {
          setDraftTasks(JSON.parse(cachedDraft))
          toast({ title: "Thông báo", description: "Đã tải lại bản nháp chưa lưu của bạn." })
        } catch {
          setDraftTasks(dbTasks)
        }
      } else {
        setDraftTasks(dbTasks)
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi tải công việc", description: error.message })
      setTasks([])
      setDraftTasks([])
    }
    setIsLoading(false)
  }, [getDraftCacheKey, toast])

  // Save all changes
  const saveAllChanges = React.useCallback(async () => {
    if (!selectedPlan || !hasChanges) return
    setIsSaving(true)

    const tasksToInsert = draftTasks
      .filter(t => t.id < 0)
      .map(task => {
        const { id, thiet_bi, ...dbData } = task
        return dbData
      })

    const tasksToUpdate = draftTasks
      .filter(t => t.id > 0 && tasks.find(original =>
        original.id === t.id && JSON.stringify(original) !== JSON.stringify(t)
      ))
      .map(task => {
        const { thiet_bi, ...dbData } = task
        return dbData
      })

    const draftTaskIds = new Set(draftTasks.map(t => t.id))
    const idsToDelete = tasks
      .map(t => t.id)
      .filter(id => !draftTaskIds.has(id))

    let hasError = false

    if (tasksToInsert.length > 0) {
      try {
        await callRpc<void>({ fn: 'maintenance_tasks_bulk_insert', args: { p_tasks: tasksToInsert } as any })
      } catch (e: any) {
        toast({ variant: "destructive", title: "Lỗi thêm công việc mới", description: e.message, duration: 10000 })
        hasError = true
      }
    }

    if (tasksToUpdate.length > 0 && !hasError) {
      for (const taskToUpdate of tasksToUpdate) {
        try {
          await callRpc<void>({ fn: 'maintenance_task_update', args: { p_id: taskToUpdate.id, p_task: taskToUpdate } as any })
        } catch (e: any) {
          toast({ variant: "destructive", title: `Lỗi cập nhật công việc ID ${taskToUpdate.id}`, description: e.message, duration: 10000 })
          hasError = true
          break
        }
      }
    }

    if (idsToDelete.length > 0 && !hasError) {
      try {
        await callRpc<void>({ fn: 'maintenance_tasks_delete', args: { p_ids: idsToDelete } as any })
      } catch (e: any) {
        toast({ variant: "destructive", title: "Lỗi xóa công việc cũ", description: e.message, duration: 10000 })
        hasError = true
      }
    }

    if (!hasError) {
      toast({ title: "Thành công", description: "Đã lưu tất cả thay đổi vào cơ sở dữ liệu." })
      localStorage.removeItem(getDraftCacheKey(selectedPlan.id))
      await fetchTasks(selectedPlan)
      onSaveSuccess?.()
    }

    setIsSaving(false)
  }, [selectedPlan, hasChanges, draftTasks, tasks, toast, getDraftCacheKey, fetchTasks, onSaveSuccess])

  // Cancel all changes
  const cancelAllChanges = React.useCallback(() => {
    setDraftTasks(tasks)
    if (selectedPlan) {
      localStorage.removeItem(getDraftCacheKey(selectedPlan.id))
    }
    toast({ title: "Đã hủy", description: "Mọi thay đổi chưa lưu đã được hủy bỏ." })
  }, [tasks, selectedPlan, getDraftCacheKey, toast])

  return {
    // State
    tasks,
    draftTasks,
    setDraftTasks,
    hasChanges,
    isLoading,
    isSaving,

    // Actions
    fetchTasks,
    saveAllChanges,
    cancelAllChanges,
    getDraftCacheKey,
  }
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/(app)/maintenance/_hooks/use-maintenance-drafts.ts
git commit -m "feat(maintenance): add use-maintenance-drafts hook for task editing"
```

---

## Task 7: Final Verification and Cleanup

**Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS with 0 errors

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Manual testing checklist**

- [ ] Can view plans list
- [ ] Can select a plan and view tasks
- [ ] Can approve a plan
- [ ] Can reject a plan with reason
- [ ] Can delete a plan
- [ ] Can edit task inline
- [ ] Can save all changes
- [ ] Can cancel changes
- [ ] Can print plan form
- [ ] Draft persists across page reload

**Step 4: Close beads issue**

```bash
bd close qltbyt-nam-phong-uwg --reason="Extracted 3 hooks: use-maintenance-operations, use-maintenance-print, use-maintenance-drafts"
```

**Step 5: Final commit with summary**

```bash
git add -A
git commit -m "refactor(maintenance): complete Phase 1 hook extraction

Extracted ~870 lines from page.tsx into reusable hooks:
- use-maintenance-operations.ts (~150 lines)
- use-maintenance-print.ts (~520 lines)
- use-maintenance-drafts.ts (~200 lines)

Closes: qltbyt-nam-phong-uwg"
```

---

## Summary

| Task | Description | Lines Saved |
|------|-------------|-------------|
| 2-3 | use-maintenance-operations | ~150 |
| 4-5 | use-maintenance-print | ~520 |
| 6 | use-maintenance-drafts | ~200 |
| **Total** | | **~870** |

After completion, `page.tsx` should be reduced from ~3400 lines to ~2530 lines.
