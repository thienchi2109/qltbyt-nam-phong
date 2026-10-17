# Temperature Monitoring Backlog

## Master reference

- Spec: [`docs/specs/temperature-monitoring.md`](../../docs/specs/temperature-monitoring.md)
- Scope: module Temperature Monitoring nằm trong Equipment hiện tại; không tạo microservice và không liên quan LabOps.

## Mandatory takeover rule

Spec chỉ là master plan định hướng ban đầu, không phải implementation plan đã chốt.
Trước khi bắt đầu **mỗi Task/Phase**, agent tiếp quản phải:

1. khảo sát read-only codebase, schema, RPC, quyền và test seam liên quan;
2. ghi nhận các điểm chạm, giả định, rủi ro và thay đổi so với spec;
3. lập implementation plan chi tiết riêng cho đúng Task/Phase đó;
4. dừng để review plan trước khi sửa code, migration hoặc dữ liệu.

Không gộp khảo sát/plan của một phase để biện minh cho phase khác. Mọi thay đổi phải giữ đúng phạm vi task và cập nhật dependency/evidence trong task tương ứng.

## Phase map

| ID    | Task                                              | Depends on          | Outcome                                                        |
| ----- | ------------------------------------------------- | ------------------- | -------------------------------------------------------------- |
| TM-01 | Domain contract and seam survey                   | None                | Contract, invariants and test seams ready for implementation   |
| TM-02 | Monitoring configuration and effective versions   | TM-01               | Per-equipment configuration with threshold snapshots           |
| TM-03 | Schedules, shifts and missing-slot projection     | TM-01, TM-02        | Server-side expected slots and Chưa ghi state                  |
| TM-04 | Measurement entry and duplicate guard             | TM-02, TM-03        | One device-day-shift measurement with server conflict handling |
| TM-05 | Confirmation, amendment and audit history         | TM-04               | Immutable confirmed readings and review workflow               |
| TM-06 | Deviation and corrective action workflow          | TM-04, TM-05        | Out-of-range deviation lifecycle                               |
| TM-07 | Mobile logbook workspace                          | TM-03, TM-04, TM-06 | Single-workspace daily/shift entry experience                  |
| TM-08 | Trend chart and accessible data view              | TM-04, TM-06        | Threshold-aware chart with point details and table fallback    |
| TM-09 | Long-range export                                 | TM-04, TM-05, TM-06 | Authorized export beyond the 90-day UI window                  |
| TM-10 | Integration, performance and release verification | TM-02..TM-09        | Cross-seam acceptance and operational handoff                  |

## Status vocabulary

Use Markdown status fields in each task: `Todo`, `In Progress`, `Blocked`, `Done`.
Do not mark a task `Done` until its task-level plan, implementation evidence and focused verification are recorded.
