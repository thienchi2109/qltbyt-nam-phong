# Kế hoạch cải thiện UI workspace Cấu hình cơ sở

- **Ngày:** 2026-08-25
- **Trạng thái:** Đã thống nhất hướng thiết kế, chưa triển khai
- **Phạm vi:** `Cấu hình kỹ thuật` > tab `Cấu hình cơ sở` > workspace xây dựng
  cấu hình

## Mục tiêu

Chuyển workspace nhập liệu phân cấp hiện tại sang cách trình bày gần với một
document outline/tree grid: vẫn đọc rõ quan hệ nhóm, phân nhóm và tiêu chí,
nhưng giảm cảm giác nhiều bảng lồng nhau, đường viền dày và các khối rời rạc.

Thiết kế mới phải giúp người dùng:

- Quét nhanh cấu trúc toàn bộ cấu hình.
- Đọc liên tục từ tiêu đề cấp I/II/III đến các mục 1/2/3.
- Chỉnh sửa inline mà không bị cảm giác đang điền một bảng biểu nặng nề.
- Sắp xếp lại nội dung bằng kéo thả, đồng thời vẫn có phương án thao tác bằng
  bàn phím và menu.
- Nhận biết trạng thái hợp lệ/lỗi mà không tăng thêm nhiễu thị giác.

## Tài liệu đầu vào

- Giao diện hiện tại: `/root/images/technical-config-current-layout.png`
- Hướng trình bày đề xuất: `/root/images/recommended-layout.png`
- Đánh giá và mô tả thiết kế:
  `/root/images/evaluation-and-suggestion.md`
- Thiết kế hierarchy editor hiện hữu:
  `docs/superpowers/specs/2026-08-04-technical-configuration-hierarchical-baseline-editor-design.md`

## Quyết định đã khóa

### Phạm vi kỹ thuật

- Đây chỉ là thay đổi UI/frontend.
- Không thay đổi backend, API, RPC, SQL, schema, payload hay save pipeline.
- Không làm mobile responsive vì trang này đã bị ẩn trên mobile viewport.
- Giữ explicit Save; không thêm autosave.
- Giữ nguyên dirty guard, trạng thái khóa, focus restoration, collapse state,
  bulk-entry buffer và validation hiện tại.

### Phạm vi sản phẩm

- Thiết kế lại toàn bộ workspace `Cấu hình cơ sở`, không chỉ restyle từng dòng.
- Toolbar chỉ giữ các khả năng hiện có; không thêm search, preview hay
  expand/collapse-all.
- Sidebar `Cấu trúc` chỉ là bản tóm tắt thụ động; không click-to-scroll và
  không active highlight theo vị trí cuộn.
- Giữ một cột `Tiêu đề` riêng, nhỏ gọn.
- Giữ nguyên mọi giá trị tiêu đề. Dấu `-` là một tiêu đề hợp lệ, không phải dữ
  liệu trống và không được tự động ẩn, thay thế hay chuẩn hóa.
- Bỏ cột `Vị trí` khỏi phần trình bày trực tiếp.

### Phạm vi kéo thả

- Nhóm được sắp xếp lại trên toàn cấu hình.
- Phân nhóm chỉ được sắp xếp trong nhóm cha hiện tại.
- Tiêu chí được sắp xếp và chuyển giữa nhóm/phân nhóm.
- Không cho phép chuyển phân nhóm sang nhóm cha khác vì persistence hiện tại
  không hỗ trợ hành vi đó.
- Giữ keyboard drag-and-drop và hành động lên/xuống trong menu làm phương án
  truy cập thay thế.
- Dùng `@dnd-kit/react` và `@dnd-kit/helpers`; hai package này chưa có trong
  dependency hiện tại và sẽ được thêm trong phase triển khai.

## Hướng thiết kế

### 1. Khung workspace

Toolbar nằm ngoài vùng cuộn nội dung để các hành động hiện tại luôn ổn định khi
người dùng làm việc với cấu hình dài.

Phần thân desktop chia thành hai vùng:

- Sidebar `Cấu trúc` rộng khoảng `220px`, chỉ hiển thị outline/tóm tắt.
- Hierarchy canvas chiếm phần còn lại và là vùng cuộn chính.

Không bọc toàn bộ trang bằng các card lồng nhau. Workspace dùng nền phẳng, các
đường phân cách nhẹ và khoảng trắng để tạo nhịp đọc.

### 2. Sidebar Cấu trúc

Sidebar hiển thị:

- Danh sách nhóm theo thứ tự hiện tại.
- Các phân nhóm nằm dưới nhóm tương ứng.
- Chỉ báo số lượng ngắn gọn khi dữ liệu hiện tại đã có sẵn để tính ở frontend.

