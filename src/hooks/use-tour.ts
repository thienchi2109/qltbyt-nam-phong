"use client"

import { useCallback, useEffect, useState } from "react"

const TOUR_STORAGE_KEY = "completed-tours"

interface TourState {
  completedTours: string[]
  isLoading: boolean
}

/**
 * Hook for managing onboarding tour state with localStorage persistence.
 * Tracks which tours have been completed by the user.
 */
export function useTour() {
  const [state, setState] = useState<TourState>({
    completedTours: [],
    isLoading: true,
  })

  // Load completed tours from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const stored = localStorage.getItem(TOUR_STORAGE_KEY)
      const completedTours = stored ? JSON.parse(stored) : []
      setState({ completedTours, isLoading: false })
    } catch {
      setState({ completedTours: [], isLoading: false })
    }
  }, [])

  // Check if a specific tour has been completed
  const isTourCompleted = useCallback(
    (tourId: string): boolean => {
      return state.completedTours.includes(tourId)
    },
    [state.completedTours]
  )

  // Mark a tour as completed
  const completeTour = useCallback((tourId: string) => {
    setState((prev) => {
      if (prev.completedTours.includes(tourId)) return prev

      const updated = [...prev.completedTours, tourId]
      try {
        localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // Ignore storage errors
      }
      return { ...prev, completedTours: updated }
    })
  }, [])

  // Reset a specific tour (allow it to be shown again)
  const resetTour = useCallback((tourId: string) => {
    setState((prev) => {
      const updated = prev.completedTours.filter((id) => id !== tourId)
      try {
        localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // Ignore storage errors
      }
      return { ...prev, completedTours: updated }
    })
  }, [])

  // Reset all tours
  const resetAllTours = useCallback(() => {
    try {
      localStorage.removeItem(TOUR_STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
    setState({ completedTours: [], isLoading: false })
  }, [])

  return {
    isLoading: state.isLoading,
    completedTours: state.completedTours,
    isTourCompleted,
    completeTour,
    resetTour,
    resetAllTours,
  }
}
