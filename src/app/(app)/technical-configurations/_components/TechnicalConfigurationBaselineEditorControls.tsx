import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

type TechnicalConfigurationBaselineEditorIconButtonProps = {
  label: string
  title: string
  disabled: boolean
  destructive?: boolean
  onClick: () => void
  children: ReactNode
}

/** Renders one stable icon-only editor command with an accessible name. */
export function TechnicalConfigurationBaselineEditorIconButton({
  label,
  title,
  disabled,
  destructive = false,
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
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
