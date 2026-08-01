# P13A Discovery And Split Decision

## Trạng thái quyết định

- **Ngày chấp thuận:** 2026-08-01.
- **Người chấp thuận:** Product owner.
- **Phạm vi:** P13A Database Security And Performance Hardening.
- **Quyết định:** **NÊN TÁCH P13A** thành P13A-P1 bắt buộc, P13A-P2 có điều kiện
  chỉ khi P13A-P1 fail, và P13A-V là gate xác minh cuối.
- **Trạng thái thực thi:** Chưa thực hiện P13A-P1, P13A-P2 hoặc P13A-V.

Artifact này ghi nhận discovery và quyết định tách đã được chấp thuận. Nó không
phải completion evidence cho P13A-P1 hoặc P13A-V, không chứng minh phase gate đã
chạy, và không cho phép đánh dấu bất kỳ task P13A nào là hoàn tất.

## Quy ước bằng chứng

- **[FACT]** Đã xác minh từ code, test, OpenSpec, GitHub hoặc live Supabase bằng
  thao tác read-only tại thời điểm discovery.
- **[INFERENCE]** Kết luận kỹ thuật từ facts hiện có nhưng chưa được khóa bằng
  representative phase gate.
- **[PRODUCT DECISION]** Quyết định phạm vi và sequencing đã được product owner
  chấp thuận ngày 2026-08-01.

## Verified baseline

- **[FACT]** P12C1 ranking RPC đã merge, apply và phase-gated; prerequisite đầu
  vào của P13A đã được đáp ứng.
- **[FACT]** P12C2 đã merge; browser, accessibility và UI regression vẫn thuộc
  P13B, không chuyển sang P13A.
- **[FACT]** Local có 32 technical migrations và live registry có 32 migrations
  tương ứng theo cùng semantic order.
- **[FACT]** Không phát hiện harmful function, grant, policy hoặc index ordering
  drift; fresh-DB replay không có source-order conflict đã biết.
- **[FACT]** Không cần migration squash, metadata repair hoặc chỉnh
  `supabase_migrations.schema_migrations`.
- **[FACT]** 17 technical tables đều bật RLS; `anon` và `authenticated` không có
  direct table read/write.
- **[FACT]** 79/80 technical functions là `SECURITY DEFINER`; các definer
  functions đã kiểm tra đều có `search_path = public, pg_temp`.
- **[FACT]** Direct ranking call fail-closed cho missing claims và role `user`;
  raw `admin` và `global` được phép theo contract.
- **[FACT]** Discovery không tìm thấy release-blocking authorization, grants,
  RLS, JWT claim, role-normalization hoặc write-integrity gap.
- **[FACT]** 18 technical SQL contract files với 232 tests đã pass tại baseline
  discovery.
- **[FACT]** Discovery không thực hiện live DB write.

## Blocking gap

- **[FACT]** Ranking phase gate hiện kiểm tra correctness với 102 criteria và
  hơn 100 options.
- **[FACT]** Phase gate đó không chứa representative `EXPLAIN`; số plan match
  hiện là 0.
- **[FACT]** Live data chỉ có 1 option, 102 criteria và chưa có comparison
  set/assessment đại diện.
- **[FACT]** Read-only live plan ở dữ liệu nhỏ có execution khoảng 14,8 ms,
  planning khoảng 8,3 ms, 28 shared-hit blocks, không có read hoặc temp spill.
- **[INFERENCE]** Plan nhỏ chứng minh không có regression rõ ràng ở tiny scale,
  nhưng không đủ kết luận cho ranking universe hơn 100 options.
- **[INFERENCE]** Snapshot-token calculation chiếm phần đáng kể trong runtime đã
  quan sát, nhưng chưa đủ bằng chứng để gọi đây là query/index defect.

**Kết luận gap:** TC-20 DB prerequisite chưa có representative plan evidence
reviewable cho ranking ở quy mô đã được phase gate dùng để kiểm tra correctness.
Đây là blocking evidence gap duy nhất đã được xác nhận cho sequencing P13A.

## Vì sao không rewrite query/index theo suy đoán

- **[FACT]** Không có failing representative plan assertion để chỉ ra exact
  query/index invariant cần sửa.
- **[FACT]** Live plan hiện nhanh ở dữ liệu quá nhỏ; advisor noise không tự động
  tạo remediation scope.
- **[INFERENCE]** Rewrite trước evidence có thể thêm migration, index hoặc query
  complexity không cần thiết và làm tăng blast radius.
- **[INFERENCE]** Evidence-first giữ P13A-P2 ở phạm vi một gap tái lập được, đồng
  thời bảo toàn ranking result, pagination, score và eligibility contracts.
- **[PRODUCT DECISION]** Không thực hiện speculative query, index, cache hoặc
  denormalization rewrite trong P13A-P1 hay P13A-V.

## Scope và ownership

| Leaf    | Điều kiện vào                                | Ownership                                                                | Output bắt buộc                                                             | Không được làm                                                  |
| ------- | -------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| P13A-P1 | Bắt buộc sau P12C1                           | Representative ranking plan evidence và focused TC-20 DB assertions      | Reviewable plan/result artifact; pass hoặc exact reproducible failure       | Không sửa production RPC/index; không apply migration           |
| P13A-P2 | Chỉ khi P13A-P1 fail                         | Exact ranking query/index remediation được evidence chỉ ra               | RED assertion, minimal fix, before/after plan, migration/apply gate nếu cần | Không mở rộng sang adjacent DB hardening, UI hoặc semantics     |
| P13A-V  | P13A-P1 pass trực tiếp hoặc pass sau P13A-P2 | Final authorization, security, migration-order và performance acceptance | Final TC-02 + TC-20 evidence; chỉ thỏa DB/P13A dependency của P13C          | Không sửa production code, apply migration hoặc chạy live write |
| P13B    | Độc lập với split DB này                     | UI, accessibility, responsive, browser và regression hardening           | Real-browser screenshots/interactions và canonical UI regression evidence   | Không dùng P13A artifact thay cho browser evidence              |

