import * as React from 'react'
import { Context } from './LinkedRequestContext'

/**
 * Returns whether the linked-request feature is currently active.
 * True when the component is rendered inside a LinkedRequestProvider.
 * Used by useEquipmentData to tighten staleTime when the feature is lit up.
 */
export function useIsLinkedRequestActive(): boolean {
  const value = React.useContext(Context)
  return value !== null
}
