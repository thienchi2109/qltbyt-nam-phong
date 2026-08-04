import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

type TechnicalConfigurationBaselineEditorIconButtonProps = {
  label: string
  title: string
  disabled: boolean
  destructive?: boolean
  ariaDisabled?: boolean
  ariaDescribedBy?: string
  onClick: () => void
  children: ReactNode
}

/** Renders one stable icon-only editor command with an accessible name. */
export function TechnicalConfigurationBaselineEditorIconButton({
  label,
  title,
  disabled,
  destructive = false,
  ariaDisabled,
  ariaDescribedBy,
  onClick,
  children,
}: Readonly<TechnicalConfigurationBaselineEditorIconButtonProps>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={destructive ? "text-destructive hover:text-destructive" : undefined}
      aria-label={label}
      aria-disabled={ariaDisabled || undefined}
      aria-describedby={ariaDescribedBy}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