Sidebar không tạo một mô hình điều hướng thứ hai. Nội dung là read-only, không
nhận focus, không điều khiển collapse state và không thay đổi vị trí cuộn.

### 3. Hierarchy canvas

Canvas dùng một column header dùng chung cho toàn bộ danh sách. Không lặp lại
table header trong từng nhóm hoặc phân nhóm.

Các cột của criterion row:

1. Drag handle.
2. STT.
3. Mã.
4. Tiêu đề.
5. Yêu cầu kỹ thuật.
6. Trạng thái.
7. Menu hành động.

Grid cần có kích thước ổn định để hover, focus, validation và nội dung dài
không làm các cột nhảy vị trí. Cột `Yêu cầu kỹ thuật` nhận phần không gian linh
hoạt; cột `Tiêu đề` giữ chiều rộng nhỏ gọn nhưng vẫn hiển thị đầy đủ giá trị
`-`.

### 4. Ngôn ngữ phân cấp

Phân cấp được thể hiện bằng tổ hợp nhiều tín hiệu nhẹ thay cho các khung bảng
dày:

- Nhóm: tiêu đề section rõ nhất, số La Mã và control collapse.
- Phân nhóm: tiêu đề section nhỏ hơn, thụt vào dưới nhóm cha.
- Tiêu chí: row phẳng, thụt vào dưới owner và dùng connector line mảnh.
- Khoảng cách dọc giữa các cấp lớn hơn khoảng cách giữa các row cùng cấp.
- Màu nền và border chỉ dùng để phân tách trạng thái, không tạo thêm card.

Nhóm và phân nhóm tiếp tục dùng collapse state hiện tại. Connector line phải
phản ánh đúng owner của tiêu chí, kể cả khi tiêu chí trực thuộc nhóm và không
nằm trong phân nhóm.

### 5. Inline editing

Input và textarea ở trạng thái nghỉ không có border nhìn thấy. Affordance chỉnh
sửa xuất hiện khi hover hoặc focus bằng nền/border focus nhẹ, không làm thay
đổi kích thước row.

Các nguyên tắc:

- Giữ nguyên field, giá trị draft và callback hiện tại.
- Không trim, biến đổi hay ẩn giá trị `Tiêu đề`, bao gồm `-`.
- Nội dung dài của `Yêu cầu kỹ thuật` được phép tăng chiều cao theo nội dung.
- `Tiêu đề` là field riêng, không gộp vào `Yêu cầu kỹ thuật`.
- Tiêu chí hợp lệ hiển thị check icon nhỏ.
- Tiêu chí lỗi chỉ dùng validation và thông báo lỗi hiện có; không thêm rule
  mới ở frontend.
- Trạng thái khóa vô hiệu hóa toàn bộ affordance chỉnh sửa và sắp xếp nhưng vẫn
  giữ khả năng đọc.

## Thiết kế tương tác kéo thả

### Drag model

Mỗi draggable item có identity và loại rõ ràng:

- `group`
- `subgroup`
- `criterion`

Drop target phải mang đủ thông tin owner và index để helper thuần có thể kiểm
tra hành vi hợp lệ trước khi cập nhật draft.

| Loại item | Drop hợp lệ                                              | Drop không hợp lệ                       |
| --------- | -------------------------------------------------------- | --------------------------------------- |
| Nhóm      | Trước/sau nhóm bất kỳ                                    | Bên trong phân nhóm hoặc tiêu chí       |
| Phân nhóm | Trước/sau phân nhóm cùng nhóm cha                        | Sang nhóm cha khác                      |
| Tiêu chí  | Trước/sau tiêu chí hoặc vào vùng rỗng của nhóm/phân nhóm | Target bị khóa hoặc owner không tồn tại |

### State transition

- Drag projection là state tạm thời phục vụ chỉ báo vị trí.
- Canonical draft không đổi trong lúc pointer/keyboard đang di chuyển.
- Chỉ cập nhật canonical draft sau một drop hợp lệ.
- Drop không hợp lệ, cancel hoặc mất target phải trả UI về draft ban đầu.
- Mỗi drop hợp lệ chỉ tạo một state transition để dirty tracking và focus
  restoration tiếp tục nhất quán.

### Accessible fallback

- Drag handle có accessible name mô tả item đang sắp xếp.
- Keyboard DnD hỗ trợ nâng item, di chuyển và thả theo API của dnd-kit.
- Menu row tiếp tục có hành động lên/xuống.
- Tiêu chí có submenu `Chuyển đến...` để đổi owner mà không cần pointer DnD.
- Phân nhóm không hiển thị lựa chọn đổi nhóm cha.
- Mọi hành động từ dropdown mở overlay khác phải dùng transition helper hiện
  có để tránh mở overlay đồng thời khi menu đang đóng.

