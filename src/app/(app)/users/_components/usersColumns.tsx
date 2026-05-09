"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import { ArrowUpDown, Edit, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { isGlobalRole } from "@/lib/rbac"
import { USER_ROLES, type SessionUser, type UserSummary } from "@/types/database"

type UsersColumnsOptions = {
  currentUser: SessionUser
  onEdit: (user: UserSummary) => void
  onDelete: (user: UserSummary) => void
  onResetPassword: (user: UserSummary) => void
}

export function getRoleVariant(role: UserSummary["role"]) {
  if (isGlobalRole(role)) return "destructive"

  switch (role) {
    case "to_qltb":
      return "default"
    case "qltb_khoa":
      return "secondary"
    default:
      return "outline"
  }
}

export function createUsersColumns({
  currentUser,
  onEdit,
  onDelete,
  onResetPassword,
}: UsersColumnsOptions): ColumnDef<UserSummary>[] {
  return [
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
        const role = row.getValue("role") as UserSummary["role"]
        return <Badge variant={getRoleVariant(role)}>{USER_ROLES[role]}</Badge>
      },
    },
    {
      accessorKey: "khoa_phong",
      header: "Khoa/Phòng",
      cell: ({ row }) =>
        row.getValue("khoa_phong") || (
          <span className="text-muted-foreground italic">Chưa xác định</span>
        ),
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Ngày tạo
          <ArrowUpDown className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = row.getValue("created_at") as string
        return format(parseISO(date), "dd/MM/yyyy HH:mm", { locale: vi })
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const user = row.original
        const isCurrentUser = String(user.id) === String(currentUser.id)

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="size-8 p-0">
                <span className="sr-only">Mở menu</span>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Hành động</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onEdit(user)}>
                <Edit className="mr-2 size-4" />
                Chỉnh sửa
              </DropdownMenuItem>
              {!isCurrentUser && (
                <>
                  <DropdownMenuItem onSelect={() => onResetPassword(user)}>
                    <RefreshCw className="mr-2 size-4" />
                    Đặt lại mật khẩu
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => onDelete(user)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Xoá
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
