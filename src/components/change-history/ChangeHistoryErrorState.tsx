import React from "react"

interface ChangeHistoryErrorStateProps {
  description: string
  title: string
}

export function ChangeHistoryErrorState({
  description,
  title,
}: ChangeHistoryErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-12 text-center text-destructive"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  )
}
