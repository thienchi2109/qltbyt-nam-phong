package qltbyt

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/usage"
)

func TestReserveUsesSelectedFacilityNotSessionFacility(t *testing.T) {
	broker := &spyBroker{bodies: map[string]json.RawMessage{
		RPCKillSwitch:   []byte(`{"enabled":false}`),
		RPCQuotaReserve: []byte(`{"allowed":true,"reservation_id":"res-selected"}`),
	}}
	assistant := testAssistant(broker, &spyQuery{})
	cred := testCredential("admin", facilityPtr(2), facilityPtr(9))
	prepared, err := assistant.Prepare(context.Background(), testRequest(t, cred, "xin chào", nil))
	if err != nil {
		t.Fatal(err)
	}
	if prepared.QuotaTenantID == nil || *prepared.QuotaTenantID != 9 || prepared.QuotaUserID != "42" {
		t.Fatalf("quota scope = %v user %s", prepared.QuotaTenantID, prepared.QuotaUserID)
	}
	book, err := usage.NewQuotaBook(t.TempDir(), func() time.Time { return fixedNow }, nil)
	if err != nil {
		t.Fatal(err)
	}
	reservation, err := book.Reserve(context.Background(), usage.ReserveRequest{
		RequestID: "req-facility",
		TenantID:  prepared.QuotaTenantID,
		UserID:    prepared.QuotaUserID,
		Role:      prepared.QuotaRole,
		Caller:    prepared.QuotaCaller,
	})
	if err != nil || reservation.ID != "res-selected" {
		t.Fatalf("reserve = %+v err=%v", reservation, err)
	}
	var payload string
	for _, call := range broker.snapshot() {
		if call.RPC == RPCQuotaReserve {
			payload = call.Payload
		}
	}
	for _, needle := range []string{`"p_user_id":"42"`, `"p_tenant_id":9`, `"p_rate_window_ms":60000`, `"p_rate_max":10`, `"p_user_daily_max":150`, `"p_tenant_daily_max":1500`, `"p_global_daily_max":5000`, `"p_ttl_ms":120000`} {
		if !strings.Contains(payload, needle) {
			t.Fatalf("missing %s in %s", needle, payload)
		}
	}
	if strings.Contains(payload, `"p_tenant_id":2`) || strings.Contains(payload, "Untrusted") || strings.Contains(payload, "12345") {
		t.Fatalf("payload widened facility or display name: %s", payload)
	}
	if protocol.ReservationTTL.Milliseconds() != 120000 {
		t.Fatalf("ttl = %d", protocol.ReservationTTL.Milliseconds())
	}
}

func TestReserveOmitsTenantWhenFacilityIsUnset(t *testing.T) {
	broker := &spyBroker{bodies: map[string]json.RawMessage{
		RPCKillSwitch:   []byte(`[{"enabled":false}]`),
		RPCQuotaReserve: []byte(`[{"allowed":true,"reservation_id":"res-null"}]`),
	}}
	assistant := testAssistant(broker, &spyQuery{})
	prepared, err := assistant.Prepare(context.Background(), testRequest(t, testCredential("technician", nil, nil), "xin chào", nil))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := prepared.QuotaCaller.ReserveQuota(context.Background(), prepared.QuotaTenantID); err != nil {
		t.Fatal(err)
	}
	payload := broker.snapshot()[len(broker.snapshot())-1].Payload
	if !strings.Contains(payload, `"p_tenant_id":null`) {
		t.Fatalf("payload = %s", payload)
	}
}
