"use client"

import * as React from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface MobileCompactCardProps<
  MetaProps extends object = Record<string, never>,
  TopRightProps extends object = Record<string, never>,
> {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  topRight?: React.ReactNode
  TopRightComponent?: React.ComponentType<TopRightProps>
  topRightProps?: TopRightProps
  meta?: React.ReactNode
  MetaComponent?: React.ComponentType<MetaProps>
  metaProps?: MetaProps
  primaryAction?: React.ReactNode
  actions?: React.ReactNode
  activationLabel: string
  onActivate?: () => void
  className?: string
  children?: React.ReactNode
  disabled?: boolean
}

/** Renders a mobile card shell with a separate activation target and isolated action zone. */
export function MobileCompactCard<
  MetaProps extends object = Record<string, never>,
  TopRightProps extends object = Record<string, never>,
>({
  eyebrow,
  title,
  subtitle,
  topRight,
  TopRightComponent,
  topRightProps,
  meta,
  MetaComponent,
  metaProps,
  primaryAction,
  actions,
  activationLabel,
  onActivate,
  className,
  children,
  disabled = false,
}: MobileCompactCardProps<MetaProps, TopRightProps>) {
  const canActivate = Boolean(onActivate) && !disabled
  const topRightContent = TopRightComponent && topRightProps ? (
    <TopRightComponent {...topRightProps} />
  ) : topRight
  const metaContent = MetaComponent && metaProps ? (
    <MetaComponent {...metaProps} />
  ) : meta

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-xl transition-all hover:shadow-md",
        disabled && "opacity-70",
        canActivate && "cursor-pointer",
        className,
      )}
    >
      {canActivate && (
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-pointer rounded-xl bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={activationLabel}
          onClick={onActivate}
        />
      )}
      <div className="pointer-events-none relative z-10 p-3 space-y-2">
        {(eyebrow || topRightContent) && (
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </span>
            {topRightContent && (
              <div className="pointer-events-auto flex shrink-0 items-center gap-1">
                {topRightContent}
              </div>
            )}
          </div>
        )}

        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight text-foreground">
            {title}
          </h3>
          {subtitle && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>

        {metaContent && (
          <div className="text-xs text-muted-foreground">
            {metaContent}
          </div>
        )}

        {children && (
          <div className="space-y-2">
            {children}
          </div>
        )}
      </div>

      {(primaryAction || actions) && (
        <div className="relative z-20 flex min-w-0 gap-2 px-3 pb-3 pt-0.5">
          {primaryAction}
          {actions}
        </div>
      )}
    </Card>
  )
}
