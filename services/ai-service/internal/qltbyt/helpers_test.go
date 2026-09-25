package qltbyt

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/protocol"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

var fixedNow = time.Unix(1_700_000_000, 0).UTC()

func testSecret() []byte { return []byte("broker-test-secret") }

func facilityPtr(value int64) *int64 { return &value }

func testCredential(role string, session, requested *int64) Credential {
	return Credential{
		Issuer:              BrokerIssuer,
		Audience:            BrokerAudience,
		IssuedAt:            fixedNow,
		ExpiresAt:           fixedNow.Add(time.Minute),
		UserID:              42,
		RawRole:             role,
		SessionFacilityID:   session,
		RequestedFacilityID: requested,
		ReservationID:       "reservation-1",
	}
}

func mustToken(t *testing.T, cred Credential) string {
	t.Helper()
	token, err := Mint(testSecret(), cred)
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func testRequest(t *testing.T, cred Credential, text string, tools []string) protocol.Request {
	t.Helper()
	return protocol.Request{
		ProtocolVersion:   protocol.ProtocolVersion,
		AppID:             AppID,
		CapabilityID:      CapabilityID,
		CapabilityVersion: Version,
		RequestID:         "req-phase2",
		Messages:          []protocol.Message{{Role: protocol.RoleUser, Content: text}},
		RequestedTools:    tools,
		Identity: protocol.Identity{
			Issuer:     BrokerIssuer,
			Audience:   "ai-service-v1",
			Tenant:     "999",
			TrustedApp: protocol.TrustedApp{AppID: AppID, CapabilityIDs: []string{CapabilityID}},
			CapabilityClaims: map[string]any{
				"broker_token": mustToken(t, cred),
			},
		},
		Context: map[string]any{
			"selected_facility_name": "Untrusted Display",
			"selected_facility_id":   "12345",
			"cookie":                 "session=browser",
		},
	}
}

func testAssistant(broker Broker, query QueryExecutor) Assistant {
	return Assistant{Broker: broker, Secret: testSecret(), Query: query, Now: func() time.Time { return fixedNow }}
}

type spyCall struct {
	RPC     string
	UserID  int64
	Payload string
}

type spyBroker struct {
	mu    sync.Mutex
	calls []spyCall
	fail  map[string]error
	body  json.RawMessage
	wait  bool
	start chan struct{}
	once  sync.Once
}

func (s *spyBroker) Call(ctx context.Context, cred Credential, rpc string, payload json.RawMessage) (json.RawMessage, error) {
	if s.start != nil {
		s.once.Do(func() { close(s.start) })
	}
	if s.wait {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	s.mu.Lock()
	s.calls = append(s.calls, spyCall{RPC: rpc, UserID: cred.UserID, Payload: string(payload)})
	s.mu.Unlock()
	if err := s.fail[rpc]; err != nil {
		return nil, err
	}
	if len(s.body) > 0 {
		return append(json.RawMessage(nil), s.body...), nil
	}
	return json.RawMessage(`{"data":[],"total":0}`), nil
}

func (s *spyBroker) snapshot() []spyCall {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]spyCall, len(s.calls))
	copy(out, s.calls)
	return out
}

type spyQuery struct {
	mu     sync.Mutex
	calls  []QueryCall
	err    error
	result QueryResult
	start  chan struct{}
	wait   bool
	once   sync.Once
}

func (s *spyQuery) Execute(ctx context.Context, call QueryCall) (QueryResult, error) {
	if s.start != nil {
		s.once.Do(func() { close(s.start) })
	}
	if s.wait {
		<-ctx.Done()
		return QueryResult{}, ctx.Err()
	}
	s.mu.Lock()
	s.calls = append(s.calls, call)
	s.mu.Unlock()
	if s.err != nil {
		return QueryResult{}, s.err
	}
	if len(s.result.Rows) == 0 && s.result.RowCount == 0 {
		return QueryResult{Rows: json.RawMessage(`[]`), RowCount: 0, PayloadBytes: 2}, nil
	}
	return s.result, nil
}

func (s *spyQuery) count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.calls)
}

type captureLog struct {
	mu    sync.Mutex
	lines []string
}

func (c *captureLog) Record(requestID, class string) {
	c.mu.Lock()
	c.lines = append(c.lines, requestID+" "+class)
	c.mu.Unlock()
}

func (c *captureLog) text() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return stringsJoin(c.lines)
}

func stringsJoin(lines []string) string {
	out := ""
	for _, line := range lines {
		out += line + "\n"
	}
	return out
}

type localSession struct {
	chat model.ToolCallingChatModel
}

func (s localSession) AttemptLimit() int      { return 1 }
func (s localSession) RotateOnQuota(int) bool { return false }
func (s localSession) ChatModel(context.Context) (model.ToolCallingChatModel, int, error) {
	return s.chat, 0, nil
}
func (s localSession) StructuredModel(context.Context) (model.ToolCallingChatModel, error) {
	return s.chat, nil
}

type localModel struct{}

func (localModel) WithTools([]*schema.ToolInfo) (model.ToolCallingChatModel, error) {
	return localModel{}, nil
}
func (localModel) Generate(context.Context, []*schema.Message, ...model.Option) (*schema.Message, error) {
	return schema.AssistantMessage("ok", nil), nil
}
func (localModel) Stream(context.Context, []*schema.Message, ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	return schema.StreamReaderFromArray([]*schema.Message{schema.AssistantMessage("ok", nil)}), nil
}
