# Temperature Monitoring — vận hành staging riêng trên Oracle

**Trạng thái 2026-10-19:** owner đã yêu cầu dừng test và dọn staging. Instance/clone/service/container/source/private env bên dưới đã bị xóa; tunnel đã dừng. Đây là runbook dựng lại, không có instance hiện đang chạy. [Báo cáo và bằng chứng cleanup](../reports/temperature-monitoring-tm10-staging-smoke-2026-10-19.md).

Runbook cho instance ngày 19/10/2026 và quy trình tạo lại có kiểm soát. Staging giữ dữ liệu và tài khoản của bản clone theo yêu cầu chủ sở hữu; không xóa/mask dữ liệu, tạo user hay reset mật khẩu. Tài khoản trong snapshot không chứng minh trạng thái tài khoản live hôm nay. Chỉ truy cập qua SSH tunnel riêng, không public app/API/DB.

## Instance đã tháo dỡ và bằng chứng lịch sử

| Thành phần              | Giá trị                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Oracle                  | `ubuntu@149.118.148.179`                                                                     |
| Thư mục riêng           | `/home/ubuntu/qltbyt-tm10-staging-20261019`                                                  |
| Source                  | `source/`, commit `834aafee8059c7142a629a01d5f24b6992ecf71c`                                 |
| Clone                   | `tm10_staging_20261019_a834aafee`, nguồn `qltbyt_test`                                       |
| App                     | user service `qltbyt-tm10-staging`, bind `127.0.0.1:3100`                                    |
| API / REST              | `tm10-staging-api` / `tm10-staging-rest`, API bind `127.0.0.1:18110`                         |
| Images / network có sẵn | `kong/kong:3.9.3`, `postgrest/postgrest:v14.12`; `supabase_default`                          |
| Tài nguyên              | app: RAM 2 GiB, CPU 100%, nice 10; mỗi container: RAM 512 MiB, CPU 1                         |
| Node build/start        | `/home/ubuntu/.nvm/versions/node/v24.15.0/bin/node`                                          |
| Script của lần chạy     | `app.py`, `setup.py`, `verify.py` đã bị xóa khi cleanup; không có runner đóng gói trong repo |
| Private                 | `private/`: cấu hình, secrets và log; không in/chia sẻ nội dung                              |
| Evidence đã sao lưu     | `docs/reports/temperature-monitoring-tm10-staging-evidence-2026-10-19/` trong repo           |

Lead xác nhận build và smoke **PASS**: trang login HTTP 200, provider credentials và CSRF có mặt, route `/temperature-monitoring` chuyển người chưa đăng nhập về `http://localhost:3100/?callbackUrl=…`; listener app/API đều loopback. `readiness.json` chỉ chứa commit/database/boolean, có thể dùng cho bàn giao nội bộ. Không chia sẻ token CSRF/cookie/log riêng.

Identity RPC tạm chỉ cho service-role đã chứng minh API thực sự nối đúng clone, sau đó được drop. Username không tồn tại bị từ chối; hash toàn bộ tài khoản khớp baseline và số lượng baseline không đổi. GET export trả 405 là đúng với POST route, không phải bằng chứng auth.

Browser smoke bổ sung do lead thực hiện qua SSH tunnel: đăng nhập tài khoản được cung cấp bằng auth vault thành công đến `/dashboard`, session role `to_qltb`; Equipment tải được, `/temperature-monitoring` có empty state ca và điều khiển Lịch sử 30 ngày. Mobile 375×812 không tràn ngang. Không ghi username, mật khẩu hoặc chi tiết cá nhân/đơn vị trong evidence chia sẻ.

Empty-state smoke ban đầu có export HTTP 200/9.239 byte, đúng XLSX MIME/ZIP header; ExcelJS reload được 6 sheet và Readings rỗng. Sau đó user yêu cầu bật thiết bị và ghi ngay: tài khoản `to_qltb` không có thiết bị trong khoa phòng chuẩn hóa của mình; chọn dòng Equipment có sẵn bị temperature scope trả 403 đúng guard. Không đổi tài khoản/quyền để vượt guard.

