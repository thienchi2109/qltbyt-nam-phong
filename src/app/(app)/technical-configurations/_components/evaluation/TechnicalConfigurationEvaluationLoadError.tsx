"use client"

import { AlertCircle, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type TechnicalConfigurationEvaluationLoadErrorProps = {
  title: string
  error: unknown
  fallback: string
  onRetry?: () => void
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Renders the shared evaluation load failure and explicit retry action. */
export function TechnicalConfigurationEvaluationLoadError({
  title,
  error,
  fallback,
  onRetry,
}: Readonly<TechnicalConfigurationEvaluationLoadErrorProps>) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{toErrorMessage(error, fallback)}</p>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Thử lại
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
