/**
 * useQRScanner.test.ts
 *
 * Tests for the QR scanner state management hook extracted from equipment-toolbar.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

// Must mock toast before importing hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

import { useQRScanner } from '../useEquipmentQRScanner'

describe('useQRScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor)
      return
    }

    Reflect.deleteProperty(globalThis, 'navigator')
  })

  it('starts with camera inactive and no scanned code', () => {
    const { result } = renderHook(() => useQRScanner())

    expect(result.current.isCameraActive).toBe(false)
    expect(result.current.scannedCode).toBe('')
    expect(result.current.showActionSheet).toBe(false)
  })

  it('sets camera active on handleStartScanning', () => {
    // Mock navigator.mediaDevices
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: { getUserMedia: vi.fn() },
      },
      configurable: true,
    })

    const { result } = renderHook(() => useQRScanner())

    act(() => {
      result.current.handleStartScanning()
    })

    expect(result.current.isCameraActive).toBe(true)
  })

  it('stores scanned code and shows action sheet on scan success', () => {
    const { result } = renderHook(() => useQRScanner())

    act(() => {
      result.current.handleScanSuccess('TB-001')
    })

    expect(result.current.scannedCode).toBe('TB-001')
    expect(result.current.isCameraActive).toBe(false)
    expect(result.current.showActionSheet).toBe(true)
  })

  it('closes camera on handleCloseCamera', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: { getUserMedia: vi.fn() },
      },
      configurable: true,
    })

    const { result } = renderHook(() => useQRScanner())

    act(() => {
      result.current.handleStartScanning()
    })
    expect(result.current.isCameraActive).toBe(true)

    act(() => {
      result.current.handleCloseCamera()
    })
    expect(result.current.isCameraActive).toBe(false)
  })

  it('resets state on handleCloseActionSheet', () => {
    const { result } = renderHook(() => useQRScanner())

    act(() => {
      result.current.handleScanSuccess('TB-001')
    })

    act(() => {
      result.current.handleCloseActionSheet()
    })

    expect(result.current.showActionSheet).toBe(false)
    expect(result.current.scannedCode).toBe('')
  })

  it('calls onShowEquipmentDetails via handleAction for view-details', () => {
    const onShowDetails = vi.fn()
    const mockEquipment = { id: 1, ten_thiet_bi: 'Test' } as any

    const { result } = renderHook(() => useQRScanner())

    act(() => {
      result.current.handleAction('view-details', mockEquipment, onShowDetails)
    })

    expect(onShowDetails).toHaveBeenCalledWith(mockEquipment)
    expect(result.current.showActionSheet).toBe(false)
    expect(result.current.scannedCode).toBe('')
  })
})
