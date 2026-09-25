# Phase 3 Evidence

Ngày: 2026-09-25  
Nhánh: `feat/shared-ai-service-phase3`  
Base: `c603e31f4b70bc58ba51e16715f9f74a7cac9256` (`origin/main`, working tree sạch trước khi tách nhánh)

## Code baseline and working tree

- `c898d3f1` feat(ai): add phase 3 draft quota and kill switch
- `f90c9d5f` fix(ai): bound phase 3 cleanup and reservation claims

Verification ran on `HEAD 5ee03b9e` with the Phase 3 fixes below still uncommitted. No commit or push was made.

`src/app/api/chat/route.ts` không đổi. Không có file trong `supabase/migrations`. Không deploy, không live DB write, không paid-provider smoke.

## Review

Review fresh-context trên `c603e31f..c898d3f1`: không Critical, 3 Important. Bản sửa `f90c9d5f` được đối chiếu lại: cả 3 mục ADDRESSED, không phát sinh Critical hoặc Important mới tại checkpoint đó. Follow-up review trên working tree tìm thấy thêm hai Important về stream error ordering và cleanup deadline; cả hai đã được sửa và có regression test bên dưới.

1. Cleanup dùng một context tối đa 5 giây. `Runner.finalize` kẹp `Cleanup` về `protocol.CleanupBudget`. `Observe` và `Finalize` dùng context đó. `gate.Cleanup` chỉ tách cancellation; nếu context cha còn deadline thì budget con là thời gian còn lại. Parent đã hủy và không có deadline vẫn chạy được audit cleanup.
2. `Reserve` giữ `RequestID` trong lock trước `ai_quota_reserve`. Lần gọi chồng trả 409 và không gọi RPC lần hai. Claim được thả nếu reserve hoặc ghi intent thất bại. Refund lỗi thì trả lỗi, không bỏ qua.
3. `context.Canceled` và `context.DeadlineExceeded` từ kill-switch đi ra nguyên vẹn và được map thành `CodeCancelled`. Không đổi thành câu "AI usage is temporarily disabled."

## Tám finding được xử lý trong working tree

1. Intent provider được ghi bền vững trước mỗi `Generate`/`Stream`; usage của từng call được append và sync trước call kế tiếp trong tool loop hoặc extraction. `TestRunnerPersistsFirstCallUsageBeforeNextToolLoopCall` kiểm tra journal ngay bên trong call thứ hai. Recovery vẫn giữ token đã biết khi intent sau cùng chưa có observation.
2. Nếu append observation lỗi, QuotaBook giữ usage trong pending state, retry ghi bền vững trước quota finalize, và không hạ token đã biết thành unknown. `TestObserveAppendFailurePersistsKnownUsageBeforeFinalize` kiểm tra 10/2 token.
3. Wait lock, Open, Write và Sync của journal tôn trọng cleanup context; công việc I/O đang chạy giữ FIFO order nhưng caller có thể trả về khi deadline hết. Các test cleanup deadline bao gồm blocked Sync, FIFO Open và chờ lock.
4. Kill-switch response rỗng, malformed, thiếu `enabled` hoặc sai kiểu đi vào fail-closed cache 2 giây. Response hợp lệ cache 8 giây; env `AI_KILL_SWITCH=on` vẫn chặn mà không đọc DB.
5. Budget được claim bằng `LoadOrStore` và chỉ owner mới được xóa bằng compare-and-delete. Runner defer cleanup sau Prepare thành công ở mọi nhánh; duplicate request không sửa slot đang hoạt động.
6. Tool budget tính argument bytes và compacted output cho mức tăng cộng dồn, đồng thời giữ raw full-output ceiling để artifact lớn không thể lọt qua nhờ compaction.
7. Stream terminal error được giữ lại cho tới khi usage `Observe` kết thúc; chỉ sau đó runner mới nhận provider/observe error. Cancellation đóng source reader an toàn một lần, chờ stream forwarder trong cleanup budget, rồi snapshot usage trước finalize. Regressions: `TestForwardStreamPersistsUsageBeforeDeliveringProviderError`, `TestForwardStreamDeliversErrorToOpenReader`, `TestForwardStreamDropsErrorWhenReaderIsClosed`, `TestRunnerStreamCancellationPersistsReceivedUsageBeforeFinalize`.
8. Cancellation mở một detached cleanup deadline dùng chung cho stream wait, usage `Observe` và quota `Finalize`, thay vì cấp lại nguyên cleanup budget cho mỗi operation. `TestCancellationSharesOneCleanupDeadlineAcrossObserveAndFinalize` kiểm tra deadline của Observe và Finalize cùng budget.

## Hành vi đã khóa bằng test

