"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cn } from "@/lib/utils"
import { FormLabel } from "@/components/ui/form"

interface RequiredFormLabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  required?: boolean
}

const RequiredFormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  RequiredFormLabelProps
>(({ className, children, required = false, ...props }, ref) => {
  return (
    <FormLabel
      ref={ref}
      className={cn(className)}
      {...props}
    >
      {children}
      {required && (
        <span className="text-destructive ml-1" aria-label="bắt buộc">
          *
        </span>
      )}
    </FormLabel>
  )
})

RequiredFormLabel.displayName = "RequiredFormLabel"

export { RequiredFormLabel }
