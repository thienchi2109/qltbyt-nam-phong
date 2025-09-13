/**
 * AI utilities with dynamic import for Firebase/Genkit libraries
 * This ensures AI libraries are only loaded when actually needed
 *
 * NOTE: Currently these AI features are not used in the main application.
 * This file is prepared for future AI feature implementation.
 */

import * as React from "react"

// Type definitions for AI features (to avoid importing the full libraries)
export interface AIResponse {
  text: string
  confidence?: number
  metadata?: Record<string, any>
}

export interface AIConfig {
  model: string
  temperature?: number
  maxTokens?: number
}

/**
 * Dynamically import AI libraries only when needed
 * This reduces initial bundle size by ~3.2MB
 */
export async function loadAILibraries(): Promise<any> {
  try {
    // Dynamic import - only loads when this function is called
    const [genkit, googleAI] = await Promise.all([
      import('genkit'),
      import('@genkit-ai/googleai')
    ])
    
    return {
      genkit: genkit.genkit,
      googleAI: googleAI.googleAI,
    }
  } catch (error) {
    console.error('Failed to load AI libraries:', error)
    throw new Error('Không thể tải thư viện AI. Vui lòng thử lại.')
  }
}

/**
 * Initialize AI with dynamic loading
 */
export async function initializeAI(config?: AIConfig): Promise<any> {
  const { genkit, googleAI } = await loadAILibraries()
  
  return genkit({
    plugins: [googleAI()],
    model: config?.model || 'googleai/gemini-2.0-flash',
  })
}

/**
 * Generate AI response with dynamic loading
 */
export async function generateAIResponse(
  prompt: string,
  config?: AIConfig
): Promise<AIResponse> {
  try {
    const ai = await initializeAI(config)
    
    // This is a placeholder implementation
    // You would implement actual AI generation logic here
    const response = await ai.generate({
      prompt,
      temperature: config?.temperature || 0.7,
      maxTokens: config?.maxTokens || 1000,
    })
    
    return {
      text: response.text || '',
      confidence: response.confidence,
      metadata: response.metadata,
    }
  } catch (error) {
    console.error('AI generation failed:', error)
    throw new Error('Không thể tạo phản hồi AI. Vui lòng thử lại.')
  }
}

/**
 * AI loading component to show while AI is being loaded
 */
export function AILoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm text-muted-foreground">Đang tải AI...</p>
      </div>
    </div>
  )
}

/**
 * Error fallback component for AI loading failures
 */
export function AIErrorFallback({ 
  error, 
  onRetry 
}: { 
  error: Error
  onRetry?: () => void
}) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
          <span className="text-destructive text-sm">!</span>
        </div>
        <div>
          <p className="text-sm font-medium text-destructive">Không thể tải AI</p>
          <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-primary hover:underline"
          >
            Thử lại
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Check if AI features are available
 */
export function isAIAvailable(): boolean {
  // Check if AI dependencies are available
  // This is a simple check - you might want to make it more sophisticated
  return typeof window !== 'undefined' && 'fetch' in window
}

/**
 * Placeholder for future AI features
 */
export const AI_FEATURES = {
  EQUIPMENT_ANALYSIS: 'equipment_analysis',
  MAINTENANCE_PREDICTION: 'maintenance_prediction',
  REPORT_GENERATION: 'report_generation',
  CHAT_ASSISTANT: 'chat_assistant',
} as const

export type AIFeature = typeof AI_FEATURES[keyof typeof AI_FEATURES]

/**
 * Check if a specific AI feature is enabled
 */
export function isAIFeatureEnabled(feature: AIFeature): boolean {
  // This would check feature flags or configuration
  // For now, return false since AI features are not implemented
  return false
}

/**
 * Dynamic AI component wrapper
 */
export function withAI<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  feature: AIFeature
) {
  return function AIWrappedComponent(props: T) {
    if (!isAIFeatureEnabled(feature)) {
      return null
    }
    
    return <Component {...props} />
  }
}
