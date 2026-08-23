export type ProtectedMainVerification =
  | {
      status: "active"
      subjectCommit: string
    }
  | {
      reason: string
      status: "inactive" | "unavailable"
    }

export type ProtectedMainVerifier = () => ProtectedMainVerification

/**
 * Phase 6 defines the fail-closed trust boundary. Phase 7 will provide the
 * reviewed read-only GitHub ruleset verifier.
 */
export function verifyProtectedMain(): ProtectedMainVerification {
  return {
    reason: "Protected-main verification is unavailable until the Phase 7 ruleset is implemented",
    status: "unavailable",
  }
}
