"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { updateTechnicalConfigurationDossierRevisionCache } from "../technical-configuration-dossier-revision-cache"
import type { TechnicalConfigurationDossierWire } from "../types"

/** Tracks and commits the monotonic dossier revision shared by option-response writes. */
export function useTechnicalConfigurationOptionResponseRevision({
  dossier,
  initialRevision = dossier.revision,
  onRevisionChange,
}: {
  dossier: TechnicalConfigurationDossierWire
  initialRevision?: number
  onRevisionChange?: (revision: number) => void
}) {
  const queryClient = useQueryClient()
  const revisionRef = React.useRef<number | null>(null)
  if (revisionRef.current === null) {
    revisionRef.current = Math.max(dossier.revision, initialRevision)
  }

  const commitRevision = React.useCallback(
    (nextRevision: number) => {
      const committedRevision = Math.max(
        revisionRef.current ?? dossier.revision,
        dossier.revision,
        nextRevision
      )
      revisionRef.current = committedRevision
      onRevisionChange?.(committedRevision)
      updateTechnicalConfigurationDossierRevisionCache(queryClient, dossier, committedRevision)
    },
    [dossier, onRevisionChange, queryClient]
  )

  React.useEffect(() => {
    revisionRef.current = Math.max(revisionRef.current ?? dossier.revision, dossier.revision)
  }, [dossier.revision])

  return { commitRevision, revisionRef }
}
