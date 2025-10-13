"use client"

import { Button } from "@/components/ui/button"
import { LayoutList, LayoutGrid } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type DensityMode = 'compact' | 'rich'

interface DensityToggleProps {
  mode: DensityMode
  onChange: (mode: DensityMode) => void
}

export function DensityToggle({ mode, onChange }: DensityToggleProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 border rounded-md p-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === 'compact' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => onChange('compact')}
            >
              <LayoutList className="h-4 w-4" />
              <span className="ml-1 text-xs hidden sm:inline">Thu gọn</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Chế độ thu gọn - Hiển thị ít thông tin hơn</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === 'rich' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => onChange('rich')}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="ml-1 text-xs hidden sm:inline">Đầy đủ</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Chế độ đầy đủ - Hiển thị tất cả thông tin</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
