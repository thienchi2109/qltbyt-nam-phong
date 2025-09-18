"use client"
import * as React from "react"

export type TenantNameProps = {
  name?: string | null
  fallback?: string
  className?: string
}

export function TenantName({ name, fallback = 'Nền tảng QLTBYT', className }: TenantNameProps) {
  const text = (name && name.trim()) || fallback
  return (
    <span className={["font-semibold tracking-tight", className].filter(Boolean).join(" ")}
      aria-label={text}
      title={text}
    >
      {text}
    </span>
  )
}
