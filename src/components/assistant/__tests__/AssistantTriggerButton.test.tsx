import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AssistantTriggerButton } from '../AssistantTriggerButton'

describe('AssistantTriggerButton', () => {
    it('renders Sparkles icon when panel is closed', () => {
        render(<AssistantTriggerButton isOpen={false} onToggle={vi.fn()} />)

        const button = screen.getByRole('button', { name: /trợ lý ai/i })
        expect(button).toBeInTheDocument()
        // Sparkles icon should be present when closed
        expect(button.querySelector('[data-testid="icon-sparkles"]')).toBeInTheDocument()
    })

    it('renders X icon when panel is open', () => {
        render(<AssistantTriggerButton isOpen={true} onToggle={vi.fn()} />)

        const button = screen.getByRole('button', { name: /đóng trợ lý/i })
        expect(button).toBeInTheDocument()
        expect(button.querySelector('[data-testid="icon-x"]')).toBeInTheDocument()
    })

    it('calls onToggle when clicked', () => {
        const onToggle = vi.fn()
        render(<AssistantTriggerButton isOpen={false} onToggle={onToggle} />)

        fireEvent.click(screen.getByRole('button'))
        expect(onToggle).toHaveBeenCalledOnce()
    })

    it('has fixed positioning and rounded-full shape', () => {
        render(<AssistantTriggerButton isOpen={false} onToggle={vi.fn()} />)

        const button = screen.getByRole('button')
        expect(button.className).toContain('fixed')
        expect(button.className).toContain('h-14')
        expect(button.className).toContain('w-14')
        expect(button.className).toContain('rounded-full')
    })

    it('stacks above mobile page FABs instead of sharing their footer offset', () => {
        render(<AssistantTriggerButton isOpen={false} onToggle={vi.fn()} />)

        const button = screen.getByRole('button', { name: /trợ lý ai/i })
        expect(button.className).toContain('bottom-[calc(env(safe-area-inset-bottom,0px)+9.5rem)]')
        expect(button.className).not.toContain('bottom-[calc(env(safe-area-inset-bottom,0px)+4rem+1rem)]')
    })
})
