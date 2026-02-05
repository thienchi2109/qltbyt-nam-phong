"use client"

import * as React from "react"
import { PlusCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"

export function DeviceQuotaCategoryToolbar() {
  const { openCreateDialog } = useDeviceQuotaCategoryContext()

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div />
      <div className="flex items-center gap-2">
        <Button onClick={openCreateDialog}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Tạo danh mục
        </Button>
      </div>
    </div>
  )
}
