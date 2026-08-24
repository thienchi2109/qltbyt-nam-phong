import { compareFindingBaseline, parseIdentityBaseline } from "./baseline"
import {
  inspectCanonicalMigrationSource,
  inspectCanonicalMigrationSourceAtCommit,
} from "./migration-source"
import { inspectMigrationRepository } from "./migration-repository"
import { currentHeadCommit } from "./git-evidence"
import type { TrustedStaticDiff } from "./landed-static-diff"
import { attachDangerousApprovals } from "./static-approvals"
import {
  hasTrustedIdentityBaseline,
  migrationIdentitiesMatch,
  repositoryFindings,
  waiverArtifactMatchesHead,
} from "./static-lane-evidence"
import {
  parseAppliedMigrationLock,
  parseWaiverRegistry,
  preservesWaiverHistory,
} from "./registries"
import { stableJsonSha256 } from "./serialization"
import {
  staticBlockingFinding,
  staticLegacyHygieneWarnings,
  staticRuleFindings,
} from "./static-policy"
import {
  artifactHash,
  artifactMatchesCommit,
  gateHarnessEvidence,
  readAppliedMigrationLockArtifact,
  readIdentityBaselineArtifact,
  readJsonArtifactAtRef,
  readWaiverRegistryArtifact,
} from "./static-artifacts"
import {
  expectedStateRegistryEvidence,
  INVARIANTS_PATH,
  SQL_TESTS_PATH,
} from "./static-lane-expected-state"
import {
  APPLIED_LOCK_PATH,
  BASELINE_PATH,
  collectStaticChangedFiles,
  DEFAULT_MIGRATION_ROOT,
  DEFAULT_STATIC_BASE_REF,
  WAIVERS_PATH,
} from "./static-changed-files"
import { finalizeStaticLaneReport } from "./static-lane-report"
import type { StaticLaneInput } from "./static-lane-types"
import type { GateReport } from "./types"

