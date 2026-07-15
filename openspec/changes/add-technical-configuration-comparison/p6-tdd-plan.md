# P6 TDD Plan - Shared URL Document Primitives

## Mục tiêu

Tách P6 thành hai PR-sized leaves:

- P6A khóa behavior hiện tại và tạo shared URL-document contracts/primitives.
- P6B chuyển Equipment sang primitives mà không đổi hook, RPC hoặc storage adapter.

P6 không tạo technical-configuration document records. Persistence bắt đầu ở P7B cho baseline/reference products và P9B cho supplier options.

## Evidence khảo sát

- Source seam: `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailFilesTab.tsx`.
- Parent composition: `EquipmentDetailTabs.tsx`; dialog controller lấy data/mutations từ `useEquipmentAttachments.ts`.
- Equipment persistence adapter gọi `equipment_attachments_list`, `equipment_attachment_create` và `equipment_attachment_delete`, rồi invalidate Equipment attachment query keys.
- Ba Equipment detail dialog tests hiện có đều mock `EquipmentDetailFilesTab` và `useEquipmentAttachments`; không test trực tiếp loading, form, list, URL validation, retry hoặc delete behavior.
- Không có browser/e2e test suite trong repo cho files tab.
- Code Review Graph/GitNexus/direct import search chỉ tìm thấy một production consumer và một Equipment-specific hook boundary.
- Semantic/`rg` search không tìm thấy reusable URL-document form/list hoặc generic URL validation helper phù hợp. `same-origin-request.ts` và markdown-link handling có ownership khác, không nên reuse. Vì vậy P6A trích behavior từ Equipment thành một implementation dùng chung; P6B thay phần presentation/validation cũ bằng implementation đó thay vì giữ hai đường logic song song.

## Phương án đã so sánh

### 1. Stateful shared manager

Shared component sở hữu field state, validation, mutation lifecycle và delete confirmation.

Ưu điểm: migration Equipment ngắn.

Nhược điểm: đóng cứng immediate persistence và simple confirmation, không hợp P7B/P9B dirty-state, expected revision, lock policy và affected-link count.

### 2. Controlled form/list + pure URL utility

Shared form/list chỉ nhận canonical data/callbacks; consumer giữ mutation, feedback, confirmation và persistence policy.

Ưu điểm: boundary nhỏ, test độc lập, giữ Equipment behavior và dùng được cho P7B/P9B.

Nhược điểm: Equipment wrapper vẫn giữ một ít orchestration và field mapping.

### 3. Một `UrlDocumentManager` nguyên khối với adapter interface

Ưu điểm: ít component files hơn và API bề ngoài gọn.

Nhược điểm: adapter interface phải dự đoán trước dirty/save/lock/delete semantics của consumer chưa tồn tại; blast radius và abstraction cost cao hơn nhu cầu hiện tại.

## Quyết định

Chọn phương án 2. Không tạo P6C vì chưa có boundary độc lập thứ ba:

- canonical item/draft types thuộc P6A primitive contract;
- Equipment field mapping thuộc P6B wrapper;
- persistence, confirmation và dirty-state thuộc từng consumer.

Chỉ mở P6C nếu execution phát hiện một contract độc lập có test/exit gate riêng và không thể deploy an toàn trong P6A hoặc P6B.

## Shared contract dự kiến

### URL utility

```ts
export type ParsedAbsoluteUrl = Readonly<{
  raw: string
  protocol: string
}>

export function parseAbsoluteUrl(value: string): ParsedAbsoluteUrl | null

export function isAllowedDocumentUrl(
  parsed: ParsedAbsoluteUrl | null
): parsed is ParsedAbsoluteUrl & { protocol: "http:" | "https:" }
```

- `parseAbsoluteUrl` chỉ parse syntax bằng semantics tương đương
  `new URL(value)`; parse thành công không đồng nghĩa URL được consumer chấp
  nhận.
