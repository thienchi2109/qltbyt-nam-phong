import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import type { Equipment } from '@/types/database'

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { EquipmentDetailDetailsTab } from '../_components/EquipmentDetailDialog/EquipmentDetailDetailsTab'

describe('EquipmentDetailDetailsTab', () => {
  it('formats ngay_ngung_su_dung as DD/MM/YYYY', () => {
    render(
      <EquipmentDetailDetailsTab
        displayEquipment={{
          id: 1,
          ma_thiet_bi: 'EQ-001',
          ten_thiet_bi: 'Máy siêu âm',
          ngay_ngung_su_dung: '2024-12-31',
        } as Equipment}
        isEditing={false}
      />
    )

    expect(screen.getByText('Ngày ngừng sử dụng')).toBeInTheDocument()
    expect(screen.getByText('31/12/2024')).toBeInTheDocument()
  })
})
