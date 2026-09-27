# Phase 7.5A Contract/ADR — application-owned BFF RPC broker

Date: 2026-09-27  
Status: contract recorded; runtime implementation and production acceptance remain gated.

## Decision

The application-owned broker endpoint is the server-only Next.js route
`POST /api/internal/ai/broker/v1`. The versioned internal namespace keeps this
boundary separate from the browser transport (`/api/chat`) and the existing
per-function RPC proxy (`/api/rpc/[fn]`). It is called by the Go service through
the trusted private/Tunnel/Access path; a browser must not call it directly.

The route is an RPC broker, not a second chat endpoint. The server-side BFF
mints and the route verifies the short-lived broker credential, validates the
operation and allowlist, derives
the downstream Supabase claims on the BFF, invokes the existing server-side
RPC adapter, and returns a bounded JSON result. It never forwards a browser
cookie or a project-wide JWT signing secret to Go.

## Trust boundaries and credential custody

1. The browser authenticates only to the existing Next.js `/api/chat` boundary.
   Browser cookies, browser claims, `SUPABASE_JWT_SECRET`, and Cloudflare
   Access headers supplied by a browser have no authority at this route.
2. The authenticated server-side BFF session is the only source for `user_id`,
   role, session facility and requested facility. The existing
   `mintGoBffBrokerToken` path mints the broker credential before the Go request
   is sent. It uses the server-only `AI_SERVICE_BFF_BROKER_SECRET` value.
3. Go receives the broker credential as an opaque capability claim and sends it
   as `Authorization: Bearer <token>` to this route. Go never receives or
   stores `SUPABASE_JWT_SECRET`; it cannot mint a project-wide Supabase JWT.
4. The BFF verifies the credential, derives narrow RPC JWT claims from those
   verified claims, and calls only the allowlisted RPC through the existing
   server-only RPC adapter. `SUPABASE_JWT_SECRET` remains in Next.js and is used
   there only to mint the short-lived downstream authenticated RPC JWT (current
   helper lifetime: `120s`); neither that secret nor the Supabase JWT is returned
   to Go. Role normalization and facility/tenant policy remain application
   policy at this boundary.
5. `AI_DATABASE_URL`, the `ai_query_tool` role, grants and catalog read-back
   are owned by 7.5D–E. This endpoint does not open a direct database connection
   and does not authorize a migration or live write.

The Cloudflare Access lane is valid only when the Access credential is injected
by the trusted Go/BFF deployment path. A header copied from a browser is
negative evidence and must be rejected. Access credentials and broker tokens
are never included in response bodies, browser-visible output or logs.

## Broker token contract

The token is the existing compact HMAC-SHA-256 envelope (it is not a browser
session cookie and is not a project-wide JWT):

```json
{
  "iss": "nextjs-bff",
  "aud": "qltbyt-rpc-broker-v1",
  "iat": 1730000000,
  "exp": 1730000120,
  "user_id": 123,
  "role": "technician",
  "session_facility_id": 7,
  "requested_facility_id": 7
}
```

The JSON is base64url encoded without padding and signed with HMAC-SHA-256
using `AI_SERVICE_BFF_BROKER_SECRET`; the wire value is
`<base64url-json>.<base64url-signature>`. `user_id` is a positive JSON number.
The role claim is a trusted role string. Facility claims are optional only when
the trusted session has no such scope; when present, facility IDs are positive
JSON numbers. A present `session_facility_id` or `requested_facility_id` of
zero, a negative number, a non-integer or another nonnumeric value is a
malformed credential and MUST fail closed with `401`. This is a normative
7.5A requirement; the current verifier does not yet provide this evidence.
Package 7.5C must enforce and test it before runtime acceptance. The BFF and Go
must enforce all of the following:

- issuer is exactly `nextjs-bff` and audience is exactly
  `qltbyt-rpc-broker-v1`;
- `exp - iat` is positive and no greater than `120s`;
- timestamps are UTC Unix seconds; `iat` cannot be in the verifier's future and
  `exp` must be later than verifier time; there is no expiry grace window;