- Draft advisory: session active và đúng một thiết bị thì emit `repairRequestDraft`, `draftOnly: true`, `source: assistant`. Không gọi RPC tạo phiếu. Session inactive, thiết bị mơ hồ, JSON hỏng, hoặc `don_vi_thuc_hien` không hợp lệ thì không có artifact. Usage của extraction vẫn được ghi.
- Secondary extraction nằm trong cùng lifecycle với primary. Test draft đếm `Attempts == 3`. Đây là sửa accounting, không đóng băng `onFinish` cũ.
- `uiArtifact` của lượt tool hiện tại nằm trong trace UI. Provider nhận bản đã bỏ artifact. Bước sau bị từ chối khi `used + len(arguments) + len(full output) > 40000`, không xóa artifact để lọt giới hạn; accepted growth tính arguments cùng compacted output. History bỏ `uiArtifact` trước gate. Clarification intent và cơ sở trả trước gate, trước reserve, và trước khi đọc kill-switch.
- Quota tenant là `Scope.EffectiveFacilityID`. `p_tenant_id` là cơ sở đã chọn khi khác session facility; null khi không có cơ sở dương. `p_user_id` là chuỗi thập phân. `p_ttl_ms` là 120000.
- Mapping 0.8: known zero là `success` + `measured` + `0,0`. Unknown sau provider là `error_with_usage` + `unknown`, sentinel `0,0` trên RPC, token lưu không được coi là measured zero. Partial chỉ gửi `0` cho chiều thiếu. Provider chưa chạy là `error_no_usage`, marker `known-no-provider-work`, có refund. Không status thứ tư, không DDL.
- Finalize lặp sau marker không gọi RPC lần hai và không tăng metric lần hai. RPC lỗi được thử tối đa 2 lần trong cùng cleanup budget.
- Request id trùng, kể cả sau refund vì provider chưa chạy, trả 409 trước provider và trước reserve RPC thứ hai.
- Kill-switch: `AI_KILL_SWITCH=on` không đọc DB. Cache 8 giây sau payload hợp lệ; transport hoặc payload lỗi fail-closed 2 giây. Chặn trước reserve và provider.
- Journal append-only, `Sync`, mode `0600`. Mỗi completed provider call có usage observation bền vững trước call kế tiếp. Ghi intent thất bại thì refund `error_no_usage` và không mở provider. Observation append lỗi được retry trước finalize. Journal rách không finalize. Replay trước expiry finalize một lần. Replay tại hoặc sau expiry không gọi `ai_quota_finalize`, ghi `expired-uncertain`, không measured, không refund. Undercount chỉ được chấp nhận ở mốc này.
- Metric phân loại đếm `measured`, `partial`, `unknown`, `known-no-provider-work`, `expired-uncertain`. Không ghi prompt, SQL, token value, hay identity.
- Hằng số: việc 55 giây, cleanup 5 giây, route 60 giây, TTL 120 giây, trần drain 60–90 giây. Drain không được cộng vào deadline 55 giây. Phase này không triển khai drain process hay HTTP stop timeout.
- Package neutral không import `qltbyt`. `usage.Memory` bỏ qua tenant và caller. Fixture second-app vẫn chạy.

Proof local của cleanup nằm trong allowance 5 giây. Proof không thất bại, nên không cần normative amendment. Task 4.5 vẫn chưa được tick: proof này không phải acceptance HTTP/SSE end-to-end.

## Verification trên working tree `HEAD 5ee03b9e`

Trong `services/ai-service`:

```text
go test ./...
go test -race ./...
go vet ./...
gofmt -l .                  # không in file
node scripts/npm-run.js run format:check
openspec validate refactor-ai-into-shared-go-service --strict
```

Sau hai finding follow-up, tất cả package đều PASS ở cả `go test` và `go test -race`; `go vet`, gofmt, Prettier format check và strict OpenSpec validation cũng PASS. Regression tests tập trung cho stream và cancellation cũng PASS.

## Test chính theo task

| Task     | Test                                                                                                                                                                                                                                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1      | `TestRepairDraftEmitsArtifactWithoutSubmit`, `TestInactiveOrAmbiguousDraftDoesNotExtract`, `TestMissingAndInvalidExtractionEmitNoArtifact`, `TestExtractionPromptDoesNotFitTheRemainingBudget`, `TestModelOutputKeepsUIArtifactInTheTrace`, `TestLaterToolStepRejectsFullOutputWithoutStrippingArtifact`                                     |
| 3.2      | `TestReserveUsesSelectedFacilityNotSessionFacility`, `TestReserveOmitsTenantWhenFacilityIsUnset`, `TestDuplicateRefundedRequestDoesNotOpenOrReserveAgain`                                                                                                                                                                                    |
| 3.3      | `TestFinalizeRetriesRPCAtMostTwice`, `TestHungFinalizeIsCutAndFastFinalizeFits`, `TestRunnerCleanupDeadlineCutsHungFinalize`, `TestFinalizeQuotaPreservesRunnerCleanupDeadline`, `TestObserveStopsWhenCleanupContextIsDone`, `TestFinalizeLockWaitHonorsCleanupContext`, `TestJournalFIFOOpenHonorsCleanupContext`                           |
| 3.4, 3.8 | `TestQuotaMappingAndIdempotentFinalize`, `TestKnownZeroStaysDistinctFromUnknown`, `TestAggregateKeepsPartialWhenOneCallLacksUsage`, `TestObserveAppendFailurePersistsKnownUsageBeforeFinalize`, `TestRecoveryKeepsKnownUsageWhenLaterIntentIsUnobserved`, `TestRunnerPersistsFirstCallUsageBeforeNextToolLoopCall`                           |
| 3.5      | `TestKillSwitchEnvCacheAndFailClosed`, `TestKillSwitchFailsClosedBeforeProvider`, `TestKillSwitchCancellationStaysCancelled`, `TestClarificationSkipsKillSwitchAndReserve`                                                                                                                                                                   |
| 3.6      | `TestRequestBudgetIsNotSummedWithDrainGrace`, metric trong `TestQuotaMappingAndIdempotentFinalize` và `TestRecoveryFinalizesOnceBeforeExpiryAndSkipsAfter`                                                                                                                                                                                   |
| 3.7      | `TestJournalIntentFailureRefundsWithoutProvider`, `TestIntentWriteFailureDoesNotOpenProvider`, `TestTornJournalDoesNotFinalize`, `TestRecoveryFinalizesOnceBeforeExpiryAndSkipsAfter`, `TestRecoveryOfIntentWithoutObservationIsUnknown`, `TestOverlappingReserveDoesNotCallQuotaTwice`, `TestIntentRefundFailureIsReturnedAndClaimReleased` |
