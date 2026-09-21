# Issue #1003 - Evidence auto-allowlist đơn vị mới

Ngày 2026-09-21. Đây là evidence tracked cho Task 4 tài liệu và registry. SQL
migration/test đã tồn tại ở implementation subject trước commit tài liệu; file này
không chứng nhận live apply, deploy hoặc hai lane Quality Gate.

## Contract đã ghi nhận

- Application RPC `don_vi_create` append ID mới đúng một lần vào cả
  `registration_canary_don_vi_ids` và `dispatch_canary_don_vi_ids` atomically.
- Arrays/flags hiện có được giữ nguyên; không backfill 28 active units của rollout lịch sử,
  không đổi policy active/reactivate, mode/UI/trigger/job hoặc active-policy.
- Allowlist không thay thế recipient config, browser opt-in hoặc authorization.
  Không đủ một trong các điều kiện này thì không có delivery.
- Failed create rollback cả đơn vị và hai append; manual remove không bị lần tạo
  đơn vị khác tự re-add. Kill switches hiện hữu vẫn là emergency off.
- Pending intent hiện có không bị hủy bởi no-backfill và có thể resume trước
  deadline nếu ID được include lại.

## Artifact identity

| Artifact               | Evidence                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Implementation subject | `680abc47ab35abdc5f14f1f552e170454b54d1f2`                                                     |
| Migration              | 97 lines; SHA-256 `d6c8b78df44dad8a189a43da91713cdd5f3c1e090b0b1322504a213904aae86e`           |
| SQL test               | 444 lines; SHA-256 `b98ed00a23e196c9bb12122ac27cbb8d144de4d1d1b6c1e42d3543f68aa862fe`          |
| Registry               | `supabase/db-quality-gate-tests.json` selects this test only for migration-specific gate scope |

## Focused disposable runs

### RED

`/tmp/issue1003-red-888ec1d9-r6.stdout.log` recorded successful lock,
preflight, clone, drop and unlock. The expected pre-fix assertion failed with
SQLSTATE `P0004`, `failureSignature`
`b7554f7fa940864414f7e42ceeb1f49cf6b152416892ea333898bc482f600747`, and
`stderrSha256`
`b14073b409e91caeb9ee0e2119e52dc5f98b289a46b113d21889227ccca7593c`.

### GREEN

`/tmp/issue1003-green-888ec1d9-r6.stdout.log` recorded successful lock,
preflight, clone, apply, test, drop and unlock. These are focused disposable
checks; they are not formal baseline-forward certification.

## Local static report

`/tmp/issue1003-static-888ec1d9-r2.json` is the local-static report for subject
`888ec1d941932ac7a48d532621e79c363b54f6a1`, run
`issue1003-static-888ec1d9-r2`, digest
`5629a563f6d67e07643e18719726e636fb8e89a12c61591961333d97055e0fbd`, outcome
`FAILED`.

The report records these implementation findings:

- `migration.dangerous-statement`: `GRANT EXECUTE ... TO authenticated` is
  classified as dangerous, although the permission already exists in live and
  this migration does not expand it.
- `migration.security-definer-search-path`: the parser recognizes only
  `public,pg_temp`; the SQL explicitly qualifies `pg_catalog` where needed.
- `migration.jwt-guards`: the parser expects a `user_id` guard, while the
  existing `don_vi_create` contract is role-only and already gates global/admin
  access. This remains an inherited hardening concern for logic review, not a
  reason to rewrite the migration to satisfy a parser.

No waiver or gate fix was added. The raw `FAILED` status remains visible.

## Formal gate and live boundary

- Static lane: `NOT RUN at document commit` for the final documentation commit.
- Oracle baseline-forward lane: `NOT RUN at document commit` for the final
  documentation commit.
- Aggregate status: `BLOCKING / INCOMPLETE`; no Quality Gate `PASS` is claimed.
- Exact-HEAD reports after this documentation commit remain outside the
  repository and this handoff in external quality-gate storage, so this file
  does not create a self-referential certification.
- No live apply, recipient mutation, worker deployment or provider test occurred
  for Task 4. Issue #1003 is not marked deployed.