- Result chỉ expose `raw` và `protocol`, không expose normalized `URL.href`.
- `isAllowedDocumentUrl` là policy riêng cho TC-11 và chỉ chấp nhận khi raw
  string có case-insensitive lexical prefix `^https?://`, không chứa backslash,
  parse thành công và parsed protocol là `http:`/`https:`. Protocol-only
  shorthand như `https:example.com` không được chấp nhận dù `new URL(...)` có
  thể canonicalize nó thành HTTP(S).
- Utility không trim, canonicalize hoặc rewrite field value.
- Khi accepted, add callback và anchor `href` dùng chính `parsed.raw`; tests đọc
  `getAttribute("href")` để phân biệt raw attribute với DOM-resolved URL, đồng
  thời assert `anchor.href === new URL(parsed.raw).href` để khóa destination mà
  browser thực sự mở.
- Không chứa toast, React state, RPC, query key hoặc module-specific type.
- Consumer kết hợp parser và policy để quyết định feedback; utility không tự persist.
- Equipment add/list và `googleDriveFolderUrl` dùng cùng utility này; không tạo validator riêng trong wrapper.

### `UrlDocumentForm`

```ts
export interface UrlDocumentFormProps {
  name: string
  url: string
  onNameChange: (value: string) => void
  onUrlChange: (value: string) => void
  onSubmit: () => void | Promise<void>
  isPending?: boolean
  disabled?: boolean
  validationError?: string | null
  submitLabel?: string
}
```

- Controlled `name` và `url`; labels cố định là `Tên tài liệu` và
  `Đường dẫn (URL)`, `submitLabel` mặc định là `Lưu liên kết`.
- Form gọi `preventDefault()` rồi phát `onSubmit` không tham số; consumer đọc
  controlled values.
- Nhận pending/disabled state; surrounding title/help copy thuộc wrapper.
- `validationError` gắn với URL input bằng
  `aria-invalid`/`aria-describedby` và render feedback với `role="alert"`.
- Không tự gọi mutation, toast hoặc reset field.
- Không tự quyết định URL nào invalid; consumer kết hợp pure URL utility với controlled error prop.
- Không tự quyết định dirty/save workflow.

### `UrlDocumentList`

```ts
export interface UrlDocumentItem {
  id: string
  name: string
  url: string
}

export interface UrlDocumentListProps {
  items: readonly UrlDocumentItem[]
  isLoading: boolean
  onDelete?: (id: string) => void
  deletingId?: string | null
  disabled?: boolean
  emptyMessage?: string
}
```

- Nhận canonical items `{ id, name, url }`.
- Render loading, empty và list states.
- External links mở tab mới với `rel="noopener noreferrer"`.
- List kiểm tra document policy trước khi đặt `href`; `javascript:`, `data:`, `file:` và protocol ngoài allowlist không bao giờ trở thành clickable link.
- Delete chỉ phát callback/request; không tự confirm hoặc biết affected-link count.
- Nhận deleting/disabled state qua props.
- Delete action luôn có `type="button"`, accessible name `Xóa <document name>`;
  pending item đổi accessible name thành `Đang xóa <document name>`.

## P6A - TDD sequence

### A1. Characterize Equipment trước refactor

Create `src/app/(app)/equipment/__tests__/equipment-detail-files-tab.test.tsx`.

Khóa các behavior:

1. Loading state che empty/list state.
2. Empty copy xuất hiện khi load xong và list rỗng.
3. Listed attachment dùng `duong_dan_luu_tru`, mở `_blank` và có `noopener noreferrer`.
4. Submit bị disable khi thiếu tên hoặc URL.
5. Handler-level invalid URL: set field values rồi dùng
   `fireEvent.submit(form)` để bypass native constraint validation; URL không
   parse được không gọi `onAddAttachment`, giữ input và phát feedback hiện tại.
