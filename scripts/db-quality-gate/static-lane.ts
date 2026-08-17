import { collectChangedFiles } from "../changed-files"
import { compareFindingBaseline, parseIdentityBaseline } from "./baseline"
import { aggregateOutcome, finalizeReport } from "./contract"
import {
  inspectCanonicalMigrationSource,
  inspectCanonicalMigrationSourceAtCommit,
  isCanonicalMigrationPath,
} from "./migration-source"
import { inspectMigrationRepository } from "./migration-repository"
import { currentHeadCommit } from "./git-evidence"
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
import { GATE_SCHEMA_VERSION } from "./types"
import type { GateFinding, GateReport, MigrationIdentity } from "./types"

type StaticLaneInput = {
  baseRef?: string
  changedFiles?: string[]
  createdAt: string
  repositoryRoot: string
  runId: string
  subjectCommit: string
}

const DEFAULT_BASE_REF = "origin/main"
const DEFAULT_MIGRATION_ROOT = "supabase/migrations"
const APPLIED_LOCK_PATH = "supabase/applied-migrations.lock.json"
const BASELINE_PATH = "supabase/db-quality-gate-baseline.json"
const WAIVERS_PATH = "supabase/db-quality-gate-waivers.json"

/** Reuses the repository diff helper and narrows it to canonical migrations plus static-gate metadata. */
export function collectStaticChangedFiles(baseRef = DEFAULT_BASE_REF): string[] {
  return collectChangedFiles(baseRef).filter(
    (filePath: string) =>
      isCanonicalMigrationPath(filePath) ||
      filePath === APPLIED_LOCK_PATH ||
      filePath === BASELINE_PATH ||
      filePath === WAIVERS_PATH
  )
}

/** Runs deterministic local-only static checks for the current repository state. */
export function runStaticLane(input: StaticLaneInput): GateReport {
  const testOverridesAllowed = process.env.NODE_ENV === "test"
  const baseRef =
    testOverridesAllowed && input.baseRef !== undefined ? input.baseRef : DEFAULT_BASE_REF
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
  let changedFileDiscoveryUnavailable = false
  let changedFiles = testOverridesAllowed ? input.changedFiles : undefined
  if (!testOverridesAllowed && (input.baseRef !== undefined || input.changedFiles !== undefined)) {
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
          current: [
            ...historicalHygieneWarnings,
            ...checkedFindings.filter((finding) => finding.classification === "WARNING"),
          ],
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
  const approvalAttachment = attachDangerousApprovals({
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
    approvalAttachment.evidenceUnavailable ||
    dynamicSqlInspectionIncomplete ||
    sourceInspection.outcome === "INCOMPLETE" ||
    repositoryInspection.outcome === "INCOMPLETE"
  const outcome = incomplete
    ? "INCOMPLETE"
    : aggregateOutcome({
        evidenceAvailable: true,
        findings,
        requiredChecksComplete: true,
      })

  return finalizeReport({
    baselineMigrationHighWater: "unavailable",
    createdAt: input.createdAt,
    digest: "",
    evidenceAvailable: !incomplete,
    executorEnvironment: { execution: "local-static" },
    findings,
    inputHashes: {
      appliedLock: artifactHash(input.repositoryRoot, APPLIED_LOCK_PATH),
      baseline: artifactHash(input.repositoryRoot, BASELINE_PATH),
      harness: harnessEvidence.hash,
      migration: stableJsonSha256(sourceInspection.migrationIdentities),
      waivers: artifactHash(input.repositoryRoot, WAIVERS_PATH),
    },
    lane: "static",
    migrationIdentities: sourceInspection.migrationIdentities,
    outcome,
    requiredChecksComplete: !incomplete,
    runId: input.runId,
    schemaVersion: GATE_SCHEMA_VERSION,
    subjectCommit,
  })
}
