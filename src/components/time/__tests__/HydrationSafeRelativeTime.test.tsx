import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HydrationSafeRelativeTime } from '../HydrationSafeRelativeTime'

describe('HydrationSafeRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15T15:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a deterministic absolute timestamp on the server', () => {
    const html = renderToStaticMarkup(
      <HydrationSafeRelativeTime value="2025-01-15T14:30:00.000Z" />
    )

    expect(html).toContain('15/01/2025 21:30')
    expect(html).not.toContain('phút')
  })

  it('upgrades to relative time after the client subscribes', async () => {
    render(<HydrationSafeRelativeTime value="2025-01-15T14:30:00.000Z" />)

    expect(screen.getByText(/phút/)).toBeInTheDocument()
  })

  it('refreshes the relative label when the minute tick advances', async () => {
    render(<HydrationSafeRelativeTime value="2025-01-15T14:58:00.000Z" />)

    expect(screen.getByText(/2 phút trước/)).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(screen.getByText(/3 phút trước/)).toBeInTheDocument()
  })

  it('accepts numeric millisecond timestamps', () => {
    render(<HydrationSafeRelativeTime value={Date.parse('2025-01-15T14:58:00.000Z')} />)

    expect(screen.getByText(/2 phút trước/)).toBeInTheDocument()
  })

  it('uses the fallback placeholder for invalid values', () => {
    render(<HydrationSafeRelativeTime value={null} fallback="-" />)

    expect(screen.getByText('-')).toBeInTheDocument()
  })
})