6. Add thành công truyền đúng `{ name, url }` và clear cả hai input.
7. Add reject giữ input để retry và không tạo unhandled rejection.
8. Khi `isAdding=true`, cả hai input và submit button bị disable, đồng thời loading spinner xuất hiện.
9. Delete cancel không gọi callback.
10. Delete confirm gọi đúng attachment ID.
11. Trong lúc delete pending, không cho delete lần hai; state được mở lại sau settle.
12. Google Drive action chỉ render khi có folder URL và giữ safe-link attributes.

Đây là characterization gate: test phải pass trên source hiện tại, rồi được giữ nguyên qua P6B.

`userEvent` tiếp tục dùng riêng cho native disabled-state và valid-submit cases.
Không dùng submit-button click để chứng minh parser chạy với malformed/relative
URL vì `type="url"` có thể chặn submit trước React handler.

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/equipment/__tests__/equipment-detail-files-tab.test.tsx"
```

Expected: exit `0`; chỉ test file trên được chạy; mọi characterization case pass trên source Equipment trước refactor.

### A2. URL utility red-green

Create failing tests trước:

- parseable absolute URL trả valid result;
- unparseable text trả invalid result;
- parser trả protocol mà không quyết định acceptance;
- document policy dùng allowlist: chấp nhận chỉ `http:`/`https:` và từ chối cả
  protocol parse được nhưng ngoài allowlist (`ftp:`, `mailto:`, `blob:`,
  `javascript:`, `data:`, `file:`);
- parser từ chối relative URL (`/documents/spec.pdf`) và scheme-relative URL
  (`//example.com/spec.pdf`) vì document contract yêu cầu absolute URL;
- policy từ chối protocol-only/single-slash shorthand và backslash variants như
  `https:example.com`, `https:/example.com`, `https:\example.com` và
  `https:\\example.com`, dù browser hoặc native `type="url"` có thể xem một số
  value này là valid/canonicalizable;
- normalization-prone mixed-case-scheme input
  `HtTpS://EXAMPLE.com/a/../spec.pdf` được chấp nhận và giữ
  nguyên `raw`, dù `new URL(...)` có thể canonicalize khi parse; list tests khóa
  cả raw `getAttribute("href")` và resolved `anchor.href`.

Run before implementation:

```bash
node scripts/npm-run.js run test:run -- "src/components/url-documents/__tests__/url-document-utils.test.ts"
```

Expected red: command exits non-zero vì utility/module chưa tồn tại hoặc chưa thỏa contract.

Implement tối thiểu để tests pass.

Run lại cùng command.

Expected green: exit `0`; một test file pass; `0` failed tests.

### A3. Form primitive red-green

Create failing tests trước:

- labels/inputs truy cập được bằng role/label;
- controlled values hiển thị đúng;
- change callbacks nhận raw values;
- submit callback chạy một lần;
- pending/disabled state khóa đúng controls;
- `validationError` render cạnh URL field với `role="alert"`, URL input có
  `aria-invalid` và `aria-describedby`;
- integration harness dùng `fireEvent.submit(form)` để kết hợp URL utility với
  controlled error prop và chứng minh persistence callback không chạy khi URL
  invalid;
- integration harness cũng từ chối URL parse được nhưng dùng protocol ngoài HTTP(S);
- component không import Equipment hook/type/RPC.

Run before implementation:

```bash
node scripts/npm-run.js run test:run -- "src/components/url-documents/__tests__/UrlDocumentForm.test.tsx"
```

Expected red: command exits non-zero vì form/module hoặc inline-error contract chưa tồn tại.

Implement controlled form tối thiểu.

Run lại cùng command.

Expected green: exit `0`; một test file pass; `0` failed tests.

### A4. List primitive red-green

Create failing tests trước:

- loading, empty và populated states loại trừ nhau;
- table-driven URL matrix áp dụng tại list sink:
  - valid absolute `http:` và `https:` item render name, clickable link và safe
    external attributes;
  - malformed text, relative URL, scheme-relative URL và parseable non-HTTP
    protocol vẫn render document name như text nhưng không render link role,
    clickable anchor hoặc fallback `href` như `#`;
