"use client"

import * as React from "react"
import type { Session } from "next-auth"
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { PlusCircle } from "lucide-react"

import { TenantsManagement } from "@/components/tenants-management"
import { DataTablePagination } from "@/components/shared/DataTablePagination"
import type { DisplayContext } from "@/components/shared/DataTablePagination/types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMediaQuery } from "@/hooks/use-media-query"
import { isGlobalRole } from "@/lib/rbac"
import type { SessionUser } from "@/types/database"

import { useUsersManagement } from "../_hooks/useUsersManagement"
import { UsersDesktopTable } from "./UsersDesktopTable"
import { UsersDialogs } from "./UsersDialogs"
import { UsersMobileList } from "./UsersMobileList"
import { createUsersColumns } from "./usersColumns"

const USER_ENTITY = { singular: "người dùng" } as const

type UsersPageContentProps = {
  user: Session["user"]
}

export function UsersPageContent({ user }: UsersPageContentProps) {
  const currentUser = user as SessionUser
  const isAdmin = isGlobalRole(currentUser.role)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const usersManagement = useUsersManagement({
    user: currentUser,
    enabled: isAdmin,
  })

  const columns = React.useMemo(
    () =>
      createUsersColumns({
        currentUser,
        onEdit: usersManagement.setEditingUser,
        onDelete: usersManagement.setUserToDelete,
        onResetPassword: usersManagement.setUserToReset,
      }),
    [
      currentUser,
      usersManagement.setEditingUser,
      usersManagement.setUserToDelete,
      usersManagement.setUserToReset,
    ],
  )

  const table = useReactTable({
    data: usersManagement.users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: usersManagement.setSorting,
    onPaginationChange: usersManagement.setPagination,
    onGlobalFilterChange: usersManagement.setGlobalFilter,
    state: {
      sorting: usersManagement.sorting,
      pagination: usersManagement.pagination,
      globalFilter: usersManagement.debouncedSearch,
    },
  })

  const usersDisplayFormat = React.useCallback((ctx: DisplayContext) => {
    const entityLabel = ctx.entity.plural ?? ctx.entity.singular
    const currentCount = ctx.totalCount > 0 ? Math.max(0, ctx.endItem - ctx.startItem + 1) : 0

    return `Hiển thị ${currentCount} trên ${ctx.totalCount} ${entityLabel}.`
  }, [])

  if (!isAdmin) {
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Không có quyền truy cập</CardTitle>
          <CardDescription>Chỉ global/admin mới có thể quản lý người dùng.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <UsersDialogs
        isAddDialogOpen={usersManagement.isAddDialogOpen}
        onAddDialogOpenChange={usersManagement.setIsAddDialogOpen}
        onSuccess={usersManagement.refreshUsers}
        editingUser={usersManagement.editingUser}
        onEditingUserChange={usersManagement.setEditingUser}
        userToDelete={usersManagement.userToDelete}
        onUserToDeleteChange={usersManagement.setUserToDelete}
        isDeletingUser={usersManagement.isDeletingUser}
        onDeleteUser={usersManagement.handleDeleteUser}
        userToReset={usersManagement.userToReset}
        onUserToResetChange={usersManagement.setUserToReset}
        isResettingPassword={usersManagement.isResettingPassword}
        onResetPassword={usersManagement.handleResetPassword}
      />

      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants">Đơn vị</TabsTrigger>
          <TabsTrigger value="users">Người dùng</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants">
          <TenantsManagement />
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="grid gap-2">
                  <CardTitle>Quản lý Người dùng</CardTitle>
                  <CardDescription>
                    Tạo, chỉnh sửa và xóa tài khoản người dùng. Chỉ quản trị viên mới có quyền
                    truy cập.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 md:ml-auto">
                  <Input
                    placeholder="Tìm kiếm người dùng…"
                    value={usersManagement.globalFilter}
                    onChange={(event) => usersManagement.setGlobalFilter(event.target.value)}
                    className="h-8 w-full md:w-64"
                  />
                  <Button
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => usersManagement.setIsAddDialogOpen(true)}
                  >
                    <PlusCircle className="size-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Thêm người dùng
                    </span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isMobile ? (
                <UsersMobileList
                  rows={table.getRowModel().rows}
                  isLoading={usersManagement.isLoading}
                  onEdit={usersManagement.setEditingUser}
                  onDelete={usersManagement.setUserToDelete}
                />
              ) : (
                <UsersDesktopTable
                  table={table}
                  columns={columns}
                  pageSize={usersManagement.pagination.pageSize}
                  isLoading={usersManagement.isLoading}
                />
              )}
              {usersManagement.users.length > 0 && (
                <div className="py-4">
                  <DataTablePagination
                    table={table}
                    totalCount={table.getFilteredRowModel().rows.length}
                    entity={USER_ENTITY}
                    paginationMode={{
                      mode: "controlled",
                      pagination: usersManagement.pagination,
                      onPaginationChange: usersManagement.setPagination,
                    }}
                    displayFormat={usersDisplayFormat}
                    responsive={{ showFirstLastAt: "lg" }}
                    isLoading={usersManagement.isLoading}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
