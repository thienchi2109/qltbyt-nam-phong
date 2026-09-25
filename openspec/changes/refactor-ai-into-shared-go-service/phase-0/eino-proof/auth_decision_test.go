package phase0proof

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"errors"
	"testing"
	"time"
)

const (
	credentialIssuer   = "nextjs-bff"
	credentialAudience = "qltbyt-rpc-broker-v1"
	credentialTTL      = 120 * time.Second
	cleanupBudget      = 5 * time.Second
)

var allowedBrokerRPCs = map[string]struct{}{
	"ai_quota_reserve":                   {},
	"ai_quota_finalize":                  {},
	"assistant_query_database_audit_log": {},
}

type brokerClaims struct {
	Issuer        string    `json:"iss"`
	Audience      string    `json:"aud"`
	IssuedAt      time.Time `json:"iat"`
	ExpiresAt     time.Time `json:"exp"`
	RPCName       string    `json:"rpc"`
	UserID        int64     `json:"user_id"`
	FacilityID    int64     `json:"facility_id"`
	ReservationID string    `json:"reservation_id,omitempty"`
}

type signedBrokerEnvelope struct {
	Claims        brokerClaims
	Signature     []byte
	BrowserCookie string
}

type brokerRPC struct {
	Name           string
	UserID         int64
	FacilityID     int64
	ReservationID  string
	SQLShape       string
	ToolPath       string
	Status         string
	ErrorClass     string
	FacilitySource string
}

type trustedBFFIdentity struct {
	UserID     int64
	FacilityID int64
}

type brokerRequest struct {
	RPCName           string
	ReservationID     string
	RequestedUserID   int64
	RequestedFacility int64
}

func signBrokerClaims(claims brokerClaims, privateKey ed25519.PrivateKey) signedBrokerEnvelope {
	payload, err := json.Marshal(claims)
	if err != nil {
		panic(err)
	}
	return signedBrokerEnvelope{Claims: claims, Signature: ed25519.Sign(privateKey, payload)}
}

func mintBrokerEnvelope(now time.Time, identity trustedBFFIdentity, request brokerRequest, privateKey ed25519.PrivateKey) signedBrokerEnvelope {
	return signBrokerClaims(brokerClaims{
		Issuer:        credentialIssuer,
		Audience:      credentialAudience,
		IssuedAt:      now,
		ExpiresAt:     now.Add(credentialTTL),
		RPCName:       request.RPCName,
		UserID:        identity.UserID,
		FacilityID:    identity.FacilityID,
		ReservationID: request.ReservationID,
	}, privateKey)
}

func validateBrokerEnvelope(now time.Time, envelope signedBrokerEnvelope, publicKey ed25519.PublicKey) error {
	claims := envelope.Claims
	if envelope.BrowserCookie != "" {
		return errors.New("browser cookie is not broker authentication")
	}
	if claims.Issuer != credentialIssuer || claims.Audience != credentialAudience {
		return errors.New("issuer or audience mismatch")
	}
	if claims.UserID <= 0 || claims.FacilityID <= 0 || claims.RPCName == "" {
		return errors.New("trusted numeric identity or RPC is missing")
	}
	if claims.IssuedAt.After(now) || !claims.ExpiresAt.After(now) || claims.ExpiresAt.Before(claims.IssuedAt) || claims.ExpiresAt.Sub(claims.IssuedAt) > credentialTTL {
		return errors.New("credential lifetime is invalid")
	}
	if _, ok := allowedBrokerRPCs[claims.RPCName]; !ok {
		return errors.New("RPC is outside the broker allowlist")
	}
	payload, err := json.Marshal(claims)
	if err != nil || !ed25519.Verify(publicKey, payload, envelope.Signature) {
		return errors.New("broker signature is invalid")
	}
	return nil
}

func authorizeBrokerCall(now time.Time, envelope signedBrokerEnvelope, publicKey ed25519.PublicKey) (brokerRPC, error) {
	if err := validateBrokerEnvelope(now, envelope, publicKey); err != nil {
		return brokerRPC{}, err
	}
	claims := envelope.Claims
	return brokerRPC{
		Name:          claims.RPCName,
		UserID:        claims.UserID,
		FacilityID:    claims.FacilityID,
		ReservationID: claims.ReservationID,
	}, nil
}

func authorizeQuotaCleanup(now time.Time, envelope signedBrokerEnvelope, publicKey ed25519.PublicKey, reservationID string, budget time.Duration) error {
	call, err := authorizeBrokerCall(now, envelope, publicKey)
	if err != nil {
		return err
	}
	if call.Name != "ai_quota_finalize" || call.ReservationID == "" || call.ReservationID != reservationID {
		return errors.New("quota cleanup is outside the reservation scope")
	}
	if budget <= 0 || budget > cleanupBudget {
		return errors.New("quota cleanup budget is unbounded")
	}
	return nil
}

func dispatchBrokerRPC(ctx context.Context, call brokerRPC, execute func(context.Context, brokerRPC) error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	return execute(ctx, call)
}

