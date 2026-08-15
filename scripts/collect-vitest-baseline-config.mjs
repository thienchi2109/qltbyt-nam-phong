export const ISSUE_NUMBER = 898
export const GITHUB_REPOSITORY = "thienchi2109/qltbyt-nam-phong"
export const DEFAULT_JSON_OUTPUT = "docs/review/2026-08-14-issue-898-vitest-inventory.json"
export const DEFAULT_MARKDOWN_OUTPUT = "docs/review/2026-08-14-issue-898-vitest-inventory.md"

export const WORKSTREAMS = [
  {
    batch: "A",
    classification: "stale-expectation-or-source-contract",
    files: [
      "src/app/api/chat/__tests__/route.attachment-tools.test.ts",
      "src/app/api/chat/__tests__/route.usage-tools.test.ts",
      "src/app/api/chat/__tests__/route.quota-tools.test.ts",
      "src/app/api/chat/__tests__/route.tools-allowlist.test.ts",
    ],
    ownerIssue: 916,
    rootCause: "AI tool registry, availability, and request-fixture contract drift",
    title: "AI attachment, usage, quota, and tool allowlist contracts",
  },
  {
    batch: "B",
    classification: "stale-expectation-or-source-contract",
    files: [
      "src/app/api/chat/__tests__/route.tenant-policy.test.ts",
      "src/app/api/chat/__tests__/route.error-safety.test.ts",
      "src/lib/ai/__tests__/intent-routing.test.ts",
      "src/app/api/chat/__tests__/route.draft-output.test.ts",
      "src/app/api/chat/__tests__/route.troubleshooting.test.ts",
    ],
    ownerIssue: 917,
    rootCause: "AI policy, status, content-type, intent, and prompt-version contract drift",
    title: "AI tenant policy, error safety, intent, and prompt-version contracts",
  },
  {
    batch: "C",
    classification: "environment-or-configuration",
    files: [
      "src/app/__tests__/page.authenticated-redirect.test.tsx",
      "src/app/(app)/__tests__/layout.auth.test.tsx",
      "src/app/api/rpc/__tests__/rpc-jwt-skew.unit.test.ts",
      "src/app/api/tenants/__tests__/tenant-routes.test.ts",
      "src/lib/ai/tools/__tests__/migration-gate.test.ts",
    ],
    ownerIssue: 918,
    rootCause: "Local server-only, auth, JWT status, environment, and module-load harness drift",
    title: "Server-only, auth layout, JWT skew, tenant env, and AI migration-gate suites",
  },
  {
    batch: "D",
    classification: "stale-expectation-or-source-contract",
    files: [
      "src/app/(app)/equipment/_hooks/__tests__/useEquipmentData.filter-buckets.test.tsx",
      "src/app/(app)/equipment/__tests__/useEquipmentPage.test.tsx",
    ],
    ownerIssue: 919,
    rootCause: "Equipment query parameter, cache-scope, and QueryClient harness drift",
    title: "Equipment filter-bucket and page query contracts",
  },
  {
    batch: "E",
    classification: "async-or-mock-isolation",
    files: ["src/components/dashboard/__tests__/RecentActivitiesCard.test.tsx"],
    ownerIssue: 920,
    rootCause: "Recent activity hook/mock shape and async state transformation drift",
    title: "RecentActivitiesCard data and state contracts",
  },
  {
    batch: "F",
    classification: "runtime-defect",
    files: ["src/components/__tests__/usage-history-tab.loadmore.test.tsx"],
    ownerIssue: 921,
    rootCause: "Deleted usage logs remain in accumulated infinite-query pages",
    title: "Usage-history load-more deletion behavior",
  },
  {
    batch: "G",
    classification: "async-or-mock-isolation",
    files: ["src/app/(app)/technical-configurations/__tests__/reference-ranking-hook.test.tsx"],
    ownerIssue: 922,
    rootCause:
      "Reference-ranking failure reproduces intermittently between standalone and shard runs",
    title: "Reference-ranking determinism characterization",
  },
  {
    batch: "H",
    classification: "stale-expectation-or-source-contract",
    files: [
      "src/app/(app)/__tests__/layout.assistant-integration.test.tsx",
      "src/components/assistant/__tests__/AssistantPanel.ui.test.tsx",
      "src/components/assistant/__tests__/AssistantComposer.test.tsx",
      "src/components/assistant/__tests__/AssistantTriggerButton.test.tsx",
      "src/components/shared/__tests__/FloatingActionButton.test.tsx",
      "src/lib/__tests__/repair-request-deep-link.adoption.test.ts",
      "src/app/(app)/repair-requests/__tests__/RepairRequestsCreateSheetShell.test.tsx",
      "src/app/(app)/transfers/__tests__/TransfersKpi.test.tsx",
      "src/components/__tests__/qr-action-sheet.test.tsx",
    ],
    ownerIssue: 923,
    rootCause: "Assistant shell and UI source-contract expectations lag production components",
    title: "Assistant shell and stale UI source contracts",
  },
  {
    batch: "I",
    classification: "stale-expectation-or-source-contract",
    files: [
      "src/__tests__/react-doctor-p4-knip-exports.source.test.ts",
      "src/__tests__/react-doctor-p4-knip-files-config.source.test.ts",
      "src/__tests__/react-doctor-p4-knip-types.source.test.ts",
    ],
    ownerIssue: 924,
    rootCause: "React Doctor and Knip source-contract baselines no longer match tracked findings",
    title: "React Doctor and Knip source-contract baselines",
  },
  {
    batch: "J",
    classification: "environment-or-configuration",
    files: [
      "src/app/api/rpc/__tests__/technical-configuration-baseline-hierarchy-snapshots-migration.test.ts",
      "src/app/api/rpc/__tests__/technical-configuration-baseline-subgroup-mutations-migration.test.ts",
      "src/app/api/rpc/__tests__/technical-configuration-baseline-hierarchy-reads-migration.test.ts",
    ],
    ownerIssue: 925,
    rootCause: "Phase-ledger readers still target the pre-archive OpenSpec path",
    title: "Archived OpenSpec phase-ledger paths",
  },
]
