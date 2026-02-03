# Hướng dẫn sử dụng: Quản lý Định mức Thiết bị Y tế

> **Căn cứ pháp lý:**
> - Thông tư 08/2019/TT-BYT: Danh mục phân loại trang thiết bị y tế
> - Thông tư 46/2025/TT-BYT: Tiêu chuẩn định mức trang thiết bị y tế
> - Nghị định 98/2021/NĐ-CP: Phân loại trang thiết bị y tế (A/B/C/D)

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Điều kiện tiên quyết](#2-điều-kiện-tiên-quyết)
3. [Bước 1: Phân loại thiết bị](#3-bước-1-phân-loại-thiết-bị)
4. [Bước 2: Tạo quyết định định mức](#4-bước-2-tạo-quyết-định-định-mức)
5. [Bước 3: Nhập định mức từ Excel](#5-bước-3-nhập-định-mức-từ-excel)
6. [Bước 4: Theo dõi tuân thủ](#6-bước-4-theo-dõi-tuân-thủ)
7. [Câu hỏi thường gặp](#7-câu-hỏi-thường-gặp)

---

## 1. Tổng quan

### Định mức thiết bị là gì?

**Định mức thiết bị y tế** là số lượng tối thiểu và tối đa các loại thiết bị y tế mà một cơ sở y tế cần có để đáp ứng yêu cầu khám chữa bệnh theo quy định của Bộ Y tế.

### Quy trình tổng quan

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         QUY TRÌNH ĐỊNH MỨC THIẾT BỊ                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   BƯỚC 1     │    │   BƯỚC 2     │    │   BƯỚC 3     │              │
│  │  Phân loại   │───►│ Tạo quyết    │───►│ Nhập định    │              │
│  │  thiết bị    │    │ định định mức│    │ mức Excel    │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│         │                                        │                      │
│         │                                        ▼                      │
│         │                              ┌──────────────┐                 │
│         │                              │   BƯỚC 4     │                 │
│         └─────────────────────────────►│ Theo dõi     │                 │
│                                        │ tuân thủ     │                 │
│                                        └──────────────┘                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Vai trò được phép thực hiện

| Vai trò | Phân loại | Tạo quyết định | Nhập định mức | Xem báo cáo |
|---------|-----------|----------------|---------------|-------------|
| Quản trị viên (global) | ✅ | ✅ | ✅ | ✅ |
| Tổ QLTB (to_qltb) | ✅ | ✅ | ✅ | ✅ |
| Kỹ thuật viên (technician) | ❌ | ❌ | ❌ | ✅ |
| Người dùng (user) | ❌ | ❌ | ❌ | ✅ |

---

## 2. Điều kiện tiên quyết

Trước khi bắt đầu, hãy đảm bảo:

### 2.1. Có danh sách thiết bị trong hệ thống

Thiết bị của đơn vị phải được nhập vào hệ thống tại **Quản lý thiết bị** (`/equipment`).

> **Kiểm tra:** Vào menu **Thiết bị** > **Danh sách thiết bị** để xem số lượng thiết bị hiện có.

### 2.2. Có danh mục nhóm thiết bị

Hệ thống đã có sẵn danh mục nhóm thiết bị theo Thông tư 08/2019. Danh mục này được quản lý bởi quản trị viên hệ thống.

### 2.3. Quyền truy cập phù hợp

Bạn cần có vai trò **Tổ QLTB** hoặc **Quản trị viên** để thực hiện các thao tác nhập liệu.

---

## 3. Bước 1: Phân loại thiết bị

### 3.1. Mục đích

Gán từng thiết bị trong danh sách vào nhóm thiết bị tương ứng. Việc này giúp hệ thống biết:
- Thiết bị A thuộc nhóm "Máy X-quang kỹ thuật số"
- Thiết bị B thuộc nhóm "Máy siêu âm 2D"
- ...

### 3.2. Truy cập tính năng

1. Vào menu **Định mức thiết bị** > **Dashboard**
2. Nếu có thiết bị chưa phân loại, bạn sẽ thấy cảnh báo:

```
⚠️ Thiết bị chưa phân loại
Có 50 thiết bị chưa được phân loại định mức.
[Phân loại ngay]
```

3. Nhấn **"Phân loại ngay"** hoặc vào menu **Định mức thiết bị** > **Phân loại thiết bị**

### 3.3. Thao tác phân loại

Màn hình phân loại gồm 2 phần:

```
┌────────────────────────────────┬────────────────────────────────┐
│     THIẾT BỊ CHƯA PHÂN LOẠI    │        DANH MỤC NHÓM           │
├────────────────────────────────┼────────────────────────────────┤
│                                │                                │
│ ☐ Máy X-quang Shimadzu R-100   │ 📁 01 Thiết bị chẩn đoán       │
│ ☐ Máy siêu âm GE Logiq P5      │   📁 01.01 Thiết bị X-quang    │
│ ☐ Monitor Philips MX800        │     📄 01.01.001 Máy X-quang DR│
│ ☐ Máy thở Draeger Evita V300   │     📄 01.01.002 Máy X-quang   │
│ ☐ Bơm tiêm điện Terumo TE-SS   │        di động                 │
│                                │   📁 01.02 Thiết bị siêu âm    │
│ Đã chọn: 0 thiết bị            │     📄 01.02.001 Máy siêu âm 2D│
│                                │                                │
└────────────────────────────────┴────────────────────────────────┘
                    [Gán vào nhóm]    [Bỏ gán]
```

**Cách thực hiện:**

1. **Chọn thiết bị** (bên trái): Tick vào các thiết bị cùng loại
   - VD: Chọn tất cả máy X-quang kỹ thuật số

2. **Chọn nhóm** (bên phải): Nhấn vào nhóm lá phù hợp
   - VD: Chọn "01.01.001 Máy X-quang kỹ thuật số (DR)"
   - ⚠️ Chỉ được chọn **nhóm lá** (nhóm không có nhóm con)

3. **Gán**: Nhấn nút **"Gán vào nhóm"**

4. **Lặp lại** cho các nhóm thiết bị khác

### 3.4. Mẹo phân loại hiệu quả

| Mẹo | Mô tả |
|-----|-------|
| Phân loại theo lô | Chọn nhiều thiết bị cùng loại và gán một lần |
| Sử dụng tìm kiếm | Gõ tên thiết bị để lọc nhanh |
| Kiểm tra lại | Sau khi gán, thiết bị sẽ biến mất khỏi danh sách "chưa phân loại" |

### 3.5. Sửa lỗi phân loại

Nếu gán nhầm nhóm:
1. Vào **Định mức thiết bị** > **Phân loại thiết bị**
2. Chọn thiết bị đã gán nhầm
3. Nhấn **"Bỏ gán"** để đưa về trạng thái chưa phân loại
4. Gán lại vào nhóm đúng

---

## 4. Bước 2: Tạo quyết định định mức

### 4.1. Mục đích

Tạo văn bản quyết định ban hành định mức thiết bị của đơn vị, căn cứ theo các thông tư của Bộ Y tế.

### 4.2. Truy cập tính năng

1. Vào menu **Định mức thiết bị** > **Quyết định**
2. Nhấn nút **"+ Thêm quyết định"**

### 4.3. Nhập thông tin quyết định

| Trường | Bắt buộc | Mô tả | Ví dụ |
|--------|----------|-------|-------|
| Số quyết định | ✅ | Số hiệu văn bản | 123/QĐ-BV |
| Ngày ban hành | ✅ | Ngày ký quyết định | 15/01/2026 |
| Ngày hiệu lực | ❌ | Ngày bắt đầu áp dụng | 01/02/2026 |
| Căn cứ pháp lý | ❌ | Thông tư, nghị định | TT 46/2025/TT-BYT |
| Ghi chú | ❌ | Thông tin bổ sung | Định mức năm 2026 |

### 4.4. Trạng thái quyết định

| Trạng thái | Mô tả | Cho phép sửa |
|------------|-------|--------------|
| **Dự thảo** | Đang soạn thảo, chưa ban hành | ✅ Có |
| **Hiệu lực** | Đã ban hành, đang áp dụng | ❌ Không |
| **Hết hiệu lực** | Đã bị thay thế hoặc hủy bỏ | ❌ Không |

> **Lưu ý:** Chỉ có thể nhập/sửa định mức khi quyết định ở trạng thái **Dự thảo**.

---

## 5. Bước 3: Nhập định mức từ Excel

### 5.1. Mục đích

Nhập danh sách định mức thiết bị từ file Excel vào hệ thống.

### 5.2. Tải mẫu Excel

1. Vào **Định mức thiết bị** > **Quyết định**
2. Nhấn **"Xem chi tiết"** trên quyết định cần nhập
3. Nhấn nút **"Tải mẫu Excel"**

File Excel sẽ được tải về với tên `mau-nhap-dinh-muc.xlsx`.

### 5.3. Cấu trúc file Excel

File Excel gồm 3 sheet:

#### Sheet 1: "Nhập Định Mức" (Điền dữ liệu)

| Cột | Tên cột | Bắt buộc | Mô tả |
|-----|---------|----------|-------|
| A | STT | Tự động | Số thứ tự (bỏ qua khi nhập) |
| B | Mã nhóm thiết bị | ✅ | Chọn từ dropdown |
| C | Tên thiết bị | Tự động | Tự điền khi chọn mã |
| D | Đơn vị tính | Tự động | Tự điền khi chọn mã |
| E | Số lượng định mức | ✅ | Số nguyên > 0 |
| F | Số lượng tối thiểu | ❌ | Số nguyên >= 0, <= định mức |
| G | Ghi chú | ❌ | Thông tin bổ sung |

#### Sheet 2: "Danh Mục Thiết Bị" (Tham khảo)

Chứa danh sách tất cả các nhóm thiết bị có thể chọn, bao gồm:
- Mã nhóm
- Tên nhóm
- Đường dẫn phân cấp

#### Sheet 3: "Hướng Dẫn"

Chứa hướng dẫn chi tiết cách điền file.

### 5.4. Cách điền file Excel

**Bước 1:** Mở file `mau-nhap-dinh-muc.xlsx`

**Bước 2:** Chuyển đến sheet "Nhập Định Mức"

**Bước 3:** Điền từng dòng:

| B (Mã nhóm) | C (Tên) | D (ĐVT) | E (Định mức) | F (Tối thiểu) | G (Ghi chú) |
|-------------|---------|---------|--------------|---------------|-------------|
| 01.01.001 | (tự điền) | (tự điền) | 5 | 2 | Theo TT 46 |
| 01.02.001 | (tự điền) | (tự điền) | 3 | 2 | |
| 03.01.001 | (tự điền) | (tự điền) | 10 | 5 | ICU + Cấp cứu |

**Mẹo:**
- Nhấn vào ô cột B để thấy dropdown danh sách mã nhóm
- Cột C và D sẽ tự động điền khi chọn mã nhóm (dùng công thức VLOOKUP)
- Chỉ cần điền cột B, E, và tùy chọn F, G

**Bước 4:** Lưu file (giữ nguyên định dạng .xlsx)

### 5.5. Nhập file vào hệ thống

1. Quay lại trang chi tiết quyết định
2. Nhấn nút **"Nhập từ Excel"**
3. Chọn file Excel đã điền
4. Hệ thống sẽ kiểm tra dữ liệu:
   - ✅ Nếu hợp lệ: Hiển thị số dòng sẽ được nhập
   - ❌ Nếu có lỗi: Hiển thị danh sách lỗi theo từng dòng

5. Nhấn **"Nhập dữ liệu"** để hoàn tất

### 5.6. Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| "Không tìm thấy mã nhóm" | Mã nhóm không tồn tại hoặc gõ sai | Kiểm tra lại mã trong sheet "Danh Mục" |
| "Thiếu số lượng định mức" | Cột E để trống | Điền số lượng định mức |
| "Số lượng định mức phải > 0" | Điền số 0 hoặc số âm | Điền số nguyên dương |
| "Số lượng tối thiểu > định mức" | Tối thiểu lớn hơn định mức | Sửa lại cho tối thiểu <= định mức |
| "Phải là số nguyên" | Điền số thập phân (1.5) | Điền số nguyên (1 hoặc 2) |
| "Không được là số âm" | Điền số âm (-5) | Điền số dương |

### 5.7. Nhập bổ sung và cập nhật

- **Nhập bổ sung:** Nhập file mới với các mã nhóm khác → Thêm dòng mới
- **Cập nhật:** Nhập file với mã nhóm đã có → Ghi đè số liệu cũ

---

## 6. Bước 4: Theo dõi tuân thủ

### 6.1. Xem trạng thái tuân thủ

Sau khi nhập định mức, hệ thống tự động tính toán trạng thái tuân thủ:

```
┌────────────────────┬────────┬─────────┬─────────┬──────────────────┐
│ Nhóm thiết bị      │ Đ.mức  │ T.thiểu │ Hiện có │ Trạng thái       │
├────────────────────┼────────┼─────────┼─────────┼──────────────────┤
│ Máy X-quang DR     │   5    │    2    │    3    │ 🟡 Chưa đạt      │
│ Máy siêu âm 2D     │   3    │    2    │    4    │ 🟢 Đạt chuẩn     │
│ Máy thở xâm nhập   │  10    │    5    │    2    │ 🔴 Thiếu nghiêm  │
│ Bơm tiêm điện      │  20    │   10    │   25    │ 🟢 Vượt chuẩn    │
└────────────────────┴────────┴─────────┴─────────┴──────────────────┘
```

### 6.2. Giải thích trạng thái

| Trạng thái | Điều kiện | Ý nghĩa |
|------------|-----------|---------|
| 🟢 **Đạt chuẩn** | Hiện có >= Định mức | Đủ theo quy định |
| 🟢 **Vượt chuẩn** | Hiện có > Định mức | Dư so với quy định |
| 🟡 **Chưa đạt** | Tối thiểu <= Hiện có < Định mức | Đủ tối thiểu, chưa đủ định mức |
| 🔴 **Thiếu nghiêm trọng** | Hiện có < Tối thiểu | Thiếu nghiêm trọng, cần bổ sung gấp |

### 6.3. Công thức tính "Số lượng hiện có"

```
Số lượng hiện có = Số thiết bị trong bảng thiet_bi
                   có nhom_thiet_bi_id = [mã nhóm này]
                   và thuộc đơn vị hiện tại
```

> **Quan trọng:** Nếu thiết bị chưa được phân loại (Bước 1), số lượng hiện có sẽ = 0.

### 6.4. Xem Dashboard tổng hợp

Vào **Định mức thiết bị** > **Dashboard** để xem:

- Tổng số nhóm thiết bị đã định mức
- Số nhóm đạt chuẩn / chưa đạt / thiếu
- Biểu đồ tỷ lệ tuân thủ
- Cảnh báo thiết bị chưa phân loại

---

## 7. Câu hỏi thường gặp

### Q: Tại sao "Số lượng hiện có" luôn bằng 0?

**A:** Có 2 nguyên nhân:
1. Thiết bị chưa được nhập vào hệ thống (bảng `thiet_bi`)
2. Thiết bị đã nhập nhưng chưa được **phân loại** vào nhóm (Bước 1)

**Giải pháp:** Thực hiện Bước 1 - Phân loại thiết bị.

### Q: Tôi có thể sửa định mức đã nhập không?

**A:** Có, nếu quyết định còn ở trạng thái **Dự thảo**:
- Nhập lại file Excel với cùng mã nhóm → Ghi đè số liệu cũ
- Hoặc xóa dòng định mức và nhập lại

### Q: Mã nhóm trong Excel không có trong dropdown?

**A:** Chỉ các **nhóm lá** (nhóm không có nhóm con) mới xuất hiện trong dropdown. Các nhóm cha (VD: "01 Thiết bị chẩn đoán") không thể gán định mức.

### Q: Một thiết bị có thể thuộc nhiều nhóm không?

**A:** Không. Mỗi thiết bị chỉ thuộc **một nhóm duy nhất**.

### Q: Làm sao để xuất báo cáo tuân thủ?

**A:** Tính năng xuất báo cáo đang được phát triển. Hiện tại có thể:
- Xem trực tiếp trên Dashboard
- Sử dụng chức năng Print của trình duyệt

### Q: Ai có thể xem định mức của đơn vị khác?

**A:**
- **Quản trị viên (global):** Xem tất cả đơn vị
- **Lãnh đạo vùng (regional_leader):** Xem các đơn vị trong vùng (chỉ đọc)
- **Các vai trò khác:** Chỉ xem đơn vị của mình

---

## Phụ lục

### A. Sơ đồ luồng dữ liệu

```
┌─────────────────┐
│   thiet_bi      │ ← Thiết bị thực tế của đơn vị
│   (Equipment)   │
└────────┬────────┘
         │ nhom_thiet_bi_id (gán qua Bước 1)
         ▼
┌─────────────────┐
│ nhom_thiet_bi   │ ← Danh mục nhóm thiết bị (TT 08/2019)
│ (Categories)    │
└────────┬────────┘
         │ nhom_thiet_bi_id
         ▼
┌─────────────────┐
│chi_tiet_dinh_muc│ ← Định mức theo từng nhóm (nhập Excel)
│ (Quota Items)   │
└────────┬────────┘
         │ quyet_dinh_id
         ▼
┌─────────────────┐
│quyet_dinh_dinh_muc│ ← Quyết định ban hành định mức
│  (Decisions)      │
└───────────────────┘
```

### B. Liên hệ hỗ trợ

- **Email:** support@example.com
- **Hotline:** 1900-xxxx
- **Tài liệu:** [Link đến tài liệu đầy đủ]

---

*Phiên bản: 1.0 | Cập nhật: 02/2026*