func dispatchQuotaCleanup(
	parent context.Context,
	now time.Time,
	envelope signedBrokerEnvelope,
	publicKey ed25519.PublicKey,
	reservationID string,
	budget time.Duration,
	execute func(context.Context, brokerRPC) error,
) error {
	if err := authorizeQuotaCleanup(now, envelope, publicKey, reservationID, budget); err != nil {
		return err
	}
	call, err := authorizeBrokerCall(now, envelope, publicKey)
	if err != nil {
		return err
	}
	cleanupContext, cancel := context.WithTimeout(parent, budget)
	defer cancel()
	return dispatchBrokerRPC(cleanupContext, call, execute)
}

func auditCall(call brokerRPC, sqlShape, status, errorClass, facilitySource string) (brokerRPC, error) {
	if call.Name != "assistant_query_database_audit_log" {
		return brokerRPC{}, errors.New("audit RPC is outside the broker call")
	}
	if len(sqlShape) == 0 || len(sqlShape) > 1000 || call.UserID <= 0 || call.FacilityID <= 0 {
		return brokerRPC{}, errors.New("audit fields are invalid")
	}
	if call.ToolPath != "query_database" {
		return brokerRPC{}, errors.New("audit tool path is invalid")
	}
	if status != "success" && status != "failure" {
		return brokerRPC{}, errors.New("audit status is invalid")
	}
	if facilitySource != "selected" && facilitySource != "session" {
		return brokerRPC{}, errors.New("audit facility source is invalid")
	}
	if status == "failure" && errorClass == "" {
		return brokerRPC{}, errors.New("failure audit needs an error class")
	}
	call.SQLShape = sqlShape
	call.ToolPath = "query_database"
	call.Status = status
	call.ErrorClass = errorClass
	call.FacilitySource = facilitySource
	return call, nil
}

func testBrokerEnvelope(t *testing.T, now time.Time, rpcName string) (signedBrokerEnvelope, ed25519.PublicKey) {
	t.Helper()
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	return mintBrokerEnvelope(now, trustedBFFIdentity{UserID: 42, FacilityID: 7}, brokerRequest{
		RPCName:           rpcName,
		ReservationID:     "reservation-1",
		RequestedUserID:   999,
		RequestedFacility: 999,
	}, privateKey), publicKey
}

func TestBFFRPCBrokerDerivesIdentityFromTrustedSession(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	envelope := mintBrokerEnvelope(now, trustedBFFIdentity{UserID: 42, FacilityID: 7}, brokerRequest{
		RPCName:           "ai_quota_reserve",
		RequestedUserID:   999,
		RequestedFacility: 999,
	}, privateKey)
	call, err := authorizeBrokerCall(now, envelope, publicKey)
	if err != nil {
		t.Fatal(err)
	}
	if call.UserID != 42 || call.FacilityID != 7 {
		t.Fatalf("broker trusted identity = (%d, %d), want (42, 7)", call.UserID, call.FacilityID)
	}
}

func TestBFFRPCBrokerAcceptsTrustedScopedAuditCall(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	envelope, publicKey := testBrokerEnvelope(t, now, "assistant_query_database_audit_log")
	call, err := authorizeBrokerCall(now.Add(time.Second), envelope, publicKey)
	if err != nil {
		t.Fatal(err)
	}
	call.ToolPath = "query_database"
	call, err = auditCall(call, "SELECT equipment_id FROM equipment WHERE id = $1", "success", "", "selected")
	if err != nil {
		t.Fatal(err)
	}
	if call.UserID != 42 || call.FacilityID != 7 || call.ToolPath != "query_database" || call.Status != "success" {
		t.Fatalf("brokered audit call = %+v", call)
	}
}

func TestBFFRPCBrokerAllowlistIncludesQuotaReserve(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	envelope, publicKey := testBrokerEnvelope(t, now, "ai_quota_reserve")
	call, err := authorizeBrokerCall(now, envelope, publicKey)
	if err != nil {
		t.Fatal(err)
	}
	if call.Name != "ai_quota_reserve" || call.UserID != 42 || call.FacilityID != 7 {
		t.Fatalf("brokered reserve call = %+v", call)
	}
}

func TestBFFRPCBrokerRejectsForgedClaimsAndUnsafeCalls(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	envelope, publicKey := testBrokerEnvelope(t, now, "assistant_query_database_audit_log")
	cases := []struct {
		name   string
		change func(*signedBrokerEnvelope)
	}{
		{name: "expired", change: func(value *signedBrokerEnvelope) { value.Claims.ExpiresAt = now.Add(-time.Second) }},
		{name: "wrong audience", change: func(value *signedBrokerEnvelope) { value.Claims.Audience = "browser" }},
		{name: "forged user id", change: func(value *signedBrokerEnvelope) { value.Claims.UserID = 999 }},
		{name: "browser cookie", change: func(value *signedBrokerEnvelope) { value.BrowserCookie = "session=untrusted" }},
		{name: "unallowlisted RPC", change: func(value *signedBrokerEnvelope) { value.Claims.RPCName = "admin_delete_everything" }},
		{name: "missing numeric user", change: func(value *signedBrokerEnvelope) { value.Claims.UserID = 0 }},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			candidate := envelope
			test.change(&candidate)
			if err := validateBrokerEnvelope(now, candidate, publicKey); err == nil {
				t.Fatal("unsafe broker credential was accepted")
			}
		})
	}
}
