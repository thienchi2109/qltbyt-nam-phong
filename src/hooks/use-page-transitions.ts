"use client"

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

interface PageTransitionConfig {
  duration: number
  easing: string
  direction: 'left' | 'right' | 'up' | 'down' | 'fade'
}

const DEFAULT_CONFIG: PageTransitionConfig = {
  duration: 300,
  easing: 'ease-out',
  direction: 'fade'
}

// Route-specific transition configurations
const ROUTE_TRANSITIONS: Record<string, PageTransitionConfig> = {
  '/dashboard': { duration: 250, easing: 'ease-out', direction: 'fade' },
  '/equipment': { duration: 300, easing: 'ease-out', direction: 'left' },
  '/repair-requests': { duration: 300, easing: 'ease-out', direction: 'left' },
  '/maintenance': { duration: 300, easing: 'ease-out', direction: 'left' },
  '/transfers': { duration: 300, easing: 'ease-out', direction: 'left' },
  '/reports': { duration: 350, easing: 'ease-out', direction: 'up' },
  '/users': { duration: 300, easing: 'ease-out', direction: 'right' },
  '/qr-scanner': { duration: 250, easing: 'ease-out', direction: 'up' },
}

export function usePageTransitions() {
  const pathname = usePathname()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionClass, setTransitionClass] = useState('')

  useEffect(() => {
    // Get transition config for current route
    const config = ROUTE_TRANSITIONS[pathname] || DEFAULT_CONFIG
    
    // Start transition
    setIsTransitioning(true)
    setTransitionClass(`route-slide-${config.direction}-enter`)
    
    // Apply active transition class
    const timer = setTimeout(() => {
      setTransitionClass(`route-slide-${config.direction}-enter-active`)
    }, 10)

    // End transition
    const endTimer = setTimeout(() => {
      setIsTransitioning(false)
      setTransitionClass('')
    }, config.duration)

    return () => {
      clearTimeout(timer)
      clearTimeout(endTimer)
    }
  }, [pathname])

  return {
    isTransitioning,
    transitionClass,
    getTransitionConfig: (route: string) => ROUTE_TRANSITIONS[route] || DEFAULT_CONFIG
  }
}

// Hook for manual transitions (modals, dialogs, etc.)
export function useManualTransition(type: 'modal' | 'loading' | 'page' = 'page') {
  const [isVisible, setIsVisible] = useState(false)
  const [transitionClass, setTransitionClass] = useState('')

  const startTransition = () => {
    setIsVisible(true)
    
    const baseClass = type === 'modal' ? 'modal-content' : 
                     type === 'loading' ? 'loading-fade' : 'page-transition'
    
    setTransitionClass(`${baseClass}-enter`)
    
    setTimeout(() => {
      setTransitionClass(`${baseClass}-enter-active`)
    }, 10)
  }

  const endTransition = () => {
    const baseClass = type === 'modal' ? 'modal-content' : 
                     type === 'loading' ? 'loading-fade' : 'page-transition'
    
    setTransitionClass(`${baseClass}-exit`)
    
    setTimeout(() => {
      setTransitionClass(`${baseClass}-exit-active`)
    }, 10)

    setTimeout(() => {
      setIsVisible(false)
      setTransitionClass('')
    }, 200)
  }

  return {
    isVisible,
    transitionClass,
    startTransition,
    endTransition
  }
}

// Performance optimization utilities
export function optimizeForTransitions(element: HTMLElement) {
  // Enable GPU acceleration
  element.style.transform = 'translateZ(0)'
  element.style.backfaceVisibility = 'hidden'
  element.style.perspective = '1000px'
  
  // Set will-change for better performance
  element.style.willChange = 'transform, opacity'
}

export function cleanupTransitionOptimizations(element: HTMLElement) {
  // Remove performance optimizations after transition
  element.style.willChange = 'auto'
  element.style.transform = ''
  element.style.backfaceVisibility = ''
  element.style.perspective = ''
}
