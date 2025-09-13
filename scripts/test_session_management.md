# 🔧 TEST SESSION MANAGEMENT MỚI

## ✅ **Những gì đã thay đổi:**

### 1. **Token thật được lưu trong localStorage**
- Token chứa thông tin user và thời gian hết hạn
- Format: Base64 encoded JSON với:
  ```json
  {
    "user_id": 1,
    "username": "admin", 
    "role": "admin",
    "khoa_phong": "IT",
    "full_name": "Admin User",
    "created_at": 1640995200000,
    "expires_at": 1641006000000  // 3 tiếng sau
  }
  ```

### 2. **Session validation mỗi phút**
- Kiểm tra token local mỗi phút (không cần gọi server)
- Cảnh báo khi còn 5 phút
- Auto-logout khi hết hạn với thông báo rõ ràng

### 3. **Thông báo cho user**
- **Cảnh báo:** "Phiên làm việc sẽ hết hạn trong X phút"
- **Auto-logout:** "Phiên làm việc đã hết hạn. Bạn đã được đăng xuất tự động sau 3 tiếng"

## 🚀 **Cách test:**

### **BƯỚC 1: Restart ứng dụng**
```bash
# Dừng server (Ctrl+C)
npm run dev
```

### **BƯỚC 2: Test login**
1. Đăng nhập vào ứng dụng
2. Kiểm tra localStorage có token mới (F12 → Application → Local Storage)
3. Token sẽ có format dài (Base64)

### **BƯỚC 3: Test session persistence**
1. Refresh trang nhiều lần → không bị logout
2. Đóng browser và mở lại → vẫn đăng nhập
3. Session sẽ tồn tại đúng 3 tiếng

### **BƯỚC 4: Test auto-logout (optional)**
Để test nhanh, có thể tạm thời giảm thời gian session:

```javascript
// Trong auth-context.tsx, dòng 141, thay:
expires_at: Date.now() + (3 * 60 * 60 * 1000) // 3 hours
// Thành:
expires_at: Date.now() + (2 * 60 * 1000) // 2 phút để test
```

## 📊 **Debug session:**

### **Xem thông tin session hiện tại:**
```javascript
// Chạy trong Console (F12)
const token = localStorage.getItem('auth_session_token');
if (token) {
  const sessionData = JSON.parse(atob(token));
  console.log('Session data:', sessionData);
  console.log('Expires at:', new Date(sessionData.expires_at));
  console.log('Time left:', Math.round((sessionData.expires_at - Date.now()) / 1000 / 60), 'minutes');
}
```

### **Kiểm tra session validation:**
- Mở Console (F12)
- Mỗi phút sẽ thấy session được check
- Khi còn 5 phút sẽ có cảnh báo
- Khi hết hạn sẽ có thông báo logout

## ✅ **Kết quả mong đợi:**

1. ✅ **Không còn logout sau 5 phút**
2. ✅ **Session tồn tại đúng 3 tiếng**  
3. ✅ **Thông báo rõ ràng khi auto-logout**
4. ✅ **Cảnh báo trước khi hết hạn**
5. ✅ **Không cần gọi server để validate**

## 🔒 **Bảo mật:**

- Token được Base64 encode (không phải encryption)
- Chấp nhận rủi ro như bạn yêu cầu
- Đơn giản và hiệu quả
- Không ảnh hưởng performance

Giải pháp này đơn giản, hiệu quả và giải quyết được vấn đề auto-logout không mong muốn!