function runStaticLaneInternal(
  input: StaticLaneInput,
  trustedDiff?: TrustedStaticDiff,
  approvalEvaluationAt = input.createdAt
): GateReport {
  const testOverridesAllowed = trustedDiff === undefined && process.env.NODE_ENV === "test"
  const baseRef =
    trustedDiff?.baseRef ??
    (testOverridesAllowed && input.baseRef !== undefined ? input.baseRef : DEFAULT_STATIC_BASE_REF)
  const headCommit = currentHeadCommit(input.repositoryRoot)
  const subjectCommit = headCommit ?? "unavailable"
  const subjectEvidenceUnavailable = headCommit === undefined || input.subjectCommit !== headCommit
  const sourceInspection = inspectCanonicalMigrationSource({
    migrationRoot: DEFAULT_MIGRATION_ROOT,
    repositoryRoot: input.repositoryRoot,
  })
  const sourceAtHead =
    headCommit === undefined
      ? undefined
      : inspectCanonicalMigrationSourceAtCommit({
          commit: headCommit,
          migrationRoot: DEFAULT_MIGRATION_ROOT,
          repositoryRoot: input.repositoryRoot,
        })
  const subjectMigrationEvidenceUnavailable =
    sourceAtHead === undefined ||
    sourceAtHead.outcome === "INCOMPLETE" ||
    !migrationIdentitiesMatch(
      sourceInspection.migrationIdentities,
      sourceAtHead.migrationIdentities
    )
  let changedFileDiscoveryUnavailable = trustedDiff?.unavailable ?? false
  let changedFiles =
    trustedDiff?.changedFiles ?? (testOverridesAllowed ? input.changedFiles : undefined)
  if (
    trustedDiff === undefined &&
    !testOverridesAllowed &&
    (input.baseRef !== undefined || input.changedFiles !== undefined)
  ) {
    changedFileDiscoveryUnavailable = true
  }
  if (changedFiles === undefined) {
    try {
      changedFiles = collectStaticChangedFiles(baseRef)
    } catch {
      changedFileDiscoveryUnavailable = true
      changedFiles = []
    }
  }
  const appliedLockChanged = changedFiles.includes(APPLIED_LOCK_PATH)
  const baselineChanged = changedFiles.includes(BASELINE_PATH)
  const waiversChanged = changedFiles.includes(WAIVERS_PATH)
  const baseAppliedLock = appliedLockChanged
    ? readJsonArtifactAtRef(input.repositoryRoot, baseRef, APPLIED_LOCK_PATH)
    : undefined
  const baseWaivers = waiversChanged
    ? readJsonArtifactAtRef(input.repositoryRoot, baseRef, WAIVERS_PATH)
    : undefined
  const previousAppliedLock =
    baseAppliedLock?.status === "value"
      ? parseAppliedMigrationLock(baseAppliedLock.value)
      : undefined
  const previousWaivers =
    baseWaivers?.status === "value" ? parseWaiverRegistry(baseWaivers.value) : undefined
  const baseEvidenceUnavailable =
    baseAppliedLock?.status === "unavailable" ||
    baseAppliedLock?.status === "invalid" ||
    baseAppliedLock?.status === "missing" ||
    baseWaivers?.status === "unavailable" ||
    baseWaivers?.status === "invalid" ||
    baseWaivers?.status === "missing" ||
    (baseAppliedLock?.status === "value" && previousAppliedLock === undefined) ||
    (baseWaivers?.status === "value" && previousWaivers === undefined)
  const repositoryInspection = inspectMigrationRepository({
    bootstrapBaseRef:
      appliedLockChanged && baseAppliedLock?.status === "missing" ? baseRef : undefined,
    previousAppliedLock,
    repositoryRoot: input.repositoryRoot,
  })
  const appliedLockMatchesHead =
    headCommit !== undefined &&
    artifactMatchesCommit(input.repositoryRoot, headCommit, APPLIED_LOCK_PATH)
  const waiverMatchesHead =
    headCommit !== undefined &&
    waiverArtifactMatchesHead(input.repositoryRoot, headCommit, WAIVERS_PATH)
  const harnessEvidence =
    headCommit === undefined
      ? { hash: "unavailable", matchesCommit: false }
      : gateHarnessEvidence(input.repositoryRoot, headCommit)
  const changedMigrations = sourceInspection.migrationIdentities.filter((migration) =>
    changedFiles.includes(migration.path)
  )
  const appliedLock = readAppliedMigrationLockArtifact(input.repositoryRoot, APPLIED_LOCK_PATH)
  const legacyMigrationPaths = new Set(appliedLock?.legacy.map((migration) => migration.path))
  const historicalHygieneWarnings = sourceInspection.migrationIdentities
    .filter(
      (migration) =>
        legacyMigrationPaths.has(migration.path) && !changedFiles.includes(migration.path)
    )
    .flatMap((migration) =>
      staticLegacyHygieneWarnings(
        input.repositoryRoot,
        migration,
        sourceInspection.migrationIdentities
      )
    )
  const waivers = readWaiverRegistryArtifact(input.repositoryRoot, WAIVERS_PATH)
  const expectedStateEvidence = expectedStateRegistryEvidence({
    repositoryRoot: input.repositoryRoot,
    subjectCommit: headCommit,
  })
  const identityBaseline = readIdentityBaselineArtifact(input.repositoryRoot, BASELINE_PATH)
  const baselineEvidenceTrusted =
    identityBaseline !== undefined &&
    hasTrustedIdentityBaseline(
      input.repositoryRoot,
      headCommit,
      identityBaseline.sourceCommit,
      BASELINE_PATH
    )
  const waiverFindings = [
    ...(waivers === undefined
      ? [
          staticBlockingFinding("registry.waivers.schema", WAIVERS_PATH, {
            registry: WAIVERS_PATH,
          }),
        ]
      : []),
    ...(baseWaivers?.status === "value" &&
    previousWaivers !== undefined &&
    waivers !== undefined &&
    !preservesWaiverHistory(previousWaivers, waivers)
      ? [
          staticBlockingFinding("registry.waivers.append-only", WAIVERS_PATH, {
            registry: WAIVERS_PATH,
          }),
        ]
      : []),
  ]
  const checkedFindings = [
    ...repositoryFindings(repositoryInspection.findings),
    ...waiverFindings,
    ...expectedStateEvidence.findings,
    ...changedMigrations.flatMap((migration) =>
      staticRuleFindings(input.repositoryRoot, migration, sourceInspection.migrationIdentities)
    ),
  ]
  const dynamicSqlInspectionIncomplete = checkedFindings.some(
    (finding) => finding.ruleId === "migration.dynamic-sql"
  )
  const baselineComparison =
    !baselineEvidenceTrusted || identityBaseline === undefined
      ? undefined
      : compareFindingBaseline({
          baseline: identityBaseline.findings,
          current: checkedFindings.filter((finding) => finding.classification === "WARNING"),
        })
  const staticFindings = [
    ...checkedFindings,
    ...historicalHygieneWarnings,
    ...(identityBaseline === undefined
      ? [
          staticBlockingFinding("baseline.identity.schema", BASELINE_PATH, {
            baseline: BASELINE_PATH,
          }),
        ]
      : []),
    ...(identityBaseline !== undefined && !baselineEvidenceTrusted
      ? [
          staticBlockingFinding("baseline.identity.evidence", BASELINE_PATH, {
            baseline: BASELINE_PATH,
          }),
        ]
      : []),
    ...(baselineChanged
      ? [
          staticBlockingFinding("baseline.identity.rebaseline", BASELINE_PATH, {
            baseline: BASELINE_PATH,
          }),
        ]
      : []),
    ...(baselineComparison?.outcome === "FAILED"
      ? [
          staticBlockingFinding("baseline.identity.new-findings", BASELINE_PATH, {
            baseline: BASELINE_PATH,
          }),
        ]
      : []),
    ...(subjectMigrationEvidenceUnavailable
      ? [
          staticBlockingFinding("migration.subject-input", DEFAULT_MIGRATION_ROOT, {
            migrationRoot: DEFAULT_MIGRATION_ROOT,
          }),
        ]
      : []),
    ...(!appliedLockMatchesHead
      ? [
          staticBlockingFinding("migration.applied-lock-evidence", APPLIED_LOCK_PATH, {
            lock: APPLIED_LOCK_PATH,
          }),
        ]
      : []),
    ...(!waiverMatchesHead
      ? [
          staticBlockingFinding("registry.waivers.evidence", WAIVERS_PATH, {
            registry: WAIVERS_PATH,
          }),
        ]
      : []),
    ...(!harnessEvidence.matchesCommit
      ? [
          staticBlockingFinding("harness.subject-input", "scripts/db-quality-gate", {
            harness: "scripts/db-quality-gate",
          }),
        ]
      : []),
    ...(changedFileDiscoveryUnavailable
      ? [
          staticBlockingFinding("migration.changed-file-discovery", baseRef, {
            baseRef,
          }),
        ]
      : []),
  ]
  const inputHashes = {
    appliedLock: artifactHash(input.repositoryRoot, APPLIED_LOCK_PATH),
    baseline: artifactHash(input.repositoryRoot, BASELINE_PATH),
    harness: harnessEvidence.hash,
    invariants: expectedStateEvidence.inputHashes.invariants,
    sqlTests: expectedStateEvidence.inputHashes.sqlTests,
    waivers: artifactHash(input.repositoryRoot, WAIVERS_PATH),
  }
  const approvalAttachment = attachDangerousApprovals({
    approvalEvaluationAt,
    candidateCommit: trustedDiff?.candidateCommit,
    finalInputHashes: inputHashes,
    findings: staticFindings,
    migrationIdentities: sourceInspection.migrationIdentities,
    repositoryRoot: input.repositoryRoot,
    subjectCommit: input.subjectCommit,
    waivers,
  })
  const findings = approvalAttachment.findings
  const incomplete =
    subjectEvidenceUnavailable ||
    subjectMigrationEvidenceUnavailable ||
    !appliedLockMatchesHead ||
    !waiverMatchesHead ||
    !harnessEvidence.matchesCommit ||
    changedFileDiscoveryUnavailable ||
    baseEvidenceUnavailable ||
    identityBaseline === undefined ||
    !baselineEvidenceTrusted ||
    expectedStateEvidence.incomplete ||
    approvalAttachment.evidenceUnavailable ||
    dynamicSqlInspectionIncomplete ||
    sourceInspection.outcome === "INCOMPLETE" ||
    repositoryInspection.outcome === "INCOMPLETE"
  return finalizeStaticLaneReport({
    createdAt: input.createdAt,
    findings,
    incomplete,
    inputHashes,
    migrationIdentities: sourceInspection.migrationIdentities,
    runId: input.runId,
    subjectCommit,
  })
}

/** Runs deterministic local-only static checks with ordinary production defaults unchanged. */
export function runStaticLane(input: StaticLaneInput): GateReport {
  return runStaticLaneInternal(input)
}

/** Runs the static checks over a caller-verified immutable diff. */
export function runStaticLaneWithTrustedDiff(
  input: StaticLaneInput,
  trustedDiff: TrustedStaticDiff,
  approvalEvaluationAt: string
): GateReport {
  return runStaticLaneInternal(input, trustedDiff, approvalEvaluationAt)
}

export { collectStaticChangedFiles }
