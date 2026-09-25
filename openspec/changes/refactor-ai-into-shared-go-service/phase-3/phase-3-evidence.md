# Phase 3 Evidence

Ngày: 2026-09-25  
Nhánh: `feat/shared-ai-service-phase3`  
Base: `c603e31f4b70bc58ba51e16715f9f74a7cac9256` (`origin/main`, working tree sạch trước khi tách nhánh)

## Commit code

- `c898d3f1` feat(ai): add phase 3 draft quota and kill switch
- `f90c9d5f` fix(ai): bound phase 3 cleanup and reservation claims

`src/app/api/chat/route.ts` không đổi. Không có file trong `supabase/migrations`. Không deploy, không live DB write, không paid-provider smoke.

## Review

Review fresh-context trên `c603e31f..c898d3f1`: không Critical, 3 Important. Bản sửa `f90c9d5f` được đối chiếu lại: cả 3 mục ADDRESSED, không phát sinh Critical hoặc Important mới.

1. Cleanup dùng một context tối đa 5 giây. `Runner.finalize` kẹp `Cleanup` về `protocol.CleanupBudget`. `Observe` và `Finalize` dùng context đó. `gate.Cleanup` chỉ tách cancellation; nếu context cha còn deadline thì budget con là thời gian còn lại. Parent đã hủy và không có deadline vẫn chạy được audit cleanup.
2. `Reserve` giữ `RequestID` trong lock trước `ai_quota_reserve`. Lần gọi chồng trả 409 và không gọi RPC lần hai. Claim được thả nếu reserve hoặc ghi intent thất bại. Refund lỗi thì trả lỗi, không bỏ qua.
3. `context.Canceled` và `context.DeadlineExceeded` từ kill-switch đi ra nguyên vẹn và được map thành `CodeCancelled`. Không đổi thành câu "AI usage is temporarily disabled."

## Hành vi đã khóa bằng test

- Draft advisory: session active và đúng một thiết bị thì emit `repairRequestDraft`, `draftOnly: true`, `source: assistant`. Không gọi RPC tạo phiếu. Session inactive, thiết bị mơ hồ, JSON hỏng, hoặc `don_vi_thuc_hien` không hợp lệ thì không có artifact. Usage của extraction vẫn được ghi.
- Secondary extraction nằm trong cùng lifecycle với primary. Test draft đếm `Attempts == 3`. Đây là sửa accounting, không đóng băng `onFinish` cũ.
- `uiArtifact` của lượt tool hiện tại nằm trong trace UI. Provider nhận bản đã bỏ artifact. Bước sau bị từ chối khi `used + len(full output) > 40000`, không xóa artifact để lọt giới hạn. History bỏ `uiArtifact` trước gate. Clarification intent và cơ sở trả trước gate, trước reserve, và trước khi đọc kill-switch.
- Quota tenant là `Scope.EffectiveFacilityID`. `p_tenant_id` là cơ sở đã chọn khi khác session facility; null khi không có cơ sở dương. `p_user_id` là chuỗi thập phân. `p_ttl_ms` là 120000.
- Mapping 0.8: known zero là `success` + `measured` + `0,0`. Unknown sau provider là `error_with_usage` + `unknown`, sentinel `0,0` trên RPC, token lưu không được coi là measured zero. Partial chỉ gửi `0` cho chiều thiếu. Provider chưa chạy là `error_no_usage`, marker `known-no-provider-work`, có refund. Không status thứ tư, không DDL.
- Finalize lặp sau marker không gọi RPC lần hai và không tăng metric lần hai. RPC lỗi được thử tối đa 2 lần trong cùng cleanup budget.
- Request id trùng, kể cả sau refund vì provider chưa chạy, trả 409 trước provider và trước reserve RPC thứ hai.
- Kill-switch: `AI_KILL_SWITCH=on` không đọc DB. Cache 8 giây sau đọc thành công, 2 giây fail-closed sau lỗi đọc. Chặn trước reserve và provider.
- Journal append-only, `Sync`, mode `0600`. Ghi intent thất bại thì refund `error_no_usage` và không mở provider. Journal rách không finalize. Replay trước expiry finalize một lần. Replay tại hoặc sau expiry không gọi `ai_quota_finalize`, ghi `expired-uncertain`, không measured, không refund. Undercount chỉ được chấp nhận ở mốc này.
- Metric phân loại đếm `measured`, `partial`, `unknown`, `known-no-provider-work`, `expired-uncertain`. Không ghi prompt, SQL, token value, hay identity.
- Hằng số: việc 55 giây, cleanup 5 giây, route 60 giây, TTL 120 giây, trần drain 60–90 giây. Drain không được cộng vào deadline 55 giây. Phase này không triển khai drain process hay HTTP stop timeout.
- Package neutral không import `qltbyt`. `usage.Memory` bỏ qua tenant và caller. Fixture second-app vẫn chạy.

