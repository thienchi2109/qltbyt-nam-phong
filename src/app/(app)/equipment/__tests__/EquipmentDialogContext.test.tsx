import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 1,
        role: 'user',
        don_vi: 5,
        name: 'Test User',
      },
    },
    status: 'authenticated',
  }),
}))

// Mock query client
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  }
})

// Import after mocking
import { EquipmentDialogProvider } from '../_components/EquipmentDialogContext'
import { useEquipmentContext } from '../_hooks/useEquipmentContext'

// Helper to create wrapper with providers
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <EquipmentDialogProvider effectiveTenantKey="5">
          {children}
        </EquipmentDialogProvider>
      </QueryClientProvider>
    )
  }
}

describe('EquipmentDialogContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should initialize with all dialogs closed', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      expect(result.current.dialogState.isAddOpen).toBe(false)
      expect(result.current.dialogState.isImportOpen).toBe(false)
      expect(result.current.dialogState.isColumnsOpen).toBe(false)
      expect(result.current.dialogState.isDetailOpen).toBe(false)
      expect(result.current.dialogState.isStartUsageOpen).toBe(false)
      expect(result.current.dialogState.isEndUsageOpen).toBe(false)
    })

    it('should initialize with null equipment states', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      expect(result.current.dialogState.editingEquipment).toBeNull()
      expect(result.current.dialogState.detailEquipment).toBeNull()
      expect(result.current.dialogState.startUsageEquipment).toBeNull()
      expect(result.current.dialogState.endUsageLog).toBeNull()
    })
  })

  describe('Add Dialog', () => {
    it('should open add dialog', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.openAddDialog()
      })

      expect(result.current.dialogState.isAddOpen).toBe(true)
    })

    it('should close add dialog', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.openAddDialog()
      })

      act(() => {
        result.current.closeAddDialog()
      })

      expect(result.current.dialogState.isAddOpen).toBe(false)
    })
  })

  describe('Import Dialog', () => {
    it('should open import dialog', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.openImportDialog()
      })

      expect(result.current.dialogState.isImportOpen).toBe(true)
    })

    it('should close import dialog', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.openImportDialog()
        result.current.closeImportDialog()
      })

      expect(result.current.dialogState.isImportOpen).toBe(false)
    })
  })

  describe('Columns Dialog', () => {
    it('should open columns dialog', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.openColumnsDialog()
      })

      expect(result.current.dialogState.isColumnsOpen).toBe(true)
    })

    it('should close columns dialog', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.openColumnsDialog()
        result.current.closeColumnsDialog()
      })

      expect(result.current.dialogState.isColumnsOpen).toBe(false)
    })
  })

  describe('Edit Dialog', () => {
    const mockEquipment = {
      id: 1,
      ten_thiet_bi: 'Test Equipment',
      don_vi: 5,
    } as any

    it('should open edit dialog with equipment', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.openEditDialog(mockEquipment)
      })

      expect(result.current.dialogState.editingEquipment).toEqual(mockEquipment)
    })

    it('should close edit dialog and clear equipment', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.openEditDialog(mockEquipment)
        result.current.closeEditDialog()
      })

      expect(result.current.dialogState.editingEquipment).toBeNull()
    })
  })

  describe('Detail Dialog', () => {
    const mockEquipment = {
      id: 2,
      ten_thiet_bi: 'Detail Equipment',
      don_vi: 5,
    } as any

    it('should open detail dialog with equipment', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.openDetailDialog(mockEquipment)
      })

      expect(result.current.dialogState.isDetailOpen).toBe(true)
      expect(result.current.dialogState.detailEquipment).toEqual(mockEquipment)
    })

    it('should close detail dialog and clear equipment', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.openDetailDialog(mockEquipment)
        result.current.closeDetailDialog()
      })

      expect(result.current.dialogState.isDetailOpen).toBe(false)
      expect(result.current.dialogState.detailEquipment).toBeNull()
    })
  })

  describe('Usage Dialogs', () => {
    const mockEquipment = { id: 3, ten_thiet_bi: 'Usage Equipment' } as any
    const mockUsageLog = { id: 10, equipment_id: 3, start_time: new Date().toISOString() } as any

    it('should open start usage dialog with equipment', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.openStartUsageDialog(mockEquipment)
      })

      expect(result.current.dialogState.isStartUsageOpen).toBe(true)
      expect(result.current.dialogState.startUsageEquipment).toEqual(mockEquipment)
    })

    it('should close start usage dialog', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.openStartUsageDialog(mockEquipment)
        result.current.closeStartUsageDialog()
      })

      expect(result.current.dialogState.isStartUsageOpen).toBe(false)
      expect(result.current.dialogState.startUsageEquipment).toBeNull()
    })

    it('should open end usage dialog with usage log', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.openEndUsageDialog(mockUsageLog)
      })

      expect(result.current.dialogState.isEndUsageOpen).toBe(true)
      expect(result.current.dialogState.endUsageLog).toEqual(mockUsageLog)
    })

    it('should close end usage dialog', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.openEndUsageDialog(mockUsageLog)
        result.current.closeEndUsageDialog()
      })

      expect(result.current.dialogState.isEndUsageOpen).toBe(false)
      expect(result.current.dialogState.endUsageLog).toBeNull()
    })
  })

  describe('Close All Dialogs', () => {
    const mockEquipment = { id: 1, ten_thiet_bi: 'Test' } as any

    it('should close all dialogs and clear all equipment', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      // Open multiple dialogs
      act(() => {
        result.current.openAddDialog()
        result.current.openEditDialog(mockEquipment)
        result.current.openColumnsDialog()
      })

      expect(result.current.dialogState.isAddOpen).toBe(true)
      expect(result.current.dialogState.isColumnsOpen).toBe(true)
      expect(result.current.dialogState.editingEquipment).toEqual(mockEquipment)

      // Close all
      act(() => {
        result.current.closeAllDialogs()
      })

      expect(result.current.dialogState.isAddOpen).toBe(false)
      expect(result.current.dialogState.isImportOpen).toBe(false)
      expect(result.current.dialogState.isColumnsOpen).toBe(false)
      expect(result.current.dialogState.isDetailOpen).toBe(false)
      expect(result.current.dialogState.isStartUsageOpen).toBe(false)
      expect(result.current.dialogState.isEndUsageOpen).toBe(false)
      expect(result.current.dialogState.editingEquipment).toBeNull()
      expect(result.current.dialogState.detailEquipment).toBeNull()
    })
  })

  describe('Context Hook Error', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useEquipmentContext())
      }).toThrow('useEquipmentContext must be used within EquipmentDialogProvider')

      consoleSpy.mockRestore()
    })
  })

  describe('User Info', () => {
    it('should provide user info from session', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      expect(result.current.user).toBeDefined()
      expect(result.current.user?.name).toBe('Test User')
    })

    it('should provide role-based flags', () => {
      const { result } = renderHook(() => useEquipmentContext(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isGlobal).toBe(false)
      expect(result.current.isRegionalLeader).toBe(false)
    })
  })
})