- delete request trả đúng canonical ID;
- deleting/disabled state khóa action;
- delete action có `type="button"`, accessible name chứa document name và
  pending accessible label;
- mount list trong outer form, click delete không submit outer form;
- component không tự gọi `confirm`.

Run before implementation:

```bash
node scripts/npm-run.js run test:run -- "src/components/url-documents/__tests__/UrlDocumentList.test.tsx"
```

Expected red: command exits non-zero vì list/module chưa tồn tại.

Implement controlled list tối thiểu.

Run lại cùng command.

Expected green: exit `0`; một test file pass; `0` failed tests.

### A5. Shared source-boundary contract

Create
`src/components/url-documents/__tests__/url-document-source-contract.test.ts`.

Test recursively enumerate mọi non-test production module dưới
`src/components/url-documents/` với extension `.ts`, `.tsx`, `.js`, `.jsx`,
`.mts`, `.cts`, `.mjs`, `.cjs`, rồi fail nếu inventory khác đúng ba file
`UrlDocumentForm.tsx`, `UrlDocumentList.tsx`, `url-document-utils.ts`. Repo bật
`allowJs`, nên không được chỉ scan TypeScript extensions. Mọi module mới phải
được phân loại và cập nhật allowlist rõ ràng trong change riêng.

Với TypeScript compiler API, test parse mọi `ImportDeclaration`,
`ImportEqualsDeclaration`, `ExportDeclaration` có module specifier, dynamic
`import()`, `require()` và `ImportTypeNode`. Dynamic/require/import-type argument
không phải string literal phải fail closed. Enforce exact module-specifier set
equality, không prefix matching:

- `url-document-utils.ts` không có module reference;
- `UrlDocumentForm.tsx` có đúng `react`, `lucide-react`,
  `@/components/ui/button`, `@/components/ui/input` và
  `@/components/ui/label`;
- `UrlDocumentList.tsx` có đúng `lucide-react`, `@/components/ui/button`,
  `@/components/ui/scroll-area`, `@/components/ui/skeleton` và
  `./url-document-utils`;
- mọi module reference khác fail, gồm React Query/mutation, toast,
  API/Supabase/RPC, Equipment/module hooks, services, server actions hoặc
  persistence adapters.

Test cũng fail khi source tham chiếu Equipment path/type, `Attachment`,
`useEquipmentAttachments`, Equipment query keys/RPC names, `file_dinh_kem` hoặc
persistence identifier cụ thể khác. Import allowlist là guard chính; symbol
denylist chỉ bổ sung thông báo lỗi rõ hơn.

Trong cùng test file, thêm synthetic source fixtures chứng minh extractor:

- nhận diện allowed/denied static import và type import;
- nhận diện `ImportEqualsDeclaration`, named/star `export ... from`, literal
  dynamic `import()`, literal `require()` và `ImportTypeNode`;
- fail với computed/non-literal dynamic `import()`, `require()` hoặc import
  type;
- fail khi có production `.js`/`.jsx`/`.mts`/`.cts`/`.mjs`/`.cjs` module thứ
  tư hoặc khi observed module-specifier set thiếu/thừa so với exact set.

Run:

```bash
node scripts/npm-run.js run test:run -- "src/components/url-documents/__tests__/url-document-source-contract.test.ts"
```

Expected: exit `0`; production inventory đúng ba module, mọi module-reference
form nằm trong per-file allowlist và shared layer giữ persistence-agnostic
boundary.

### A6. P6A verification

