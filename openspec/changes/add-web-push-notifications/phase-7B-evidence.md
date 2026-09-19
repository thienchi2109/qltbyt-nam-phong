# Phase 7B Evidence

## Phạm vi

- Kiểm chứng lifecycle session cho browser/PWA Web Push: logout thường, session expiry, relogin cùng owner, remount/reload và chuyển A → B.
- Giữ cleanup/revoke cho `forced_password_change` và Disable; không mở rộng sang worker, DB, staging, deploy hoặc browser E2E.

## RED → GREEN

- Focused lifecycle ban đầu: `7` tests, `5 PASS / 2 RED`; logout và mounted expiry vẫn gọi `unsubscribe()`.
- Auth/provider RED: `16` tests, `13 PASS / 3 RED`.
- Reload ownership RED: browser lifecycle `7` tests, `5 PASS / 2 RED`; mount mới của B chưa cleanup owner A.
- Probe-error RED: browser lifecycle `8` tests, `7 PASS / 1 RED`; probe service worker bị reject vẫn cho barrier đi qua.
- Sau khi sửa, policy được kiểm chứng: logout/expiry thường giữ record và delivery eligibility; relogin cùng owner không cần enable lại; owner mới chờ cleanup persisted owner hợp lệ; cleanup/probe lỗi chặn owner mới; Disable và `forced_password_change` vẫn cleanup/revoke.

## Validation

- Luna validation: `10` files, `76 PASS`.
- Parent independent validation: `4` files, `27 PASS`.
- Gates PASS: `format:check`, `verify:no-explicit-any`, `verify:dedupe`, `typecheck`, React Doctor `100/100`, `git diff --check`.
- Focused command:
  `node scripts/npm-run.js run test:run -- src/lib/__tests__/auth-signout.test.ts src/providers/__tests__/session-provider.test.tsx src/lib/web-push/__tests__/browser-lifecycle.test.ts 'src/app/(app)/notifications/__tests__/NotificationsPushOptInLifecycle.test.tsx' 'src/app/(app)/__tests__/AppLayoutShell.test.tsx' 'src/app/(app)/__tests__/AppLayoutShell.logout-stale.test.tsx' 'src/app/(app)/__tests__/AppLayoutShell.expert-isolation.test.tsx' 'src/app/(app)/__tests__/AppLayoutShell.react-doctor-source.test.ts' src/lib/web-push/__tests__/worker-events.test.ts src/lib/__tests__/app-route-access.test.ts`
- Không có test log bền vững; các kết quả trên là command/result được ghi lại từ lượt validation.

## Semantic deduplication evidence

- Capability được tìm trước khi ghi handoff: giữ subscription browser/PWA theo owner qua auth transitions, cô lập owner khi A → B, và chặn owner mới khi cleanup/probe chưa an toàn.
- Đã áp dụng skill `code-deduplication`. Code Review Graph `get_minimal_context` trả `status=ok`, graph `18,268 nodes / 215,489 edges`, build và HEAD cùng `6049761ddd11457114601083e810c432f047bf05`; GitNexus repo `qltbyt-nam-phong` cũng được index ở commit này.
- Semantic search với câu mô tả nghiệp vụ trả `0 node` vì graph tìm theo name/path/signature, không đọc source text. Đây là giới hạn của kết quả, không phải bằng chứng không có code tương tự.
- Exact graph/GitNexus queries tìm thấy capability đang sở hữu contract: `browser-lifecycle.ts` có `storageKey`, `isValidRecord`, `readBrowserSubscriptionRecord`, `writeBrowserSubscriptionRecord`, `removeBrowserSubscriptionRecord`, `cleanupBrowserSubscription`, `discardLocalBrowserSubscription`, `waitForPendingBrowserSubscriptionCleanup`, `hasMatchingLocalBrowserSubscription`; callers gồm `NotificationsPushOptIn`, `signOutWithReason`, `AuthSignoutBroadcastListener` và retry path.
- Vì runtime diff còn uncommitted, graph không được rebuild. Exact searches cho `readStoredBrowserSubscriptionOwnerIds` và `probeMatchingLocalBrowserSubscription` trả `0 node`; hai symbol mới này được kiểm chứng bằng diff/`rg` trực tiếp và focused tests, không claim graph đã index chúng.
- `rg` được dùng để backstop JSX/import edges và uncommitted diff. Quyết định reuse: giữ record validation, local discard, cleanup/revoke và service-worker probe trong module `src/lib/web-push/browser-lifecycle.ts`; provider chỉ điều phối owner transition, không tạo storage key, revoke path hoặc helper thứ hai. Validator/API revoke hiện có tiếp tục được dùng.
- Không tạo shared utility mới; các test lifecycle/provider bảo vệ contract vừa nêu. GitNexus có thể under-report JSX/import edges, nên không dùng graph để claim coverage đầy đủ.

## Giới hạn

- Chưa có real provider/logout E2E hoặc full browser auth matrix.
- Old-owner inference chỉ có tác dụng khi persisted subscription record còn hợp lệ; browser không có record hợp lệ thì không thể suy ra owner cũ.
- Protected notification detail vẫn yêu cầu auth/authorization; chưa claim navigation E2E.
- Không claim toàn bộ Phase 7B/Phase 8 hoàn tất; artifact worker lịch sử, canary `535` và waiver DB `FAILED/INCOMPLETE` giữ nguyên boundary cũ.
