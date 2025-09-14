"use client"

import { Edit, MoreHorizontal, Trash2 } from "lucide-react"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { USER_ROLES, type User } from "@/types/database" // Đảm bảo đường dẫn đúng
import { useSession } from "next-auth/react" // Để kiểm tra không cho xóa chính mình

interface UserCardProps {
  user: User
  onEdit: (user: User) => void
  onDelete: (user: User) => void
}

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

export function UserCard({ user, onEdit, onDelete }: UserCardProps) {
  const { data: session } = useSession()
  const currentUser = session?.user as any // Cast NextAuth user to our User type
  const isCurrentUserTheUserInCard = currentUser?.id === user.id

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{user.full_name}</CardTitle>
            <CardDescription>@{user.username}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-auto h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Mở menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Hành động</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onEdit(user)}>
                <Edit className="mr-2 h-4 w-4" />
                Chỉnh sửa
              </DropdownMenuItem>
              {!isCurrentUserTheUserInCard && ( // Không cho xóa chính mình
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onDelete(user)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Xoá
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <span className="text-sm font-medium text-muted-foreground">Vai trò: </span>
          <Badge variant={getRoleVariant(user.role)} className="text-sm">
            {USER_ROLES[user.role]}
          </Badge>
        </div>
        {user.khoa_phong && (
          <div>
            <span className="text-sm font-medium text-muted-foreground">Khoa/Phòng: </span>
            <span className="text-sm">{user.khoa_phong}</span>
          </div>
        )}
      </CardContent>
      {/* <CardFooter>
        <p className="text-xs text-muted-foreground">
          Ngày tạo: {format(parseISO(user.created_at), 'dd/MM/yyyy', { locale: vi })}
        </p>
      </CardFooter> */}
    </Card>
  )
}
