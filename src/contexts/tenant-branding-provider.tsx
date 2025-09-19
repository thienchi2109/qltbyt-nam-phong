"use client"

import * as React from "react"
import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { TenantBranding } from "@/hooks/use-tenant-branding"

type TenantBrandingContextType = {
  branding: TenantBranding | null
  isLoading: boolean
  isError: boolean
  error: Error | null
}

const TenantBrandingContext = React.createContext<TenantBrandingContextType | undefined>(undefined)

export function TenantBrandingProvider({ children }: { children: React.ReactNode }) {
  const brandingQuery = useTenantBranding()
  
  const contextValue = {
    branding: brandingQuery.data ?? null,
    isLoading: brandingQuery.isLoading,
    isError: brandingQuery.isError,
    error: brandingQuery.error ?? null
  }
  
  return (
    <TenantBrandingContext.Provider value={contextValue}>
      {children}
    </TenantBrandingContext.Provider>
  )
}

export function useTenantBrandingContext() {
  const context = React.useContext(TenantBrandingContext)
  if (context === undefined) {
    throw new Error("useTenantBrandingContext must be used within a TenantBrandingProvider")
  }
  return context
}