- missing, malformed, forged, expired, future-dated, over-TTL, nonnumeric or
  nonpositive claims fail closed with `401`;
- the token carries only the trusted role/facility scope derived by the BFF;
  request payload fields cannot widen it.

Operational clocks must be synchronized to UTC (the separate HMAC ingress
signature keeps its reviewed 30-second skew policy). This token verifier does
not add a second skew allowance.

## HTTP request contract

Request headers:

| Header                                            | Contract                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Authorization`                                   | Required `Bearer <broker-token>`; no cookie or alternate browser credential is accepted.                                                                                                                                                                                                     |
| `Content-Type`                                    | `application/json`; other media types are `415`.                                                                                                                                                                                                                                             |
| `X-Request-ID`                                    | Required for normal dispatch and must match `[A-Za-z0-9._:-]{1,128}`; echoed in every response. A missing or invalid value is rejected before RPC with `400`; the server generates a fresh compliant response correlation ID and uses it in the error body instead of echoing the bad value. |
| `CF-Access-Client-Id` / `CF-Access-Client-Secret` | Injected only by the trusted deployment path when the route is behind Access; browser-supplied values never authorize a request.                                                                                                                                                             |

The bounded JSON body is at most 64 KiB and has this shape:

```json
{
  "protocol_version": "v1",
  "request_id": "req-123",
  "operation": "call",
  "rpc": "ai_equipment_lookup",
  "payload": { "query": "monitor" }
}
```

`operation` is `call` for normal work and `cleanup` for bounded post-cancel
work. `rpc` is an exact allowlist name. `payload` is a strict JSON object; the
BFF passes only the validated RPC arguments to the adapter and does not accept
a SQL statement, arbitrary function name, role, tenant, facility or signing
secret from the caller. `request_id` in the body must equal the valid header
value. A missing or invalid header is the explicit pre-dispatch exception
described above; it does not reach RPC validation.
The remaining deadline is transport metadata from the Go HTTP client and the
inbound request signal; no body field may extend or replace it.

The HTTP `operation` is part of the transport contract. The existing Go
`Broker.Call(ctx, cred, rpc, payload)` signature has no operation parameter and
therefore is not evidence that this wire contract is implemented. Package 7.5C
must provide an operation-aware transport (or an equivalent adapter boundary)
with these mappings: `call` invokes the normal bounded broker call, while
`cleanup` invokes a separate bounded cleanup method that can only audit or
finalize. It MUST preserve the operation through to the BFF, reject an
operation/RPC mismatch, and MUST NOT infer cleanup solely from the RPC name.
This ADR records the required contract; it does not claim that 7.5C is done.

The allowlist is deliberately explicit:

```text
ai_equipment_lookup
ai_maintenance_summary
ai_maintenance_plan_lookup
ai_repair_summary
ai_usage_summary
ai_attachment_metadata
ai_device_quota_lookup
ai_quota_compliance_summary
ai_category_suggestion
ai_department_list
assistant_query_database_audit_log
ai_quota_reserve
ai_quota_finalize
ai_kill_switch_status
```

An allowlist addition requires a reviewed 7.5A amendment and focused endpoint
tests. `cleanup` may call only `assistant_query_database_audit_log` or
`ai_quota_finalize`; cleanup cannot reserve quota, invoke a catalog RPC or
widen `p_user_id`/facility fields. `ai_quota_finalize` must remain idempotent by
reservation ID, so a retry never creates a second reservation effect.

### RPC argument and result schemas

Every `payload` is a strict object. Unknown keys, protected scope keys and
incorrect JSON types are rejected before the RPC. The caller-visible argument
schemas and success result schemas below are normative. The BFF may add the
protected fields when invoking the existing Supabase adapter, but those fields
are server-derived and are not caller authority.

| RPC                                  | Caller payload (strict)                                                                                                                                                                                                                                                          | Success result and item limit                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai_equipment_lookup`                | Optional `query` (string, 1–200), `limit` (integer 1–50), `status` (string 1–100), and `filters` with only `equipmentCode` (1–200), `status` (1–100), `department` (1–200), `location` (1–200), `classification` (1–50), `model` (1–200) and `serial` (1–200).                   | Object `{data,total,limit,appliedFilters}` or the existing bounded `{error,limit}` error shape. `data` has at most 50 items; each item may contain only `id`, `ma_thiet_bi`, `ten_thiet_bi`, `model`, `serial`, `so_luu_hanh`, `tinh_trang_hien_tai`, `khoa_phong_quan_ly`, `vi_tri_lap_dat`, `phan_loai_theo_nd98`, `ngay_bt_tiep_theo`, `ngay_hc_tiep_theo`, `ngay_kd_tiep_theo`, `don_vi` and `facility_name`; `appliedFilters` may contain only the seven filter keys. |
| `ai_maintenance_summary`             | Optional `fromDate` and `toDate` strings; the existing RPC date parser remains authoritative.                                                                                                                                                                                    | Object `{totalTasks,totalPlans,statusCounts,taskTypeCounts,recentTasks,fromDate,toDate}`. `recentTasks` has at most 20 items with only `task_id`, `loai_cong_viec`, `don_vi_thuc_hien`, `plan_id`, `ten_ke_hoach`, `nam`, `plan_status`, `ngay_phe_duyet`, `equipment_id`, `ma_thiet_bi`, `ten_thiet_bi` and `model`.                                                                                                                                                      |
| `ai_maintenance_plan_lookup`         | Required positive integer `p_thiet_bi_id`; optional integer `p_nam` in 2000–2100.                                                                                                                                                                                                | Object `{equipment,plans,totalPlans,yearFilter}`. `equipment` is one object with `id`, `ma_thiet_bi`, `ten_thiet_bi`, `model`, `don_vi`; `plans` has at most 100 items with the existing plan/task fields (`plan_id`, `ten_ke_hoach`, `nam`, `loai_cong_viec`, `plan_trang_thai`, `ngay_phe_duyet`, `task_id`, `don_vi_thuc_hien`, `diem_hieu_chuan`, `thang_1`–`thang_12`, `thang_1_hoan_thanh`–`thang_12_hoan_thanh` and `ghi_chu`).                                     |
| `ai_repair_summary`                  | Optional `status` string, 1–50 characters.                                                                                                                                                                                                                                       | Object `{totalRequests,openRequests,statusCounts,recentRequests,statusFilter}`. `recentRequests` has at most 20 items with only `id`, `thiet_bi_id`, `ngay_yeu_cau`, `trang_thai`, `mo_ta_su_co`, `hang_muc_sua_chua`, `ngay_hoan_thanh`, `don_vi_thuc_hien`, `ten_don_vi_thue`, `ma_thiet_bi`, `ten_thiet_bi`, `model`, `khoa_phong_quan_ly`, `don_vi` and `facility_name`.                                                                                               |
| `ai_usage_summary`                   | Required positive integer `p_thiet_bi_id`; optional integer `p_months` in 1–24.                                                                                                                                                                                                  | Object with only `thiet_bi_id`, `total_sessions`, `avg_duration_hours`, `sessions_last_30_days`, `sessions_last_90_days`, `condition_counts`, `earliest_session`, `latest_session`, `months_range` and `error`; `condition_counts` has at most 100 keys.                                                                                                                                                                                                                   |
| `ai_attachment_metadata`             | Required positive integer `p_thiet_bi_id`.                                                                                                                                                                                                                                       | Object `{kind,thiet_bi_id,attachments,total_count}` or the existing bounded `{error,thiet_bi_id}` error shape; `attachments` has at most 20 items with only `id`, `ten_file`, `access_type`, `url` and `ngay_tai_len`.                                                                                                                                                                                                                                                     |
| `ai_device_quota_lookup`             | Required positive integer `p_thiet_bi_id`.                                                                                                                                                                                                                                       | Object with only `kind`, `status`, `evidence_status`, `reason`, `error`, `device` (`id`, `ma_thiet_bi`, `ten_thiet_bi`), `scope` (`mode`, `don_vi_id`), `decision` (`id`, `so_quyet_dinh`, `trang_thai`, `ngay_hieu_luc`), `category` (`id`, `ma_nhom`, `ten_nhom`) and `quota` (`so_luong_toi_da`, `so_luong_toi_thieu`, `so_luong_hien_co`, `remaining`); absent nested objects are `null` and no arrays are allowed.                                                    |
| `ai_quota_compliance_summary`        | Empty object.                                                                                                                                                                                                                                                                    | Object with only `kind`, `scope` (`mode`, `don_vi_id`, `label`), `decision` (`id`, `so_quyet_dinh`, `trang_thai`, `ngay_hieu_luc`), `summary` (`total_categories`, `dat_count`, `thieu_count`, `vuot_count`, `unmapped_equipment`), `evidence_status`, `suggested_follow_ups`, `error` and `message`; `suggested_follow_ups` has at most 10 strings.                                                                                                                       |
| `ai_category_suggestion`             | Required `device_name` string, 1–200 characters.                                                                                                                                                                                                                                 | Object `{data,total}`; `data` has at most 10 items with only `id`, `ma_nhom`, `ten_nhom`, `phan_loai`, `parent_name` and `match_reason`.                                                                                                                                                                                                                                                                                                                                   |
| `ai_department_list`                 | Empty object.                                                                                                                                                                                                                                                                    | Object `{data,total}`; `data` has at most 50 items with only `name` and `equipment_count`.                                                                                                                                                                                                                                                                                                                                                                                 |
| `assistant_query_database_audit_log` | Required `p_status` (`success` or `failure`), `p_tool_path` exactly `query_database`, nonempty `p_sql_shape` (at most 1000 characters), nonnegative `p_latency_ms`; optional nonnegative `p_row_count`, `p_payload_bytes` and nonempty `p_error_class` when status is `failure`. | JSON boolean `true`. The effective facility, source, requested/session facility and raw role are server-derived telemetry, not caller fields.                                                                                                                                                                                                                                                                                                                              |
| `ai_quota_reserve`                   | `p_rate_window_ms` positive integer, `p_rate_max`, `p_user_daily_max`, `p_tenant_daily_max`, `p_global_daily_max` nonnegative integers, and `p_ttl_ms` positive integer; `p_now` is server time and is forbidden. `p_user_id` and `p_tenant_id` are server-derived.              | At most one row `{allowed,reservation_id,reason,message}`; no other keys.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `ai_quota_finalize`                  | Required `p_reservation_id` (nonempty string), `p_status` in `success                                                                                                                                                                                                            | error_with_usage                                                                                                                                                                                                                                                                                                                                                                                                                                                           | error_no_usage`, nonnegative integer `p_tokens_in`/`p_tokens_out`and nonnegative number`p_cost_usd`, with idempotent finalize rules. | Empty JSON object or `null` (the underlying function returns `void`). |
| `ai_kill_switch_status`              | Empty object.                                                                                                                                                                                                                                                                    | At most one row `{enabled,reason,updated_at}`; no other keys.                                                                                                                                                                                                                                                                                                                                                                                                              |