Chạy theo repo order trong một `ctx_batch_execute`:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- "src/app/(app)/equipment/__tests__/equipment-detail-files-tab.test.tsx" "src/components/url-documents/__tests__/url-document-utils.test.ts" "src/components/url-documents/__tests__/UrlDocumentForm.test.tsx" "src/components/url-documents/__tests__/UrlDocumentList.test.tsx" "src/components/url-documents/__tests__/url-document-source-contract.test.ts"
node scripts/npm-run.js run react-doctor
openspec validate add-technical-configuration-comparison --type change --strict --no-interactive
git diff --check
```

Expected:

- mọi command exit `0`;
- năm focused test files pass, `0` failed tests;
- React Doctor không có finding mới trong diff;
- OpenSpec báo change valid;
- `git diff --check` không có output.

Exit gate:

- shared primitives pass độc lập;
- Equipment characterization pass;
- `EquipmentDetailFilesTab.tsx` production source chưa đổi;
- không có SQL/migration/live DB write.

## P6B - TDD-safe migration sequence

### B1. Baseline gate

Run P6A Equipment characterization và shared tests trước khi sửa source.

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/equipment/__tests__/equipment-detail-files-tab.test.tsx" "src/components/url-documents/__tests__/url-document-utils.test.ts" "src/components/url-documents/__tests__/UrlDocumentForm.test.tsx" "src/components/url-documents/__tests__/UrlDocumentList.test.tsx" "src/components/url-documents/__tests__/url-document-source-contract.test.ts"
```

Expected: exit `0`; năm test files pass; `0` failed tests.

### B2. Adapter migration

Trước implementation, modify
`src/components/url-documents/__tests__/url-document-source-contract.test.ts`
và thêm failing Equipment consumer assertions. Contract dùng exact shared
module paths/bindings, không chỉ kiểm tra text presence:

- `EquipmentDetailFilesTab.tsx` named-import/render `UrlDocumentForm` từ
  `@/components/url-documents/UrlDocumentForm` và `UrlDocumentList` từ
  `@/components/url-documents/UrlDocumentList`;
- wrapper named-import/call `parseAbsoluteUrl` và `isAllowedDocumentUrl` từ
  `@/components/url-documents/url-document-utils` cho add và Google Drive folder
  policy;
- source không còn `new URL(...)`, direct `Input`/`Label`/`ScrollArea`/`Skeleton`
  import hoặc JSX presentation đã extract.

Consumer manifest phải cumulative thay vì thay thế theo phase:

- P6B: `EquipmentDetailFilesTab.tsx`;
- P7B: Equipment + `TechnicalConfigurationBaselineDocuments.tsx`;
- P9B: Equipment + baseline + `TechnicalConfigurationOptionDocuments.tsx`.

Mỗi phase assert set equality cho toàn manifest hiện hành, exact path/binding và
không có missing/extra consumer entry.

Đồng thời create
`src/app/(app)/equipment/__tests__/equipment-detail-files-tab-delegation.test.tsx`
và thêm failing runtime-delegation cases. Test mock exact shared
form/list/utility modules, capture props/callbacks và chứng minh active workflow:

- controlled field props/change callbacks drive Equipment local state;
- form `onSubmit` đi qua mocked parser/policy rồi mới gọi add callback bằng exact
  raw URL;
- list nhận exact mapped `{ id, name, url }` items và list delete callback đi qua
  Equipment confirmation/pending orchestration trước hook delete;
- Google Drive action đi qua mocked parser/policy; shared imports không phải dead
  code chỉ để thỏa AST contract.

Behavior test hiện hữu đồng thời thêm failing cases:

- table-driven URL matrix gồm malformed text, relative URL, scheme-relative URL,
  protocol-only/single-slash shorthand, backslash variants, parseable non-HTTP
  protocols, valid `http:` và valid `https:`;
- add parser/policy matrix dùng `fireEvent.submit(form)`; native disabled và
  valid-submit cases dùng `userEvent`;
- cùng matrix áp dụng riêng tại ba Equipment sinks:
  - add input chỉ gọi `onAddAttachment` cho valid HTTP(S);
  - existing attachment chỉ render clickable `href` cho valid HTTP(S); invalid
    item vẫn hiện tên nhưng không có link role/anchor hoặc fallback `href`;
  - `googleDriveFolderUrl` chỉ render clickable folder action cho valid HTTP(S);