Proof local của cleanup nằm trong allowance 5 giây. Proof không thất bại, nên không cần normative amendment. Task 4.5 vẫn chưa được tick: proof này không phải acceptance HTTP/SSE end-to-end.

## Lệnh đã chạy lại trên `f90c9d5f`

Trong `services/ai-service`:

```text
gofmt -l .                 # không in file
go test -count=1 -race ./...
go vet ./...
```

Kết quả `go test`: `fixtures/secondapp`, `boundary`, `ingress`, `orchestration`, `protocol`, `provider`, `qltbyt`, `usage` đều `ok`.

`/usr/bin/openspec validate refactor-ai-into-shared-go-service --strict`: valid.

## Test chính theo task

| Task     | Test                                                                                                                                                                                                                                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1      | `TestRepairDraftEmitsArtifactWithoutSubmit`, `TestInactiveOrAmbiguousDraftDoesNotExtract`, `TestMissingAndInvalidExtractionEmitNoArtifact`, `TestExtractionPromptDoesNotFitTheRemainingBudget`, `TestModelOutputKeepsUIArtifactInTheTrace`, `TestLaterToolStepRejectsFullOutputWithoutStrippingArtifact`                                     |
| 3.2      | `TestReserveUsesSelectedFacilityNotSessionFacility`, `TestReserveOmitsTenantWhenFacilityIsUnset`, `TestDuplicateRefundedRequestDoesNotOpenOrReserveAgain`                                                                                                                                                                                    |
| 3.3      | `TestFinalizeRetriesRPCAtMostTwice`, `TestHungFinalizeIsCutAndFastFinalizeFits`, `TestRunnerCleanupDeadlineCutsHungFinalize`, `TestFinalizeQuotaPreservesRunnerCleanupDeadline`, `TestObserveStopsWhenCleanupContextIsDone`                                                                                                                  |
| 3.4, 3.8 | `TestQuotaMappingAndIdempotentFinalize`, `TestKnownZeroStaysDistinctFromUnknown`, `TestAggregateKeepsPartialWhenOneCallLacksUsage`                                                                                                                                                                                                           |
| 3.5      | `TestKillSwitchEnvCacheAndFailClosed`, `TestKillSwitchFailsClosedBeforeProvider`, `TestKillSwitchCancellationStaysCancelled`, `TestClarificationSkipsKillSwitchAndReserve`                                                                                                                                                                   |
| 3.6      | `TestRequestBudgetIsNotSummedWithDrainGrace`, metric trong `TestQuotaMappingAndIdempotentFinalize` và `TestRecoveryFinalizesOnceBeforeExpiryAndSkipsAfter`                                                                                                                                                                                   |
| 3.7      | `TestJournalIntentFailureRefundsWithoutProvider`, `TestIntentWriteFailureDoesNotOpenProvider`, `TestTornJournalDoesNotFinalize`, `TestRecoveryFinalizesOnceBeforeExpiryAndSkipsAfter`, `TestRecoveryOfIntentWithoutObservationIsUnknown`, `TestOverlappingReserveDoesNotCallQuotaTwice`, `TestIntentRefundFailureIsReturnedAndClaimReleased` |