The result allowlists apply recursively to nested objects. A result that adds a
field, exceeds its row/item limit, or cannot be serialized within the response
cap below is an upstream contract error; the BFF MUST NOT silently truncate it.

Authorization scope and audit telemetry are separate concerns. The effective
authorization facility is resolved from the verified credential: a positive
requested facility is used for a privileged role, otherwise the positive
session facility is used. A catalog, quota or audit payload cannot choose a
different facility. For `assistant_query_database_audit_log`, the BFF derives
`p_effective_facility_id`, `p_facility_source` (`selected` exactly when the
requested facility was used, otherwise `session`),
`p_requested_facility_id`, `p_session_facility_id` and `p_raw_role` from the
verified token/scope. They are audit observations, not authorization inputs;
any caller-supplied value is rejected (or overwritten only at the trusted BFF
boundary) and a mismatch fails closed. The same rule applies to
`p_user_id`, `p_don_vi`/`p_tenant_id` and `p_effective_facility_id` on catalog
and quota calls.

For cleanup, `p_requested_facility_id`, `p_session_facility_id`,
`p_effective_facility_id`, `p_raw_role`, `p_facility_source`, `p_user_id` and
`p_don_vi`/`p_tenant_id` are forbidden payload keys. Cleanup accepts only the
strict finalize fields or the strict audit fields above; the BFF derives any
audit scope telemetry. This closes the existing `rejectWidenedPayload` gap for
`p_requested_facility_id` and prevents caller-controlled raw role/source data.