- normalization-prone mixed-case-scheme
  `HtTpS://EXAMPLE.com/a/../spec.pdf` chạy qua cả ba sinks, giữ exact raw string
  trong add payload và attachment/folder `getAttribute("href")`; mỗi accepted
  anchor đồng thời assert resolved `href` bằng `new URL(raw).href`;
- mọi clickable HTTP(S) result giữ `_blank` và `noopener noreferrer`;
- delete callback reject không tạo unhandled rejection, reset per-item pending
  state và cho phép confirm/retry lại cùng attachment.

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/equipment/__tests__/equipment-detail-files-tab.test.tsx" "src/app/(app)/equipment/__tests__/equipment-detail-files-tab-delegation.test.tsx" "src/components/url-documents/__tests__/url-document-source-contract.test.ts"
```

Expected red trên pre-P6B source: command exits non-zero; ba test files được
chọn. Consumer assertions fail vì Equipment chưa render shared primitives, còn
behavior cases fail vì source chỉ dùng parse-only `new URL(...)`, đặt folder URL
trực tiếp vào `href` và không catch delete callback rejection. Delegation cases
fail vì active Equipment workflow chưa đi qua shared module callbacks.

Trong `EquipmentDetailFilesTab.tsx`:

- giữ local field state;
- dùng URL utility nhưng giữ feedback behavior đã khóa;
- map `Attachment.id`/`ten_file`/`duong_dan_luu_tru` sang canonical list items;
- giữ Google Drive action ngoài shared form/list nhưng gate `href` bằng cùng URL parser/policy;
- giữ delete confirmation và per-item pending orchestration ở Equipment wrapper;
- catch rejected delete callback sau khi hook đã phát toast để tránh unhandled
  rejection, luôn reset pending state và cho retry;
- kết hợp parser + HTTP(S) document policy trước add và clickable-link rendering;
- render `UrlDocumentForm` và `UrlDocumentList`.

Không sửa:

- `useEquipmentAttachments.ts`;
- RPC names/arguments;
- `equipmentDetailQueryKeys`;
- `file_dinh_kem`;
- P7B/P9B persistence.

### B3. Regression gate

Run lại nguyên bộ P6A tests. Chỉ sửa assertions nếu markup/accessibility contract được cải thiện mà user-observable behavior không đổi; không nới assertion để che regression.

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/equipment/__tests__/equipment-detail-files-tab.test.tsx" "src/app/(app)/equipment/__tests__/equipment-detail-files-tab-delegation.test.tsx" "src/components/url-documents/__tests__/url-document-utils.test.ts" "src/components/url-documents/__tests__/UrlDocumentForm.test.tsx" "src/components/url-documents/__tests__/UrlDocumentList.test.tsx" "src/components/url-documents/__tests__/url-document-source-contract.test.ts" "src/app/(app)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx" "src/app/(app)/equipment/__tests__/equipment-detail-dialog-delete-rbac.test.tsx" "src/app/(app)/equipment/__tests__/equipment-detail-dialog-tabs.test.tsx"
```

Expected: exit `0`; chín focused test files pass; `0` failed tests.

### B4. Conditional browser smoke

Browser smoke không phải blocking exit gate vì repo chưa có browser/e2e harness hoặc fixture setup chuẩn cho files tab. B3 React tests là mandatory regression gate.

Precondition:

- đã có authenticated local/dev session và một fixture/mock data path không
  dùng live DB;
- fixture phải cung cấp chính xác `attachments` với ít nhất một HTTP(S) item và
  `google_drive_folder_url` là một Google Drive HTTPS URL;
- export ID đó thành `P6_BROWSER_EQUIPMENT_ID`;
- không tạo dữ liệu fixture bằng submit/delete trong browser.

