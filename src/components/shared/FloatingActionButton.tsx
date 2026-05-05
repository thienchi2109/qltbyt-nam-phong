import * as React from "react"

import { cn } from "@/lib/utils"

type FloatingActionButtonTone = "primary" | "assistant"
type FloatingActionButtonPlacement = "page" | "assistant"

export interface FloatingActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: FloatingActionButtonTone
  placement?: FloatingActionButtonPlacement
}

const placementClasses: Record<FloatingActionButtonPlacement, string> = {
  page: "right-6 bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)] z-[100] md:hidden",
  assistant: "right-6 bottom-[calc(env(safe-area-inset-bottom,0px)+9.5rem)] z-[997] md:bottom-6",
}

const toneClasses: Record<FloatingActionButtonTone, string> = {
  primary:
    "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/95 focus-visible:ring-primary/40",
  assistant:
    "border-white/30 bg-[linear-gradient(135deg,hsl(194,45%,42%),hsl(188,48%,32%))] text-white hover:bg-[linear-gradient(135deg,hsl(194,45%,46%),hsl(188,48%,36%))] focus-visible:ring-[hsl(194,45%,42%)]",
}

export function floatingActionButtonClassName({
  className,
  tone = "primary",
  placement = "page",
}: Pick<FloatingActionButtonProps, "className" | "tone" | "placement"> = {}) {
  return cn(
    "fixed inline-flex h-14 w-14 items-center justify-center rounded-full border p-0",
    "shadow-[0_18px_34px_rgba(15,23,42,0.24)] transition-all duration-200 ease-out",
    "hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(15,23,42,0.28)]",
    "active:translate-y-0 active:scale-95 active:duration-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-6 [&_svg]:w-6 [&_svg]:shrink-0",
    placementClasses[placement],
    toneClasses[tone],
    className,
  )
}

export function FloatingActionButton({
  className,
  tone = "primary",
  placement = "page",
  type = "button",
  ...props
}: FloatingActionButtonProps) {
  return (
    <button
      type={type}
      className={floatingActionButtonClassName({ className, tone, placement })}
      {...props}
    />
  )
}
