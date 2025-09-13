"use client"

import { useEffect, useRef } from 'react'
import { usePageTransitions, optimizeForTransitions, cleanupTransitionOptimizations } from '@/hooks/use-page-transitions'
import { cn } from '@/lib/utils'

interface PageTransitionWrapperProps {
  children: React.ReactNode
  className?: string
  enableGPUAcceleration?: boolean
}

export function PageTransitionWrapper({ 
  children, 
  className,
  enableGPUAcceleration = true 
}: PageTransitionWrapperProps) {
  const { isTransitioning, transitionClass } = usePageTransitions()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = containerRef.current
    if (!element || !enableGPUAcceleration) return

    if (isTransitioning) {
      optimizeForTransitions(element)
    } else {
      // Cleanup after transition completes
      const cleanup = setTimeout(() => {
        cleanupTransitionOptimizations(element)
      }, 100)
      
      return () => clearTimeout(cleanup)
    }
  }, [isTransitioning, enableGPUAcceleration])

  return (
    <div
      ref={containerRef}
      className={cn(
        'transition-container',
        transitionClass,
        enableGPUAcceleration && isTransitioning && 'gpu-accelerated',
        className
      )}
    >
      {children}
    </div>
  )
}

// Specialized wrapper for main content areas
export function MainContentTransition({ children, className }: PageTransitionWrapperProps) {
  return (
    <PageTransitionWrapper 
      className={cn('min-h-screen w-full', className)}
      enableGPUAcceleration={true}
    >
      {children}
    </PageTransitionWrapper>
  )
}

// Specialized wrapper for modal content
export function ModalTransition({ children, className }: PageTransitionWrapperProps) {
  return (
    <PageTransitionWrapper 
      className={cn('modal-transition-wrapper', className)}
      enableGPUAcceleration={true}
    >
      {children}
    </PageTransitionWrapper>
  )
}

// Loading transition component
interface LoadingTransitionProps {
  isLoading: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
  className?: string
}

export function LoadingTransition({ 
  isLoading, 
  children, 
  fallback,
  className 
}: LoadingTransitionProps) {
  return (
    <div className={cn('loading-transition-container', className)}>
      {isLoading ? (
        <div className="loading-fade-enter loading-fade-enter-active">
          {fallback || (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
        </div>
      ) : (
        <div className="loading-fade-enter loading-fade-enter-active">
          {children}
        </div>
      )}
    </div>
  )
}
