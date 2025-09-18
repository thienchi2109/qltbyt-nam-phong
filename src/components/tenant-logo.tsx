"use client"
import Image from "next/image"
import * as React from "react"

export type TenantLogoProps = {
  src?: string | null
  name?: string | null
  size?: number // px
  rounded?: boolean
  className?: string
}

function initials(name?: string | null) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  const letters = (parts[0]?.[0] || "").toUpperCase() + (parts[1]?.[0] || "").toUpperCase()
  return letters || name[0]?.toUpperCase() || "?"
}

export function TenantLogo({ src, name, size = 32, rounded = true, className }: TenantLogoProps) {
  const [error, setError] = React.useState(false)
  const displayInitials = !src || error
  const radiusClass = rounded ? "rounded-full" : "rounded-md"
  const px = `${size}px`

  if (displayInitials) {
    return (
      <div
        className={["flex items-center justify-center bg-muted text-foreground font-semibold", radiusClass, className].filter(Boolean).join(" ")}
        style={{ width: px, height: px }}
        aria-label={name || "Tenant"}
      >
        <span className="text-xs select-none">{initials(name)}</span>
      </div>
    )
  }

  return (
    <Image
      src={src!}
      alt={name || "Tenant logo"}
      width={size}
      height={size}
      onError={() => setError(true)}
      className={[radiusClass, className].filter(Boolean).join(" ")}
    />
  )
}
