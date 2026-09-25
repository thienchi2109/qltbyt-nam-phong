# Phase 1 Handoff

Ngày: 2026-09-25  
Nhánh: `feat/shared-ai-service-phase1`  
Base: `337d7dc4c522f19736911ee39d59dae374559469`

## Trạng thái

Phase 1 đã có shared Go core và second-app fixture. Evidence nằm ở
`phase-1/phase-1-evidence.md`. Checklist Phase 2 trở đi vẫn chưa tick và chưa
được thực hiện.

Không có runtime production change, không migration/DDL, không live DB write,
không deploy, không paid-provider smoke.

Re-review tại `19a496c9` đã xác nhận ba finding Important được sửa: quota
rotation dùng đúng key index đã lease, Gemini bỏ prefix `google/`, và
cancellation trong `Authorize` giữ đúng mã hủy/deadline. Các gate Go/race/vet,
gofmt và OpenSpec strict đều pass.

## Quyết định giữ từ Phase 0

- Chỉ chấp nhận undercount accounting khi recovery bắt đầu sau reservation
  expiry. Replay và finalize trước expiry vẫn bắt buộc. Core ghi trạng thái đó
  là `expired-uncertain`, không biến nó thành measured zero và không refund.
- Known zero khác unknown. Partial giữ dimension đã quan sát.
- Giữ `gateway`, `google`, `openai-compatible`. Google có key-pool rotation và
  hourly reset. Không port Bifrost.
- HMAC, BFF RPC broker và mapping sang ba status `ai_quota_finalize` vẫn là
  contract Phase 0. Phase 1 chưa gọi RPC và chưa đưa status đó vào core.
- Credential Go không gồm `SUPABASE_JWT_SECRET` hay browser cookie.

## Bước tiếp theo

Dừng trước Phase 2. Phase 2 chỉ bắt đầu khi user duyệt. Phase 2 mới đưa prompt,
authorization và RPC của QLTBYT vào adapter.

## Residual không chặn Phase 1

- `internal/orchestration/meter.go` cần được kiểm tra lại việc truyền lỗi/đóng
  stream writer khi Phase 2 thêm HTTP streaming boundary.
- Protocol errors hiện là tiếng Anh; BFF Phase 2 chịu trách nhiệm dịch lỗi
  hướng người dùng sang tiếng Việt tại HTTP boundary.
