# Phase 4 live apply — 2026-09-13

Maintainer cho phép apply đúng ba migration Phase 4 qua Supabase MCP project
`cdthersvldpnlbvpufrr`, bypass Database Quality Gate cho lần apply này.
Source commit: `15fcc813418b2ac11a3e071166e062eac2b794ad` trên
`feat/web-push-phase-4`; worktree sạch trước apply. Không đổi SQL/source order.

| Source filename                               | Live version     | SQL SHA-256                                                        |
| --------------------------------------------- | ---------------- | ------------------------------------------------------------------ |
| `20260912000100_web_push_controls_nonce.sql`  | `20260913013933` | `86fe0c64a42a17e8917c20bc515889500a26bfcd57db8d25612bc88d6d289efc` |
| `20260912000200_web_push_delivery_claim.sql`  | `20260913013943` | `8e94f00d65cdb458a4be5bfdfc1bd13a619bad55ca47df5bff2cab0e62707faa` |
| `20260912000300_web_push_delivery_report.sql` | `20260913013951` | `1ed6108488e096dc9a6d08df21b4d20e1ae32a3df85347e954bea64c0a9e9365` |

MCP trả success cho từng migration theo thứ tự trên. Các file đã apply trở
thành immutable; không rename filename để khớp timestamp MCP.

## Read-back

- Registration/enqueue/dispatch đều false; hai canary arrays rỗng; VAPID fields
  và retention last-run null. Intents/subscriptions/deliveries đều 0.
- Sáu bảng Web Push có RLS; anon/authenticated không có direct CRUD.
- Worker nonce/claim/report, controls getter, retention và reconcile chỉ cấp
  EXECUTE cho service_role, không anon/authenticated.
- Registration/revoke và config RPCs cho authenticated; helper
  `web_push_subscription_register_unchecked` không cấp EXECUTE cho browser
  hoặc service_role. Các routines pin search_path=public,pg_temp.
- `repair_request_create(integer,text,text,date,text,text,text)` MD5 trước/sau
  đều `e82bb06870bb25bafcf2de51793d07fe`; revoke trước/sau đều
  `62032260cebbcac5e152c57ed7af55cf`. Không sửa ZBS/create flow.

Security/performance advisors đã chạy. Findings Web Push: RLS-no-policy INFO
phù hợp RPC-only access, authenticated security-definer WARN cho bốn session
RPC, unused-index INFO. Không claim toàn project sạch advisor; không sửa
findings ngoài scope. Tham chiếu:
[RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[session RPC](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Boundaries

Không chạy fixture/claim/report/retention trên live, không provision keys,
bật controls, deploy hoặc merge main. Oracle restored baseline chưa catch-up
Phase 4; lần apply này không thay đổi Oracle và không cho phép tự catch-up.
Static/baseline-forward vẫn FAILED; tasks 2.4/3.4/4.5 giữ unchecked và #1000
tiếp tục theo dõi gate acceptance. Live apply thành công không phải Gate PASS.
