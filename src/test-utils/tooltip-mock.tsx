import * as React from "react"

const TooltipProviderContext = React.createContext(false)
const TooltipContext = React.createContext<
  { open: boolean; setOpen: (open: boolean) => void } | null
>(null)

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProviderContext.Provider value={true}>
      {children}
    </TooltipProviderContext.Provider>
  )
}

function Tooltip({ children }: { children: React.ReactNode }) {
  const hasProvider = React.useContext(TooltipProviderContext)

  if (!hasProvider) {
    throw new Error("Tooltip must be used within TooltipProvider")
  }

  const [open, setOpen] = React.useState(false)

  return <TooltipContext.Provider value={{ open, setOpen }}>{children}</TooltipContext.Provider>
}

const TooltipTrigger = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { asChild?: boolean }
>(({ asChild, children, onBlur, onFocus, onMouseEnter, onMouseLeave, ...props }, ref) => {
  const context = React.useContext(TooltipContext)
  const child = React.Children.only(children) as React.ReactElement

  const handleOpen = (handler?: React.EventHandler<React.SyntheticEvent>) => {
    return (event: React.SyntheticEvent) => {
      handler?.(event)
      context?.setOpen(true)
    }
  }

  const handleClose = (handler?: React.EventHandler<React.SyntheticEvent>) => {
    return (event: React.SyntheticEvent) => {
      handler?.(event)
      context?.setOpen(false)
    }
  }

  const triggerProps = {
    ...props,
    ref,
    "data-tooltip-trigger": true,
    onMouseEnter: handleOpen(onMouseEnter),
    onFocus: handleOpen(onFocus),
    onMouseLeave: handleClose(onMouseLeave),
    onBlur: handleClose(onBlur),
  }

  if (asChild && React.isValidElement(child)) {
    return React.cloneElement(child, triggerProps)
  }

  return <span {...triggerProps}>{children}</span>
})
TooltipTrigger.displayName = "TooltipTrigger"

function TooltipContent({ children }: { children: React.ReactNode }) {
  const context = React.useContext(TooltipContext)
  if (!context?.open) return null

  return <div role="tooltip">{children}</div>
}

export const tooltipMockModule = {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
}

export { TooltipProvider as TooltipTestProvider }
