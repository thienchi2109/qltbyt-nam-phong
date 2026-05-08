"use client"

import * as React from "react"
import { Calendar as CalendarIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type TransfersDateFilterButtonProps = Readonly<{
  label: string
  value: Date | null
  onChange: (date: Date | null) => void
}>

export function TransfersDateFilterButton({
  label,
  value,
  onChange,
}: TransfersDateFilterButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-9 min-w-[116px] justify-start",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? value.toLocaleDateString("vi-VN") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[1100]" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(date) => onChange(date ?? null)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
