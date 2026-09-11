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

Static lane chạy trên exact working commit nhưng trả **INCOMPLETE** (digest
`75d7da467b676d4246cb5d1186befe9e7dede998e0568ebb6f680af4f24df167`, 14
blocking, 1541 warnings). Phân loại: header thiếu là lỗi thật và đã sửa; parser
đã nhận nhầm multi-object grants/revokes và các helper public-only là false
positive/giới hạn nhận diện cần maintainer xử lý riêng; không sửa gate hoặc cấp
waiver. Registry source/evidence finding vẫn chưa có evidence exact-landed.

Oracle baseline-forward chưa chạy được với exact landed commit (chưa commit và
chưa có run/control evidence): **BLOCKING / INCOMPLETE**. Không claim aggregate
PASS và chưa tick 2.4.

Oracle read-only preflight: PostgreSQL 17.6, persisted baseline schema v2,
healthy=true, high-water `20260910064225`. Đây chưa phải dynamic lane PASS.
Candidate SQL chỉ được chạy trên disposable database, không restored baseline.

Baseline QR source-adoption failure vẫn theo #997; không chạy/sửa test ngoài
scope để biến baseline đó thành PASS.
