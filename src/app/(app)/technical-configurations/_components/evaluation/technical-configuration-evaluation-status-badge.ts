import type { TechnicalConfigurationDerivedStatus } from "@/lib/technical-configuration-evaluation"

/** Maps each derived evaluation status to its shared badge presentation. */
export const TECHNICAL_CONFIGURATION_EVALUATION_STATUS_BADGE_VARIANTS = {
  not_evaluated: "muted",
  not_applicable: "outline",
  fails: "destructive",
  unclear: "outline",
  insufficient_evidence: "outline",
  exceeds: "secondary",
  meets: "secondary",
} as const satisfies Record<
  TechnicalConfigurationDerivedStatus,
  "destructive" | "muted" | "outline" | "secondary"
>