Lead tạo thiết bị fixture có nhãn `TM10-STAGING-20261019`, ID `9679`, qua authenticated BFF `equipment_create` (**không phải** tạo thành công qua Equipment add UI). UI Equipment detail → Config lưu bật theo dõi 2–8°C, primary là actor hiện tại, policy tương lai hiệu lực `2026-10-20T00:00+07`. Hợp đồng kích hoạt ban đầu từ nửa đêm kế tiếp không cho ghi cùng ngày. Sau khi giải thích fixture cho user, lead append policy lịch sử **chỉ cho thiết bị fixture trong clone** bằng SQL DML có audit reason, đặt current enabled true; không sửa version tương lai bất biến, source, đồng hồ hoặc role. SQL fixture đã được sao lưu vào thư mục evidence trong repo trước cleanup. Lần đầu sai tên bảng đã rollback; lần sửa dùng `public.temperature_readings`.

UI `/temperature-monitoring?equipment=9679` tự mở slot; nhập **5,2°C** và bấm **Lưu số đo** thành công. DB reading `941c3665-0103-4d18-a025-60462d39752d`, ngày 19/10/2026 ca tối 18–22, snapshot 2/8, actor hiện tại. Self-review bị UI chặn; History hiện 5,2/Đã ghi; tên điểm biểu đồ truy cập được khớp reading, chưa nghiệm thu fidelity toàn bộ chart. Export authenticated cho fixture/ngày này trả HTTP 200/11.129 byte; ExcelJS reload 6 sheet xác nhận **đúng 1 dòng reading**, ID khớp, 5,2 và snapshot 2/8, **1 reading event**. Fixture/reading đã bị xóa cùng clone; kết quả lịch sử lưu trong [báo cáo smoke](../reports/temperature-monitoring-tm10-staging-smoke-2026-10-19.md).

Đây là **scoped disposable smoke PASS**, không phải full UAT/app-wide PASS/capacity. Chưa chứng minh amendment, deviation, independent review, high load hoặc races; chart point fidelity và download UX đầy đủ còn mở (browser CLI download-event capture timeout). Formal DB vẫn **INCOMPLETE**.

Dashboard ghi nhận hai lỗi tương thích RPC của snapshot, PostgREST báo không tìm thấy function trong schema cache:

- `public.usage_log_list(p_active_only,p_don_vi,p_equipment_dataset,p_limit)`
- `public.equipment_department_distribution(p_don_vi,p_equipment_dataset,p_khoa_phong_array,p_nguoi_su_dung_array,p_nguon_kinh_phi_array,p_phan_loai_array,p_q,p_tinh_trang_array,p_vi_tri_lap_dat_array)`

Hai gap này còn mở cho preproduction/snapshot compatibility. Không tự sửa baseline, thêm migration hay khẳng định toàn app PASS để bỏ qua chúng.

19 migration Temperature Monitoring được áp dụng **chỉ trên clone**. Compatibility helper `ai_readonly.try_parse_iso_date(text)` lấy từ `supabase/migrations/20260426090000_expand_ai_readonly_equipment_reporting_surface.sql`; quyền `CREATE` schema `public` cho `postgres` được cấp tạm rồi thu hồi trên clone. Đây là chuẩn bị disposable, không phải formal gate. Formal **static INCOMPLETE**, **baseline-forward INCOMPLETE**; build Next có bỏ type/lint nội bộ nên không thay các gate riêng.

## Mở từ máy cá nhân

Chạy trên **máy của người dùng**, dùng đường dẫn private key của máy đó. `/root/Oracle/...` là đường dẫn trên Codex VPS, không phải key mặc định trên máy cá nhân. Xác minh host key theo kênh đã tin cậy; không tắt kiểm tra host key.

```bash
ssh -i /duong-dan/key-tren-may-cua-ban \
  -N -o ExitOnForwardFailure=yes \
  -L 127.0.0.1:3100:127.0.0.1:3100 \
  -L 127.0.0.1:18110:127.0.0.1:18110 \
  ubuntu@149.118.148.179
```

Giữ terminal tunnel mở, dùng browser profile riêng và mở **`http://localhost:3100`**. Public Supabase URL của build là `http://127.0.0.1:18110`, vì vậy cần cả hai forward. NextAuth 4 dùng `NEXTAUTH_URL=http://localhost:3100` và `NEXTAUTH_URL_INTERNAL=http://127.0.0.1:3100`; `AUTH_URL` không thay thế hai biến này. Không dùng cookie/session live. Đăng nhập bằng tài khoản/mật khẩu có trong snapshot; không tạo/reset user nếu đăng nhập thất bại. Không đưa dữ liệu thật vào ảnh, export, HAR hay báo cáo chia sẻ.

