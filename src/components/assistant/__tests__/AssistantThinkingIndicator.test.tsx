import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AssistantThinkingIndicator } from '../AssistantThinkingIndicator'

describe('AssistantThinkingIndicator', () => {
    it('renders 3 bouncing dots', () => {
        render(<AssistantThinkingIndicator />)

        const dots = screen.getAllByTestId('assistant-thinking-dot')
        expect(dots).toHaveLength(3)
    })

    it('each dot has the bounce animation class', () => {
        render(<AssistantThinkingIndicator />)

        const dots = screen.getAllByTestId('assistant-thinking-dot')
        dots.forEach((dot) => {
            expect(dot.className).toContain('assistant-dot')
        })
    })

    it('renders in a pill-shaped bubble container', () => {
        render(<AssistantThinkingIndicator />)

        const container = screen.getByTestId('assistant-thinking-container')
        expect(container.className).toContain('rounded-2xl')
    })
})
