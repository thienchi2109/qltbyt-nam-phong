# Chunk 5.5 - Evidence

## Phạm vi

- Ngày 2026-09-15; baseline exact commit `a77c56e45e2530fd0bc88f12b339a5fe5b983230` (`main == origin/main` trước khi sửa).
- Chỉ tích hợp browser/service worker và polish UI: `/notifications`, worker push/click, payload validation/truncation và focused tests.
- Không sửa backend/API/RPC/SQL/migration, không gửi push, không bật controls, không deploy và không live write. `tasks.md` đánh dấu 5.5 sau khi evidence được review.

## TDD evidence

- RED worker: chạy `worker-payload.test.ts` và `worker-events.test.ts` trước khi thêm helper; 2 test suites fail khi Vite không resolve được `../worker-payload` và `../worker-events`.
- RED accessibility: test landmark fail trước khi page có accessible name cho `<main>`.
- GREEN worker: `worker-payload.test.ts` và `worker-events.test.ts` pass, 11 tests tổng cộng sau khi bổ sung các trường hợp payload/click.

## Implementation

- `src/lib/web-push/worker-payload.ts` validate exact wire v1 keys, UUID, canonical repair deep link, tag/request ID, same-origin click URL và cắt UTF-8 an toàn theo code point.
- `src/lib/web-push/worker-events.ts` chỉ hiển thị text đã validate; click đóng notification rồi navigate/focus client cùng origin hoặc `openWindow` deep link để auth/quyền hiện hành quyết định.
- `src/sw.ts` nối `push` và `notificationclick` vào `/sw.js` Serwist hiện có; không thêm worker/scope hoặc foreground display handler thứ hai.
- `src/app/(app)/notifications/page.tsx` thêm accessible page landmark/title/description và `min-w-0` cho layout responsive; dialog bell, password/logout và route placement giữ nguyên.

## Verification

- Ordered gates: `format:check`, `verify:no-explicit-any`, `verify:dedupe` và `typecheck` đều PASS.
- Focused suite: 12 files / 87 tests PASS, gồm 5.1–5.4 regression tests, bell/layout/deep-link contracts và 11 worker tests.
- React Doctor diff scan: 100/100, no issues; Code Review Graph risk `0.35` (low) và GitNexus không phát hiện affected process.
- Production build: compile PASS, static pages `44/44` generated; Serwist bundled `/sw.js` với scope `/`.

## Giới hạn

- Browser/platform smoke authenticated chưa chạy được do môi trường auth; không claim Chrome/Edge/Firefox/Android/iOS platform PASS.
- Chưa xác nhận permission thực tế, foreground/background delivery, click trên thiết bị, provider acceptance/delivery/read hoặc logout/revoke live behavior.
- Graph review còn báo untested `NotificationsPageContent` và `WorkerGlobalScope`; focused DOM/worker event contracts đã chạy, nhưng browser runtime vẫn cần kiểm chứng ở phase readiness.
