"use client"

import type { Row } from "@tanstack/react-table"

import { UserCard } from "@/components/user-card"
import { Skeleton } from "@/components/ui/skeleton"
import type { UserSummary } from "@/types/database"

type UsersMobileListProps = {
  rows: Row<UserSummary>[]
  isLoading: boolean
  onEdit: (user: UserSummary) => void
  onDelete: (user: UserSummary) => void
}

export function UsersMobileList({ rows, isLoading, onEdit, onDelete }: UsersMobileListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">Không tìm thấy người dùng nào.</div>
    )
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <UserCard
          key={row.original.id}
          user={row.original}
          onEdit={() => onEdit(row.original)}
          onDelete={() => onDelete(row.original)}
        />
      ))}
    </div>
  )
}