URL fixture UAT của lần chạy đã tháo dỡ là `http://localhost:3100/temperature-monitoring?equipment=9679`; hiện không còn phục vụ. Lần dựng mới dùng ID fixture mới. Policy lịch sử là chuẩn bị riêng của lần test này; không copy bước đó sang live hoặc dùng để thay hợp đồng kích hoạt nửa đêm.

Nếu cổng local đang bận, đóng tunnel cũ hoặc tiến trình của chính mình dùng cổng đó. Không đổi riêng cổng tunnel rồi giả định auth/public API build vẫn đúng; đổi topology cần đồng bộ cấu hình và build lại.

### Browser CLI riêng trên Codex VPS

Lần smoke này dùng `/usr/bin/agent-browser` cùng `/usr/bin/google-chrome` trên Codex VPS, session riêng `tm10-staging`, đi qua loopback SSH tunnel tương tự phía trên. Không dùng hoặc thay đổi browser container đang có trên Oracle. Chỉ chạy khi tunnel đang nối đúng staging.

```bash
agent-browser --session tm10-staging --executable-path /usr/bin/google-chrome auth login tm10-staging
agent-browser --session tm10-staging get url
agent-browser --session tm10-staging close
```

Auth profile tạm `tm10-staging` đã bị xóa và session browser đã đóng sau smoke. Trong lần dựng mới, owner nạp username riêng từ nguồn private, mật khẩu qua `agent-browser auth save` với **`--password-stdin`**, tắt shell tracing và không log input/output nhạy cảm; không đặt giá trị credential trực tiếp trong lệnh, docs hay chat. Không dùng `--password` hoặc lệnh `fill` chứa mật khẩu. Không dump auth/session/cookies, page snapshot hay screenshot có dữ liệu thật; báo cáo chỉ trạng thái và URL/role đã loại thông tin cá nhân. `close` đóng session browser này, không xóa tài khoản clone hoặc tự xóa vault của người dùng.

## Mẫu kiểm tra và restart cho instance đang tồn tại

Instance ngày 19/10 đã bị xóa; không chạy các lệnh dưới để khôi phục nó. Sau khi dựng instance mới, đổi tên/path cho đúng run và SSH vào Oracle với user `ubuntu`. Chỉ dùng mẫu dưới khi root/service/container/clone vẫn tồn tại và đã xác minh identity; không chạy lại setup để “restart”. Không in env, `app-env.json`, Docker inspect toàn bộ hay log có credential.

```bash
systemctl --user is-active qltbyt-tm10-staging.service
systemctl --user show qltbyt-tm10-staging.service \
  -p ActiveState -p SubState -p MemoryMax -p CPUQuotaPerSecUSec -p Nice
docker inspect --format '{{.Name}} {{.State.Status}}' tm10-staging-rest tm10-staging-api
ss -ltn '( sport = :3100 or sport = :18110 )'
```

Nếu container còn tồn tại nhưng đã stop, khởi động đúng hai container theo thứ tự REST rồi API. Không restart container Supabase nền.

```bash
docker start tm10-staging-rest
docker start tm10-staging-api
```

Nếu user unit vẫn được load:

```bash
systemctl --user restart qltbyt-tm10-staging.service
```

Nếu transient unit đã mất sau logout/reboot, kiểm tra source/private config/clone/container còn đúng identity rồi tạo lại unit bằng lệnh đã dùng:

```bash
systemd-run --user --unit qltbyt-tm10-staging \
  --property=MemoryMax=2G --property=CPUQuota=100% --property=Nice=10 \
  --property=Restart=on-failure --property=RestartSec=5 \
  /usr/bin/python3 /home/ubuntu/qltbyt-tm10-staging-20261019/app.py start
```

Không có cam kết autostart qua reboot. Nếu unit tên này tồn tại nhưng lỗi, kiểm tra trạng thái trước; không tạo tên service mới để che lỗi. Kiểm tra listener vẫn đúng `127.0.0.1` và mở browser qua tunnel; nếu DB/API identity không còn xác minh được thì dừng UAT. Chỉ đọc log riêng sau khi biết cách che dữ liệu/secret.

## Stop, giữ nguyên dữ liệu

Đóng app trước API/REST. Các lệnh này **không xóa clone/tài khoản/config**:

```bash
systemctl --user stop qltbyt-tm10-staging.service
docker stop tm10-staging-api
docker stop tm10-staging-rest
```

Đóng terminal SSH tunnel trên máy cá nhân. Không cleanup network `supabase_default`, image, `node_modules` dùng chung, baseline hay các container khác; không `docker system prune`/mass prune. Không xóa clone để xử lý lỗi login/startup.

