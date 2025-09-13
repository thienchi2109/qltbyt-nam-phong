"use client"

import * as React from "react"
import { Filter, FilterX } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

interface MobileFiltersDropdownProps {
  children: React.ReactNode
  activeFiltersCount: number
  onClearFilters: () => void
}

export function MobileFiltersDropdown({ 
  children, 
  activeFiltersCount, 
  onClearFilters 
}: MobileFiltersDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-8 gap-2 touch-target-sm md:h-8">
          <Filter className="h-3.5 w-3.5" />
          Bộ lọc
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Bộ lọc nâng cao
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-6 px-2 text-xs touch-target-sm md:h-6"
            >
              <FilterX className="h-3 w-3 mr-1" />
              Xóa
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-2 space-y-2" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 