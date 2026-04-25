# Playbook Rollback AI Provider Trên Vercel

Tài liệu này lưu sẵn **2 bộ lệnh Vercel CLI** để chuyển `default_chat` về Google khi cần rollback.

Mục tiêu của tài liệu này là:

- lưu sẵn lệnh để dùng về sau
- giải thích rõ khi nào dùng từng bộ
- tránh phải nhớ thủ công biến nào cần xóa, biến nào cần giữ

Tài liệu này **không tự áp dụng thay đổi**. Chỉ chạy các lệnh bên dưới khi anh/chị thực sự muốn rollback.

## Trạng thái hiện tại của Production

Tại thời điểm viết tài liệu này, production đang có cả:

- path mới `openai-compatible`
- bộ biến legacy của Google
- `AI_GATEWAY_API_KEY`

Điều đó có nghĩa là rollback sang Google không cần thêm code, chỉ cần đổi env và redeploy.

## Chọn đường rollback nào?

### 1. Rollback về Google trực tiếp

Dùng khi:

- cần rollback nhanh nhất
- muốn quay về path cũ đã chạy trước đây
- muốn giữ khả năng `key-pool rotation`

Đây là đường rollback **đơn giản nhất**.

### 2. Rollback về Google qua Gateway

Dùng khi:

- vẫn muốn ở transport `gateway`
- chỉ muốn đổi provider/model về Google trong cùng contract gateway
- đã có `AI_GATEWAY_API_KEY` hợp lệ

Đường này hợp lý nếu mục tiêu là giữ transport gateway, nhưng không phải rollback ít rủi ro nhất.

## Chuẩn bị trước khi chạy

1. Đăng nhập Vercel CLI:

```bash
vercel login
```

2. Chạy trong thư mục repo đã link với project Vercel:

```bash
cd /root/qltbyt-nam-phong
```

3. Kiểm tra lại env production hiện tại:

```bash
vercel env ls production
```

## Bộ lệnh 1: Rollback về Google trực tiếp

### Ý nghĩa

Bộ lệnh này:

- tắt path `openai-compatible`
- bỏ capability-specific path đang override production
- giữ / đặt lại legacy Google path

Sau khi chạy xong, deploy mới sẽ dùng:

- `AI_PROVIDER=google`
- `AI_MODEL=gemini-3.1-flash-lite-preview`
- `GOOGLE_GENERATIVE_AI_API_KEY` hoặc `GOOGLE_GENERATIVE_AI_API_KEYS`

### Lưu ý trước khi chạy

- Thay `YOUR_GOOGLE_API_KEY` bằng key thật nếu anh/chị muốn dùng single-key mode.
- Nếu anh/chị muốn dùng key-pool rotation, bỏ dòng add `GOOGLE_GENERATIVE_AI_API_KEY` và dùng `GOOGLE_GENERATIVE_AI_API_KEYS` thay thế.
- Các lệnh `rm` có thể báo biến không tồn tại nếu production đã khác trạng thái hiện tại. Điều đó không sao, chỉ cần kiểm tra lại cuối cùng bằng `vercel env ls production`.

### Single-key mode

```bash
vercel env rm AI_DEFAULT_CHAT_PROVIDER production --yes
vercel env rm AI_DEFAULT_CHAT_MODEL production --yes
vercel env rm AI_OPENAI_COMPATIBLE_BASE_URL production --yes
vercel env rm AI_OPENAI_COMPATIBLE_API_KEY production --yes

printf 'google\n' | vercel env add AI_PROVIDER production
printf 'gemini-3.1-flash-lite-preview\n' | vercel env add AI_MODEL production
printf 'YOUR_GOOGLE_API_KEY\n' | vercel env add GOOGLE_GENERATIVE_AI_API_KEY production
```

### Key-pool mode

```bash
vercel env rm AI_DEFAULT_CHAT_PROVIDER production --yes
vercel env rm AI_DEFAULT_CHAT_MODEL production --yes
vercel env rm AI_OPENAI_COMPATIBLE_BASE_URL production --yes
vercel env rm AI_OPENAI_COMPATIBLE_API_KEY production --yes

printf 'google\n' | vercel env add AI_PROVIDER production
printf 'gemini-3.1-flash-lite-preview\n' | vercel env add AI_MODEL production
printf 'KEY_A,KEY_B,KEY_C\n' | vercel env add GOOGLE_GENERATIVE_AI_API_KEYS production
```

### Sau khi chạy

1. Kiểm tra lại env:

```bash
vercel env ls production
```

2. Redeploy production.

3. Smoke test `/api/chat`.

## Bộ lệnh 2: Rollback về Google qua Gateway

### Ý nghĩa

Bộ lệnh này:

- bỏ path `openai-compatible`
- chuyển production sang transport `gateway`
- dùng model Google ở format provider-prefixed

Sau khi chạy xong, deploy mới sẽ dùng:

- `AI_DEFAULT_CHAT_PROVIDER=gateway`
- `AI_DEFAULT_CHAT_MODEL=google/gemini-3.1-flash-lite-preview`
- `AI_GATEWAY_API_KEY`

### Lưu ý trước khi chạy

- Bộ lệnh này giả sử `AI_GATEWAY_API_KEY` đã có giá trị hợp lệ.
- Nếu cần thay key gateway, xóa và add lại `AI_GATEWAY_API_KEY` trước khi redeploy.
- Path này **không** dùng key-pool rotation của Google.

### Lệnh rollback

```bash
vercel env rm AI_OPENAI_COMPATIBLE_BASE_URL production --yes
vercel env rm AI_OPENAI_COMPATIBLE_API_KEY production --yes

vercel env rm AI_DEFAULT_CHAT_PROVIDER production --yes
vercel env rm AI_DEFAULT_CHAT_MODEL production --yes

printf 'gateway\n' | vercel env add AI_DEFAULT_CHAT_PROVIDER production
printf 'google/gemini-3.1-flash-lite-preview\n' | vercel env add AI_DEFAULT_CHAT_MODEL production
```

### Nếu cần thay luôn gateway key

```bash
vercel env rm AI_GATEWAY_API_KEY production --yes
printf 'YOUR_GATEWAY_API_KEY\n' | vercel env add AI_GATEWAY_API_KEY production
```

### Sau khi chạy

1. Kiểm tra lại env:

```bash
vercel env ls production
```

2. Redeploy production.

3. Smoke test `/api/chat`.

## Cách dùng an toàn

Nếu anh/chị cần thao tác thật, nên đi theo thứ tự này:

1. Copy đúng bộ lệnh phù hợp.
2. Thay các placeholder key thật.
3. Chạy từng lệnh một.
4. Sau khi xong, chạy:

```bash
vercel env ls production
```

5. Xác nhận các biến đúng như mong muốn.
6. Redeploy.
7. Kiểm tra chat production.

## Gợi ý thực tế

Trong tình huống rollback khẩn cấp:

- ưu tiên **Google trực tiếp**
- chỉ dùng **Google qua gateway** nếu anh/chị muốn giữ transport gateway vì lý do vận hành riêng

Lý do là production trước đó đã có lịch sử chạy ổn trên direct Google path, nên đây là đường rollback có ít moving parts nhất.
