import type { TechnicalConfigurationDossierWire } from "../../types"
import { TechnicalConfigurationEvaluationWorkspace } from "../evaluation/TechnicalConfigurationEvaluationWorkspace"

type TechnicalConfigurationComparisonTabProps = {
  dossier: TechnicalConfigurationDossierWire
  onDirtyChange?: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
  onRevisionChange?: (revision: number) => void
}

/** Composes comparison and evaluation in one continuous workspace. */
export function TechnicalConfigurationComparisonTab({
  dossier,
  onDirtyChange,
  onNavigationBlockedChange,
  onRevisionChange,
}: Readonly<TechnicalConfigurationComparisonTabProps>) {
  return (
    <TechnicalConfigurationEvaluationWorkspace
      dossier={dossier}
      onDirtyChange={onDirtyChange}
      onNavigationBlockedChange={onNavigationBlockedChange}
      onRevisionChange={onRevisionChange}
    />
  )
}
