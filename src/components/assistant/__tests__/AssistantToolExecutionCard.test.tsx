import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AssistantToolExecutionCard } from '../AssistantToolExecutionCard'

describe('AssistantToolExecutionCard', () => {
  it('reveals a visible summary when expanded after tool completion', () => {
    render(
      <AssistantToolExecutionCard
        toolName="equipmentLookup"
        state="output-available"
      />,
    )

    expect(screen.queryByText('Đã hoàn tất tra cứu thiết bị.')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Mở rộng'))

    expect(screen.getByText('Đã hoàn tất tra cứu thiết bị.')).toBeInTheDocument()
  })
})
