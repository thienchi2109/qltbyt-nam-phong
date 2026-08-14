"use client"

import { DeviceQuotaManualMappingEquipmentList } from "../../_components/manual-mapping/DeviceQuotaManualMappingEquipmentList"
import { useDeviceQuotaMappingContext } from "../_hooks/useDeviceQuotaMappingContext"

/** Adapts the Mapping route context to the reusable manual-mapping equipment list. */
export function DeviceQuotaUnassignedList() {
  const {
    unassignedEquipment,
    totalEquipmentCount,
    selectedEquipmentIds,
    toggleEquipmentSelection,
    selectAllEquipment,
    deselectPageEquipment,
    filters,
    filterOptions,
    pagination,
    isLoading,
    isFacilitySelected,
  } = useDeviceQuotaMappingContext()

  return (
    <DeviceQuotaManualMappingEquipmentList
      unassignedEquipment={unassignedEquipment}
      totalEquipmentCount={totalEquipmentCount}
      selectedEquipmentIds={selectedEquipmentIds}
      toggleEquipmentSelection={toggleEquipmentSelection}
      selectAllEquipment={selectAllEquipment}
      deselectPageEquipment={deselectPageEquipment}
      filters={filters}
      filterOptions={filterOptions}
      pagination={pagination}
      isLoading={isLoading}
      isFacilitySelected={isFacilitySelected}
    />
  )
}
