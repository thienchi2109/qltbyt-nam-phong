package qltbyt

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
)

func TestHTTPBrokerPropagatesOpaqueTokenAndCallOperation(t *testing.T) {
	cred := testCredential("technician", facilityPtr(7), nil)
	token := mustToken(t, cred)
	parsed, err := parseCredential(testSecret(), token, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost || request.URL.Path != "/api/internal/ai/broker/v1" {
			t.Fatalf("request = %s %s", request.Method, request.URL.Path)
		}
		if got := request.Header.Get("Authorization"); got != "Bearer "+token {
			t.Fatalf("authorization = %q", got)
		}
		var body struct {
			ProtocolVersion string          `json:"protocol_version"`
			RequestID       string          `json:"request_id"`
			Operation       string          `json:"operation"`
			RPC             string          `json:"rpc"`
			Payload         json.RawMessage `json:"payload"`
		}
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.ProtocolVersion != "v1" || body.Operation != string(OperationCall) || body.RPC != RPCAudit || body.RequestID != "req-valid-01" || request.Header.Get("X-Request-ID") != body.RequestID {
			t.Fatalf("envelope = %+v", body)
		}
		if string(body.Payload) != `{"p_status":"success"}` {
			t.Fatalf("payload = %s", body.Payload)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"protocol_version":"v1","request_id":"` + body.RequestID + `","rpc":"` + RPCAudit + `","result":true}`))
	}))
	defer server.Close()

	broker, err := NewHTTPBroker(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	result, err := broker.Call(WithRequestID(context.Background(), "req-valid-01"), parsed, RPCAudit, json.RawMessage(`{"p_status":"success"}`))
	if err != nil {
		t.Fatal(err)
	}
	if string(result) != "true" {
		t.Fatalf("result = %s", result)
	}
}

func TestHTTPBrokerRejectsMismatchedResponseEnvelope(t *testing.T) {
	cred := testCredential("technician", facilityPtr(7), nil)
	token := mustToken(t, cred)
	parsed, err := parseCredential(testSecret(), token, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"protocol_version":"v1","request_id":"other-request","rpc":"` + RPCAudit + `","result":true}`))
	}))
	defer server.Close()
	broker, err := NewHTTPBroker(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	_, err = broker.Call(WithRequestID(context.Background(), "req-envelope"), parsed, RPCAudit, json.RawMessage(`{"p_status":"success"}`))
	if err == nil || !strings.Contains(err.Error(), "data broker response is invalid") {
		t.Fatalf("mismatched response error = %v", err)
	}
}

func TestHTTPBrokerRegeneratesInvalidRequestID(t *testing.T) {
	cred := testCredential("technician", facilityPtr(7), nil)
	token := mustToken(t, cred)
	parsed, err := parseCredential(testSecret(), token, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		var body struct {
			RequestID string `json:"request_id"`
			RPC       string `json:"rpc"`
		}
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.RequestID == "bad/id" || !regexp.MustCompile(`^[A-Za-z0-9._:-]{1,128}$`).MatchString(body.RequestID) {
			t.Fatalf("request id = %q", body.RequestID)
		}
		if request.Header.Get("X-Request-ID") != body.RequestID {
			t.Fatalf("header request id = %q, body = %q", request.Header.Get("X-Request-ID"), body.RequestID)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"protocol_version":"v1","request_id":"` + body.RequestID + `","rpc":"` + body.RPC + `","result":true}`))
	}))
	defer server.Close()
	broker, err := NewHTTPBroker(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := broker.Call(WithRequestID(context.Background(), "bad/id"), parsed, RPCAudit, json.RawMessage(`{"p_status":"success"}`)); err != nil {
		t.Fatal(err)
	}
}

func TestHTTPBrokerCleanupPreservesCleanupOperationAndRejectsMismatch(t *testing.T) {
	cred := testCredential("admin", nil, facilityPtr(7))
	token := mustToken(t, cred)
	cred, err := parseCredential(testSecret(), token, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	operations := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		var body struct {
			Operation string `json:"operation"`
			RPC       string `json:"rpc"`
			RequestID string `json:"request_id"`
		}
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		operations <- body.Operation + ":" + body.RPC
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"protocol_version":"v1","request_id":"` + body.RequestID + `","rpc":"` + body.RPC + `","result":null}`))
	}))
	defer server.Close()
	broker, err := NewHTTPBroker(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := broker.Cleanup(context.Background(), cred, RPCQuotaFinalize, json.RawMessage(`{"p_reservation_id":"r-1"}`)); err != nil {
		t.Fatal(err)
	}
	if got := <-operations; got != "cleanup:"+RPCQuotaFinalize {
		t.Fatalf("operation = %q", got)
	}
	if _, err := broker.Cleanup(context.Background(), cred, RPCQuotaReserve, json.RawMessage(`{}`)); err == nil {
		t.Fatal("cleanup reserve was accepted")
	}
	select {
	case got := <-operations:
		t.Fatalf("mismatched cleanup reached server: %s", got)
	default:
	}
}

func TestHTTPBrokerRequiresParsedBrokerToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("request reached server without an opaque token")
	}))
	defer server.Close()
	broker, err := NewHTTPBroker(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	_, err = broker.Call(context.Background(), testCredential("technician", facilityPtr(7), nil), RPCAudit, json.RawMessage(`{}`))
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "authorized") {
		t.Fatalf("missing token error = %v", err)
	}
}

func TestHTTPBrokerPropagatesCancellation(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		close(started)
		select {
		case <-request.Context().Done():
		case <-release:
		}
	}))
	defer func() {
		close(release)
		server.Close()
	}()
	cred := testCredential("technician", facilityPtr(7), nil)
	token := mustToken(t, cred)
	cred, err := parseCredential(testSecret(), token, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	broker, err := NewHTTPBroker(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		_, callErr := broker.Call(ctx, cred, RPCAudit, json.RawMessage(`{}`))
		done <- callErr
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("request did not start")
	}
	cancel()
	select {
	case callErr := <-done:
		if callErr == nil {
			t.Fatal("canceled request succeeded")
		}
	case <-time.After(time.Second):
		t.Fatal("canceled request did not return")
	}
}

func TestParseCredentialRejectsInvalidFacilityClaims(t *testing.T) {
	for _, tc := range []struct {
		name   string
		mutate func(*Credential)
	}{
		{name: "zero session", mutate: func(cred *Credential) { cred.SessionFacilityID = facilityPtr(0) }},
		{name: "negative requested", mutate: func(cred *Credential) { cred.RequestedFacilityID = facilityPtr(-1) }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cred := testCredential("admin", facilityPtr(7), facilityPtr(9))
			tc.mutate(&cred)
			token := mustToken(t, cred)
			if _, err := parseCredential(testSecret(), token, fixedNow); err == nil {
				t.Fatal("invalid facility claim was accepted")
			}
		})
	}
	for _, payload := range []string{
		`{"iss":"nextjs-bff","aud":"qltbyt-rpc-broker-v1","iat":1700000000,"exp":1700000060,"user_id":42,"session_facility_id":null}`,
		`{"iss":"nextjs-bff","aud":"qltbyt-rpc-broker-v1","iat":1700000000,"exp":1700000060,"user_id":42,"session_facility_id":"7"}`,
		`{"iss":"nextjs-bff","aud":"qltbyt-rpc-broker-v1","iat":1700000000,"exp":1700000060,"user_id":42}`,
		`{"iss":"nextjs-bff","aud":"qltbyt-rpc-broker-v1","iat":1700000000,"exp":1700000060,"user_id":42,"role":" "}`,
		`{"iss":"nextjs-bff","aud":"qltbyt-rpc-broker-v1","iat":1700000000,"exp":1700000060,"user_id":42,"unexpected":true}`,
	} {
		token := signRawCredential(payload, testSecret())
		if _, err := parseCredential(testSecret(), token, fixedNow); err == nil {
			t.Fatalf("malformed credential was accepted: %s", payload)
		}
	}
}