Nếu session hoặc fixture này chưa tồn tại, ghi browser smoke là `N/A` kèm lý do; không mở thêm test-harness scope trong P6. B3 vẫn phải pass đầy đủ.

Run:

```bash
export P6_BROWSER_EQUIPMENT_ID="<readable-local-or-dev-equipment-id>"
export P6_BROWSER_URL="http://127.0.0.1:3100/equipment?highlight=${P6_BROWSER_EQUIPMENT_ID}"
printf '%s\n' "$P6_BROWSER_URL"
node scripts/npm-run.js run dev -- --hostname 127.0.0.1 --port 3100
```

Open the exact resolved URL printed by `printf`.

Expected read-only result:

1. Deep link mở đúng Equipment detail dialog.
2. Chọn tab `File đính kèm`.
3. Tab render loading/empty/populated state ổn định.
4. Existing HTTP(S) attachment và Google Drive link của fixture mở tab mới với
   safe attributes.
5. Form/list layout không tạo nested cards, overflow hoặc overlap ở desktop và narrow viewport.

Unsupported-scheme attachment/folder rendering và invalid/add/retry/delete
mutation behavior được verify bằng focused React tests ở B3, gồm assertion rằng
value ngoài HTTP(S) allowlist không clickable. Browser smoke này chỉ đọc fixture
local/dev và không được trỏ tới live DB.

### B5. Quality gates

Run trong một `ctx_batch_execute`:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- "src/app/(app)/equipment/__tests__/equipment-detail-files-tab.test.tsx" "src/app/(app)/equipment/__tests__/equipment-detail-files-tab-delegation.test.tsx" "src/components/url-documents/__tests__/url-document-utils.test.ts" "src/components/url-documents/__tests__/UrlDocumentForm.test.tsx" "src/components/url-documents/__tests__/UrlDocumentList.test.tsx" "src/components/url-documents/__tests__/url-document-source-contract.test.ts" "src/app/(app)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx" "src/app/(app)/equipment/__tests__/equipment-detail-dialog-delete-rbac.test.tsx" "src/app/(app)/equipment/__tests__/equipment-detail-dialog-tabs.test.tsx"
node scripts/npm-run.js run react-doctor
openspec validate add-technical-configuration-comparison --type change --strict --no-interactive
git diff --check
```

Expected:

- mọi command exit `0`;
- chín focused test files pass, `0` failed tests;
- React Doctor không có finding mới;
- OpenSpec valid;
- `git diff --check` không có output.

Exit gate:

- Equipment dùng shared primitives;
- hook/RPC/storage contract không đổi;
- no technical-configuration records;
- P7B có thể bắt đầu trên P6B.

## TC-11/TC-12 downstream ownership

- P6A: validation, controlled form/list contract, safe external links.
- P6B: Equipment adapter proof và regression.
- P7B: baseline/reference-product document persistence, authoritative helper
  `public._technical_configuration_validate_document_url(text)`, owner scope,
  citations, lock/copy/delete/concurrency; aggregate list trả discriminated
  baseline/reference owners cùng nested citations; rerun cumulative Equipment +
  baseline AST manifest và add baseline runtime-delegation/raw
  create-update-list-render tests.
- P9B: supplier-option document persistence/citations, reuse P7B authoritative
  URL validator và primary completion ownership cho TC-11-S01/S02/S03 cùng
  TC-12-S01/S02 sau khi rerun P7B coverage; rerun cumulative Equipment +
  baseline + option AST manifest và add option runtime-delegation/raw
  create-update-list-render tests.
- P13A/P13B: cross-leaf SQL/UI regression.

P6A/P6B tests xác nhận partial callback/presentation contracts và không được tạo document records. P7B có phase-local persistence/citation tests nhưng chưa mark normative TC-11 hoặc TC-12 scenarios complete. Chỉ P9B mark TC-11-S01/S02/S03 và TC-12-S01/S02 complete sau khi baseline/reference và supplier-option cases đều pass.
