'use client'

import * as React from 'react'
import { Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Equipment } from '@/types/database'
import { useLinkedRequest } from './LinkedRequestContext'
import { STRINGS } from './strings'

interface LinkedRequestRowIndicatorProps {
  equipment: Pick<
    Equipment,
    'id' | 'ma_thiet_bi' | 'tinh_trang_hien_tai' | 'active_repair_request_id'
  >
}

const WAITING_REPAIR_STATUS = 'Chờ sửa chữa'

export function LinkedRequestRowIndicator({ equipment }: LinkedRequestRowIndicatorProps) {
  const { openRepair } = useLinkedRequest()

  if (
    equipment.tinh_trang_hien_tai !== WAITING_REPAIR_STATUS ||
    equipment.active_repair_request_id == null
  ) {
    return null
  }

  return (
    <TooltipProvider delayDuration={300} disableHoverableContent>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-1 h-6 w-6 text-amber-500 hover:text-amber-600"
            aria-label={STRINGS.rowIndicatorAriaLabel(equipment.ma_thiet_bi ?? '')}
            onClick={(event) => {
              event.stopPropagation()
              openRepair(equipment.id)
            }}
          >
            <Wrench className="h-4 w-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{STRINGS.rowIndicatorTooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