Agent-browser và E2E/real-browser verification thuộc **P13B**. P13A chỉ sở hữu DB
prerequisite và không mở rộng sang desktop/mobile interaction coverage.
P13A-V chỉ thỏa dependency **DB/P13A** của P13C; final P13C còn bắt buộc P13B,
P7A2 và P9A3. P13C giữ ownership cho release, final acceptance, OpenSpec archive
và AI-boundary audit; artifact này không archive OpenSpec change.

## Dependency DAG

```text
P12C1 merged/applied/gated
          |
          v
P13A-P1 mandatory evidence
  | pass --------------------------------------------------+
  | fail -> P13A-P2 -> apply/gate -> rerun P13A-P1 green -+
                                                             |
                                                             v
                                                  P13A-V DB/P13A --+
P13B browser/E2E -----------------------------------------------+
P7A2 reference workspace ---------------------------------------+--> P13C
P9A3 import workspace ------------------------------------------+    release/acceptance/archive/AI audit
```

- **Direct path:** P13A-P1 pass, P13A-P2 không được instantiate, P13A-V được
  unblock.
- **Failure path:** P13A-P1 giữ trạng thái failed; P13A-V bị block cho đến khi
  P13A-P2 được apply/phase-gated và P13A-P1 rerun green.
- **P13A path:** Accepted P13A-V evidence chỉ hoàn tất dependency DB/P13A của
  P13C.
- **Final path:** P13C chỉ được unblock khi P13A-V, P13B, P7A2 và P9A3 đều hoàn
  tất; P13C sau đó mới sở hữu release review, final acceptance, OpenSpec archive
  và AI-boundary audit.

## Live-write approval boundaries

- Read-only catalog, advisor và `EXPLAIN` trên dữ liệu hiện có không cần write
  approval.
- Nếu P13A-P1 cần seed representative scale trên live trong rollback-only
  transaction, phải xin explicit user approval riêng ngay trước lần chạy qua
  Supabase MCP.
- P13A-P1 không apply migration và mọi scale seed đã được phê duyệt phải rollback
  sạch.
- P13A-P2 có thể chuẩn bị repo-only remediation trước approval.
- Mỗi P13A-P2 migration apply lên live cần một explicit user approval riêng.
- Rollback-only live phase gate sau apply cần một explicit user approval thứ hai;
  approval apply không bao hàm approval chạy gate.
- P13A-V cấm live write và migration apply. Gap mới phải tạo exact blocking fix
  leaf; approval thuộc leaf sửa đó, không thuộc artifact này.

## Deploy-safe states

| Boundary                        | Deploy-safe state                                                         |
| ------------------------------- | ------------------------------------------------------------------------- |
| Sau P13A-P1 merge               | Chỉ test/evidence; runtime và schema không đổi; P12C1 behavior giữ nguyên |
| P13A-P1 fail                    | Không deploy remediation suy đoán; P13A-V tiếp tục blocked                |
| P13A-P2 repo merge, trước apply | Production chưa đổi; migration chờ explicit approval                      |
| P13A-P2 apply + gate            | Chỉ exact remediation active; API result và paging contract không đổi     |
| Sau P13A-V merge                | Chỉ evidence/task state; runtime và DB state không đổi                    |

Không có trạng thái trung gian nào cho phép coi P13A hoàn tất chỉ vì artifact
decision này đã tồn tại.

## Canonical OpenSpec links

- Implementation plan:
  [P13A-P1](../implementation-plan.md#phase-p13a-p1---mandatory-representative-ranking-performance-evidence),
  [P13A-P2](../implementation-plan.md#phase-p13a-p2---conditional-ranking-query-remediation),
  [P13A-V](../implementation-plan.md#phase-p13a-v---final-database-security-and-performance-verification),
  [P13B](../implementation-plan.md#phase-p13b---ui-accessibility-and-regression-hardening),
  [P13C](../implementation-plan.md#phase-p13c---release-openspec-and-ai-boundary-audit).
- Tasks:
  [P13A-P1](../tasks.md#phase-p13a-p1---mandatory-representative-ranking-performance-evidence),
  [P13A-P2](../tasks.md#phase-p13a-p2---conditional-ranking-query-remediation),
  [P13A-V](../tasks.md#phase-p13a-v---final-database-security-and-performance-verification),
  [P13B](../tasks.md#phase-p13b---ui-accessibility-and-regression-hardening),
  [P13C](../tasks.md#phase-p13c---release-openspec-and-ai-boundary-audit).
- Contracts:
  [Frontend Surface Ownership](../contracts.md#frontend-surface-ownership),
  [Query And Performance Budgets](../contracts.md#query-and-performance-budgets),
  [Migration Order](../contracts.md#migration-order),
  [AI Boundary Audit](../contracts.md#ai-boundary-audit).
- Test matrix:
  [Contract](../test-matrix.md#contract),
  [Scenario Ownership](../test-matrix.md#scenario-ownership),
  [Matrix Budget](../test-matrix.md#matrix-budget).

## Non-completion notice

Tại thời điểm tạo artifact, các task P13A-P1, P13A-P2 và P13A-V trong
`tasks.md` vẫn là `[ ]`. Artifact này chỉ là decision record đã được product
owner chấp thuận ngày 2026-08-01; completion evidence phải được tạo bởi đúng leaf
và chỉ được dùng để check task sau khi các gate tương ứng thực sự pass.
