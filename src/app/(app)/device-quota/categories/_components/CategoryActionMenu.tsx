"use client"

import * as React from "react"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CategoryListItem } from "../_types/categories"

interface CategoryActionMenuProps {
    category: CategoryListItem
    disabled: boolean
    onEdit: (category: CategoryListItem) => void
    onDelete: (category: CategoryListItem) => void
    className?: string
}

export function CategoryActionMenu({
    category,
    disabled,
    onEdit,
    onDelete,
    className,
}: CategoryActionMenuProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("size-7", className)}
                    disabled={disabled}
                    aria-label={`Mở menu danh mục ${category.ten_nhom}`}
                    onClick={(event) => event.stopPropagation()}
                >
                    <MoreHorizontal className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onEdit(category)}>
                    <Pencil className="mr-2 size-4" />
                    Sửa
                </DropdownMenuItem>
                <DropdownMenuItem
                    onSelect={() => onDelete(category)}
                    className="text-destructive focus:text-destructive"
                >
                    <Trash2 className="mr-2 size-4" />
                    Xóa
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
