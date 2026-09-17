# Phase 6.5 Handoff

- Harness source sau correction tại commit `ac1289ec5e2569ac45d0d1a51dc9c9d4c0fc448e`: `ops/web-push/chunk-6.5-smoke.mjs`, cleanup helper và fault-injection regression.
- Runtime artifact kiểm chứng là source commit `280bbead03d0dcd3114687f6e3dee7a51296c6ca`, image `qltbyt-web-push:280bbead03d0`, ID `sha256:35fe490293289ad7d2f9c1882c0c08f81a013bfac78adb8873f2601b42717e91`, `RepoDigests=[]`.
- Normal smoke với `WEB_PUSH_EXPECTED_IMAGE_ID`: `PASS`, exit `0`; output ghi `requestedImage` riêng, image ID `sha256:35fe490293289ad7d2f9c1882c0c08f81a013bfac78adb8873f2601b42717e91`, direct/filesystem container assert immutable ID; restart cùng container/mount giữ nguyên secret bytes/hash, readiness `paused`, delivery metric `0`; cleanup direct/Compose/temp được verify.
- Regression command `node ops/web-push/chunk-6.5-smoke-regression.mjs`: PASS; baseline image prerequisite, activation marker và expected stage được kiểm tra cho history/layer-list/cleanup-rm/Compose-stop/Compose-down/stderr-secret; container/network baseline giữ nguyên. Immutable-tag guard PASS.
- Negative command với `WEB_PUSH_EXPECTED_IMAGE_ID=sha256:` + 64 số `0`: exit `1`, không in regression `PASS`; đây là bằng chứng harness không chấp nhận child fail ở sai preflight.
- RED evidence trước correction: wrong image từng làm regression false `PASS`; log audit bỏ stderr; operation sau image audit còn dùng mutable tag. GREEN tại harness commit `ac1289ec5e2569ac45d0d1a51dc9c9d4c0fc448e`.
- Gates: format, no-explicit-any, diff-only dedupe, typecheck, React Doctor `100/100` PASS. Go test/vet/build giữ nguyên PASS đã kiểm chứng trước đó; runtime Go không đổi.
- Giới hạn: mock-only/paused, không provider thật, browser, SQL/live DB, Oracle, deploy, Phase 7 hoặc Phase 8; audit không claim arbitrary-secret absence.
- 6.5 checkbox vẫn pending independent review của parent; không tự tick hoặc diễn giải phase khác.
