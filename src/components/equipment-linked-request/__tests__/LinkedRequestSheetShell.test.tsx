import * as React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let sheetInstanceCounter = 0

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({
    open,
    children,
    onOpenChange,
  }: {
    open: boolean
    children: React.ReactNode
    onOpenChange?: (open: boolean) => void
  }) => {
    const instanceId = React.useRef(++sheetInstanceCounter)
    if (!open) return null

    return (
      <div
        data-testid="sheet-root"
        data-sheet-instance={String(instanceId.current)}
        onClick={() => onOpenChange?.(false)}
      >
        {children}
      </div>
    )
  },
  SheetContent: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div data-testid="sheet-content" {...props}>
      {children}
    </div>
  ),
}))

import { LinkedRequestSheetShell } from '../LinkedRequestSheetShell'

describe('LinkedRequestSheetShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sheetInstanceCounter = 0
  })

  it('renders one shared sheet shell with the standard equipment linked-request sizing', () => {
    render(
      <LinkedRequestSheetShell open={true} onClose={vi.fn()}>
        <div>shell content</div>
      </LinkedRequestSheetShell>,
    )

    expect(screen.getByTestId('sheet-root')).toBeInTheDocument()
    expect(screen.getByTestId('sheet-content').className).toContain('w-full')
    expect(screen.getByTestId('sheet-content').className).toContain('sm:max-w-xl')
    expect(screen.getByTestId('sheet-content').className).toContain('md:max-w-2xl')
    expect(screen.getByTestId('sheet-content').className).toContain('lg:max-w-3xl')
  })

  it('calls onClose when the sheet requests close', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <LinkedRequestSheetShell open={true} onClose={onClose}>
        <div>shell content</div>
      </LinkedRequestSheetShell>,
    )

    await user.click(screen.getByTestId('sheet-root'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the same sheet instance mounted while children change from loading to resolved content', () => {
    const { rerender } = render(
      <LinkedRequestSheetShell open={true} onClose={vi.fn()}>
        <div>loading content</div>
      </LinkedRequestSheetShell>,
    )

    const initialInstanceId = screen
      .getByTestId('sheet-root')
      .getAttribute('data-sheet-instance')

    rerender(
      <LinkedRequestSheetShell open={true} onClose={vi.fn()}>
        <div>resolved content</div>
      </LinkedRequestSheetShell>,
    )

    expect(screen.getByText('resolved content')).toBeInTheDocument()
    expect(screen.getByTestId('sheet-root')).toHaveAttribute(
      'data-sheet-instance',
      initialInstanceId,
    )
  })

  it('renders nothing when closed', () => {
    render(
      <LinkedRequestSheetShell open={false} onClose={vi.fn()}>
        <div>hidden content</div>
      </LinkedRequestSheetShell>,
    )

    expect(screen.queryByTestId('sheet-root')).toBeNull()
  })
})