## Tạo lại với source mới: checklist cho owner

Đây là quy trình có checkpoint, không phải script generic/idempotent. Các one-run runner `setup.py`, `app.py`, `verify.py` đã bị xóa cùng thư mục staging khi cleanup; chúng không được đóng gói trong repo. Lần dựng mới cần tạo/review runner hoặc thực hiện thủ công theo checklist dưới; các lệnh gọi `app.py` chỉ là mẫu sau khi chuẩn bị runner, không thể chạy ngay trên VM đã dọn. Clone đã tồn tại phải fail closed, không drop/ghi đè.

1. Chốt quyền và identity: exact source SHA, baseline snapshot/health, migration manifest kèm SHA-256, run ID mới, tên DB/container/service/root/port riêng. Mặc định không đổi hoặc xóa instance cũ. Dùng [kế hoạch TM-10](../plans/2026-10-19-temperature-monitoring-tm10-plan.md) cho acceptance và [formal Oracle gate](db-quality-gate-oracle.md) cho certification; không sửa baseline để vượt gate.
2. Kiểm tra port/tên trống, disk/RAM/CPU đủ, SSH host key đúng, images/network đã có. Source checkout/tar phải khớp exact SHA, không mang `.env.local`, `.next`, secret hay artifact từ source khác. Lưu manifest source/lockfile/migration/test hash trong evidence; không ghi connection URI/token.
3. Tạo thư mục `source/`, `private/`, `evidence/` riêng; `private/` chỉ owner đọc. Chuyển tài liệu secret riêng `/root/docs/AUTH_SECRET_CVMEMS.md` từ Codex VPS qua SSH bảo mật, không paste vào shell/history/docs. Thư mục `/root/docs` không phải nguồn có sẵn trên Oracle hoặc máy cá nhân. Giữ tài liệu/secret bên ngoài Git và log.
4. Tạo clone mới từ `qltbyt_test` bằng thủ tục Oracle đã duyệt, xác nhận `current_database()` là tên mới trước mọi thay đổi. Giữ dữ liệu/tài khoản/password snapshot; không wipe/mask/reset/tạo user. Ghi baseline counts và account-hash digest riêng trước/sau, không in row/password hash. Khác snapshot có thể khác dữ liệu/login; không hứa tài khoản giống live hôm nay.
5. So sánh manifest pending với clone; áp dụng đúng SQL source đã chốt **chỉ clone**. Lần 19/10 cần helper `ai_readonly.try_parse_iso_date(text)` ở trên và quyền CREATE tạm; source mới phải kiểm tra lại nhu cầu, ghi mọi compatibility step và thu hồi grant tạm. Không áp nguyên migration lịch sử chỉ để lấy một helper, không sửa applied history/baseline. Kết quả compatibility luôn **DISPOSABLE ONLY**.
6. Tạo JWT secret + anon/service tokens riêng, độc lập live. Tạo **container REST mới** trên `supabase_default`, dùng authenticator URI riêng trỏ clone; URI chứa credential giữ trong file private. Lần này chỉ expose schema `public`: baseline không có `graphql_public`, cấu hình schema đó làm REST lỗi. Không thêm schema vào baseline để sửa staging.
7. Tạo **Kong mới** định tuyến `/rest/v1` đến REST mới, publish API vào loopback port riêng. Dùng images có sẵn `postgrest/postgrest:v14.12`, `kong/kong:3.9.3`, RAM 512 MiB/CPU 1 mỗi container. Không pull/build/tag image, đổi image hay restart container cũ; đổi version cần scope riêng. Kiểm tra API không đi vào REST/baseline cũ.
8. Tạo `private/app-env.json` theo allowlist đã review: Supabase URL/anon/service/JWT chỉ của test stack, AUTH_SECRET/NEXTAUTH_SECRET lấy riêng từ tài liệu được cung cấp, NextAuth URL/INTERNAL theo localhost đã chốt. Kiểm tra env kế thừa và `.env*` để loại production overrides; không dump env/config ra terminal. Chặn/kiểm soát Web Push/email/AI/webhook/cron và delivery ngoài hệ thống trước khi dùng dữ liệu clone.
9. Chỉ tái sử dụng symlink `node_modules` có sẵn nếu package-lock SHA-256 khớp **`a89a2fd79446cbf4f26202549965ff9063b7114571229f3045c3c58e8755ab87`** của lần hiện tại và khớp nguồn dependency dùng chung. Nếu source mới khác lockfile, dừng tại prerequisite dependency; không tự install hay sửa thư mục dùng chung. Dùng đúng native Node nêu trên.
10. Chuẩn bị và review runner `app.py` cho root mới để nạp allowlisted env, gọi Next build/start bằng đúng Node và bind loopback; build với giới hạn tài nguyên **trước khi chạy**, rồi mới start app. Lần đầu đã áp giới hạn giữa build; không dùng điều đó làm quy trình chuẩn. Đổi root/run ID trong lệnh mẫu dưới; một user transient unit phải có tên mới, không ảnh hưởng app cũ.