## Timeout, cancellation and response contract

The BFF uses the inbound request signal and never resets or extends the caller's
deadline. It applies a maximum 5-second RPC/cleanup budget, reduced to the
remaining inbound deadline when that is shorter. An HTTP abort cancels the
downstream RPC. Cleanup is a separate bounded request and uses at most the
reviewed `CleanupMax = 5s`; it is not an authorization to perform new work.
The BFF does not retry RPC calls. Callers may retry an idempotent finalize with
the same reservation ID after a transport failure.

Successful calls return `200 application/json`:

```json
{
  "protocol_version": "v1",
  "request_id": "req-123",
  "rpc": "ai_equipment_lookup",
  "result": []
}
```

The result is the validated JSON returned by the allowlisted RPC. The complete
serialized `200` response body, including its envelope, has a hard UTF-8 byte
cap of `64 KiB`; error bodies have a separate `8 KiB` cap. Quota reservation
denial remains a successful RPC result (`allowed: false`); it is not converted
into an empty success or an implicit retry. On a successful query, an audit
failure blocks release; on a failed query, the original SQL error remains the
returned failure while the audit attempt is recorded as a redacted best-effort
event. Neither path becomes an empty success. If the upstream result exceeds
the hard byte cap or any per-RPC row/item/field allowlist, the BFF returns
`502` with error code `result_too_large`, `retryable: false`, and no partial
result; it does not truncate or retry the RPC.

