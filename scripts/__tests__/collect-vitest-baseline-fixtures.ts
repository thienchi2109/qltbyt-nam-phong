export const CURRENT_ROOT = "/workspace/current"
export const HISTORICAL_ROOT = "/workspace/historical"

function createReport({
  startTime,
  testResults,
}: {
  startTime: number
  testResults: Array<{
    assertionResults: Array<{
      ancestorTitles: string[]
      failureMessages: string[]
      fullName: string
      status: "failed" | "passed"
      title: string
    }>
    message: string
    name: string
    status: "failed" | "passed"
  }>
}) {
  const assertions = testResults.flatMap((result) => result.assertionResults)
  const failedTests = assertions.filter((assertion) => assertion.status === "failed").length

  return {
    numFailedTestSuites: testResults.filter((result) => result.status === "failed").length,
    numFailedTests: failedTests,
    numPassedTestSuites: testResults.filter((result) => result.status === "passed").length,
    numPassedTests: assertions.length - failedTests,
    numPendingTests: 0,
    numTotalTestSuites: testResults.length,
    numTotalTests: assertions.length,
    startTime,
    success: failedTests === 0 && testResults.every((result) => result.status === "passed"),
    testResults,
  }
}

export const currentReports = [
  {
    report: createReport({
      startTime: Date.UTC(2026, 7, 15, 1, 0, 0),
      testResults: [
        {
          assertionResults: [],
          message:
            "\u001b[31mThis module cannot be imported from a Client Component module.\u001b[39m\n" +
            ` at ${CURRENT_ROOT}/node_modules/server-only/index.js:1:1`,
          name: `${CURRENT_ROOT}/src/app/__tests__/page.authenticated-redirect.test.tsx`,
          status: "failed",
        },
      ],
    }),
    shard: 1,
  },
  {
    report: createReport({
      startTime: Date.UTC(2026, 7, 15, 1, 1, 0),
      testResults: [
        {
          assertionResults: [
            {
              ancestorTitles: ["/api/chat tools allowlist policy"],
              failureMessages: [
                `AssertionError: expected ${CURRENT_ROOT}/src/app/api/chat/route.ts to contain usageHistory\n` +
                  ` at ${CURRENT_ROOT}/src/app/api/chat/__tests__/route.tools-allowlist.test.ts:10:1`,
              ],
              fullName:
                '/api/chat tools allowlist policy allows shipped tool "usageHistory" when explicitly requested',
              status: "failed",
              title: 'allows shipped tool "usageHistory" when explicitly requested',
            },
          ],
          message: "",
          name: `${CURRENT_ROOT}/src/app/api/chat/__tests__/route.tools-allowlist.test.ts`,
          status: "failed",
        },
      ],
    }),
    shard: 2,
  },
  {
    report: createReport({
      startTime: Date.UTC(2026, 7, 15, 1, 2, 0),
      testResults: [
        {
          assertionResults: [
            {
              ancestorTitles: ["technical configuration baseline P1D hierarchy snapshot migration"],
              failureMessages: [
                "Error: ENOENT: no such file or directory, open " +
                  "'openspec/changes/revise-technical-configuration-baseline-hierarchy/tasks.md'",
              ],
              fullName:
                "technical configuration baseline P1D hierarchy snapshot migration keeps P1D complete",
              status: "failed",
              title: "keeps P1D complete",
            },
          ],
          message: "",
          name:
            `${CURRENT_ROOT}/src/app/api/rpc/__tests__/` +
            "technical-configuration-baseline-hierarchy-snapshots-migration.test.ts",
          status: "failed",
        },
      ],
    }),
    shard: 3,
  },
  {
    report: createReport({
      startTime: Date.UTC(2026, 7, 15, 1, 3, 0),
      testResults: [
        {
          assertionResults: [
            {
              ancestorTitles: ["healthy suite"],
              failureMessages: [],
              fullName: "healthy suite passes",
              status: "passed",
              title: "passes",
            },
          ],
          message: "",
          name: `${CURRENT_ROOT}/src/lib/__tests__/healthy.test.ts`,
          status: "passed",
        },
      ],
    }),
    shard: 4,
  },
]

export const historicalReport = createReport({
  startTime: Date.UTC(2026, 7, 9, 1, 0, 0),
  testResults: [
    {
      assertionResults: [],
      message: "This module cannot be imported from a Client Component module.",
      name: `${HISTORICAL_ROOT}/src/app/__tests__/page.authenticated-redirect.test.tsx`,
      status: "failed",
    },
    {
      assertionResults: [
        {
          ancestorTitles: ["/api/chat tools allowlist policy"],
          failureMessages: ["AssertionError: expected undefined to be defined"],
          fullName:
            '/api/chat tools allowlist policy allows shipped tool "usageHistory" when explicitly requested',
          status: "failed",
          title: 'allows shipped tool "usageHistory" when explicitly requested',
        },
      ],
      message: "",
      name: `${HISTORICAL_ROOT}/src/app/api/chat/__tests__/route.tools-allowlist.test.ts`,
      status: "failed",
    },
    {
      assertionResults: [
        {
          ancestorTitles: ["technical configuration baseline P1D hierarchy snapshot migration"],
          failureMessages: [],
          fullName:
            "technical configuration baseline P1D hierarchy snapshot migration keeps P1D complete",
          status: "passed",
          title: "keeps P1D complete",
        },
      ],
      message: "",
      name:
        `${HISTORICAL_ROOT}/src/app/api/rpc/__tests__/` +
        "technical-configuration-baseline-hierarchy-snapshots-migration.test.ts",
      status: "passed",
    },
  ],
})