func signRawCredential(payload string, secret []byte) string {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString([]byte(payload)) + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func TestRegisterRejectsIncompleteAssistantComposition(t *testing.T) {
	for _, assistant := range []Assistant{
		{Secret: testSecret(), Broker: &spyBroker{}},
		{Secret: testSecret(), Query: &spyQuery{}},
		{Broker: &spyBroker{}, Query: &spyQuery{}},
	} {
		reg := registry.New()
		if err := Register(reg, assistant); err == nil {
			t.Fatal("incomplete assistant was registered")
		}
		if _, err := reg.Lookup(AppID, CapabilityID, Version); err == nil {
			t.Fatal("incomplete assistant made the tuple visible")
		}
	}
}

func TestGatePreservesCallAndCleanupOperations(t *testing.T) {
	spy := &operationSpyBroker{}
	assistant := testAssistant(spy, &spyQuery{})
	cred := testCredential("admin", nil, facilityPtr(7))
	if _, err := assistant.gate().Call(context.Background(), cred, RPCAudit, json.RawMessage(`{"p_status":"success"}`)); err != nil {
		t.Fatal(err)
	}
	if _, err := assistant.gate().Cleanup(context.Background(), cred, RPCQuotaFinalize, json.RawMessage(`{"p_reservation_id":"r-1"}`)); err != nil {
		t.Fatal(err)
	}
	if len(spy.operations) != 2 || spy.operations[0] != OperationCall || spy.operations[1] != OperationCleanup {
		t.Fatalf("operations = %v", spy.operations)
	}
}

func TestGateCleanupFallsBackToOperationAwareBroker(t *testing.T) {
	spy := &operationOnlySpyBroker{}
	assistant := testAssistant(spy, &spyQuery{})
	cred := testCredential("admin", nil, facilityPtr(7))
	if _, err := assistant.gate().Cleanup(context.Background(), cred, RPCAudit, json.RawMessage(`{"p_status":"failure"}`)); err != nil {
		t.Fatal(err)
	}
	if len(spy.operations) != 1 || spy.operations[0] != OperationCleanup {
		t.Fatalf("operations = %v", spy.operations)
	}
}

func TestGateCleanupFailsClosedWithoutCleanupOperation(t *testing.T) {
	spy := &spyBroker{}
	assistant := testAssistant(spy, &spyQuery{})
	cred := testCredential("admin", nil, facilityPtr(7))
	_, err := assistant.gate().Cleanup(context.Background(), cred, RPCAudit, json.RawMessage(`{"p_status":"failure"}`))
	if err == nil || !strings.Contains(err.Error(), "does not support cleanup") {
		t.Fatalf("cleanup error = %v", err)
	}
	var serviceErr *protocol.Error
	if !errors.As(err, &serviceErr) || serviceErr.Status != 503 || serviceErr.Code != protocol.CodeCapabilityUnavailable {
		t.Fatalf("cleanup error contract = %v", err)
	}
	if calls := spy.snapshot(); len(calls) != 0 {
		t.Fatalf("plain broker received cleanup call: %+v", calls)
	}
}

func TestAssistantDependenciesRejectTypedNilInterfaces(t *testing.T) {
	var nilBroker *operationOnlySpyBroker
	var nilQuery *spyQuery
	for _, assistant := range []Assistant{
		{Broker: nilBroker, Query: &spyQuery{}, Secret: testSecret()},
		{Broker: &spyBroker{}, Query: nilQuery, Secret: testSecret()},
	} {
		if assistant.DependenciesReady() {
			t.Fatal("typed-nil dependency was reported ready")
		}
		if err := Register(registry.New(), assistant); err == nil {
			t.Fatal("typed-nil dependency was registered")
		}
	}
}

type operationSpyBroker struct {
	operations []Operation
}

type operationOnlySpyBroker struct {
	operations []Operation
}

func (s *operationOnlySpyBroker) Call(context.Context, Credential, string, json.RawMessage) (json.RawMessage, error) {
	return json.RawMessage(`true`), nil
}

func (s *operationOnlySpyBroker) CallOperation(_ context.Context, operation Operation, _ Credential, _ string, _ json.RawMessage) (json.RawMessage, error) {
	s.operations = append(s.operations, operation)
	return json.RawMessage(`true`), nil
}

type blockingOperationBroker struct {
	start chan struct{}
}

func (*blockingOperationBroker) Call(context.Context, Credential, string, json.RawMessage) (json.RawMessage, error) {
	return json.RawMessage(`true`), nil
}

func (b *blockingOperationBroker) CallOperation(ctx context.Context, _ Operation, _ Credential, _ string, _ json.RawMessage) (json.RawMessage, error) {
	close(b.start)
	<-ctx.Done()
	return nil, ctx.Err()
}

func (s *operationSpyBroker) Call(context.Context, Credential, string, json.RawMessage) (json.RawMessage, error) {
	return json.RawMessage(`true`), nil
}

func (s *operationSpyBroker) CallOperation(_ context.Context, operation Operation, _ Credential, _ string, _ json.RawMessage) (json.RawMessage, error) {
	s.operations = append(s.operations, operation)
	return json.RawMessage(`true`), nil
}

func (s *operationSpyBroker) Cleanup(_ context.Context, _ Credential, _ string, _ json.RawMessage) (json.RawMessage, error) {
	s.operations = append(s.operations, OperationCleanup)
	return json.RawMessage(`true`), nil
}
