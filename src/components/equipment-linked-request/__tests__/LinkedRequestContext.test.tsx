import * as React from 'react'
import { act, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  LinkedRequestProvider,
  useLinkedRequest,
} from '../LinkedRequestContext'
import {
  EquipmentDialogContext,
  type EquipmentDialogContextValue,
} from '@/app/(app)/equipment/_components/EquipmentDialogContext'

function createEquipmentDialogContextStub(
  overrides: Partial<EquipmentDialogContextValue> = {}
): EquipmentDialogContextValue {
  return {
    user: null,
    isGlobal: false,
    isRegionalLeader: false,
    dialogState: {
      isAddOpen: false,
      isImportOpen: false,
      isColumnsOpen: false,
      isDetailOpen: false,
      isStartUsageOpen: false,
      isEndUsageOpen: false,
      isDeleteOpen: false,
      detailEquipment: null,
      startUsageEquipment: null,
      endUsageLog: null,
      deleteTarget: null,
      deleteSource: null,
    },
    openAddDialog: vi.fn(),
    openImportDialog: vi.fn(),
    openColumnsDialog: vi.fn(),
    openDetailDialog: vi.fn(),
    openStartUsageDialog: vi.fn(),
    openEndUsageDialog: vi.fn(),
    openDeleteDialog: vi.fn(),
    closeAddDialog: vi.fn(),
    closeImportDialog: vi.fn(),
    closeColumnsDialog: vi.fn(),
    closeDetailDialog: vi.fn(),
    closeStartUsageDialog: vi.fn(),
    closeEndUsageDialog: vi.fn(),
    closeDeleteDialog: vi.fn(),
    closeAllDialogs: vi.fn(),
    onDataMutationSuccess: vi.fn(),
    ...overrides,
  }
}

function wrap(
  equipmentDialogValue: EquipmentDialogContextValue,
): React.FC<{ children: React.ReactNode }> {
  return function Wrapper({ children }) {
    return (
      <EquipmentDialogContext.Provider value={equipmentDialogValue}>
        <LinkedRequestProvider>{children}</LinkedRequestProvider>
      </EquipmentDialogContext.Provider>
    )
  }
}

describe('LinkedRequestProvider', () => {
  it('starts in the closed state', () => {
    const ctx = createEquipmentDialogContextStub()
    const { result } = renderHook(() => useLinkedRequest(), { wrapper: wrap(ctx) })
    expect(result.current.state).toEqual({ open: false, kind: null, equipmentId: null })
  })

  it('opens with kind="repair" and the given equipmentId', () => {
    const ctx = createEquipmentDialogContextStub({
      dialogState: { ...createEquipmentDialogContextStub().dialogState, isDetailOpen: true },
    })
    const { result } = renderHook(() => useLinkedRequest(), { wrapper: wrap(ctx) })
    act(() => result.current.openRepair(11))
    expect(result.current.state).toEqual({ open: true, kind: 'repair', equipmentId: 11 })
  })

  it('close() returns to the closed state', () => {
    const ctx = createEquipmentDialogContextStub({
      dialogState: { ...createEquipmentDialogContextStub().dialogState, isDetailOpen: true },
    })
    const { result } = renderHook(() => useLinkedRequest(), { wrapper: wrap(ctx) })
    act(() => result.current.openRepair(7))
    act(() => result.current.close())
    expect(result.current.state.open).toBe(false)
  })

  it('throws if used outside the provider', () => {
    expect(() => renderHook(() => useLinkedRequest())).toThrow(
      /LinkedRequestProvider/,
    )
  })

  it('auto-closes when EquipmentDialogContext.dialogState.isDetailOpen flips to false', () => {
    const dialogStateOpen = {
      ...createEquipmentDialogContextStub().dialogState,
      isDetailOpen: true,
    }
    const dialogStateClosed = {
      ...createEquipmentDialogContextStub().dialogState,
      isDetailOpen: false,
    }
    const initialCtx = createEquipmentDialogContextStub({ dialogState: dialogStateOpen })

    function Harness() {
      const linked = useLinkedRequest()
      return <span data-testid="open">{linked.state.open ? 'yes' : 'no'}</span>
    }

    function Opener() {
      const linked = useLinkedRequest()
      React.useEffect(() => {
        linked.openRepair(99)
      }, [linked])
      return null
    }

    const { rerender } = render(
      <EquipmentDialogContext.Provider value={initialCtx}>
        <LinkedRequestProvider>
          <Harness />
          <Opener />
        </LinkedRequestProvider>
      </EquipmentDialogContext.Provider>,
    )

    expect(screen.getByTestId('open').textContent).toBe('yes')

    // Detail dialog now closes — provider must auto-close the sheet.
    rerender(
      <EquipmentDialogContext.Provider
        value={createEquipmentDialogContextStub({ dialogState: dialogStateClosed })}
      >
        <LinkedRequestProvider>
          <Harness />
        </LinkedRequestProvider>
      </EquipmentDialogContext.Provider>,
    )

    expect(screen.getByTestId('open').textContent).toBe('no')
  })
})
