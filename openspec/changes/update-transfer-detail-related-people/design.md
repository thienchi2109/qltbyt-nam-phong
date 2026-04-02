## Context

The Transfers page currently opens `TransferDetailDialog` from list-row data mapped through `mapToTransferRequest()`. That mapping preserves requester and approver IDs but drops nested user objects, while the dialog only renders `Người liên quan` from nested `nguoi_yeu_cau` and `nguoi_duyet`.

We explicitly do not want to solve this by enriching every transfer list or kanban row. The related-people requirement belongs to the detail surface, not to the list contract.

The separate `Lịch sử thay đổi` bug is out of scope for this change and must not influence the detail-dialog read contract here.

## Goals

- Restore requester and approver rendering for the Transfers detail dialog across statuses.
- Keep transfer list and kanban payloads lightweight.
- Use a dedicated detail read path for dialog-only data.
- Implement under strict TDD so the regression is captured before production code changes.

## Non-Goals

- No transfer-history redesign.
- No new related-person roles beyond requester and approver.
- No transfer workflow mutation changes.
- No list or kanban payload enrichment unless it is required solely to preserve backward compatibility.

## Decision

Use a dedicated transfer-detail read path for the dialog instead of enriching `transfer_request_list`.

This keeps the list contract optimized for rows and avoids coupling all transfer surfaces to dialog-only user data. The detail read path will be `public.transfer_request_get(p_id int)`, following the existing `_get` naming pattern already used by `equipment_get` and `repair_request_get`.

The `transfer_request_get(p_id)` contract should accept:
- `p_id: int`

The `transfer_request_get(p_id)` contract should return:
- a single transfer detail record shaped for `TransferRequest`
- nested `nguoi_yeu_cau` and `nguoi_duyet` user objects when resolvable
- `null` for `nguoi_yeu_cau` or `nguoi_duyet` when the referenced user cannot be resolved

Frontend callers should treat this as the authoritative detail payload for `Người liên quan`. List and kanban row DTOs remain lightweight and should continue to carry only row-safe fields.

## TDD Delivery Plan

1. RED
   - Add focused failing tests at the row-open seam and dialog render boundary:
     - opening detail from a list row with IDs only calls `transfer_request_get(p_id)` and renders requester and approver after detail resolution
     - pending transfer shows requester only when approver is absent
     - unresolved requester or approver user references do not crash the dialog and only render resolvable rows
2. GREEN
   - Add the minimal `transfer_request_get(p_id)` read path and wire the detail-open flow to it.
   - Keep all non-people sections unchanged.
3. REFACTOR
   - Simplify type boundaries between list rows and detail payloads.
   - Remove any redundant mapping logic that still assumes related people come from list-row enrichment.

## Testing Strategy

- Prefer focused interaction tests that span `list row -> open detail -> transfer_request_get(p_id) -> dialog render` instead of isolated dialog-only tests, because the existing regression starts before the dialog receives resolved user objects.
- Keep dialog-level rendering tests for null-handling states once the detail payload has been resolved.
- Mock the `transfer_request_get(p_id)` contract directly with:
  - request args: `{ p_id: number }`
  - response: `TransferRequest | null` with nullable nested `nguoi_yeu_cau` and `nguoi_duyet`
- Assert visible user-facing names and the absence of empty related-person rows.
- Verify the RED phase by running only the new focused tests and confirming failure for the expected reason before implementation.
- After GREEN, run the same focused tests plus required typecheck and repository verification gates.
