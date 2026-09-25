package qltbyt

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"

	"example.com/shared-ai-service/internal/protocol"
)

type quotaCaller struct {
	assistant Assistant
	cred      Credential
	scope     Scope
}

func (c quotaCaller) KillSwitch(ctx context.Context) (bool, string, error) {
	return c.assistant.killSwitch(ctx, c.cred)
}

func (c quotaCaller) ReserveQuota(ctx context.Context, _ *int64) (string, error) {
	payload, err := json.Marshal(buildReservePayload(c.cred, c.scope))
	if err != nil {
		return "", err
	}
	raw, err := c.assistant.gate().Call(ctx, c.cred, RPCQuotaReserve, payload)
	if err != nil {
		return "", err
	}
	row, err := firstReserveRow(raw)
	if err != nil {
		return "", protocol.NewError(502, protocol.CodeProviderFailure, "The quota reservation is missing.", false)
	}
	if !row.Allowed || strings.TrimSpace(row.ReservationID) == "" {
		return "", protocol.NewError(429, protocol.CodeLimitExceeded, "AI usage quota exceeded.", true)
	}
	return row.ReservationID, nil
}

func (c quotaCaller) FinalizeQuota(ctx context.Context, reservationID string, status string, inputTokens, outputTokens int64) error {
	if strings.TrimSpace(reservationID) == "" {
		return protocol.NewError(400, protocol.CodeInvalidRequest, "The reservation is missing.", false)
	}
	payload, err := json.Marshal(finalizePayload{
		ReservationID: reservationID,
		Status:        status,
		TokensIn:      inputTokens,
		TokensOut:     outputTokens,
		CostUSD:       0,
	})
	if err != nil {
		return err
	}
	_, err = c.assistant.gate().Cleanup(ctx, c.cred, RPCQuotaFinalize, payload)
	return err
}

type reservePayload struct {
	UserID       string `json:"p_user_id"`
	TenantID     *int64 `json:"p_tenant_id"`
	RateWindowMS int64  `json:"p_rate_window_ms"`
	RateMax      int64  `json:"p_rate_max"`
	UserDailyMax int64  `json:"p_user_daily_max"`
	TenantDaily  int64  `json:"p_tenant_daily_max"`
	GlobalDaily  int64  `json:"p_global_daily_max"`
	TTLMS        int64  `json:"p_ttl_ms"`
}

func buildReservePayload(cred Credential, scope Scope) reservePayload {
	payload := reservePayload{
		UserID:       strconv.FormatInt(cred.UserID, 10),
		RateWindowMS: QuotaRateWindowMS,
		RateMax:      QuotaRateMax,
		UserDailyMax: QuotaUserDailyMax,
		TenantDaily:  QuotaTenantDailyMax,
		GlobalDaily:  QuotaGlobalDailyMax,
		TTLMS:        protocol.ReservationTTL.Milliseconds(),
	}
	if scope.EffectiveFacilityID > 0 {
		value := scope.EffectiveFacilityID
		payload.TenantID = &value
	}
	return payload
}

type finalizePayload struct {
	ReservationID string  `json:"p_reservation_id"`
	Status        string  `json:"p_status"`
	TokensIn      int64   `json:"p_tokens_in"`
	TokensOut     int64   `json:"p_tokens_out"`
	CostUSD       float64 `json:"p_cost_usd"`
}

type reserveRow struct {
	Allowed       bool   `json:"allowed"`
	ReservationID string `json:"reservation_id"`
}

func firstReserveRow(raw json.RawMessage) (reserveRow, error) {
	raw = bytesTrim(raw)
	if len(raw) == 0 {
		return reserveRow{}, protocol.NewError(502, protocol.CodeProviderFailure, "The quota reservation is missing.", false)
	}
	if raw[0] == '[' {
		var rows []reserveRow
		if err := json.Unmarshal(raw, &rows); err != nil || len(rows) == 0 {
			return reserveRow{}, protocol.NewError(502, protocol.CodeProviderFailure, "The quota reservation is missing.", false)
		}
		return rows[0], nil
	}
	var row reserveRow
	if err := json.Unmarshal(raw, &row); err != nil {
		return reserveRow{}, protocol.NewError(502, protocol.CodeProviderFailure, "The quota reservation is missing.", false)
	}
	return row, nil
}
