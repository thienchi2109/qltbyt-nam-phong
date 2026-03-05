import React from 'react'
import { render, screen } from '@testing-library/react'
import "@testing-library/jest-dom"
import { describe, it, expect } from 'vitest'

import { QuotaProgressBar } from '../_components/QuotaProgressBar'

describe('QuotaProgressBar', () => {
    it('shows fraction "3/9" when both current and max provided', () => {
        render(<QuotaProgressBar current={3} max={9} />)
        expect(screen.getByText('3/9')).toBeInTheDocument()
    })

    it('shows "0/–" when max is null', () => {
        render(<QuotaProgressBar current={0} max={null} />)
        expect(screen.getByText('0/–')).toBeInTheDocument()
    })

    it('renders progress bar with correct percentage', () => {
        const { container } = render(<QuotaProgressBar current={3} max={9} />)
        const indicator = container.querySelector('[data-testid="quota-bar-fill"]')
        expect(indicator).toBeInTheDocument()
        // 3/9 = 33.33%
        expect(indicator).toHaveStyle({ width: '33%' })
    })

    it('applies green color when usage below 80%', () => {
        const { container } = render(<QuotaProgressBar current={3} max={9} />)
        const indicator = container.querySelector('[data-testid="quota-bar-fill"]')
        expect(indicator?.className).toMatch(/emerald/)
    })

    it('applies amber color when usage at 80% or above', () => {
        const { container } = render(<QuotaProgressBar current={8} max={10} />)
        const indicator = container.querySelector('[data-testid="quota-bar-fill"]')
        expect(indicator?.className).toMatch(/amber/)
    })

    it('applies red color when over quota', () => {
        const { container } = render(<QuotaProgressBar current={12} max={10} />)
        const indicator = container.querySelector('[data-testid="quota-bar-fill"]')
        expect(indicator?.className).toMatch(/red/)
    })

    it('applies gray color when max is null', () => {
        const { container } = render(<QuotaProgressBar current={5} max={null} />)
        const indicator = container.querySelector('[data-testid="quota-bar-fill"]')
        expect(indicator?.className).toMatch(/muted/)
    })

    it('clamps progress bar at 100% when over quota', () => {
        const { container } = render(<QuotaProgressBar current={15} max={10} />)
        const indicator = container.querySelector('[data-testid="quota-bar-fill"]')
        expect(indicator).toHaveStyle({ width: '100%' })
    })

    it('shows 0% width when current is 0', () => {
        const { container } = render(<QuotaProgressBar current={0} max={10} />)
        const indicator = container.querySelector('[data-testid="quota-bar-fill"]')
        expect(indicator).toHaveStyle({ width: '0%' })
    })
})