## Kế hoạch component

Ưu tiên giữ ranh giới component hiện tại, nhưng tách các phần mới trước khi các
file gần ngưỡng `350` dòng trở nên quá lớn.

### Component hiện có cần chỉnh

- `TechnicalConfigurationBaselineEditor.tsx`
  - Bố trí toolbar ngoài scroll region.
  - Tạo shell hai cột sidebar/canvas.
  - Điều phối DnD và trạng thái projection ở mức workspace.
- `TechnicalConfigurationBaselineGroupSection.tsx`
  - Chuyển từ section kiểu card/table sang group heading nhẹ.
  - Gắn group drag handle và drop zones.
- `TechnicalConfigurationBaselineGroupContent.tsx`
  - Dùng chung column header và hierarchy indentation.
  - Bỏ header lặp lại.
- `TechnicalConfigurationBaselineSubgroupSection.tsx`
  - Chuyển sang subgroup heading và connector line.
  - Chỉ cho reorder trong parent hiện tại.
- `TechnicalConfigurationCriteriaSpreadsheet.tsx`
  - Bỏ presentation dạng spreadsheet nặng và cột `Vị trí`.
  - Render shared criterion row.
- `TechnicalConfigurationBaselineSubgroupCriteria.tsx`
  - Dùng cùng criterion row và owner/drop contract với tiêu chí trực thuộc
    nhóm.
- `useTechnicalConfigurationInlineEditor.ts`
  - Chỉ nối thêm các action frontend cần thiết; không đổi save contract.
- `useTechnicalConfigurationHierarchyAuthoring.ts`
  - Tái sử dụng action hiện tại cho menu fallback và bulk authoring.

### Extraction dự kiến

Tên cuối cùng có thể điều chỉnh theo convention gần nhất, nhưng mỗi phần phải
có một trách nhiệm rõ ràng:

- `TechnicalConfigurationBaselineStructureSidebar.tsx`
- `TechnicalConfigurationBaselineColumnHeader.tsx`
- `TechnicalConfigurationBaselineCriterionRow.tsx`
- `TechnicalConfigurationBaselineDndContext.tsx`
- `technical-configuration-baseline-dnd.ts`

Không tạo abstraction mới nếu component/helper hiện hữu đã cung cấp cùng hành
vi. Trước khi thêm helper dùng chung phải chạy semantic deduplication theo quy
định của repo.

### State helper

Mở rộng `technical-configuration-baseline-editor-state.ts` hoặc tách helper
riêng nếu file tiến gần ngưỡng:

- Tính target index khi reorder nhóm.
- Tính target index khi reorder phân nhóm trong cùng parent.
- Tính source/target owner và target index khi move tiêu chí.
- Phân biệt no-op, invalid drop và valid drop.
- Giữ stable identity; không dựa vào STT hoặc code hiển thị làm drag identity.

## Lộ trình triển khai theo TDD

### Phase 1: Khóa state contract

Viết failing tests trước cho các helper thuần:

- Reorder nhóm ở đầu, giữa và cuối danh sách.
- Reorder phân nhóm trong cùng nhóm cha.
- Từ chối cross-parent subgroup move.
- Reorder tiêu chí trong cùng owner.
- Chuyển tiêu chí giữa group và subgroup theo cả hai hướng.
- Chuyển tiêu chí giữa hai owner khác nhau.
- Tính đúng target index khi kéo item từ trước xuống sau và ngược lại.
- Invalid target/cancel không thay đổi canonical draft.
- Giá trị tiêu đề `-` được bảo toàn sau mọi reorder/move.

Mở rộng test gần nhất:

- `technical-configuration-baseline-editor-state.test.ts`
- `technical-configuration-baseline-hierarchy-editor-state.test.ts`
- `technical-configuration-baseline-hierarchy-editor-ordering.test.ts`

### Phase 2: Khóa presentation contract

Viết component tests cho:

- Toolbar nằm ngoài vùng cuộn hierarchy.
- Sidebar `Cấu trúc` hiển thị đúng thứ tự nhưng không có navigation behavior.
- Toàn canvas chỉ có một column header.
- Criterion row có cột `Tiêu đề` và không còn cột `Vị trí`.
- Tiêu đề `-` được render và edit như mọi tiêu đề khác.
- Group, subgroup và criterion có mức heading/indentation đúng.
- Locked state không hiển thị affordance chỉnh sửa hoặc drag.
- Validation hợp lệ hiển thị check icon; lỗi vẫn dùng message hiện tại.