```bash
systemd-run --user --wait --pipe --unit qltbyt-tm10-build-RUN \
  --property=MemoryMax=6G --property=MemorySwapMax=0 \
  --property=CPUQuota=100% --property=Nice=19 --property=CPUAffinity=0 \
  /usr/bin/python3 /home/ubuntu/qltbyt-tm10-staging-NEW/app.py build
```

`RUN`/`NEW` là placeholder bắt buộc thay. Owner xác minh CPU 0 nằm trong affinity được cấp trước khi dùng; thiếu controller/quota thì dừng, không build không giới hạn. Build cgroup của lần hiện tại là `/sys/fs/cgroup/tm10-staging-build` (`cpu.max=100000 100000`, RAM 6 GiB, swap 0). `--pipe` có thể trả log nhạy cảm: giữ output trong kênh/file private. Typecheck/test/security/DB gate vẫn phải chạy riêng theo scope đã được duyệt.

11. Start bằng user service có giới hạn như phần restart, dùng root/service/port mới đã review. Xác nhận listener loopback, container resource caps, app SHA/build identity. Qua **cùng API mà app dùng**, xác minh DB clone bằng identity RPC tạm chỉ service-role, rồi drop RPC và xác nhận không còn tồn tại; không để endpoint chẩn đoán privileged lâu dài. Review `verify.py` trước nếu tái dùng, không coi nó là health probe chỉ đọc.
12. Smoke login page/provider/CSRF, unauth redirect và username không tồn tại bị từ chối. Kiểm tra baseline counts/account-hash digest không đổi, clone giữ tài khoản đúng snapshot; viết sanitized `readiness.json` với SHA/DB/boolean và giới hạn chứng minh. Sau đó mới test đăng nhập thành công/browser UAT theo [TM-10](../plans/2026-10-19-temperature-monitoring-tm10-plan.md). UAT/account mutation hoặc fixture mới chỉ theo scope riêng đã duyệt.

## Xóa một lần chạy: chỉ khi được yêu cầu riêng

Stop không đồng nghĩa xóa. Chỉ cleanup phá hủy khi có chỉ đạo rõ cho đúng run. Ngày 2026-10-19 owner đã yêu cầu dọn sạch instance này sau kiểm thử, thay thế yêu cầu giữ clone trước đó. Ghi lại root/DB/container/service identity, lưu evidence sanitized ra ngoài root, chụp ID/StartedAt/restart count/health của container khác và ID/tag/digest image; stop app/API/REST trước, kiểm tra không còn client. Chỉ remove đúng container mới của run, không xóa volume/network/image dùng chung. Khi so sánh image, loại trường đếm container tham chiếu vì cleanup làm thay đổi số đếm này.

DB owner dùng kết nối quản trị private theo `/root/Oracle/supabase-test.md` (Codex VPS) hoặc `/opt/supabase-test/TEST-DB.md` (Oracle); kiểm tra tên clone trong `pg_database` và đối chiếu manifest. Tên `qltbyt_test`, live hoặc DB ngoài run đều bị loại. Chỉ sau khi identity/authorization khớp mới drop **đúng DB clone đã chỉ định**, rồi read-back `pg_database` phải trả count 0 cho tên đó. Không blanket-prefix drop; không in URI/password. Không xóa `source/private/evidence` bằng lệnh rộng; giữ evidence sanitized theo quyết định owner.

## Giới hạn bàn giao

Staging hoạt động trên disposable clone không phải production rollout và không chứng nhận formal DB gate. **PASS** phải ghi rõ check/SHA/evidence; thiếu test/login/timing là **INCOMPLETE**. Manual readings không phải giám sát sensor liên tục. Export vẫn một năm lịch, giới hạn UI 90 ngày riêng; các ceiling 100.000 dòng/25 MiB/60 giây và limiter process-local không phải capacity đã đo. Theo dõi readiness bằng evidence hiện tại cộng smoke mới; file readiness cũ không tự chứng minh service còn chạy sau reboot.
