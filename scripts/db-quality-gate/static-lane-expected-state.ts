import { validateExpectedStateRegistries } from "./registries"
import { sha256Text } from "./serialization"
import { readFileAtCommit } from "./git-evidence"
import { registeredSqlTestBody } from "./oracle-remote-sql"
import {
  artifactHash,
  artifactMatchesCommit,
  readInvariantRegistryArtifact,
  readJsonArtifact,
  readSqlTestRegistryArtifact,
} from "./static-artifacts"
import { staticBlockingFinding } from "./static-policy"
import type { GateFinding } from "./types"

/** Identifies the committed table-security invariant registry. */
export const INVARIANTS_PATH = "supabase/db-quality-gate-invariants.json"
/** Identifies the committed SQL-test execution registry. */
export const SQL_TESTS_PATH = "supabase/db-quality-gate-tests.json"

type ExpectedStateRegistryEvidence = {
  findings: GateFinding[]
  incomplete: boolean
  inputHashes: {
    invariants: string
    sqlTests: string
  }
}

/** Binds committed expected-state registries to the local static report without catalog execution. */
export function expectedStateRegistryEvidence(input: {
  repositoryRoot: string
  subjectCommit: string | undefined
}): ExpectedStateRegistryEvidence {
  const invariants = readInvariantRegistryArtifact(input.repositoryRoot, INVARIANTS_PATH)
  const sqlTests = readSqlTestRegistryArtifact(input.repositoryRoot, SQL_TESTS_PATH)
  const validation = validateExpectedStateRegistries({
    invariants: readJsonArtifact(input.repositoryRoot, INVARIANTS_PATH),
    sqlTests: readJsonArtifact(input.repositoryRoot, SQL_TESTS_PATH),
  })
  const invariantsMatchCommit =
    input.subjectCommit !== undefined &&
    artifactMatchesCommit(input.repositoryRoot, input.subjectCommit, INVARIANTS_PATH)
  const sqlTestsMatchCommit =
    input.subjectCommit !== undefined &&
    artifactMatchesCommit(input.repositoryRoot, input.subjectCommit, SQL_TESTS_PATH)
  const parsedSqlTests = sqlTests
  const sqlTestSourceFindings =
    input.subjectCommit === undefined || parsedSqlTests === undefined
      ? []
      : parsedSqlTests.tests
          .filter((test) => test.safety === "default-safe")
          .flatMap((test) => {
            const content = readFileAtCommit(
              input.repositoryRoot,
              input.subjectCommit as string,
              test.path
            )
            if (content === undefined) {
              return [
                staticBlockingFinding("registry.sql-tests.source", test.path, {
                  path: test.path,
                }),
              ]
            }
            if (
              test.baselineDebt !== undefined &&
              test.baselineDebt.sourceSha256 !== sha256Text(content)
            ) {
              return [
                staticBlockingFinding("registry.sql-tests.debt-source", test.path, {
                  path: test.path,
                }),
              ]
            }
            return registeredSqlTestBody(content) === undefined
              ? [
                  staticBlockingFinding("registry.sql-tests.execution-contract", test.path, {
                    path: test.path,
                  }),
                ]
              : []
          })
  const validationFindings = validation.findings.map((finding) =>
    staticBlockingFinding(
      finding.ruleId,
      finding.ruleId.startsWith("registry.invariants") ? INVARIANTS_PATH : SQL_TESTS_PATH,
      {
        registry: finding.ruleId.startsWith("registry.invariants")
          ? INVARIANTS_PATH
          : SQL_TESTS_PATH,
      }
    )
  )

  return {
    findings: [
      ...validationFindings,
      ...(!invariantsMatchCommit
        ? [
            staticBlockingFinding("registry.invariants.evidence", INVARIANTS_PATH, {
              registry: INVARIANTS_PATH,
            }),
          ]
        : []),
      ...(!sqlTestsMatchCommit
        ? [
            staticBlockingFinding("registry.sql-tests.evidence", SQL_TESTS_PATH, {
              registry: SQL_TESTS_PATH,
            }),
          ]
        : []),
      ...sqlTestSourceFindings,
    ],
    incomplete:
      invariants === undefined ||
      sqlTests === undefined ||
      !validation.valid ||
      !invariantsMatchCommit ||
      !sqlTestsMatchCommit ||
      sqlTestSourceFindings.length > 0,
    inputHashes: {
      invariants: artifactHash(input.repositoryRoot, INVARIANTS_PATH),
      sqlTests: artifactHash(input.repositoryRoot, SQL_TESTS_PATH),
    },
  }
}
