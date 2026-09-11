# Phase 2 evidence

Ngày 2026-09-11. Base `fc63c55b2b9ec5bbe15cd7db5b26d9d4006d83b4`:
`main` sạch, `git pull --rebase` up-to-date và ancestor check PASS trước khi
tạo branch `feat/web-push-phase-2`.

## Phạm vi

Chỉ tasks 2.1–2.4 theo contract v1: additive SQL, SQL tests và test registry.
Không đổi create/enqueue, ZBS, API/UI/Go, #997 hoặc Phase 3; không ghi live DB
hay deploy. Chưa có entrypoint tạo intent từ repair request.

Recall agentmemory theo `add-web-push-notifications Phase 1` và smart search
`mem_mtvn9f1m_13001642ee85` không tìm thấy entry. Retry `web push` chỉ trả
memory ZBS cũ; không dùng thay contract. Quyết định lấy từ proposal, design,
spec, tasks, phase-1-contract và phase-1-evidence hiện hành.

## Baseline và authorization

- Source/HMAC check Phase 1 PASS trên base; không chứng nhận DB rollback ZBS.
- OpenSpec strict PASS trước implementation.
- Durable profile theo migration `20260824070104`, repair read theo
  `20260428132000`, department normalization theo `20260515113000`.
- Config xét profile/tenant, không đòi subscription hoặc request. Predicate
  request-specific thêm request/equipment hiện hành và department role user.
  Claim/retry lifecycle là phase sau, không lấy quyền worker thay recipient.
- Không thêm cột/guard account active. Department đã mất phải fail closed;
  không kế thừa department cũ từ session snapshot.

## Verification

Migration và SQL test đã chạy PASS trên disposable `dq_webpush_phase2_dev_20260911`
(fresh clone từ baseline): ba notice PASS cho config/authorization, registration
/ownership/revision/epoch và retention/FK/RLS/grants. Đây là execution evidence
cho 2.1–2.3, không phải live apply.

Hai lane chính thức cùng subject commit
`7e3c834722b50957787978feeb148a30357c38ce` trên branch; đây không phải main đã
land hoặc chứng nhận live apply. Migration SQL commit `c7adad19` không bị sửa
sau commit; `7e3c8347` chỉ bổ sung access invariants cho năm bảng mới.

| Lane                    | Kết quả thực tế                                                                                 | Evidence                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| static                  | **FAILED**, 11 BLOCKING, 5 DANGEROUS, 1541 WARNING                                              | run `webpush-phase2-static-v2-20260911`; digest `15d138c649812f60a36592843336e78c9316ff63bcff48f0a7976c6ee1836902` |
| Oracle baseline-forward | **FAILED**; 79/79 tests attempted và executed, Web Push test PASS; một blocker baseline còn lại | run `webpush-phase2-oracle-v2-20260911`; digest `8c10b269fed4b76e35fb8a47a345ebaae17df6b745e06fc037205ea2afa67bef` |

Report đầy đủ có digest tại
`/root/Oracle/web-push-phase2-evidence/7e3c8347/webpush-phase2-static-v2.json`
và `webpush-phase2-oracle-v2.json`. Oracle report đã persist tại
`/opt/supabase-test/quality-gate/evidence/webpush-phase2-oracle-v2-20260911/report.json`.
Control chạy inline trên clone riêng; candidate clone riêng, cleanup của gate
không có failure. Không reuse control cũ có SQL failures.

### Phân loại findings

- **Lỗi thật đã sửa:** thiếu header ở hai migration; thiếu đăng ký table-access
  contract cho năm bảng mới khiến Oracle dừng trước candidate SQL tests. Đã thêm
  đúng năm invariants `rpc-only`, không sửa gate engine hay baseline registry cũ.
- **False positive về cú pháp đã loại:** PostgreSQL cho phép gộp GRANT/REVOKE
  nhiều objects và bỏ keyword TABLE, nhưng recognizer không nhận đủ. Đã tách
  thành từng statement tương đương, không mở thêm quyền.
