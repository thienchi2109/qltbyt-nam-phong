"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { TenantLogo, TenantLogoProps } from "@/components/tenant-logo"
import { TenantName, TenantNameProps } from "@/components/tenant-name"
import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { Skeleton } from "@/components/ui/skeleton"
import { isGlobalRole } from "@/lib/rbac"

export interface FormBrandingHeaderProps {
  align?: "left" | "center" | "right"
  size?: "sm" | "md" | "lg"
  showDivider?: boolean
  className?: string
  tenantId?: number | null // New: Form owner's tenant ID for static branding
  mode?: "auto" | "static" | "dynamic" // New: Override branding mode
}

type SessionUserWithRole = {
  role?: string | null
}

const FORM_BRANDING_SIZE_CONFIG = {
  sm: { logoSize: 24, textSize: "text-sm" },
  md: { logoSize: 32, textSize: "text-base" },
  lg: { logoSize: 40, textSize: "text-lg" },
} satisfies Record<
  NonNullable<FormBrandingHeaderProps["size"]>,
  { logoSize: number; textSize: string }
>

const FORM_BRANDING_ALIGNMENT_CLASS = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
} satisfies Record<NonNullable<FormBrandingHeaderProps["align"]>, string>

/** Renders tenant branding for forms with static or session-derived context. */
export function FormBrandingHeader({
  align = "left",
  size = "md",
  showDivider = false,
  className = "",
  tenantId = null,
  mode = "auto",
}: FormBrandingHeaderProps) {
  const { data: session } = useSession()
  const user = session?.user as SessionUserWithRole | undefined
  const isPrivileged = isGlobalRole(user?.role)

  // Determine branding mode
  const shouldUseFormContext =
    mode === "static" || (mode === "auto" && isPrivileged && tenantId !== null)

  const branding = useTenantBranding({
    formTenantId: tenantId,
    useFormContext: shouldUseFormContext,
  })

  const config = FORM_BRANDING_SIZE_CONFIG[size]
  const alignmentClass = FORM_BRANDING_ALIGNMENT_CLASS

  // Loading skeleton
  if (branding.isLoading) {
    return (
      <div className={`flex items-center ${alignmentClass[align]} ${className}`}>
        <Skeleton
          className="rounded-full"
          style={{ width: config.logoSize, height: config.logoSize }}
        />
        <Skeleton className={`ml-3 h-5 ${config.textSize} w-32`} />
      </div>
    )
  }

  // Error or no data
  if (branding.isError || !branding.data) {
    return (
      <div className={`flex items-center ${alignmentClass[align]} ${className}`}>
        <TenantLogo size={config.logoSize} />
        <TenantName fallback="Nền tảng QLTBYT" className={`ml-3 ${config.textSize}`} />
      </div>
    )
  }

  return (
    <div className={`flex items-center ${alignmentClass[align]} ${className}`}>
      <TenantLogo src={branding.data.logo_url} name={branding.data.name} size={config.logoSize} />
      <TenantName name={branding.data.name} className={`ml-3 ${config.textSize}`} />

      {showDivider && <div className="ml-4 w-px h-8 bg-gray-300" />}
    </div>
  )
}
