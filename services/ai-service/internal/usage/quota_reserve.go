package usage

import (
	"context"
	"errors"

	"example.com/shared-ai-service/internal/protocol"
)

// Reserve claims the request ID before any quota RPC. A second overlapping
// call returns 409 without calling ReserveQuota. The claim is released when
// reserve or the intent append fails.
func (b *QuotaBook) Reserve(ctx context.Context, request ReserveRequest) (Reservation, error) {
	if request.Caller == nil {
		return Reservation{}, protocol.NewError(503, protocol.CodeCapabilityUnavailable, "The quota caller is missing.", false)
	}
	if request.RequestID == "" {
		return Reservation{}, protocol.NewError(400, protocol.CodeInvalidRequest, "The request is missing a routing identifier.", false)
	}
	if err := ctx.Err(); err != nil {
		return Reservation{}, err
	}
	if err := b.claim(request.RequestID); err != nil {
		return Reservation{}, err
	}
	blocked, _, err := request.Caller.KillSwitch(ctx)
	if err != nil {
		b.releaseClaim(request.RequestID)
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return Reservation{}, err
		}
		return Reservation{}, protocol.NewError(429, protocol.CodeLimitExceeded, KillSwitchMessage, true)
	}
	if blocked {
		b.releaseClaim(request.RequestID)
		return Reservation{}, protocol.NewError(429, protocol.CodeLimitExceeded, KillSwitchMessage, true)
	}
	reservationID, err := request.Caller.ReserveQuota(ctx, request.TenantID)
	if err != nil || reservationID == "" {
		b.releaseClaim(request.RequestID)
		if err != nil {
			return Reservation{}, err
		}
		return Reservation{}, protocol.NewError(502, protocol.CodeProviderFailure, "The quota reservation is missing.", false)
	}
	ttl := request.TTL
	if ttl < protocol.ReservationTTL {
		ttl = protocol.ReservationTTL
	}
	expires := b.now().Add(ttl)
	line := journalLine{
		Kind: kindProviderIntent, ReservationID: reservationID, RequestID: request.RequestID,
		AttemptID: "1", ExpiresAt: formatExpiry(expires),
	}
	if err := b.appendLine(ctx, line); err != nil {
		b.releaseClaim(request.RequestID)
		if refundErr := request.Caller.FinalizeQuota(ctx, reservationID, rpcErrorNoUsage, 0, 0); refundErr != nil {
			return Reservation{}, errors.Join(err, refundErr)
		}
		return Reservation{}, err
	}
	b.mu.Lock()
	b.byReq[request.RequestID] = reservationID
	b.slots[reservationID] = &quotaSlot{
		requestID: request.RequestID, expires: expires, caller: request.Caller,
		attemptOrder: []string{"1"}, intents: map[string]struct{}{"1": {}}, usages: map[string]CallUsage{},
	}
	b.mu.Unlock()
	return Reservation{ID: reservationID, RequestID: request.RequestID, ExpiresAt: expires}, nil
}

func (b *QuotaBook) claim(requestID string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, exists := b.byReq[requestID]; exists {
		return alreadyReserved()
	}
	b.byReq[requestID] = ""
	return nil
}

func (b *QuotaBook) releaseClaim(requestID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if owner, ok := b.byReq[requestID]; ok && owner == "" {
		delete(b.byReq, requestID)
	}
}
