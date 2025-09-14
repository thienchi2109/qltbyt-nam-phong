"use client"

import * as React from "react"
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table"
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
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit, Loader2, MoreHorizontal, PlusCircle, RefreshCw, Trash2 } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useMediaQuery } from "@/hooks/use-media-query"
import { UserCard } from "@/components/user-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSession } from "next-auth/react"
import { AddUserDialog } from "@/components/add-user-dialog"
import { EditUserDialog } from "@/components/edit-user-dialog"
import { USER_ROLES, type User } from "@/types/database"
import { Input } from "@/components/ui/input"
import { useSearchDebounce } from "@/hooks/use-debounce"

export default function UsersPage() {
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const currentUser = session?.user as any
  
  // State for users
  const [users, setUsers] = React.useState<User[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [globalFilter, setGlobalFilter] = React.useState('')
  const debouncedSearch = useSearchDebounce(globalFilter)

  // State for dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<User | null>(null)
  const [userToDelete, setUserToDelete] = React.useState<User | null>(null)
  const [isDeletingUser, setIsDeletingUser] = React.useState(false)
  const [userToReset, setUserToReset] = React.useState<User | null>(null)
  const [isResettingPassword, setIsResettingPassword] = React.useState(false)
  const isMobile = useMediaQuery("(max-width: 768px)")

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'admin'

  // Redirect if not admin
  React.useEffect(() => {
    if (status === 'authenticated' && currentUser && !isAdmin) {
      // toast({ // Commented out to prevent potential issues with toast during initial load/redirect
      //   variant: "destructive",
      //   title: "Không có quyền truy cập",
      //   description: "Chỉ quản trị viên mới có thể truy cập trang này."
      // })
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard'
      }
    }
  }, [currentUser, isAdmin, status /*, toast*/])

  const fetchUsers = React.useCallback(async () => {
    if (!isAdmin) return
    
    setIsLoading(true)
    if (!supabase) {
      // toast({ variant: "destructive", title: "Lỗi", description: "Không thể kết nối đến cơ sở dữ liệu." }) // Avoid toast if redirecting or not admin
      setIsLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("nhan_vien")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      toast({ variant: "destructive", title: "Lỗi tải danh sách người dùng", description: error.message })
      setUsers([])
    } else {
      setUsers(data as User[])
    }
    setIsLoading(false)
  }, [toast, isAdmin])

  React.useEffect(() => {
    if (isAdmin) {
      fetchUsers()
    }
  }, [fetchUsers, isAdmin])

  const handleDeleteUser = React.useCallback(async () => {
    if (!userToDelete || !supabase) return
    setIsDeletingUser(true)

    // Prevent deleting self
    if (userToDelete.id === currentUser?.id) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Bạn không thể xóa tài khoản của chính mình."
      })
      setIsDeletingUser(false)
      setUserToDelete(null)
      return
    }

    const { error } = await supabase
      .from('nhan_vien')
      .delete()
      .eq('id', userToDelete.id)

    if (error) {
      toast({ variant: "destructive", title: "Lỗi xóa người dùng", description: error.message })
    } else {
      toast({ title: "Đã xóa", description: "Người dùng đã được xóa thành công." })
      fetchUsers()
    }

    setIsDeletingUser(false)
    setUserToDelete(null)
  }, [userToDelete, toast, fetchUsers, currentUser])

  const handleResetPassword = React.useCallback(async () => {
    if (!userToReset || !currentUser || !supabase) return
    setIsResettingPassword(true)

    const { data, error } = await supabase.rpc('reset_password_by_admin', {
      p_admin_user_id: currentUser.id,
      p_target_user_id: userToReset.id,
    })

    if (error || !data) {
      toast({
        variant: "destructive",
        title: "Lỗi đặt lại mật khẩu",
        description: error?.message || "Không thể đặt lại mật khẩu cho người dùng này.",
      })
    } else {
      // RPC returns jsonb, e.g., { success: true, message, username, new_password }
      const message = (data as any).message || `Đã đặt lại mật khẩu cho ${userToReset.username}.`
      toast({
        title: "Thành công",
        description: message,
      })
    }
    
    setIsResettingPassword(false)
    setUserToReset(null)
  }, [userToReset, currentUser, toast])

  const getRoleVariant = (role: User["role"]) => {
    switch (role) {
      case "admin":
        return "destructive"
      case "to_qltb":
        return "default"
      case "qltb_khoa":
        return "secondary"
      case "user":
        return "outline"
      default:
        return "outline"
    }
  }

  const columns: ColumnDef<User>[] = React.useMemo(() => [
    {
      accessorKey: "username",
      header: "Tên đăng nhập",
      cell: ({ row }) => <div className="font-medium">{row.getValue("username")}</div>,
    },
    {
      accessorKey: "full_name",
      header: "Họ và tên",
      cell: ({ row }) => row.getValue("full_name"),
    },
    {
      accessorKey: "role",
      header: "Vai trò",
      cell: ({ row }) => {
        const role = row.getValue("role") as User["role"]
        return <Badge variant={getRoleVariant(role)}>{USER_ROLES[role]}</Badge>
      },
    },
    {
      accessorKey: "khoa_phong",
      header: "Khoa/Phòng",
      cell: ({ row }) => row.getValue("khoa_phong") || <span className="text-muted-foreground italic">Chưa xác định</span>,
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Ngày tạo
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = row.getValue("created_at") as string
        return format(parseISO(date), 'dd/MM/yyyy HH:mm', { locale: vi })
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const user = row.original
        const isCurrentUser = user.id === currentUser?.id
        
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
              <DropdownMenuItem onSelect={() => setEditingUser(user)}>
                <Edit className="mr-2 h-4 w-4" />
                Chỉnh sửa
              </DropdownMenuItem>
              {!isCurrentUser && (
                <>
                  <DropdownMenuItem onSelect={() => setUserToReset(user)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Đặt lại mật khẩu
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={() => setUserToDelete(user)} 
                    className="text-destructive focus:text-destructive"
                  >
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
  ], [currentUser])

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      pagination,
      globalFilter: debouncedSearch,
    },
  })

  // Don't render anything if not admin
  if (!isAdmin) {
    return null
  }

  return (
    <>
      <AddUserDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={fetchUsers}
      />
      <EditUserDialog
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        onSuccess={fetchUsers}
        user={editingUser}
      />
      {userToDelete && (
        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
              <AlertDialogDescription>
                Hành động này không thể hoàn tác. Tài khoản của 
                <strong> {userToDelete.full_name} ({userToDelete.username}) </strong> 
                sẽ bị xóa vĩnh viễn.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingUser}>Hủy</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteUser} 
                disabled={isDeletingUser} 
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeletingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <AlertDialog open={!!userToReset} onOpenChange={(open) => !open && setUserToReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận đặt lại mật khẩu?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ đặt lại mật khẩu cho người dùng <span className="font-bold">{userToReset?.username}</span> thành mật khẩu mặc định là <span className="font-bold">"userqltb"</span>. Người dùng sẽ cần đổi mật khẩu này sau khi đăng nhập.
              <br/>
              Bạn có chắc chắn muốn tiếp tục không?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword} disabled={isResettingPassword}>
              {isResettingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="grid gap-2">
              <CardTitle>Quản lý Người dùng</CardTitle>
              <CardDescription>
                Tạo, chỉnh sửa và xóa tài khoản người dùng. Chỉ quản trị viên mới có quyền truy cập.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 md:ml-auto">
              <Input
                placeholder="Tìm kiếm người dùng..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="h-8 w-full md:w-64"
              />
              <Button size="sm" className="h-8 gap-1" onClick={() => setIsAddDialogOpen(true)}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Thêm người dùng
                </span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            <div className="space-y-4">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-lg" />
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <UserCard
                    key={row.original.id}
                    user={row.original}
                    onEdit={() => setEditingUser(row.original)}
                    onDelete={() => setUserToDelete(row.original)}
                  />
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Không tìm thấy người dùng nào.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
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
                    Array.from({ length: pagination.pageSize }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={columns.length}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        Không tìm thấy người dùng nào.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {/* Pagination - common for both views */}
          {users.length > 0 && (
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="flex-1 text-sm text-muted-foreground">
                Hiển thị {table.getRowModel().rows.length} trên {users.length} người dùng.
              </div>
              <div className="flex items-center gap-x-2 sm:gap-x-4 md:gap-x-6 lg:gap-x-8">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium hidden sm:block">Số dòng</p>
                  <Select
                    value={`${table.getState().pagination.pageSize}`}
                    onValueChange={(value) => {
                      table.setPageSize(Number(value))
                    }}
                  >
                    <SelectTrigger className="h-8 w-[60px] sm:w-[70px]">
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
                <div className="flex w-[80px] sm:w-[100px] items-center justify-center text-sm font-medium">
                  Trang {table.getState().pagination.pageIndex + 1} /{" "}
                  {table.getPageCount()}
                </div>
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <Button
                    variant="outline"
                    className="hidden h-8 w-8 p-0 lg:flex"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Về trang đầu</span>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Trang trước</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Trang sau</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="hidden h-8 w-8 p-0 lg:flex"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Đến trang cuối</span>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}