Errors use one stable, redacted shape. A valid request ID is echoed in the
`X-Request-ID` response header and body; when the request ID is missing or
invalid, the server generates a fresh compliant ID and uses that ID instead:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The request is not valid.",
    "retryable": false,
    "request_id": "req-123"
  }
}
```

The contract maps malformed method/media type/body to `400`/`405`/`413`/`415`,
missing or invalid credentials to `401`, an unknown RPC or widened scope to
`403`, cancellation to `499`, an oversized or disallowed upstream result to
sanitized `502` with `result_too_large`, an upstream RPC failure to sanitized
`502`, and
missing configuration or unavailable dependencies to `503`. Retryable errors
may include `Retry-After`. Raw SQL, rows, database messages, provider details,
tokens and secrets never appear in error bodies or logs.

## Negative acceptance matrix

7.5B focused tests must prove that the route rejects each of these before an
RPC call: missing/forged/expired/future/wrong-audience/over-TTL tokens; a
nonnumeric or nonpositive `user_id`; a nonpositive, non-integer or nonnumeric
session/requested facility claim; browser cookie or browser claim authority;
`SUPABASE_JWT_SECRET` in headers/body; missing broker or Supabase server secret;
unknown RPC; cleanup of reserve/catalog work; widened user/facility payload;
caller-controlled `p_requested_facility_id`, `p_session_facility_id`,
`p_effective_facility_id`, `p_raw_role` or `p_facility_source`; operation/RPC
mismatch; missing or invalid request ID (with a generated error correlation
ID); malformed/oversized JSON; browser-supplied Access headers; and
cancellation that attempts an unbounded cleanup. Positive tests must cover one
catalog call, audit, reserve, finalize cleanup, scoped claims, per-RPC result
field/row limits, `result_too_large`, generated error correlation and redacted
success/error logging.

## Package boundary and evidence

This ADR is the 7.5A contract output. It does not implement the route, Go
Broker, QueryExecutor, SQL role, migration, deployment, Oracle activation,
`/api/chat` cutover, Phase 9 cleanup or paid-provider smoke. The package can
authorize dispatch of 7.5B contract implementation only after this document is
reviewed; it does not mark 7.5B–G complete. Evidence is recorded in
[phase-7.5-evidence.md](phase-7.5-evidence.md) and the dispatch handoff.
