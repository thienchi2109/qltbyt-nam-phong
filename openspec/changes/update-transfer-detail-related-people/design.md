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

This keeps the list contract optimized for rows and avoids coupling all transfer surfaces to dialog-only user data. The detail read path should return the base transfer record plus nested `nguoi_yeu_cau` and `nguoi_duyet` user objects when resolvable.

## TDD Delivery Plan

1. RED
   - Add focused failing tests for the dialog behavior:
     - completed or approved transfer shows requester and approver after detail resolution
     - pending transfer shows requester only when approver is absent
     - list-row payload with IDs only still resolves related people through the detail read path
2. GREEN
   - Add the minimal detail read path and wire the dialog to it.
   - Keep all non-people sections unchanged.
3. REFACTOR
   - Simplify type boundaries between list rows and detail payloads.
   - Remove any redundant mapping logic that still assumes related people come from list-row enrichment.

## Testing Strategy

- Prefer dialog-level tests over broad page tests so the regression is isolated.
- Mock the detail RPC contract directly and assert visible user-facing names.
- Verify the RED phase by running only the new focused tests and confirming failure for the expected reason before implementation.
- After GREEN, run the same focused tests plus required typecheck and repository verification gates.
