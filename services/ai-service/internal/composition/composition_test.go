package composition

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"example.com/shared-ai-service/internal/qltbyt"
	"example.com/shared-ai-service/internal/registry"
)

func TestRegisterQLTBYTRequiresEveryRuntimeDependency(t *testing.T) {
	for _, dependencies := range []Dependencies{
		{Broker: &fakeBroker{}},
		{Query: &fakeQuery{}},
		{Broker: &fakeBroker{}, Query: &fakeQuery{}},
	} {
		reg := registry.New()
		if RegisterQLTBYT(reg, dependencies) {
			t.Fatal("incomplete dependency tuple was registered")
		}
		if _, err := reg.Lookup(qltbyt.AppID, qltbyt.CapabilityID, qltbyt.Version); err == nil {
			t.Fatal("incomplete dependency tuple became visible")
		}
	}
}

func TestRegisterQLTBYTReadinessMatrixRejectsNilBrokerQueryAndRegistry(t *testing.T) {
	cases := []struct {
		name         string
		reg          *registry.Registry
		dependencies Dependencies
	}{
		{name: "nil broker", reg: registry.New(), dependencies: Dependencies{Query: &fakeQuery{}, BrokerSecret: []byte("secret")}},
		{name: "nil query executor", reg: registry.New(), dependencies: Dependencies{Broker: &fakeBroker{}, BrokerSecret: []byte("secret")}},
		{name: "nil registry", dependencies: Dependencies{Broker: &fakeBroker{}, Query: &fakeQuery{}, BrokerSecret: []byte("secret")}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if RegisterQLTBYT(tc.reg, tc.dependencies) {
				t.Fatal("incomplete dependency tuple was registered")
			}
			if tc.reg != nil {
				if _, err := tc.reg.Lookup(qltbyt.AppID, qltbyt.CapabilityID, qltbyt.Version); err == nil {
					t.Fatal("incomplete dependency tuple became visible")
				}
			}
		})
	}
}

func TestRegisterQLTBYTRejectsTypedNilDependencies(t *testing.T) {
	var nilBroker *fakeBroker
	var nilQuery *fakeQuery
	for _, tc := range []struct {
		name string
		deps Dependencies
	}{
		{name: "typed nil broker", deps: Dependencies{Broker: nilBroker, Query: &fakeQuery{}, BrokerSecret: []byte("secret")}},
		{name: "typed nil query executor", deps: Dependencies{Broker: &fakeBroker{}, Query: nilQuery, BrokerSecret: []byte("secret")}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			reg := registry.New()
			if RegisterQLTBYT(reg, tc.deps) {
				t.Fatal("typed-nil dependency was registered")
			}
			if _, err := reg.Lookup(qltbyt.AppID, qltbyt.CapabilityID, qltbyt.Version); err == nil {
				t.Fatal("typed-nil dependency became visible")
			}
		})
	}
}

func TestRegisterQLTBYTRegistersTheRealTupleOnlyWhenComplete(t *testing.T) {
	reg := registry.New()
	if !RegisterQLTBYT(reg, Dependencies{
		Broker:       &fakeBroker{},
		Query:        &fakeQuery{},
		BrokerSecret: []byte("secret"),
	}) {
		t.Fatal("complete dependency tuple was not registered")
	}
	if _, err := reg.Lookup(qltbyt.AppID, qltbyt.CapabilityID, qltbyt.Version); err != nil {
		t.Fatal(err)
	}
}

func TestRegisterAssistantWithEndpointStaysUnreadyWithoutQueryExecutor(t *testing.T) {
	server := httptest.NewServer(nil)
	defer server.Close()
	reg := registry.New()
	if RegisterAssistantWithEndpoint(reg, server.URL, server.Client(), []byte("secret"), nil) {
		t.Fatal("broker-only endpoint was registered")
	}
	if _, err := reg.Lookup(qltbyt.AppID, qltbyt.CapabilityID, qltbyt.Version); err == nil {
		t.Fatal("broker-only endpoint made the tuple visible")
	}
}

type fakeBroker struct{}

func (*fakeBroker) Call(context.Context, qltbyt.Credential, string, json.RawMessage) (json.RawMessage, error) {
	return json.RawMessage(`{}`), nil
}

type fakeQuery struct{}

func (*fakeQuery) Execute(context.Context, qltbyt.QueryCall) (qltbyt.QueryResult, error) {
	return qltbyt.QueryResult{Rows: json.RawMessage(`[]`)}, nil
}