- **11 static blocking còn lại là giới hạn nhận diện, không phải bằng chứng
  thiếu authorization:** tám JWT-guard findings gồm pure P-256 validator,
  predicate internal-only không dùng worker JWT và các session RPC gọi helper
  kiểm claims/profile. Ba execute-grant findings yêu cầu authenticated cho
  helper/predicate mà contract cấm browser gọi. SQL tests và review xác nhận
  ACL/authorization thực tế; không cấp quyền thêm hoặc thêm guard giả để ép PASS.
- **5 DANGEROUS không gọi là false positive:** bốn grants session RPC và DELETE
  config theo tenant là thay đổi quyền/mutation có chủ ý, đúng contract đã duyệt.
  Mutation có caller guard và transaction; grants chỉ authenticated, PUBLIC/anon
  bị revoke. Không tự tạo approval record/waiver trong gate.
- **Oracle blocker là baseline test lỗi thời:**
  `technical_configuration_authorized_user_guard_phase_gate.sql` đòi
  `all 79 authenticated module RPCs are inventoried`. Read-only catalog đếm 83
  ở cả baseline và disposable candidate. Hai phía cùng SQLSTATE `P0001`, cùng
  test SHA `f6db0ff12fc3147d20be0ed9f618d018ddad04644f9fde36180a883c8a43e849`
  và failure signature
  `14531cbcc0868fcbebec3ef3d4fa3bbe5f8bd42344106383f3fcc4b6283ca693`.
  Web Push không sửa routine Technical Configurations. Không sửa test đó hoặc
  tự thêm baseline-debt exemption. Sáu failures khác đã được registry hiện hữu
  nhận là reviewed baseline debt; Web Push test từ missing function ở control
  chuyển sang PASS ở candidate, không dùng missing function làm bằng chứng TDD.

Aggregate acceptance: **BLOCKING / INCOMPLETE**, vì không có hai lane PASS.
Tasks 2.1–2.3 có implementation/execution evidence nên tick; **2.4 chưa tick**.
Follow-up [#998](https://github.com/thienchi2109/qltbyt-nam-phong/issues/998)
theo dõi gate acceptance và stale RPC inventory riêng, không sửa gate trong Phase 2.

Oracle read-only preflight: PostgreSQL 17.6, persisted baseline schema v2,
healthy=true, high-water `20260910064225`. Đây chưa phải dynamic lane PASS.
Candidate SQL chỉ được chạy trên disposable database, không restored baseline.

Baseline QR source-adoption failure vẫn theo #997; không chạy/sửa test ngoài
scope để biến baseline đó thành PASS.

## Review và closeout

`post_implementation_reviewer` review theo base `fc63c55b`, contract và scope
Phase 2: không có Critical/Important sau khi đối chiếu durable-profile parity,
ownership/revision, retention/FK và ACL. Tests kiểm role không hợp lệ, actual
subject/owner deletion, regional inactive, missing region, stale department,
manager/nonmanager current tenant, giới hạn 10 subscriptions, P-256 point lỗi,
foreign revoke và atomic config.

Reuse `_normalize_department_scope` và `get_session_authorization_profile_for_jwt`.
Code Review Graph stale/không trả SQL symbol; GitNexus chỉ tìm auth TS context.
Không dùng zero graph hits làm bằng chứng không có code tương đương: đã kiểm
source migration definitions theo filename order và các primitive hiện hành.
Không viết lại department normalizer hoặc gọi repair read dưới worker identity.

Formatting, whitespace check, Phase 1 source/HMAC lock và OpenSpec strict PASS.
Không đổi JS/TS/React nên không chạy full React/browser suite. Maintainer đã
cho phép **push dùng `--no-verify`**; commit hooks vẫn chạy, không ghi nhận hook
bypass là gate PASS. Không merge main, live write/deploy hoặc bắt đầu Phase 3.