Ưu tiên mở rộng:

- `technical-configuration-baseline-group-section.test.tsx`
- `technical-configuration-baseline-subgroup-presentation.test.tsx`
- `technical-configuration-baseline-hierarchy-integration.test.tsx`

### Phase 3: DnD foundation

- Thêm `@dnd-kit/react` và `@dnd-kit/helpers`.
- Tạo typed drag payload và drop projection helper.
- Tích hợp pointer và keyboard sensors.
- Render drag overlay/drop indicator không làm đổi layout.
- Chỉ commit canonical draft trong `onDragEnd` sau khi validation drop thành
  công.
- Khóa hành vi cancel/no-op bằng tests.

### Phase 4: Workspace và hierarchy styling

- Tạo layout toolbar + sidebar + canvas.
- Tạo shared column header và criterion row.
- Chuyển group/subgroup sang section heading, indentation và connector line.
- Áp dụng borderless inline editing và stable grid dimensions.
- Giữ collapse, bulk-entry UI và các menu/action hiện tại.

### Phase 5: Accessible fallback và regression

- Nối lại action lên/xuống và `Chuyển đến...`.
- Kiểm tra keyboard DnD và focus restoration sau drop/menu action.
- Chạy regression cho save, dirty guard, lock, import, bulk authoring và
  collapse state.
- Xác nhận không có thay đổi request/API/RPC snapshot.

Các regression suite trọng yếu:

- `baseline-locking.test.tsx`
- `technical-configuration-baseline-hierarchy-save.test.ts`
- `technical-configuration-baseline-hierarchy-authoring-workflow.test.tsx`
- `technical-configuration-baseline-hierarchy-authoring-controls.test.tsx`
- `technical-configuration-baseline-hierarchy-tab-workflow.test.tsx`
- `technical-configuration-baseline-hierarchy-editor-snapshot.test.ts`

## Tiêu chí nghiệm thu

- Workspace đọc như một outline liên tục thay vì nhiều bảng/card lồng nhau.
- Người dùng vẫn nhận biết ngay ba cấp nhóm, phân nhóm và tiêu chí.
- Toolbar không cuộn cùng nội dung dài.
- Sidebar chỉ tóm tắt cấu trúc và không tạo hành vi điều hướng ngầm.
- Chỉ có một column header cho toàn hierarchy canvas.
- Cột `Tiêu đề` tồn tại, nhỏ gọn và hiển thị đúng `-`.
- Không còn cột `Vị trí` nhìn thấy.
- Inline fields yên tĩnh ở trạng thái nghỉ, rõ affordance khi hover/focus.
- Nhóm, phân nhóm và tiêu chí tuân thủ đúng ma trận DnD đã khóa.
- Keyboard DnD và menu fallback thao tác được đầy đủ.
- Save, dirty guard, lock, collapse, focus restoration, bulk-entry buffer và
  validation giữ nguyên hành vi.
- Không có thay đổi backend, API, RPC, SQL, schema hoặc save payload.
- Không phát sinh công việc mobile responsive.

## Ngoài phạm vi

- Search trong cấu hình.
- Preview mode.
- Expand/collapse-all.
- Click sidebar để cuộn hoặc active-scroll tracking.
- Autosave.
- Cross-parent subgroup move.
- Thay đổi validation rule.
- Chuẩn hóa hoặc diễn giải lại giá trị tiêu đề.
- Thay đổi dữ liệu hiện hữu.
- Mobile/tablet layout.
- Backend/API/RPC/database changes.

## Kiểm chứng bắt buộc

Chạy theo đúng thứ tự của repo sau khi triển khai TypeScript/React:

1. `node scripts/npm-run.js run format:check`
2. `node scripts/npm-run.js run verify:no-explicit-any`
3. `node scripts/npm-run.js run verify:dedupe`
4. `node scripts/npm-run.js run typecheck`
5. Focused Vitest cho state, DnD, presentation và regression suites nêu trên
6. `node scripts/npm-run.js run react-doctor`

Ngoài automated checks:

- Kiểm tra trực quan trên desktop với cấu hình ngắn và cấu hình dài.
- Kiểm tra canvas khi group/subgroup collapsed và expanded.
- Kiểm tra title `-`, title trống và title dài là ba trường hợp độc lập.
- Kiểm tra pointer DnD, keyboard DnD, menu lên/xuống và `Chuyển đến...`.
- Kiểm tra locked workspace không thể edit hoặc reorder.
- Kiểm tra save payload trước/sau redesign không thay đổi shape.
