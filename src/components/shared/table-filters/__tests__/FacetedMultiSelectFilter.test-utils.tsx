import * as React from "react"
import { vi } from "vitest"

type PopoverStateProps = {
  open?: boolean
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>
}

type PopoverTriggerProps = PopoverStateProps & {
  children: React.ReactNode
  onClick?: (...args: unknown[]) => void
} & Record<string, unknown>

type PopoverContentProps = PopoverStateProps & {
  children: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>

vi.mock("@heroui/react/input", () => {
  function MockHeroInput({
    ref,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & {
    ref?: React.Ref<HTMLInputElement>
  }) {
    return <input {...props} ref={ref} />
  }
  MockHeroInput.displayName = "MockHeroInput"

  return { Input: MockHeroInput }
})

/**
 * Mock HeroUI Popover so content renders inline (no portal / no jsdom issues).
 */
vi.mock("@heroui/react/popover", () => {
  const Trigger = ({ children, open, setOpen, ...rest }: PopoverTriggerProps) => {
    const togglePopover = () => setOpen?.(!open)
    if (React.isValidElement(children)) {
      const childElement = children as React.ReactElement<{
        onClick?: (...args: unknown[]) => void
      }>
      return React.cloneElement(childElement, {
        ...rest,
        onClick: (...args: unknown[]) => {
          togglePopover()
          childElement.props.onClick?.(...args)
        },
      })
    }
    return (
      <button {...rest} onClick={togglePopover}>
        {children}
      </button>
    )
  }

  const Popover = Object.assign(
    ({
      children,
      isOpen,
      onOpenChange,
    }: {
      children: React.ReactNode
      isOpen?: boolean
      onOpenChange?: (open: boolean) => void
    }) => {
      const [open, setOpen] = React.useState(false)
      const renderedOpen = isOpen ?? open
      const setRenderedOpen = (nextOpen: boolean) => {
        setOpen(nextOpen)
        onOpenChange?.(nextOpen)
      }

      let triggerConnected = false

      return (
        <div data-testid="popover">
          {React.Children.map(children, (child) => {
            if (!React.isValidElement(child)) return child

            if (child.type === Popover.Content) {
              return React.cloneElement(child as React.ReactElement<PopoverStateProps>, {
                open: renderedOpen,
                setOpen: setRenderedOpen,
              })
            }

            if (!triggerConnected) {
              triggerConnected = true
              const triggerElement = child as React.ReactElement<{
                onClick?: (...args: unknown[]) => void
              }>
              return React.cloneElement(triggerElement, {
                onClick: (...args: unknown[]) => {
                  setRenderedOpen(!renderedOpen)
                  triggerElement.props.onClick?.(...args)
                },
              })
            }

            return child
          })}
        </div>
      )
    },
    {
      Trigger,
      Content: ({ children, open, setOpen: _setOpen, ...rest }: PopoverContentProps) => {
        if (!open) return null
        return (
          <dialog data-testid="popover-content" open {...rest}>
            {children}
          </dialog>
        )
      },
      Dialog: ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
        <div {...rest}>{children}</div>
      ),
    }
  )

  return { Popover }
})
