import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import {
  createDefaultParams,
  mockEquipmentList,
  mockTenantBranding,
  mockGenerateProfileSheet,
  mockGenerateDeviceLabel,
  mockToast,
} from "./useEquipmentExport.fixtures"
import { useEquipmentExport } from "../_hooks/useEquipmentExport"

describe("handleGenerateProfileSheet", () => {
  it("should generate profile sheet for equipment", async () => {
    mockGenerateProfileSheet.mockResolvedValueOnce(undefined)
    const equipment = mockEquipmentList[0]

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

    await act(async () => {
      await result.current.handleGenerateProfileSheet(equipment as Equipment)
    })

    expect(mockGenerateProfileSheet).toHaveBeenCalledWith(
      equipment,
      expect.objectContaining({
        tenantBranding: mockTenantBranding,
        userRole: "to_qltb",
        equipmentTenantId: 5,
      })
    )
  })

  it("should pass correct print context", async () => {
    mockGenerateProfileSheet.mockResolvedValueOnce(undefined)
    const equipment = { ...mockEquipmentList[0], don_vi: 10 }

    const { result } = renderHook(() =>
      useEquipmentExport(
        createDefaultParams({
          userRole: "global",
        })
      )
    )

    await act(async () => {
      await result.current.handleGenerateProfileSheet(equipment as Equipment)
    })

    expect(mockGenerateProfileSheet).toHaveBeenCalledWith(
      equipment,
      expect.objectContaining({
        userRole: "global",
        equipmentTenantId: 10,
      })
    )
  })

  it("should handle undefined don_vi", async () => {
    mockGenerateProfileSheet.mockResolvedValueOnce(undefined)
    const equipment = { ...mockEquipmentList[0], don_vi: null }

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

    await act(async () => {
      await result.current.handleGenerateProfileSheet(equipment as Equipment)
    })

    expect(mockGenerateProfileSheet).toHaveBeenCalledWith(
      equipment,
      expect.objectContaining({
        equipmentTenantId: undefined,
      })
    )
  })
})

describe("handleGenerateDeviceLabel", () => {
  it("should generate device label for equipment", async () => {
    mockGenerateDeviceLabel.mockResolvedValueOnce(undefined)
    const equipment = mockEquipmentList[0]

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

    await act(async () => {
      await result.current.handleGenerateDeviceLabel(equipment as Equipment)
    })

    expect(mockGenerateDeviceLabel).toHaveBeenCalledWith(
      equipment,
      expect.objectContaining({
        tenantBranding: mockTenantBranding,
        userRole: "to_qltb",
        equipmentTenantId: 5,
      })
    )
  })

  it("should work without tenant branding", async () => {
    mockGenerateDeviceLabel.mockResolvedValueOnce(undefined)
    const equipment = mockEquipmentList[0]

    const { result } = renderHook(() =>
      useEquipmentExport(
        createDefaultParams({
          tenantBranding: undefined,
        })
      )
    )

    await act(async () => {
      await result.current.handleGenerateDeviceLabel(equipment as Equipment)
    })

    expect(mockGenerateDeviceLabel).toHaveBeenCalledWith(
      equipment,
      expect.objectContaining({
        tenantBranding: undefined,
      })
    )
  })
})
