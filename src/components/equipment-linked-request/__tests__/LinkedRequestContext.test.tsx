import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  LinkedRequestProvider,
  useLinkedRequest,
} from '../LinkedRequestContext'

function wrap(): React.FC<{ children: React.ReactNode }> {
  return function Wrapper({ children }) {
    return <LinkedRequestProvider>{children}</LinkedRequestProvider>
  }
}

describe('LinkedRequestProvider', () => {
  it('does not couple provider lifecycle to EquipmentDialogContext', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/equipment-linked-request/LinkedRequestContext.tsx'),
      'utf8',
    )

    expect(source).not.toContain('EquipmentDialogContext')
  })

  it('starts in the closed state', () => {
    const { result } = renderHook(() => useLinkedRequest(), { wrapper: wrap() })
    expect(result.current.state).toEqual({ open: false, kind: null, equipmentId: null })
  })

  it('opens with kind="repair" and the given equipmentId', () => {
    const { result } = renderHook(() => useLinkedRequest(), { wrapper: wrap() })
    act(() => result.current.openRepair(11))
    expect(result.current.state).toEqual({ open: true, kind: 'repair', equipmentId: 11 })
  })

  it('close() returns to the closed state', () => {
    const { result } = renderHook(() => useLinkedRequest(), { wrapper: wrap() })
    act(() => result.current.openRepair(7))
    act(() => result.current.close())
    expect(result.current.state.open).toBe(false)
  })

  it('throws if used outside the provider', () => {
    expect(() => renderHook(() => useLinkedRequest())).toThrow(
      /LinkedRequestProvider/,
    )
  })

  it('does not require EquipmentDialogContext to stay open', async () => {
    const { result } = renderHook(() => useLinkedRequest(), { wrapper: wrap() })

    act(() => result.current.openRepair(99))

    await waitFor(() => {
      expect(result.current.state).toEqual({ open: true, kind: 'repair', equipmentId: 99 })
    })
  })
})
